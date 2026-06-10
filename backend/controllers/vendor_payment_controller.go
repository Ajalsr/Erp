package controllers

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var vendorPaymentCollection *mongo.Collection = config.GetCollection(config.DB, "vendor_payments")

func generateVendorPaymentNumber() string {
	now := time.Now()
	return fmt.Sprintf("VPAY-%d%02d-%04d", now.Year(), now.Month(), rand.Intn(9000)+1000)
}

func CreateVendorPayment() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr  := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var p models.VendorPayment
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if p.Amount <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Amount must be greater than 0"})
			return
		}
		if p.VendorID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Vendor is required"})
			return
		}

		// Approval gate — hold the payment for an approver when the org requires it.
		if !c.GetBool("approvalReplay") {
			title := p.VendorName
			if title == "" {
				title = "Vendor payment"
			}
			if holdForApproval(c, ctx, orgIDStr, fmt.Sprintf("%v", userID), "", "vendor_payment", "vendor_payments", title, p.Amount, p) {
				return
			}
		}

		p.ID = primitive.NewObjectID()
		p.OrgID = orgIDStr
		p.CreatedAt = time.Now()
		p.UpdatedAt = time.Now()
		if userID != nil {
			p.CreatedBy = fmt.Sprintf("%v", userID)
		}
		if p.PaymentNumber == "" {
			p.PaymentNumber = generateVendorPaymentNumber()
		}
		if p.Date == "" {
			p.Date = time.Now().Format("2006-01-02")
		}

		// Resolve the paid-through cash/bank account chosen by the user (id or code);
		// fall back to 1001 Cash on Hand to preserve legacy behaviour.
		bankCode := resolveAccountCode(ctx, orgIDStr, p.PaidThroughAccount)
		if bankCode == "" {
			bankCode = "1001"
		}

		// ── Multi-bill allocation path ───────────────────────────────────────
		// One paid amount split across several bills (FIFO-filled on the client,
		// editable). Any amount beyond all allocated bills becomes credit on the
		// vendor's account (creditAvailable / Vendor Advances), never a debit note.
		if len(p.Allocations) > 0 {
			type jePart struct {
				ccy    string
				rate   float64
				amount float64
			}
			var parts []jePart
			var totalApplied float64

			for i := range p.Allocations {
				al := p.Allocations[i]
				billObjID, err := primitive.ObjectIDFromHex(al.BillID)
				if err != nil {
					continue
				}
				var b models.Bill
				if billCollection.FindOne(ctx, bson.M{"_id": billObjID, "orgId": orgIDStr}).Decode(&b) != nil {
					continue
				}
				bal := b.Totals.GrandTotal - b.AmountPaid
				if bal < 0 {
					bal = 0
				}
				applied := al.Amount
				if applied > bal {
					applied = bal // never over-apply a single bill
				}
				if applied <= 0 {
					continue
				}
				newPaid := b.AmountPaid + applied
				newBalance := b.Totals.GrandTotal - newPaid
				if newBalance < 0 {
					newBalance = 0
				}
				newStatus := "partial"
				if newBalance <= 0 {
					newStatus = "paid"
				}
				billCollection.UpdateOne(ctx, bson.M{"_id": billObjID, "orgId": orgIDStr}, bson.M{"$set": bson.M{
					"amountPaid": newPaid,
					"balanceDue": newBalance,
					"status":     newStatus,
					"updatedAt":  time.Now(),
				}})

				rate := 1.0
				if b.ExchangeRate > 0 {
					rate = b.ExchangeRate
				}
				parts = append(parts, jePart{ccy: b.Currency, rate: rate, amount: applied})
				p.Allocations[i].Amount = applied
				p.Allocations[i].BillNumber = b.BillNumber
				totalApplied += applied
				if p.VendorName == "" {
					p.VendorName = b.VendorName
				}
			}

			totalApplied = round2(totalApplied)
			excess := round2(p.Amount - totalApplied)
			if excess < 0 {
				excess = 0
			}
			p.ExcessCredit = excess
			p.BillID = ""
			p.BillNumber = ""

			// Vendor: applied portion reduces payable; excess becomes credit on account.
			if vObjID, err := primitive.ObjectIDFromHex(p.VendorID); err == nil {
				inc := bson.M{"outstandingPayable": -totalApplied}
				if excess > 0 {
					inc["creditAvailable"] = excess
				}
				histNote := fmt.Sprintf("Payment AED %.2f recorded (%s) across %d bill(s). Ref: %s", p.Amount, p.PaymentMode, len(parts), p.Reference)
				if excess > 0 {
					histNote += fmt.Sprintf(" Excess AED %.2f added to credit available.", excess)
				}
				vendorCollection.UpdateOne(ctx, bson.M{"_id": vObjID, "orgId": orgIDStr}, bson.M{
					"$inc": inc,
					"$push": bson.M{"history": bson.M{
						"action":    "payment_made",
						"timestamp": time.Now(),
						"user":      p.CreatedBy,
						"details":   histNote,
					}},
					"$set": bson.M{"updatedAt": time.Now()},
				})
			}

			if _, err := vendorPaymentCollection.InsertOne(ctx, p); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to record payment", "error": err.Error()})
				return
			}

			// GL: one balanced entry per bill (DR AP / CR Bank + FX gain/loss),
			// plus the excess as DR Vendor Advances (1350) / CR Bank.
			for _, pt := range parts {
				lines := buildVendorPaymentJE(ctx, p.OrgID, bankCode, pt.amount, pt.ccy, pt.rate, p.Date)
				go autoJE(p.OrgID, "vendor_payment", p.ID.Hex(), p.PaymentNumber, p.Date,
					"Vendor payment - "+p.PaymentNumber, lines)
			}
			if excess > 0 {
				go autoJE(p.OrgID, "vendor_payment", p.ID.Hex(), p.PaymentNumber, p.Date,
					"Vendor advance (overpayment) - "+p.PaymentNumber,
					[]jeLineInput{
						{AccountCode: "1350", Debit: excess},
						{AccountCode: bankCode, Credit: excess},
					})
			}

			c.JSON(http.StatusCreated, gin.H{
				"status":  http.StatusCreated,
				"message": "Vendor payment recorded successfully",
				"data": gin.H{
					"id":            p.ID.Hex(),
					"paymentNumber": p.PaymentNumber,
					"applied":       totalApplied,
					"excessCredit":  excess,
				},
			})
			return
		}

		// Bill currency + frozen rate, captured for the FX-aware payment JE below.
		billCurrency := ""
		billRate := 1.0

		// ── 1. Apply to linked bill ──────────────────────────────────────────
		overpayment := 0.0
		if p.BillID != "" {
			billObjID, err := primitive.ObjectIDFromHex(p.BillID)
			if err == nil {
				var b models.Bill
				err = billCollection.FindOne(ctx, bson.M{"_id": billObjID, "orgId": orgIDStr}).Decode(&b)
				if err == nil {
					billCurrency = b.Currency
					if b.ExchangeRate > 0 {
						billRate = b.ExchangeRate
					}
					newPaid    := b.AmountPaid + p.Amount
					newBalance := b.Totals.GrandTotal - newPaid
					if newBalance < 0 {
						// Overpayment — excess goes to creditAvailable on vendor.
						// Cap amountPaid at the grand total so the bill never shows
						// "Paid X of Y" with X > Y (the ledger stays balanced).
						overpayment = -newBalance
						newBalance  = 0
						newPaid     = b.Totals.GrandTotal
					}
					newStatus := "partial"
					if newBalance <= 0 {
						newStatus = "paid"
					}
					billCollection.UpdateOne(ctx, bson.M{"_id": billObjID, "orgId": orgIDStr}, bson.M{
						"$set": bson.M{
							"amountPaid": newPaid,
							"balanceDue": newBalance,
							"status":     newStatus,
							"updatedAt":  time.Now(),
						},
					})
					if p.BillNumber == "" { p.BillNumber = b.BillNumber }
					if p.VendorName == "" { p.VendorName = b.VendorName }
				}
			}
		}

		// ── 2. Update vendor: reduce payable, add overpayment to creditAvailable, push history ──
		if p.VendorID != "" {
			if vObjID, err := primitive.ObjectIDFromHex(p.VendorID); err == nil {
				incFields := bson.M{"outstandingPayable": -p.Amount}
				if overpayment > 0 {
					incFields["creditAvailable"] = overpayment
				}
				histNote := fmt.Sprintf("Payment AED %.2f recorded (%s). Bill: %s. Ref: %s", p.Amount, p.PaymentMode, p.BillNumber, p.Reference)
				if overpayment > 0 {
					histNote += fmt.Sprintf(" Overpayment AED %.2f added to credit available.", overpayment)
				}
				histEntry := bson.M{
					"action":    "payment_made",
					"timestamp": time.Now(),
					"user":      p.CreatedBy,
					"details":   histNote,
				}
				vendorCollection.UpdateOne(ctx,
					bson.M{"_id": vObjID, "orgId": orgIDStr},
					bson.M{
						"$inc":  incFields,
						"$push": bson.M{"history": histEntry},
						"$set":  bson.M{"updatedAt": time.Now()},
					},
				)
			}
		}

		// ── 3. Insert payment record ─────────────────────────────────────────
		p.ExcessCredit = round2(overpayment)
		if _, err := vendorPaymentCollection.InsertOne(ctx, p); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to record payment", "error": err.Error()})
			return
		}

		// Journal entry: DR Accounts Payable / CR Bank/Cash for the applied portion
		// (FX-aware), plus any overpayment as DR Vendor Advances (1350) / CR Bank.
		applied := round2(p.Amount - overpayment)
		if applied > 0 {
			go autoJE(p.OrgID, "vendor_payment", p.ID.Hex(), p.PaymentNumber, p.Date,
				"Vendor payment - "+p.BillNumber,
				buildVendorPaymentJE(ctx, p.OrgID, bankCode, applied, billCurrency, billRate, p.Date))
		}
		if overpayment > 0 {
			go autoJE(p.OrgID, "vendor_payment", p.ID.Hex(), p.PaymentNumber, p.Date,
				"Vendor advance (overpayment) - "+p.PaymentNumber,
				[]jeLineInput{
					{AccountCode: "1350", Debit: overpayment},
					{AccountCode: bankCode, Credit: overpayment},
				})
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Vendor payment recorded successfully",
			"data":    gin.H{"id": p.ID.Hex(), "paymentNumber": p.PaymentNumber},
		})
	}
}

func GetAllVendorPayments() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr  := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if vid := c.Query("vendorId"); vid != "" {
			filter["vendorId"] = vid
		}
		billFilterID := c.Query("billId")
		if billFilterID != "" {
			// A multi-bill payment links bills via allocations[], not the top-level
			// billId — match both so the bill drawer's Payments tab finds it.
			filter["$or"] = []bson.M{
				{"billId": billFilterID},
				{"allocations.billId": billFilterID},
			}
		}

		total, _ := vendorPaymentCollection.CountDocuments(ctx, filter)

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := vendorPaymentCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch vendor payments"})
			return
		}
		defer cursor.Close(ctx)

		var payments []models.VendorPayment
		if err := cursor.All(ctx, &payments); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode payments"})
			return
		}
		if payments == nil {
			payments = []models.VendorPayment{}
		}

		// When listing a single bill's payments, surface the portion applied to THAT
		// bill (its allocation) rather than the full multi-bill payment amount.
		if billFilterID != "" {
			for i := range payments {
				for _, al := range payments[i].Allocations {
					if al.BillID == billFilterID {
						payments[i].Amount = al.Amount
						payments[i].BillID = al.BillID
						payments[i].BillNumber = al.BillNumber
						break
					}
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Vendor payments retrieved successfully",
			"data":    gin.H{"payments": payments, "total": total},
		})
	}
}

func GetVendorPaymentByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid payment ID"})
			return
		}

		var p models.VendorPayment
		err = vendorPaymentCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&p)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Payment not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve payment"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Payment retrieved", "data": p})
	}
}

// POST /api/vendor-payments/:id/reverse
func ReverseVendorPayment() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid payment id"})
			return
		}

		var body struct {
			Notes string `json:"notes"`
		}
		c.ShouldBindJSON(&body)

		var p models.VendorPayment
		if err = vendorPaymentCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&p); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "payment not found"})
			return
		}
		if p.IsReversed {
			c.JSON(http.StatusConflict, gin.H{"message": "payment already reversed"})
			return
		}

		// Mark payment as reversed
		vendorPaymentCollection.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": bson.M{
			"isReversed":    true,
			"reversedAt":    time.Now().Format(time.RFC3339),
			"reversalNotes": body.Notes,
			"updatedAt":     time.Now(),
		}})

		// Restore each bill's balance. restoreBill reverses one bill's portion and
		// returns the amount actually un-applied (so vendor payable is restored by the
		// same total — excess never touched the payable).
		restoreBill := func(billID string, amt float64) float64 {
			billObjID, err := primitive.ObjectIDFromHex(billID)
			if err != nil {
				return 0
			}
			var b models.Bill
			if billCollection.FindOne(ctx, bson.M{"_id": billObjID, "orgId": orgID}).Decode(&b) != nil {
				return 0
			}
			unapplied := round2(amt)
			if unapplied > b.AmountPaid {
				unapplied = b.AmountPaid
			}
			newPaid := round2(b.AmountPaid - unapplied)
			if newPaid < 0 {
				newPaid = 0
			}
			newBalance := round2(b.Totals.GrandTotal - newPaid)
			newStatus := "open"
			if newPaid > 0 {
				newStatus = "partial"
			}
			billCollection.UpdateOne(ctx, bson.M{"_id": billObjID}, bson.M{"$set": bson.M{
				"amountPaid": newPaid,
				"balanceDue": newBalance,
				"status":     newStatus,
				"updatedAt":  time.Now(),
			}})
			return unapplied
		}

		restoredPayable := 0.0
		if len(p.Allocations) > 0 {
			for _, al := range p.Allocations {
				restoredPayable += restoreBill(al.BillID, al.Amount)
			}
		} else if p.BillID != "" {
			// Single-bill: only the applied portion (Amount − excess) hit the payable.
			applied := round2(p.Amount - p.ExcessCredit)
			restoredPayable += restoreBill(p.BillID, applied)
		} else {
			restoredPayable = round2(p.Amount - p.ExcessCredit)
		}
		restoredPayable = round2(restoredPayable)

		// Restore vendor: payable goes back up by the applied total; any excess credit
		// granted by this payment is clawed back from the wallet.
		if p.VendorID != "" {
			vendorFilter := bson.M{"orgId": orgID}
			if vObjID, err := primitive.ObjectIDFromHex(p.VendorID); err == nil {
				vendorFilter["_id"] = vObjID
			}
			inc := bson.M{"outstandingPayable": restoredPayable}
			if p.ExcessCredit > 0 {
				inc["creditAvailable"] = -p.ExcessCredit
			}
			histEntry := bson.M{
				"action":    "payment_reversed",
				"timestamp": time.Now(),
				"details":   fmt.Sprintf("Payment %s of AED %.2f reversed. Bill: %s", p.PaymentNumber, p.Amount, p.BillNumber),
			}
			vendorCollection.UpdateOne(ctx, vendorFilter, bson.M{
				"$inc":  inc,
				"$push": bson.M{"history": histEntry},
				"$set":  bson.M{"updatedAt": time.Now()},
			})
		}

		c.JSON(http.StatusOK, gin.H{"message": "payment reversed successfully"})
	}
}

// ApplyVendorCreditWallet applies a vendor's creditAvailable wallet (built from
// overpayments / vendor credits) to a specific open bill, reducing its balance.
// POST /api/vendors/:id/apply-credit   Body: { billId, amount }
//
// GL: DR Accounts Payable (2000) / CR Vendor Advances (1350).
func ApplyVendorCreditWallet() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")
		userIDStr := fmt.Sprintf("%v", userID)

		vendObjID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid vendor ID"})
			return
		}

		var req struct {
			BillID string  `json:"billId"`
			Amount float64 `json:"amount"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.Amount <= 0 || req.BillID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "billId and amount > 0 required"})
			return
		}

		// ── 1. Fetch vendor, verify sufficient credit ─────────────────────────
		var vend models.Vendor
		if err := vendorCollection.FindOne(ctx, bson.M{"_id": vendObjID, "orgId": orgIDStr}).Decode(&vend); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Vendor not found"})
			return
		}
		if vend.CreditAvailable < req.Amount {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"message":         fmt.Sprintf("Insufficient credit — available: %.2f, requested: %.2f", vend.CreditAvailable, req.Amount),
				"availableCredit": vend.CreditAvailable,
			})
			return
		}

		// ── 2. Fetch bill, verify it belongs to this vendor + has a balance ───
		billObjID, err := primitive.ObjectIDFromHex(req.BillID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid bill ID"})
			return
		}
		var b models.Bill
		if err := billCollection.FindOne(ctx, bson.M{"_id": billObjID, "orgId": orgIDStr}).Decode(&b); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Bill not found"})
			return
		}
		if b.VendorID != c.Param("id") {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Bill does not belong to this vendor"})
			return
		}
		if b.Status == "paid" || b.Status == "void" {
			c.JSON(http.StatusConflict, gin.H{"message": "Cannot apply credit to a " + b.Status + " bill"})
			return
		}

		balanceDue := b.Totals.GrandTotal - b.AmountPaid
		if balanceDue <= 0 {
			c.JSON(http.StatusConflict, gin.H{"message": "Bill has no outstanding balance"})
			return
		}
		apply := req.Amount
		if apply > balanceDue {
			apply = balanceDue
		}
		apply = round2(apply)

		// ── 3. Update bill ────────────────────────────────────────────────────
		newPaid := round2(b.AmountPaid + apply)
		newBalance := round2(b.Totals.GrandTotal - newPaid)
		if newBalance < 0 {
			newBalance = 0
		}
		newStatus := "partial"
		if newBalance <= 0 {
			newStatus = "paid"
		}
		billCollection.UpdateOne(ctx, bson.M{"_id": billObjID, "orgId": orgIDStr}, bson.M{"$set": bson.M{
			"amountPaid": newPaid,
			"balanceDue": newBalance,
			"status":     newStatus,
			"updatedAt":  time.Now(),
		}})

		// ── 4. Decrement vendor creditAvailable + outstandingPayable ──────────
		vendorCollection.UpdateOne(ctx, bson.M{"_id": vendObjID, "orgId": orgIDStr}, bson.M{
			"$inc": bson.M{"creditAvailable": -apply, "outstandingPayable": -apply},
			"$push": bson.M{"history": bson.M{
				"action":    "credit_applied",
				"timestamp": time.Now(),
				"user":      userIDStr,
				"details":   fmt.Sprintf("Credit AED %.2f applied to Bill %s. Bill status: %s.", apply, b.BillNumber, newStatus),
			}},
			"$set": bson.M{"updatedAt": time.Now()},
		})

		// ── 5. Create a payment record for the audit trail ────────────────────
		pmt := models.VendorPayment{
			ID:            primitive.NewObjectID(),
			OrgID:         orgIDStr,
			VendorID:      c.Param("id"),
			VendorName:    vend.DisplayName,
			BillID:        req.BillID,
			BillNumber:    b.BillNumber,
			Amount:        apply,
			PaymentMode:   "Credit Applied",
			PaymentNumber: generateVendorPaymentNumber(),
			Date:          time.Now().Format("2006-01-02"),
			Notes:         "Applied from vendor credit available balance",
			CreatedBy:     userIDStr,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		vendorPaymentCollection.InsertOne(ctx, pmt)

		// ── 6. Journal entry: DR Accounts Payable / CR Vendor Advances ────────
		go autoJE(orgIDStr, "vendor_payment", pmt.ID.Hex(), pmt.PaymentNumber, pmt.Date,
			"Vendor credit applied - "+b.BillNumber,
			[]jeLineInput{
				{AccountCode: "2000", Debit: apply},
				{AccountCode: "1350", Credit: apply},
			})

		c.JSON(http.StatusOK, gin.H{
			"status":          http.StatusOK,
			"message":         fmt.Sprintf("AED %.2f credit applied to bill %s", apply, b.BillNumber),
			"appliedAmount":   apply,
			"billStatus":      newStatus,
			"billBalanceDue":  newBalance,
			"remainingCredit": round2(vend.CreditAvailable - apply),
		})
	}
}

func GetVendorPaymentStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgID}}},
			{{Key: "$group", Value: bson.M{
				"_id":   nil,
				"total": bson.M{"$sum": "$amount"},
				"count": bson.M{"$sum": 1},
			}}},
		}

		cursor, _ := vendorPaymentCollection.Aggregate(ctx, pipeline)
		var results []bson.M
		if cursor != nil {
			cursor.All(ctx, &results)
		}

		total := 0.0
		count := int64(0)
		if len(results) > 0 {
			if v, ok := results[0]["total"].(float64); ok {
				total = v
			}
			if v, ok := results[0]["count"].(int32); ok {
				count = int64(v)
			}
		}

		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		mc, _ := vendorPaymentCollection.Aggregate(ctx, mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgID, "createdAt": bson.M{"$gte": startOfMonth}}}},
			{{Key: "$group", Value: bson.M{"_id": nil, "total": bson.M{"$sum": "$amount"}}}},
		})
		var mr []bson.M
		monthTotal := 0.0
		if mc != nil {
			mc.All(ctx, &mr)
			if len(mr) > 0 {
				if v, ok := mr[0]["total"].(float64); ok {
					monthTotal = v
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"totalPaid":  total,
				"count":      count,
				"thisMonth":  monthTotal,
			},
		})
	}
}
