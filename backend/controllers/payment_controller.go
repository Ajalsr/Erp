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
					invoiceCollection.UpdateOne(ctx, bson.M{"_id": invObjID}, invUpdate)

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
