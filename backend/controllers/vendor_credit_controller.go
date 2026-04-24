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

var vendorCreditCollection *mongo.Collection = config.GetCollection(config.DB, "vendor_credits")

func generateCreditNumber() string {
	now := time.Now()
	return fmt.Sprintf("VCR-%d%02d-%04d", now.Year(), now.Month(), rand.Intn(9000)+1000)
}

func CreateVendorCredit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var cr models.VendorCredit
		if err := c.ShouldBindJSON(&cr); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if cr.VendorID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Vendor is required"})
			return
		}

		cr.ID = primitive.NewObjectID()
		cr.OrgID = orgID.(string)
		cr.CreatedAt = time.Now()
		cr.UpdatedAt = time.Now()
		if userID != nil {
			cr.CreatedBy = userID.(string)
		}
		if cr.CreditNumber == "" {
			cr.CreditNumber = generateCreditNumber()
		}
		if cr.Status == "" {
			cr.Status = "open"
		}
		if cr.Date == "" {
			cr.Date = time.Now().Format("2006-01-02")
		}

		if _, err := vendorCreditCollection.InsertOne(ctx, cr); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create vendor credit", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Vendor credit created successfully",
			"data":    gin.H{"id": cr.ID.Hex(), "creditNumber": cr.CreditNumber},
		})
	}
}

func GetAllVendorCredits() gin.HandlerFunc {
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

		total, _ := vendorCreditCollection.CountDocuments(ctx, filter)

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := vendorCreditCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch vendor credits"})
			return
		}
		defer cursor.Close(ctx)

		var credits []models.VendorCredit
		if err := cursor.All(ctx, &credits); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode credits"})
			return
		}
		if credits == nil {
			credits = []models.VendorCredit{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Vendor credits retrieved successfully",
			"data":    gin.H{"credits": credits, "total": total},
		})
	}
}

func GetVendorCreditByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid credit ID"})
			return
		}

		var cr models.VendorCredit
		err = vendorCreditCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&cr)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Vendor credit not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve credit"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor credit retrieved", "data": cr})
	}
}

// ApplyVendorCredit applies a credit note to a bill, reducing its balance due.
func ApplyVendorCredit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		crObjID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid credit ID"})
			return
		}

		var body struct {
			BillID string `json:"billId"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.BillID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "billId is required"})
			return
		}

		// Fetch credit
		var cr models.VendorCredit
		err = vendorCreditCollection.FindOne(ctx, bson.M{"_id": crObjID, "orgId": orgID}).Decode(&cr)
		if err != nil || cr.Status != "open" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Credit not found or already applied/void"})
			return
		}

		// Fetch bill
		billObjID, err := primitive.ObjectIDFromHex(body.BillID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid bill ID"})
			return
		}
		var b models.Bill
		err = billCollection.FindOne(ctx, bson.M{"_id": billObjID, "orgId": orgID}).Decode(&b)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Bill not found"})
			return
		}

		creditAmt := cr.Totals.GrandTotal
		newPaid := b.AmountPaid + creditAmt
		newBalance := b.Totals.GrandTotal - newPaid
		if newBalance < 0 {
			newBalance = 0
		}
		newBillStatus := "partial"
		if newBalance <= 0 {
			newBillStatus = "paid"
		}

		// Update bill
		billCollection.UpdateOne(ctx, bson.M{"_id": billObjID}, bson.M{
			"$set": bson.M{
				"amountPaid": newPaid,
				"balanceDue": newBalance,
				"status":     newBillStatus,
				"updatedAt":  time.Now(),
			},
		})

		// Mark credit as applied
		vendorCreditCollection.UpdateOne(ctx, bson.M{"_id": crObjID}, bson.M{
			"$set": bson.M{
				"status":     "applied",
				"billId":     body.BillID,
				"billNumber": b.BillNumber,
				"updatedAt":  time.Now(),
			},
		})

		// Reduce vendor outstanding payable
		if cr.VendorID != "" {
			vendorFilter := bson.M{"orgId": orgID}
			if vObjID, err := primitive.ObjectIDFromHex(cr.VendorID); err == nil {
				vendorFilter["_id"] = vObjID
			}
			vendorCollection.UpdateOne(ctx, vendorFilter, bson.M{
				"$inc": bson.M{"outstandingPayable": -creditAmt},
				"$set": bson.M{"updatedAt": time.Now()},
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Vendor credit applied successfully",
			"data": gin.H{
				"creditApplied": creditAmt,
				"billBalanceDue": newBalance,
				"billStatus":     newBillStatus,
			},
		})
	}
}

func VoidVendorCredit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid credit ID"})
			return
		}

		result, err := vendorCreditCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgID, "status": "open"},
			bson.M{"$set": bson.M{"status": "void", "updatedAt": time.Now()}},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Credit not found or cannot be voided"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor credit voided"})
	}
}

func GetVendorCreditStats() gin.HandlerFunc {
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
			}}},
		}

		cursor, _ := vendorCreditCollection.Aggregate(ctx, pipeline)
		var results []bson.M
		if cursor != nil {
			cursor.All(ctx, &results)
		}

		byStatus := map[string]gin.H{}
		openTotal := 0.0

		for _, r := range results {
			status, _ := r["_id"].(string)
			count, _ := r["count"].(int32)
			total, _ := r["grandTotal"].(float64)
			byStatus[status] = gin.H{"count": count, "grandTotal": total}
			if status == "open" {
				openTotal = total
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"byStatus":  byStatus,
				"openTotal": openTotal,
			},
		})
	}
}
