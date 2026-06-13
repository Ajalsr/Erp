package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var billCollection *mongo.Collection = config.GetCollection(config.DB, "bills")

func generateBillNumber(orgID string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	return nextNumber(ctx, orgID, "bill", billCollection, "billNumber")
}

func CreateBill() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")
		userIDStr := fmt.Sprintf("%v", userID)

		var b models.Bill
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if b.VendorID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Vendor is required"})
			return
		}

		// Approval gate — hold non-draft bills for an approver when the org requires it.
		if b.Status != "draft" {
			title := b.VendorName
			if title == "" {
				title = "Vendor bill"
			}
			if holdForApproval(c, ctx, orgIDStr, userIDStr, "", "bill", "bills", title, b.Totals.GrandTotal, b) {
				return
			}
		}

		id, num, err := createBillCore(ctx, orgIDStr, userIDStr, b)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create bill", "error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Bill created successfully",
			"data":    gin.H{"id": id, "billNumber": num},
		})
	}
}

// createBillCore performs the actual bill creation + GL/vendor side-effects. Called by
// the handler directly, or by the approval flow when a held bill is approved.
func createBillCore(ctx context.Context, orgIDStr, userIDStr string, b models.Bill) (string, string, error) {
	b.ID = primitive.NewObjectID()
	b.OrgID = orgIDStr
	b.CreatedAt = time.Now()
	b.UpdatedAt = time.Now()
	if userIDStr != "" {
		b.CreatedBy = userIDStr
	}
	if b.BillNumber == "" {
		b.BillNumber = generateBillNumber(orgIDStr)
	}
	if b.Status == "" {
		b.Status = "open"
	}
	b.AmountPaid = 0
	b.BalanceDue = b.Totals.GrandTotal

	// Multi-currency: freeze the txn→base rate and compute base totals, so the GL
	// posts in base currency and reports stay single-currency.
	fxRate := applyBillFX(ctx, &b)

	// Insert bill
	if _, err := billCollection.InsertOne(ctx, b); err != nil {
		return "", "", err
	}

	{
		// Journal entry (posted in base currency):
		//   GRN-linked bill (goods received into stock) → capitalise landed cost to
		//     Inventory (1200); COGS is recognised later, at sale (deductStockOnDispatch).
		//   Non-GRN bill (rent, utilities, services) → expense straight to COGS (5000).
		// VAT Input (5500) is the recoverable tax; the credit clears Accounts Payable.
		if b.Status != "draft" && b.Totals.GrandTotal > 0 {
			goodsAccount := "5000" // expense (default)
			if b.GRNID != "" {
				goodsAccount = "1200" // inventory asset — goods received into stock
			} else if code := resolveAccountCode(ctx, b.OrgID, b.ExpenseAccount); code != "" {
				goodsAccount = code // user-chosen expense account for this bill
			}
			go autoJE(b.OrgID, "bill", b.ID.Hex(), b.BillNumber, b.BillDate,
				"Bill received - "+b.BillNumber,
				scaleJELines([]jeLineInput{
					// Goods + freight + shipping + adjustment (everything except recoverable VAT)
					{AccountCode: goodsAccount, Debit: b.Totals.GrandTotal - b.Totals.TaxTotal},
					{AccountCode: "5500", Debit: b.Totals.TaxTotal},
					{AccountCode: "2000", Credit: b.Totals.GrandTotal},
				}, fxRate))
		}

		// Mark linked GRN as billed + spin off separate payee charge bills (customs etc.)
		if b.GRNID != "" {
			if grnObjID, err := primitive.ObjectIDFromHex(b.GRNID); err == nil {
				grnCollection.UpdateOne(ctx,
					bson.M{"_id": grnObjID, "orgId": orgIDStr},
					bson.M{"$set": bson.M{"status": "billed", "billId": b.ID.Hex(), "updatedAt": time.Now()}},
				)
				if b.Status != "draft" {
					generatePayeeChargeBills(ctx, orgIDStr, userIDStr, grnObjID, b)
				}
			}
		}

		// Update vendor outstanding payable + push history
		if b.VendorID != "" && b.Status != "draft" {
			vendorFilter := bson.M{"orgId": orgIDStr}
			if vObjID, err := primitive.ObjectIDFromHex(b.VendorID); err == nil {
				vendorFilter["_id"] = vObjID
			}
			histEntry := bson.M{
				"action":    "bill_created",
				"timestamp": time.Now(),
				"user":      b.CreatedBy,
				"details":   fmt.Sprintf("Bill %s created. Amount: AED %.2f. Due: %s", b.BillNumber, b.Totals.GrandTotal, b.DueDate),
			}
			vendorCollection.UpdateOne(ctx, vendorFilter, bson.M{
				"$inc":  bson.M{"outstandingPayable": b.Totals.GrandTotal},
				"$push": bson.M{"history": histEntry},
				"$set":  bson.M{"updatedAt": time.Now()},
			})
		}
	}

	return b.ID.Hex(), b.BillNumber, nil
}

// generatePayeeChargeBills reads the GRN's landed-cost charges and, for every charge
// that names a separate payee (customs authority, clearing agent, freight forwarder),
// creates its own bill addressed to that payee. These bills are created already PAID
// (the duty/clearing is settled on clearance), so they carry status "paid", zero
// balance, and post Cr Bank instead of Cr Accounts Payable — unlike the main vendor
// bill, whose status follows its payment terms. Charges with no payee belong to the
// main vendor and are billed on the main bill, so they are skipped here.
func generatePayeeChargeBills(ctx context.Context, orgIDStr, userIDStr string, grnObjID primitive.ObjectID, mainBill models.Bill) {
	var g models.GRN
	if err := grnCollection.FindOne(ctx, bson.M{"_id": grnObjID, "orgId": orgIDStr}).Decode(&g); err != nil {
		return
	}

	today := time.Now().Format("2006-01-02")
	for idx, ch := range g.Charges {
		// Only payee-directed charges that haven't been billed yet.
		if ch.PayeeVendorID == "" || ch.PayeeVendorID == g.VendorID || ch.BillID != "" {
			continue
		}

		label := ch.Label
		if label == "" {
			label = "Other charge"
		}

		bill := models.Bill{
			ID:             primitive.NewObjectID(),
			BillNumber:     generateBillNumber(orgIDStr),
			BillDate:       today,
			DueDate:        today,
			AccountingDate: today,
			VendorID:       ch.PayeeVendorID,
			VendorName:     ch.PayeeVendorName,
			PlaceOfSupply:  mainBill.PlaceOfSupply,
			GRNID:          g.ID.Hex(),
			GRNNumber:      g.GRNNumber,
			PONumber:       g.PONumber,
			LineItems: []models.BillLineItem{{
				ID:          primitive.NewObjectID(),
				Description: label,
				Qty:         1,
				UnitPrice:   ch.Amount,
				TaxRate:     ch.TaxRate,
				TaxAmt:      ch.TaxAmount,
				Subtotal:    ch.Amount,
				Total:       ch.Total,
			}},
			Totals: models.BillTotals{
				Subtotal:   ch.Amount,
				TaxTotal:   ch.TaxAmount,
				GrandTotal: ch.Total,
			},
			// Created already settled.
			Status:     "paid",
			AmountPaid: ch.Total,
			BalanceDue: 0,
			Notes:      fmt.Sprintf("Auto-generated from GRN %s — %s (paid on clearance)", g.GRNNumber, label),
			OrgID:      orgIDStr,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
			CreatedBy:  userIDStr,
		}

		if _, err := billCollection.InsertOne(ctx, bill); err != nil {
			continue
		}

		// GL: goods/duty leg (capitalise to Inventory or expense), recoverable VAT,
		// credit Bank since the charge is paid immediately.
		goodsAccount := "5000"
		if ch.Capitalise {
			goodsAccount = "1200"
		}
		payAccount := ch.PaymentAccount
		if payAccount == "" {
			payAccount = "1002" // Bank
		}
		go autoJE(orgIDStr, "bill", bill.ID.Hex(), bill.BillNumber, bill.BillDate,
			"Charge bill (paid) - "+bill.BillNumber,
			[]jeLineInput{
				{AccountCode: goodsAccount, Debit: ch.Amount},
				{AccountCode: "5500", Debit: ch.TaxAmount},
				{AccountCode: payAccount, Credit: ch.Total},
			})

		// Stamp the charge with its bill id so re-billing the GRN can't duplicate it.
		grnCollection.UpdateOne(ctx,
			bson.M{"_id": grnObjID, "orgId": orgIDStr},
			bson.M{"$set": bson.M{
				fmt.Sprintf("charges.%d.billId", idx): bill.ID.Hex(),
				"updatedAt":                           time.Now(),
			}},
		)

		// Reflect the bill on the payee vendor's profile (history). It is already paid,
		// so outstanding payable is left untouched.
		if vObjID, err := primitive.ObjectIDFromHex(ch.PayeeVendorID); err == nil {
			vendorCollection.UpdateOne(ctx,
				bson.M{"_id": vObjID, "orgId": orgIDStr},
				bson.M{
					"$push": bson.M{"history": bson.M{
						"action":    "bill_created",
						"timestamp": time.Now(),
						"user":      userIDStr,
						"details":   fmt.Sprintf("Charge bill %s (PAID) created from GRN %s for %s. Amount: AED %.2f", bill.BillNumber, g.GRNNumber, label, ch.Total),
					}},
					"$set": bson.M{"updatedAt": time.Now()},
				},
			)
		}
	}
}

func GetAllBills() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if vid := c.Query("vendorId"); vid != "" {
			filter["vendorId"] = vid
		}
		if poid := c.Query("purchaseOrderId"); poid != "" {
			filter["purchaseOrderId"] = poid
		}
		if grnid := c.Query("grnId"); grnid != "" {
			filter["grnId"] = grnid
		}

		total, _ := billCollection.CountDocuments(ctx, filter)

		limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "50"), 10, 64)
		if limit < 1 || limit > 200 {
			limit = 50
		}
		page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
		if page < 1 {
			page = 1
		}
		skip := (page - 1) * limit

		opts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetSkip(skip).
			SetLimit(limit)
		cursor, err := billCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch bills"})
			return
		}
		defer cursor.Close(ctx)

		var bills []models.Bill
		if err := cursor.All(ctx, &bills); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode bills"})
			return
		}
		if bills == nil {
			bills = []models.Bill{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Bills retrieved successfully",
			"data":    gin.H{"bills": bills, "total": total},
		})
	}
}

func GetBillByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid bill ID"})
			return
		}

		var b models.Bill
		err = billCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&b)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Bill not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve bill"})
			}
			return
		}
		// Record scope: "own" roles may only open bills they created.
		if uid, _, ownOnly := recordScope(c, "bills", "view"); ownOnly && b.CreatedBy != uid {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You can only view bills you created"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Bill retrieved", "data": b})
	}
}

func UpdateBillStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid bill ID"})
			return
		}

		var body struct {
			Status string `json:"status"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Status == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Status is required"})
			return
		}

		validStatuses := map[string]bool{"draft": true, "open": true, "partial": true, "paid": true, "overdue": true, "void": true}
		if !validStatuses[body.Status] {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid status"})
			return
		}

		// Guard: a settled bill (any payment or applied credit) cannot be voided —
		// the payments/credits must be reversed first or the ledger goes out of balance.
		if body.Status == "void" {
			var existing models.Bill
			if err := billCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&existing); err == nil {
				if existing.Status == "paid" || existing.AmountPaid > 0 {
					c.JSON(http.StatusBadRequest, gin.H{
						"status":  http.StatusBadRequest,
						"message": "Cannot void a bill that has payments or applied credits. Reverse them first.",
						"code":    "BILL_SETTLED",
					})
					return
				}
			}
		}

		result, err := billCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": bson.M{"status": body.Status, "updatedAt": time.Now()}},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Bill not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Bill status updated"})
	}
}

// ConvertPOToBill creates a draft bill pre-filled from a purchase order
func ConvertPOToBill() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		poObjID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid PO ID"})
			return
		}

		var po models.PurchaseOrder
		if err := purchaseOrderCollection.FindOne(ctx, bson.M{"_id": poObjID, "orgId": orgIDStr}).Decode(&po); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Purchase order not found"})
			return
		}

		// Goods POs must flow through GRN → bill, not directly
		if po.POType == "" || po.POType == "goods" {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Goods POs must be billed via a confirmed GRN. Open the GRN and click 'Create Bill' from there.",
				"code":    "REQUIRES_GRN",
			})
			return
		}

		// Prevent duplicate bills for the same PO
		existingCount, _ := billCollection.CountDocuments(ctx, bson.M{
			"orgId":           orgIDStr,
			"purchaseOrderId": c.Param("id"),
		})
		if existingCount > 0 {
			c.JSON(http.StatusConflict, gin.H{
				"status":  http.StatusConflict,
				"message": "A bill already exists for this purchase order.",
				"code":    "DUPLICATE_BILL",
			})
			return
		}

		// Fetch vendor TRN
		vendorTRN := ""
		if po.VendorID != "" {
			if vObjID, err2 := primitive.ObjectIDFromHex(po.VendorID); err2 == nil {
				var v struct {
					TRN    string `bson:"trn"`
					Origin string `bson:"origin"`
				}
				vendorCollection.FindOne(ctx, bson.M{"_id": vObjID}).Decode(&v)
				vendorTRN = v.TRN
			}
		}

		// Convert PO items to bill line items
		var lineItems []models.BillLineItem
		var subtotal, taxTotal float64
		for _, item := range po.Items {
			base := round2(item.BaseAmount)
			tax := round2(item.TaxAmount)
			lineItems = append(lineItems, models.BillLineItem{
				ID:          primitive.NewObjectID(),
				Description: item.Details,
				Qty:         item.Quantity,
				UnitPrice:   item.Rate,
				TaxRate:     item.TaxRate,
				Discount:    item.Discount,
				DiscountAmt: 0,
				TaxAmt:      tax,
				Subtotal:    base,
				Total:       round2(base + tax),
			})
			subtotal += base
			taxTotal += tax
		}
		subtotal = round2(subtotal)
		taxTotal = round2(taxTotal)
		grandTotal := round2(subtotal + taxTotal)

		now := time.Now()
		billDate := now.Format("2006-01-02")
		// default 30-day due
		dueDate := now.AddDate(0, 0, 30).Format("2006-01-02")

		normOrigin := normaliseOrigin(po.VendorOrigin)
		rcm := normOrigin == "free_zone" || normOrigin == "overseas"
		rcmType := ""
		if normOrigin == "overseas" {
			rcmType = "import"
		} else if normOrigin == "free_zone" {
			rcmType = "designated_zone"
		}
		rcmOutputVAT := 0.0
		rcmInputVAT := 0.0
		if rcm {
			rcmOutputVAT = round2(subtotal * 0.05)
			rcmInputVAT = rcmOutputVAT
		}

		bill := models.Bill{
			ID:                  primitive.NewObjectID(),
			BillNumber:          generateBillNumber(orgIDStr),
			BillDate:            billDate,
			DueDate:             dueDate,
			AccountingDate:      billDate,
			VendorID:            po.VendorID,
			VendorName:          po.VendorName,
			VendorTRN:           vendorTRN,
			PlaceOfSupply:       "Dubai",
			RCMApplicable:       rcm,
			RCMType:             rcmType,
			RCMOutputVAT:        rcmOutputVAT,
			RCMInputVAT:         rcmInputVAT,
			PurchaseOrderID:     po.ID.Hex(),
			PONumber:            po.OrderNumber,
			ThreeWayMatchStatus: "pending",
			LineItems:           lineItems,
			Totals: models.BillTotals{
				Subtotal:      subtotal,
				DiscountTotal: 0,
				TaxTotal:      taxTotal,
				GrandTotal:    grandTotal,
			},
			AmountPaid:   0,
			BalanceDue:   grandTotal,
			PaymentTerms: string(po.PaymentTerms),
			Status:       "open",
			OrgID:        orgIDStr,
			CreatedAt:    now,
			UpdatedAt:    now,
			CreatedBy:    fmt.Sprintf("%v", userID),
		}

		if _, err := billCollection.InsertOne(ctx, bill); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create bill", "error": err.Error()})
			return
		}

		// Update vendor outstanding payable
		if po.VendorID != "" {
			vendorFilter := bson.M{"orgId": orgIDStr}
			if vObjID, err2 := primitive.ObjectIDFromHex(po.VendorID); err2 == nil {
				vendorFilter["_id"] = vObjID
			}
			histEntry := bson.M{
				"action":    "bill_created",
				"timestamp": now,
				"user":      fmt.Sprintf("%v", userID),
				"details":   fmt.Sprintf("Bill %s created from service PO %s. Amount: AED %.2f", bill.BillNumber, po.OrderNumber, grandTotal),
			}
			vendorCollection.UpdateOne(ctx, vendorFilter, bson.M{
				"$inc":  bson.M{"outstandingPayable": grandTotal},
				"$push": bson.M{"history": histEntry},
				"$set":  bson.M{"updatedAt": now},
			})
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Bill created from purchase order",
			"data":    gin.H{"id": bill.ID.Hex(), "billNumber": bill.BillNumber},
		})
	}
}

// UpdateBill edits a draft/open bill's details
func UpdateBill() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid bill ID"})
			return
		}

		var b models.Bill
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}

		// Fetch existing bill to preserve amountPaid and recompute balance/status
		var existing models.Bill
		if err := billCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&existing); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Bill not found"})
			return
		}
		// Record scope: when the caller's scope is "own", only the creator may edit.
		if uid, _, ownOnly := recordScope(c, "bills", "edit"); ownOnly && existing.CreatedBy != uid {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You can only edit bills you created"})
			return
		}
		if existing.Status == "void" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Voided bills cannot be edited"})
			return
		}

		// Approval gate — hold the edit for an approver when the org requires it.
		if !c.GetBool("approvalReplay") {
			userID, _ := c.Get("userId")
			title := existing.VendorName
			if title == "" {
				title = "Vendor bill"
			}
			if holdActionForApproval(c, ctx, orgIDStr, fmt.Sprintf("%v", userID), "", "bill", "update", "bills", title, b.Totals.GrandTotal, c.Param("id"), b) {
				return
			}
		}

		paid       := existing.AmountPaid
		newBalance := b.Totals.GrandTotal - paid
		if newBalance < 0 {
			newBalance = 0
		}
		newStatus := "open"
		if paid > 0 && newBalance > 0 {
			newStatus = "partial"
		} else if newBalance <= 0 && paid > 0 {
			newStatus = "paid"
		}

		// Adjust vendor outstandingPayable by the grand-total delta
		delta := b.Totals.GrandTotal - existing.Totals.GrandTotal

		update := bson.M{
			"billDate":            b.BillDate,
			"dueDate":             b.DueDate,
			"accountingDate":      b.AccountingDate,
			"vendorRef":           b.VendorRef,
			"vendorTrn":           b.VendorTRN,
			"placeOfSupply":       b.PlaceOfSupply,
			"rcmApplicable":       b.RCMApplicable,
			"rcmType":             b.RCMType,
			"rcmOutputVat":        b.RCMOutputVAT,
			"rcmInputVat":         b.RCMInputVAT,
			"paymentTerms":        b.PaymentTerms,
			"lineItems":           b.LineItems,
			"totals":              b.Totals,
			"balanceDue":          newBalance,
			"status":              newStatus,
			"notes":               b.Notes,
			"threeWayMatchStatus": b.ThreeWayMatchStatus,
			"updatedAt":           time.Now(),
		}

		result, err := billCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr, "status": bson.M{"$nin": []string{"void"}}},
			bson.M{"$set": update},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Bill not found or not editable"})
			return
		}

		// Sync vendor outstandingPayable if total changed
		if delta != 0 && existing.VendorID != "" {
			if vObjID, err := primitive.ObjectIDFromHex(existing.VendorID); err == nil {
				vendorCollection.UpdateOne(ctx,
					bson.M{"_id": vObjID, "orgId": orgIDStr},
					bson.M{"$inc": bson.M{"outstandingPayable": delta}, "$set": bson.M{"updatedAt": time.Now()}},
				)
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Bill updated"})
	}
}

// VoidBill voids a bill and reverses the vendor outstanding payable
func VoidBill() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid bill ID"})
			return
		}

		var b models.Bill
		if err := billCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&b); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Bill not found"})
			return
		}
		if b.Status == "paid" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Cannot void a paid bill"})
			return
		}

		// Approval gate — hold the void/delete for an approver when the org requires it.
		if !c.GetBool("approvalReplay") {
			userID, _ := c.Get("userId")
			title := b.VendorName
			if title == "" {
				title = "Vendor bill"
			}
			if holdActionForApproval(c, ctx, orgIDStr, fmt.Sprintf("%v", userID), "", "bill", "delete", "bills", title, b.Totals.GrandTotal, c.Param("id"), nil) {
				return
			}
		}

		billCollection.UpdateOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": bson.M{"status": "void", "updatedAt": time.Now()}},
		)

		// Reverse vendor outstanding payable
		if b.VendorID != "" && b.Status != "draft" && b.BalanceDue > 0 {
			if vObjID, err2 := primitive.ObjectIDFromHex(b.VendorID); err2 == nil {
				vendorCollection.UpdateOne(ctx,
					bson.M{"_id": vObjID, "orgId": orgIDStr},
					bson.M{"$inc": bson.M{"outstandingPayable": -b.BalanceDue}, "$set": bson.M{"updatedAt": time.Now()}},
				)
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Bill voided"})
	}
}

// GetVendorAging returns vendor aging buckets (0-30, 31-60, 61-90, 90+ days overdue)
func GetVendorAging() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		cursor, err := billCollection.Find(ctx, bson.M{
			"orgId":  orgIDStr,
			"status": bson.M{"$in": []string{"open", "partial", "overdue"}},
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch bills"})
			return
		}
		defer cursor.Close(ctx)

		var bills []models.Bill
		cursor.All(ctx, &bills)

		type VendorRow struct {
			VendorID   string
			VendorName string
			Current    float64 // not yet due
			Days1_30   float64
			Days31_60  float64
			Days61_90  float64
			Days90Plus float64
			Total      float64
		}

		rows := map[string]*VendorRow{}
		today := time.Now().Truncate(24 * time.Hour)

		for _, b := range bills {
			bal := b.BalanceDue
			if bal <= 0 {
				continue
			}
			due, err2 := time.Parse("2006-01-02", b.DueDate)
			if err2 != nil {
				due = today
			}
			daysPast := int(today.Sub(due).Hours() / 24)

			row, exists := rows[b.VendorID]
			if !exists {
				row = &VendorRow{VendorID: b.VendorID, VendorName: b.VendorName}
				rows[b.VendorID] = row
			}
			row.Total += bal

			switch {
			case daysPast <= 0:
				row.Current += bal
			case daysPast <= 30:
				row.Days1_30 += bal
			case daysPast <= 60:
				row.Days31_60 += bal
			case daysPast <= 90:
				row.Days61_90 += bal
			default:
				row.Days90Plus += bal
			}
		}

		result := make([]gin.H, 0, len(rows))
		grandCurrent, grand30, grand60, grand90, grand90p, grandTotal := 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
		for _, r := range rows {
			result = append(result, gin.H{
				"vendorId":   r.VendorID,
				"vendorName": r.VendorName,
				"current":    round2(r.Current),
				"1_30":       round2(r.Days1_30),
				"31_60":      round2(r.Days31_60),
				"61_90":      round2(r.Days61_90),
				"90_plus":    round2(r.Days90Plus),
				"total":      round2(r.Total),
			})
			grandCurrent += r.Current
			grand30 += r.Days1_30
			grand60 += r.Days31_60
			grand90 += r.Days61_90
			grand90p += r.Days90Plus
			grandTotal += r.Total
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"rows": result,
				"summary": gin.H{
					"current": round2(grandCurrent),
					"1_30":    round2(grand30),
					"31_60":   round2(grand60),
					"61_90":   round2(grand90),
					"90_plus": round2(grand90p),
					"total":   round2(grandTotal),
				},
			},
		})
	}
}

func GetBillStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgIDStr}}},
			{{Key: "$group", Value: bson.M{
				"_id":        "$status",
				"count":      bson.M{"$sum": 1},
				"grandTotal": bson.M{"$sum": "$totals.grandTotal"},
				"balanceDue": bson.M{"$sum": "$balanceDue"},
				"amountPaid": bson.M{"$sum": "$amountPaid"},
			}}},
		}

		cursor, err := billCollection.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Stats failed"})
			return
		}
		defer cursor.Close(ctx)

		var results []bson.M
		cursor.All(ctx, &results)

		byStatus := map[string]gin.H{}
		totalPayable := 0.0
		totalCount := int64(0)

		for _, r := range results {
			status, _ := r["_id"].(string)
			count, _ := r["count"].(int32)
			bal, _ := r["balanceDue"].(float64)
			total, _ := r["grandTotal"].(float64)
			paid, _ := r["amountPaid"].(float64)

			byStatus[status] = gin.H{
				"count":      count,
				"grandTotal": total,
				"balanceDue": bal,
				"amountPaid": paid,
			}
			totalCount += int64(count)
			if status != "void" && status != "paid" {
				totalPayable += bal
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"byStatus":     byStatus,
				"totalPayable": totalPayable,
				"totalCount":   totalCount,
			},
		})
	}
}
