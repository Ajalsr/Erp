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

var vendorTypeCollection *mongo.Collection = config.GetCollection(config.DB, "vendor_types")

// defaultVendorTypeSeeds — starting set for a brand-new org, so the vendor-type
// dropdown isn't empty on day one. These are the values the app hard-coded
// before Vendor Types became an org-configurable module. Admins can
// rename/add/remove freely afterward.
var defaultVendorTypeSeeds = []struct {
	Name        string
	Description string
}{
	{"Individual", ""},
	{"Business / Company", ""},
	{"Manufacturer", ""},
	{"Distributor", ""},
	{"Service Provider", ""},
}

// seedDefaultVendorTypesForOrg — idempotent, skips names that already exist for the org.
func seedDefaultVendorTypesForOrg(ctx context.Context, orgID, createdBy string) (seeded, skipped int) {
	for _, d := range defaultVendorTypeSeeds {
		if vendorTypeCollection.FindOne(ctx, bson.M{"orgId": orgID, "name": d.Name}).Err() == nil {
			skipped++
			continue
		}
		t := models.VendorType{
			ID:          primitive.NewObjectID(),
			Name:        d.Name,
			Description: d.Description,
			Status:      "active",
			OrgID:       orgID,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
			CreatedBy:   createdBy,
		}
		if _, err := vendorTypeCollection.InsertOne(ctx, t); err == nil {
			seeded++
		}
	}
	return
}

// EnsureDefaultVendorTypes backfills the default vendor types into every org that
// already exists (created before this module had auto-seeding). Idempotent.
func EnsureDefaultVendorTypes(ctx context.Context) {
	orgIDs, err := orgCollection.Distinct(ctx, "_id", bson.M{})
	if err != nil {
		return
	}
	for _, oid := range orgIDs {
		objID, ok := oid.(primitive.ObjectID)
		if !ok {
			continue
		}
		seedDefaultVendorTypesForOrg(ctx, objID.Hex(), "system")
	}
}

func CreateVendorType() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var t models.VendorType
		if err := c.ShouldBindJSON(&t); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if t.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Vendor type name is required"})
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

		if _, err := vendorTypeCollection.InsertOne(ctx, t); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create vendor type", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Vendor type created successfully",
			"data":    gin.H{"id": t.ID.Hex(), "name": t.Name},
		})
	}
}

func GetAllVendorTypes() gin.HandlerFunc {
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
		cursor, err := vendorTypeCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch vendor types"})
			return
		}
		defer cursor.Close(ctx)

		var types []models.VendorType
		if err := cursor.All(ctx, &types); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode vendor types"})
			return
		}
		if types == nil {
			types = []models.VendorType{}
		}

		total, _ := vendorTypeCollection.CountDocuments(ctx, filter)

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Vendor types retrieved successfully",
			"data":    gin.H{"vendorTypes": types, "total": total},
		})
	}
}

func GetVendorTypeByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid vendor type ID"})
			return
		}

		var t models.VendorType
		err = vendorTypeCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&t)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Vendor type not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve vendor type"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor type retrieved", "data": t})
	}
}

func UpdateVendorType() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid vendor type ID"})
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

		result, err := vendorTypeCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": updates},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Vendor type not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor type updated successfully"})
	}
}

func DeleteVendorType() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid vendor type ID"})
			return
		}

		result, err := vendorTypeCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr})
		if err != nil || result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Vendor type not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor type deleted successfully"})
	}
}
