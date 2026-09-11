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

var uomCollection *mongo.Collection = config.GetCollection(config.DB, "uoms")

// defaultUOMSeeds — starting set for a brand-new org, so dropdowns aren't empty on day
// one. Admins can rename/add/remove freely afterward.
var defaultUOMSeeds = []struct {
	Name   string
	Symbol string
}{
	{"Piece", "pcs"},
	{"Box", "box"},
	{"Carton", "ctn"},
	{"Pallet", "pallet"},
	{"Set", "set"},
	{"Pair", "pair"},
	{"Dozen", "dz"},
	{"Kilogram", "kg"},
	{"Gram", "g"},
	{"Ton", "t"},
	{"Liter", "L"},
	{"Milliliter", "mL"},
	{"Meter", "m"},
	{"Centimeter", "cm"},
	{"Square Meter", "m²"},
	{"Cubic Meter", "m³"},
	{"Roll", "roll"},
	{"Sheet", "sheet"},
	{"Bundle", "bundle"},
	{"Unit", "unit"},
}

// seedDefaultUOMsForOrg — idempotent, skips names that already exist for the org.
func seedDefaultUOMsForOrg(ctx context.Context, orgID, createdBy string) (seeded, skipped int) {
	for _, d := range defaultUOMSeeds {
		if uomCollection.FindOne(ctx, bson.M{"orgId": orgID, "name": d.Name}).Err() == nil {
			skipped++
			continue
		}
		u := models.UOM{
			ID:        primitive.NewObjectID(),
			Name:      d.Name,
			Symbol:    d.Symbol,
			Status:    "active",
			OrgID:     orgID,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			CreatedBy: createdBy,
		}
		if _, err := uomCollection.InsertOne(ctx, u); err == nil {
			seeded++
		}
	}
	return
}

// EnsureDefaultUOMs backfills the default units of measure into every org that already
// exists (created before this module had auto-seeding). Idempotent.
func EnsureDefaultUOMs(ctx context.Context) {
	orgIDs, err := orgCollection.Distinct(ctx, "_id", bson.M{})
	if err != nil {
		return
	}
	for _, oid := range orgIDs {
		objID, ok := oid.(primitive.ObjectID)
		if !ok {
			continue
		}
		seedDefaultUOMsForOrg(ctx, objID.Hex(), "system")
	}
}

func CreateUOM() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var u models.UOM
		if err := c.ShouldBindJSON(&u); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if u.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Unit name is required"})
			return
		}

		u.ID = primitive.NewObjectID()
		u.OrgID = orgIDStr
		u.CreatedAt = time.Now()
		u.UpdatedAt = time.Now()
		if userID != nil {
			u.CreatedBy = userID.(string)
		}
		if u.Status == "" {
			u.Status = "active"
		}

		if _, err := uomCollection.InsertOne(ctx, u); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create unit", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Unit of measure created successfully",
			"data":    gin.H{"id": u.ID.Hex(), "name": u.Name, "symbol": u.Symbol},
		})
	}
}

func GetAllUOMs() gin.HandlerFunc {
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
		cursor, err := uomCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch units"})
			return
		}
		defer cursor.Close(ctx)

		var uoms []models.UOM
		if err := cursor.All(ctx, &uoms); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode units"})
			return
		}
		if uoms == nil {
			uoms = []models.UOM{}
		}

		total, _ := uomCollection.CountDocuments(ctx, filter)

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Units retrieved successfully",
			"data":    gin.H{"uoms": uoms, "total": total},
		})
	}
}

func GetUOMByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid unit ID"})
			return
		}

		var u models.UOM
		err = uomCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&u)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Unit not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve unit"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Unit retrieved", "data": u})
	}
}

func UpdateUOM() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid unit ID"})
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

		result, err := uomCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": updates},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Unit not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Unit updated successfully"})
	}
}

func DeleteUOM() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid unit ID"})
			return
		}

		result, err := uomCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr})
		if err != nil || result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Unit not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Unit deleted successfully"})
	}
}
