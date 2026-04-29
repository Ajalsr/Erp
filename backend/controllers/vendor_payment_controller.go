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

		p.ID = primitive.NewObjectID()
		p.OrgID = orgID.(string)
		p.CreatedAt = time.Now()
		p.UpdatedAt = time.Now()
		if userID != nil {
			p.CreatedBy = userID.(string)
		}
		if p.PaymentNumber == "" {
			p.PaymentNumber = generateVendorPaymentNumber()
		}
		if p.Date == "" {
			p.Date = time.Now().Format("2006-01-02")
		}

		// ── 1. Apply to linked bill ──────────────────────────────────────────
		if p.BillID != "" {
			billObjID, err := primitive.ObjectIDFromHex(p.BillID)
			if err == nil {
				var b models.Bill
				err = billCollection.FindOne(ctx, bson.M{"_id": billObjID, "orgId": orgID}).Decode(&b)
				if err == nil {
					newPaid := b.AmountPaid + p.Amount
					newBalance := b.Totals.GrandTotal - newPaid
					if newBalance < 0 {
						newBalance = 0
					}
					newStatus := "partial"
					if newBalance <= 0 {
						newStatus = "paid"
					}
					billCollection.UpdateOne(ctx, bson.M{"_id": billObjID, "orgId": orgID}, bson.M{
						"$set": bson.M{
							"amountPaid": newPaid,
							"balanceDue": newBalance,
							"status":     newStatus,
							"updatedAt":  time.Now(),
						},
					})
					if p.BillNumber == "" {
						p.BillNumber = b.BillNumber
					}
					if p.VendorName == "" {
						p.VendorName = b.VendorName
					}
				}
			}
		}

		// ── 2. Reduce vendor outstanding payable + push history ──────────────
		if p.VendorID != "" {
			vendorFilter := bson.M{"orgId": orgID}
			if vObjID, err := primitive.ObjectIDFromHex(p.VendorID); err == nil {
				vendorFilter["_id"] = vObjID
			}
			histEntry := bson.M{
				"action":    "payment_made",
				"timestamp": time.Now(),
				"user":      p.CreatedBy,
				"details": fmt.Sprintf("Payment of %.2f recorded (%s). Bill: %s. Ref: %s",
					p.Amount, p.PaymentMode, p.BillNumber, p.Reference),
			}
			vendorCollection.UpdateOne(ctx, vendorFilter, bson.M{
				"$inc":  bson.M{"outstandingPayable": -p.Amount},
				"$push": bson.M{"history": histEntry},
				"$set":  bson.M{"updatedAt": time.Now()},
			})
		}

		// ── 3. Insert payment record ─────────────────────────────────────────
		if _, err := vendorPaymentCollection.InsertOne(ctx, p); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to record payment", "error": err.Error()})
			return
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

		filter := bson.M{"orgId": orgID}
		if vid := c.Query("vendorId"); vid != "" {
			filter["vendorId"] = vid
		}
		if bid := c.Query("billId"); bid != "" {
			filter["billId"] = bid
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
