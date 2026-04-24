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

var billCollection *mongo.Collection = config.GetCollection(config.DB, "bills")

func generateBillNumber() string {
	now := time.Now()
	return fmt.Sprintf("BILL-%d%02d-%04d", now.Year(), now.Month(), rand.Intn(9000)+1000)
}

func CreateBill() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var b models.Bill
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if b.VendorID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Vendor is required"})
			return
		}

		b.ID = primitive.NewObjectID()
		b.OrgID = orgID.(string)
		b.CreatedAt = time.Now()
		b.UpdatedAt = time.Now()
		if userID != nil {
			b.CreatedBy = userID.(string)
		}
		if b.BillNumber == "" {
			b.BillNumber = generateBillNumber()
		}
		if b.Status == "" {
			b.Status = "open"
		}
		b.AmountPaid = 0
		b.BalanceDue = b.Totals.GrandTotal

		// Insert bill
		if _, err := billCollection.InsertOne(ctx, b); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create bill", "error": err.Error()})
			return
		}

		// Update vendor outstanding payable
		if b.VendorID != "" && b.Status != "draft" {
			vendorFilter := bson.M{"orgId": orgID}
			if vObjID, err := primitive.ObjectIDFromHex(b.VendorID); err == nil {
				vendorFilter["_id"] = vObjID
			}
			vendorCollection.UpdateOne(ctx, vendorFilter, bson.M{
				"$inc": bson.M{"outstandingPayable": b.Totals.GrandTotal},
				"$set": bson.M{"updatedAt": time.Now()},
			})
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Bill created successfully",
			"data":    gin.H{"id": b.ID.Hex(), "billNumber": b.BillNumber},
		})
	}
}

func GetAllBills() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		filter := bson.M{"orgId": orgID}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if vid := c.Query("vendorId"); vid != "" {
			filter["vendorId"] = vid
		}

		total, _ := billCollection.CountDocuments(ctx, filter)

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
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
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid bill ID"})
			return
		}

		var b models.Bill
		err = billCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&b)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Bill not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve bill"})
			}
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

		result, err := billCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgID},
			bson.M{"$set": bson.M{"status": body.Status, "updatedAt": time.Now()}},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Bill not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Bill status updated"})
	}
}

func GetBillStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgID}}},
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
