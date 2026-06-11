package controllers

import (
	"context"
	"fmt"
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

var advancePaymentCollection *mongo.Collection = config.GetCollection(config.DB, "advance_payments")

func generateAdvanceNumber(orgID string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	return nextNumber(ctx, orgID, "advance", advancePaymentCollection, "advanceNumber")
}

// bankAccountCode maps a payment mode to its GL cash/bank account code.
func bankAccountCode(mode string) string {
	switch mode {
	case "Bank Transfer", "bank", "Cheque", "PDC", "Card":
		return "1002" // Bank Account
	default:
		return "1001" // Cash on Hand
	}
}

// CreateAdvancePayment — record money received before an invoice exists.
// GL: DR Bank/Cash / CR Customer Advances (liability).
func CreateAdvancePayment() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var a models.AdvancePayment
		if err := c.ShouldBindJSON(&a); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if a.Amount <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Amount must be greater than 0"})
			return
		}
		if a.CustomerID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Customer is required"})
			return
		}

		a.ID = primitive.NewObjectID()
		a.OrgID = orgIDStr
		a.AdvanceNumber = generateAdvanceNumber(orgIDStr)
		a.AllocatedAmount = 0
		a.RemainingAmount = a.Amount
		a.Status = "unallocated"
		a.Allocations = []models.AdvanceAllocation{}
		a.CreatedAt = time.Now()
		a.UpdatedAt = time.Now()
		if userID != nil {
			a.CreatedBy = fmt.Sprintf("%v", userID)
		}
		if a.Date == "" {
			a.Date = time.Now().Format("2006-01-02")
		}

		if _, err := advancePaymentCollection.InsertOne(ctx, a); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to record advance", "error": err.Error()})
			return
		}

		// Customer history + advance-balance bump (liability owed back/applied later)
		if custObjID, err := primitive.ObjectIDFromHex(a.CustomerID); err == nil {
			histEntry := bson.M{
				"action":    "advance_received",
				"timestamp": time.Now(),
				"user":      a.CreatedBy,
				"details": bson.M{
					"amount":        a.Amount,
					"advanceNumber": a.AdvanceNumber,
					"salesOrder":    a.SalesOrderNumber,
					"paymentMode":   a.PaymentMode,
				},
			}
			customersCollection.UpdateOne(ctx,
				bson.M{"_id": custObjID, "orgId": orgIDStr},
				bson.M{
					"$inc":  bson.M{"advance_balance": a.Amount},
					"$push": bson.M{"history": histEntry},
					"$set":  bson.M{"updated_at": time.Now()},
				},
			)
		}

		// Journal entry: DR Bank/Cash / CR Customer Advances.
		// Use the user-chosen deposit account; fall back to the mode-derived account.
		bankCode := resolveAccountCode(ctx, orgIDStr, a.DepositAccount)
		if bankCode == "" {
			bankCode = bankAccountCode(a.PaymentMode)
		}
		go autoJE(orgIDStr, "advance_payment", a.ID.Hex(), a.AdvanceNumber, a.Date,
			"Advance received - "+a.CustomerName,
			[]jeLineInput{
				{AccountCode: bankCode, Debit: a.Amount},
				{AccountCode: "2400", Credit: a.Amount},
			})

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Advance payment recorded successfully",
			"data":    gin.H{"id": a.ID.Hex(), "advanceNumber": a.AdvanceNumber},
		})
	}
}

func GetAdvancePayments() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if cid := c.Query("customerId"); cid != "" {
			filter["customerId"] = cid
		}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		// "available" → unallocated or partial (has remaining balance)
		if c.Query("available") == "true" {
			filter["status"] = bson.M{"$in": []string{"unallocated", "partial"}}
		}

		total, _ := advancePaymentCollection.CountDocuments(ctx, filter)
		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := advancePaymentCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch advances"})
			return
		}
		defer cursor.Close(ctx)

		var advances []models.AdvancePayment
		cursor.All(ctx, &advances)
		if advances == nil {
			advances = []models.AdvancePayment{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data":   gin.H{"advances": advances, "total": total},
		})
	}
}

func GetAdvancePaymentByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid advance ID"})
			return
		}

		var a models.AdvancePayment
		if err := advancePaymentCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&a); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Advance not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": a})
	}
}

// ApplyAdvanceToInvoice — apply (part of) an advance to an unpaid invoice.
// GL: DR Customer Advances / CR Accounts Receivable. Also writes a Payment
// record so the invoice's Payments tab reflects the applied amount.
func ApplyAdvanceToInvoice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		advObjID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid advance ID"})
			return
		}

		var req struct {
			InvoiceID string  `json:"invoiceId"`
			Amount    float64 `json:"amount"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.InvoiceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invoiceId is required"})
			return
		}

		var adv models.AdvancePayment
		if err := advancePaymentCollection.FindOne(ctx, bson.M{"_id": advObjID, "orgId": orgIDStr}).Decode(&adv); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Advance not found"})
			return
		}
		if adv.RemainingAmount <= 0.005 {
			c.JSON(http.StatusConflict, gin.H{"message": "Advance fully applied"})
			return
		}

		invObjID, err := primitive.ObjectIDFromHex(req.InvoiceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid invoice ID"})
			return
		}
		var inv models.Invoice
		if err := invoiceCollection.FindOne(ctx, bson.M{"_id": invObjID, "orgId": orgIDStr}).Decode(&inv); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Invoice not found"})
			return
		}
		if inv.Type == "proforma" {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"message": "Cannot apply advance to a proforma invoice"})
			return
		}

		// Determine apply amount — capped by both advance remaining and invoice balance
		applyAmt := req.Amount
		if applyAmt <= 0 {
			applyAmt = adv.RemainingAmount
		}
		if applyAmt > adv.RemainingAmount+0.005 {
			applyAmt = adv.RemainingAmount
		}
		if applyAmt > inv.BalanceDue+0.005 {
			applyAmt = inv.BalanceDue
		}
		if applyAmt <= 0.005 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Nothing to apply — invoice already settled"})
			return
		}

		// ── Update invoice paid/balance/status ────────────────────────────────
		newPaid := inv.AmountPaid + applyAmt
		newBalance := inv.Totals.GrandTotal - newPaid
		if newBalance < 0 {
			newBalance = 0
		}
		newStatus := "partial"
		if newBalance <= 0.005 {
			newStatus = "paid"
		}
		invoiceCollection.UpdateOne(ctx, bson.M{"_id": invObjID, "orgId": orgIDStr}, bson.M{"$set": bson.M{
			"amountPaid": newPaid,
			"balanceDue": newBalance,
			"status":     newStatus,
			"updatedAt":  time.Now(),
		}})

		// ── Update advance allocation ─────────────────────────────────────────
		newAllocated := adv.AllocatedAmount + applyAmt
		newRemaining := adv.Amount - newAllocated
		if newRemaining < 0 {
			newRemaining = 0
		}
		advStatus := "partial"
		if newRemaining <= 0.005 {
			advStatus = "applied"
		}
		alloc := models.AdvanceAllocation{
			InvoiceID:     req.InvoiceID,
			InvoiceNumber: inv.InvoiceNumber,
			Amount:        applyAmt,
			Date:          time.Now().Format("2006-01-02"),
			AppliedAt:     time.Now(),
		}
		advancePaymentCollection.UpdateOne(ctx, bson.M{"_id": advObjID, "orgId": orgIDStr}, bson.M{
			"$set":  bson.M{"allocatedAmount": newAllocated, "remainingAmount": newRemaining, "status": advStatus, "updatedAt": time.Now()},
			"$push": bson.M{"allocations": alloc},
		})

		// ── Write a Payment record so the invoice Payments tab shows it ───────
		pmt := models.Payment{
			ID:            primitive.NewObjectID(),
			OrgID:         orgIDStr,
			PaymentNumber: generatePaymentNumber(orgIDStr),
			Date:          time.Now().Format("2006-01-02"),
			CustomerID:    adv.CustomerID,
			CustomerName:  adv.CustomerName,
			InvoiceID:     req.InvoiceID,
			InvoiceNumber: inv.InvoiceNumber,
			Amount:        applyAmt,
			PaymentMode:   "Advance",
			Reference:     adv.AdvanceNumber,
			Notes:         "Applied from advance " + adv.AdvanceNumber,
			CreatedBy:     fmt.Sprintf("%v", userID),
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		paymentCollection.InsertOne(ctx, pmt)

		// ── Customer balances: reduce AR + reduce advance liability + history ──
		if custObjID, err := primitive.ObjectIDFromHex(adv.CustomerID); err == nil {
			histEntry := bson.M{
				"action":    "advance_applied",
				"timestamp": time.Now(),
				"user":      fmt.Sprintf("%v", userID),
				"details": bson.M{
					"amount":        applyAmt,
					"advanceNumber": adv.AdvanceNumber,
					"invoiceId":     req.InvoiceID,
					"invoiceNumber": inv.InvoiceNumber,
				},
			}
			customersCollection.UpdateOne(ctx,
				bson.M{"_id": custObjID, "orgId": orgIDStr},
				bson.M{
					"$inc": bson.M{
						"outstanding_balance": -applyAmt,
						"advance_balance":     -applyAmt,
					},
					"$push": bson.M{"history": histEntry},
					"$set":  bson.M{"updated_at": time.Now()},
				},
			)
		}

		// ── Invoice history ───────────────────────────────────────────────────
		pushInvoiceHistory(ctx, invObjID,
			fmt.Sprintf("Advance applied (%s)", adv.AdvanceNumber),
			fmt.Sprintf("%v", userID),
			fmt.Sprintf("AED %.2f applied from advance %s", applyAmt, adv.AdvanceNumber))

		// ── Journal entry: DR Customer Advances / CR Accounts Receivable ──────
		go autoJE(orgIDStr, "advance_application", adv.ID.Hex(), adv.AdvanceNumber, time.Now().Format("2006-01-02"),
			fmt.Sprintf("Advance %s applied to %s", adv.AdvanceNumber, inv.InvoiceNumber),
			[]jeLineInput{
				{AccountCode: "2400", Debit: applyAmt},
				{AccountCode: "1100", Credit: applyAmt},
			})

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": fmt.Sprintf("Applied %.2f from advance to invoice", applyAmt),
			"data": gin.H{
				"appliedAmount":   applyAmt,
				"advanceRemaining": newRemaining,
				"invoiceBalance":  newBalance,
				"invoiceStatus":   newStatus,
			},
		})
	}
}
