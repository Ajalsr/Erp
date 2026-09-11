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

var salesTypeCollection *mongo.Collection = config.GetCollection(config.DB, "sales_types")

// defaultSalesTypeSeeds — starting set for a brand-new org, so dropdowns aren't empty on
// day one. Admins can rename/add/remove freely afterward. Names match the codes this app
// used before Sales Types became an org-configurable module.
var defaultSalesTypeSeeds = []struct {
	Name        string
	Description string
}{
	{"SO", "Standard Sale Order"},
	{"MOA", "Material on Approval"},
	{"MOA_COLLECT", "Material on Approval Collect"},
	{"FREE_DELIVERY", "Free Delivery"},
}

// seedDefaultSalesTypesForOrg — idempotent, skips names that already exist for the org.
func seedDefaultSalesTypesForOrg(ctx context.Context, orgID, createdBy string) (seeded, skipped int) {
	for _, d := range defaultSalesTypeSeeds {
		if salesTypeCollection.FindOne(ctx, bson.M{"orgId": orgID, "name": d.Name}).Err() == nil {
			skipped++
			continue
		}
		t := models.SalesType{
			ID:          primitive.NewObjectID(),
			Name:        d.Name,
			Description: d.Description,
			Status:      "active",
			OrgID:       orgID,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
			CreatedBy:   createdBy,
		}
		if _, err := salesTypeCollection.InsertOne(ctx, t); err == nil {
			seeded++
		}
	}
	return
}

// EnsureDefaultSalesTypes backfills the default sales types into every org that already
// exists (created before this module had auto-seeding). Idempotent.
func EnsureDefaultSalesTypes(ctx context.Context) {
	orgIDs, err := orgCollection.Distinct(ctx, "_id", bson.M{})
	if err != nil {
		return
	}
	for _, oid := range orgIDs {
		objID, ok := oid.(primitive.ObjectID)
		if !ok {
			continue
		}
		seedDefaultSalesTypesForOrg(ctx, objID.Hex(), "system")
	}
}

func CreateSalesType() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var t models.SalesType
		if err := c.ShouldBindJSON(&t); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if t.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Sales type name is required"})
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

		if _, err := salesTypeCollection.InsertOne(ctx, t); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create sales type", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Sales type created successfully",
			"data":    gin.H{"id": t.ID.Hex(), "name": t.Name},
		})
	}
}

func GetAllSalesTypes() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}

		opts := options.Find().SetSort(bson.D{{Key: "name", Value: 1}})
		cursor, err := salesTypeCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch sales types"})
			return
		}
		defer cursor.Close(ctx)

		var types []models.SalesType
		if err := cursor.All(ctx, &types); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode sales types"})
			return
		}
		if types == nil {
			types = []models.SalesType{}
		}

		total, _ := salesTypeCollection.CountDocuments(ctx, filter)

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Sales types retrieved successfully",
			"data":    gin.H{"salesTypes": types, "total": total},
		})
	}
}

func GetSalesTypeByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid sales type ID"})
			return
		}

		var t models.SalesType
		err = salesTypeCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&t)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Sales type not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve sales type"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Sales type retrieved", "data": t})
	}
}

func UpdateSalesType() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid sales type ID"})
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

		result, err := salesTypeCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": updates},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Sales type not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Sales type updated successfully"})
	}
}

func DeleteSalesType() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid sales type ID"})
			return
		}

		result, err := salesTypeCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr})
		if err != nil || result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Sales type not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Sales type deleted successfully"})
	}
}
