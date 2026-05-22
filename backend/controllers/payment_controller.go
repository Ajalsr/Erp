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

var paymentCollection *mongo.Collection = config.GetCollection(config.DB, "payments")

func generatePaymentNumber() string {
	now := time.Now()
	return fmt.Sprintf("PAY-%d%02d-%04d", now.Year(), now.Month(), rand.Intn(9000)+1000)
}

// CreatePayment records a payment, updates the linked invoice, and adjusts
// the customer's outstanding_balance + appends a history entry.
func CreatePayment() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var p models.Payment
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if p.Amount <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Amount must be greater than 0"})
			return
		}

		p.ID = primitive.NewObjectID()
		p.OrgID = orgID.(string)
		p.CreatedAt = time.Now()
		p.UpdatedAt = time.Now()
		if userID != nil {
			p.CreatedBy = userID.(string)
		}
		if p.PaymentNumber == "" {
			p.PaymentNumber = generatePaymentNumber()
		}
		if p.Date == "" {
			p.Date = time.Now().Format("2006-01-02")
		}

		// ── 1. Apply payment to invoice (if invoiceId provided) ──────────────
		if p.InvoiceID != "" {
			invObjID, err := primitive.ObjectIDFromHex(p.InvoiceID)
			if err == nil {
				var inv models.Invoice
				err = invoiceCollection.FindOne(ctx, bson.M{"_id": invObjID, "orgId": orgID}).Decode(&inv)
				if err == nil {
					if inv.Type == "proforma" {
						c.JSON(http.StatusUnprocessableEntity, gin.H{"message": "Cannot record payment against a proforma invoice"})
						return
					}
					newPaid := inv.AmountPaid + p.Amount
					newBalance := inv.Totals.GrandTotal - newPaid
					if newBalance < 0 {
						newBalance = 0
					}
					newStatus := "partial"
					if newBalance <= 0 {
						newStatus = "paid"
					}

					invUpdate := bson.M{
						"$set": bson.M{
							"amountPaid": newPaid,
							"balanceDue": newBalance,
							"status":     newStatus,
							"updatedAt":  time.Now(),
						},
					}
					invoiceCollection.UpdateOne(ctx, bson.M{"_id": invObjID, "orgId": orgID}, invUpdate)

					if p.InvoiceNumber == "" {
						p.InvoiceNumber = inv.InvoiceNumber
					}
					if p.CustomerID == "" {
						p.CustomerID = inv.CustomerID
					}
				}
			}
		}

		// ── 2. Reduce customer outstanding_balance + add history ─────────────
		if p.CustomerID != "" {
			custFilter := bson.M{"_id": p.CustomerID, "orgId": orgID}
			// try ObjectID first, then string match
			if custObjID, err := primitive.ObjectIDFromHex(p.CustomerID); err == nil {
				custFilter = bson.M{"_id": custObjID, "orgId": orgID}
			}

			histEntry := bson.M{
				"action":    "payment_received",
				"timestamp": time.Now(),
				"user":      p.CreatedBy,
				"details": bson.M{
					"amount":        p.Amount,
					"paymentNumber": p.PaymentNumber,
					"invoiceId":     p.InvoiceID,
					"invoiceNumber": p.InvoiceNumber,
					"paymentMode":   p.PaymentMode,
					"reference":     p.Reference,
				},
			}

			custUpdate := bson.M{
				"$inc":  bson.M{"outstanding_balance": -p.Amount},
				"$push": bson.M{"history": histEntry},
				"$set":  bson.M{"updated_at": time.Now()},
			}
			customersCollection.UpdateOne(ctx, custFilter, custUpdate)
		}

		// ── 3. Insert the payment record ─────────────────────────────────────
		if _, err := paymentCollection.InsertOne(ctx, p); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to record payment", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Payment recorded successfully",
			"data":    gin.H{"id": p.ID.Hex(), "paymentNumber": p.PaymentNumber},
		})
	}
}

// GetAllPayments returns all payments for the org, with optional filters.
func GetAllPayments() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		filter := bson.M{"orgId": orgID}
		if cid := c.Query("customerId"); cid != "" {
			filter["customerId"] = cid
		}
		if iid := c.Query("invoiceId"); iid != "" {
			filter["invoiceId"] = iid
		}

		total, _ := paymentCollection.CountDocuments(ctx, filter)

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := paymentCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch payments", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var payments []models.Payment
		if err := cursor.All(ctx, &payments); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode payments", "error": err.Error()})
			return
		}
		if payments == nil {
			payments = []models.Payment{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Payments retrieved successfully",
			"data":    gin.H{"payments": payments, "total": total},
		})
	}
}

// GetPaymentByID returns a single payment by ID.
func GetPaymentByID() gin.HandlerFunc {
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

		var p models.Payment
		err = paymentCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&p)
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

// ApplyCredit applies a customer's unused credit balance to a specific invoice.
// POST /api/customers/:id/apply-credit
// Body: { invoiceId, amount }
func ApplyCredit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")
		custIDStr := c.Param("id")

		custObjID, err := primitive.ObjectIDFromHex(custIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid customer ID"})
			return
		}

		var req struct {
			InvoiceID string  `json:"invoiceId"`
			Amount    float64 `json:"amount"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.Amount <= 0 || req.InvoiceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invoiceId and amount > 0 required"})
			return
		}

		// ── 1. Fetch customer, verify sufficient credits ──────────────────────
		var cust models.Customer
		if err := customersCollection.FindOne(ctx, bson.M{"_id": custObjID, "orgId": orgID}).Decode(&cust); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Customer not found"})
			return
		}
		if cust.UnusedCredits < req.Amount {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"message":        fmt.Sprintf("Insufficient credits — available: %.2f, requested: %.2f", cust.UnusedCredits, req.Amount),
				"availableCredit": cust.UnusedCredits,
			})
			return
		}

		// ── 2. Fetch invoice, verify it belongs to this customer ──────────────
		invObjID, err := primitive.ObjectIDFromHex(req.InvoiceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid invoice ID"})
			return
		}
		var inv models.Invoice
		if err := invoiceCollection.FindOne(ctx, bson.M{"_id": invObjID, "orgId": orgID}).Decode(&inv); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Invoice not found"})
			return
		}
		if inv.CustomerID != custIDStr {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invoice does not belong to this customer"})
			return
		}
		if inv.Status == "paid" || inv.Status == "void" {
			c.JSON(http.StatusConflict, gin.H{"message": "Cannot apply credit to a " + inv.Status + " invoice"})
			return
		}

		balanceDue := inv.Totals.GrandTotal - inv.AmountPaid
		if balanceDue <= 0 {
			c.JSON(http.StatusConflict, gin.H{"message": "Invoice has no outstanding balance"})
			return
		}
		apply := req.Amount
		if apply > balanceDue {
			apply = balanceDue
		}

		// ── 3. Update invoice ─────────────────────────────────────────────────
		newPaid := inv.AmountPaid + apply
		newBalance := inv.Totals.GrandTotal - newPaid
		if newBalance < 0 {
			newBalance = 0
		}
		newStatus := "partial"
		if newBalance <= 0 {
			newStatus = "paid"
		}
		invoiceCollection.UpdateOne(ctx, bson.M{"_id": invObjID},
			bson.M{"$set": bson.M{
				"amountPaid": newPaid,
				"balanceDue": newBalance,
				"status":     newStatus,
				"updatedAt":  time.Now(),
			}},
		)

		// ── 4. Decrement customer unused_credits ──────────────────────────────
		histEntry := bson.M{
			"action":    "credit_applied",
			"timestamp": time.Now(),
			"user":      fmt.Sprintf("%v", userID),
			"details": bson.M{
				"appliedAmount": apply,
				"invoiceId":     req.InvoiceID,
				"invoiceNumber": inv.InvoiceNumber,
			},
		}
		customersCollection.UpdateOne(ctx,
			bson.M{"_id": custObjID, "orgId": orgID},
			bson.M{
				"$inc":  bson.M{"unused_credits": -apply},
				"$push": bson.M{"history": histEntry},
				"$set":  bson.M{"updated_at": time.Now()},
			},
		)

		// ── 5. Create a payment record for audit trail ────────────────────────
		custName := cust.CustomerDisplayName
		if custName == "" {
			custName = cust.CompanyName
		}
		pmt := models.Payment{
			ID:            primitive.NewObjectID(),
			OrgID:         orgID.(string),
			CustomerID:    custIDStr,
			CustomerName:  custName,
			InvoiceID:     req.InvoiceID,
			InvoiceNumber: inv.InvoiceNumber,
			Amount:        apply,
			PaymentMode:   "Credit Applied",
			PaymentNumber: generatePaymentNumber(),
			Date:          time.Now().Format("2006-01-02"),
			Notes:         "Applied from customer unused credit balance",
			CreatedBy:     fmt.Sprintf("%v", userID),
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		paymentCollection.InsertOne(ctx, pmt)

		c.JSON(http.StatusOK, gin.H{
			"status":          http.StatusOK,
			"message":         fmt.Sprintf("AED %.2f credit applied to invoice %s", apply, inv.InvoiceNumber),
			"appliedAmount":   apply,
			"invoiceStatus":   newStatus,
			"remainingCredit": cust.UnusedCredits - apply,
		})
	}
}

// GetPaymentStats returns aggregate totals for the org.
func GetPaymentStats() gin.HandlerFunc {
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

		cursor, err := paymentCollection.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Stats failed"})
			return
		}
		defer cursor.Close(ctx)

		var results []bson.M
		cursor.All(ctx, &results)

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

		// This month
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		monthFilter := bson.M{"orgId": orgID, "createdAt": bson.M{"$gte": startOfMonth}}
		monthTotal := 0.0
		mc, _ := paymentCollection.Aggregate(ctx, mongo.Pipeline{
			{{Key: "$match", Value: monthFilter}},
			{{Key: "$group", Value: bson.M{"_id": nil, "total": bson.M{"$sum": "$amount"}}}},
		})
		var mr []bson.M
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
				"totalReceived": total,
				"count":         count,
				"thisMonth":     monthTotal,
			},
		})
	}
}

// RefundPayment reverses a payment: reduces invoice amountPaid, restores balanceDue.
// POST /api/payments/:id/refund
func RefundPayment() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid payment ID"})
			return
		}

		var pmt models.Payment
		if err = paymentCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&pmt); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Payment not found"})
			return
		}
		if pmt.IsRefunded {
			c.JSON(http.StatusConflict, gin.H{"message": "Payment already refunded"})
			return
		}

		var req struct {
			Amount float64 `json:"amount"`
			Reason string  `json:"reason"`
		}
		c.ShouldBindJSON(&req)
		if req.Amount <= 0 {
			req.Amount = pmt.Amount
		}
		if req.Amount > pmt.Amount {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Refund amount cannot exceed original payment"})
			return
		}

		// ── Reverse effect on linked invoice ─────────────────────────────────
		if pmt.InvoiceID != "" {
			invObjID, err := primitive.ObjectIDFromHex(pmt.InvoiceID)
			if err == nil {
				var inv models.Invoice
				if err = invoiceCollection.FindOne(ctx, bson.M{"_id": invObjID, "orgId": orgID}).Decode(&inv); err == nil {
					newPaid    := inv.AmountPaid - req.Amount
					if newPaid < 0 { newPaid = 0 }
					newBalance := inv.Totals.GrandTotal - newPaid
					if newBalance < 0 { newBalance = 0 }

					newStatus := "unpaid"
					if newBalance <= 0 {
						newStatus = "paid"
					} else if newPaid > 0 {
						newStatus = "partial"
					}

					invoiceCollection.UpdateOne(ctx, bson.M{"_id": invObjID, "orgId": orgID}, bson.M{"$set": bson.M{
						"amountPaid": newPaid,
						"balanceDue": newBalance,
						"status":     newStatus,
						"updatedAt":  time.Now(),
					}})
				}
			}
		}

		// ── Mark payment as refunded ──────────────────────────────────────────
		paymentCollection.UpdateOne(ctx, bson.M{"_id": objID, "orgId": orgID}, bson.M{"$set": bson.M{
			"isRefunded":     true,
			"refundedAmount": req.Amount,
			"refundedAt":     time.Now(),
			"refundReason":   req.Reason,
			"updatedAt":      time.Now(),
		}})

		c.JSON(http.StatusOK, gin.H{
			"message": "Payment refunded",
			"data":    gin.H{"refundedAmount": req.Amount},
		})
	}
}
