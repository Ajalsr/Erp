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

var paymentTermCollection *mongo.Collection = config.GetCollection(config.DB, "payment_terms")

// defaultPaymentTermSeeds — starting set for a brand-new org, so dropdowns aren't empty
// on day one. Admins can rename/add/remove freely afterward.
var defaultPaymentTermSeeds = []struct {
	Name string
	Days int
}{
	{"Due on Receipt", 0},
	{"Cash on Delivery", 0},
	{"Net 15", 15},
	{"Net 30", 30},
	{"Net 45", 45},
	{"Net 60", 60},
	{"Net 90", 90},
	{"End of Month", 0},
}

// seedDefaultPaymentTermsForOrg — idempotent, skips names that already exist for the org.
func seedDefaultPaymentTermsForOrg(ctx context.Context, orgID, createdBy string) (seeded, skipped int) {
	for _, d := range defaultPaymentTermSeeds {
		if paymentTermCollection.FindOne(ctx, bson.M{"orgId": orgID, "name": d.Name}).Err() == nil {
			skipped++
			continue
		}
		t := models.PaymentTerm{
			ID:        primitive.NewObjectID(),
			Name:      d.Name,
			Days:      d.Days,
			Status:    "active",
			OrgID:     orgID,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			CreatedBy: createdBy,
		}
		if _, err := paymentTermCollection.InsertOne(ctx, t); err == nil {
			seeded++
		}
	}
	return
}

// EnsureDefaultPaymentTerms backfills the default payment terms into every org that
// already exists (created before this module had auto-seeding). Idempotent — orgs that
// already have any of these names are skipped for that name only.
func EnsureDefaultPaymentTerms(ctx context.Context) {
	orgIDs, err := orgCollection.Distinct(ctx, "_id", bson.M{})
	if err != nil {
		return
	}
	for _, oid := range orgIDs {
		objID, ok := oid.(primitive.ObjectID)
		if !ok {
			continue
		}
		seedDefaultPaymentTermsForOrg(ctx, objID.Hex(), "system")
	}
}

func CreatePaymentTerm() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var t models.PaymentTerm
		if err := c.ShouldBindJSON(&t); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if t.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Term name is required"})
			return
		}

		t.ID = primitive.NewObjectID()
		t.OrgID = orgIDStr
		t.CreatedAt = time.Now()
		t.UpdatedAt = time.Now()
		if userID != nil {
			t.CreatedBy = userID.(string)
		}
		if t.Status == "" {
			t.Status = "active"
		}

		if _, err := paymentTermCollection.InsertOne(ctx, t); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create payment term", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Payment term created successfully",
			"data":    gin.H{"id": t.ID.Hex(), "name": t.Name, "days": t.Days},
		})
	}
}

func GetAllPaymentTerms() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}

		opts := options.Find().SetSort(bson.D{{Key: "days", Value: 1}})
		cursor, err := paymentTermCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch payment terms"})
			return
		}
		defer cursor.Close(ctx)

		var terms []models.PaymentTerm
		if err := cursor.All(ctx, &terms); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode payment terms"})
			return
		}
		if terms == nil {
			terms = []models.PaymentTerm{}
		}

		total, _ := paymentTermCollection.CountDocuments(ctx, filter)

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Payment terms retrieved successfully",
			"data":    gin.H{"paymentTerms": terms, "total": total},
		})
	}
}

func GetPaymentTermByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid payment term ID"})
			return
		}

		var t models.PaymentTerm
		err = paymentTermCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&t)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Payment term not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve payment term"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Payment term retrieved", "data": t})
	}
}

func UpdatePaymentTerm() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid payment term ID"})
			return
		}

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}
		delete(updates, "_id")
		delete(updates, "orgId")
		delete(updates, "createdAt")
		updates["updatedAt"] = time.Now()

		result, err := paymentTermCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": updates},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Payment term not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Payment term updated successfully"})
	}
}

func DeletePaymentTerm() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid payment term ID"})
			return
		}

		result, err := paymentTermCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr})
		if err != nil || result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Payment term not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Payment term deleted successfully"})
	}
}
