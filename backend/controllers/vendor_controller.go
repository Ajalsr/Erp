package controllers

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var vendorCollection *mongo.Collection = config.GetCollection(config.DB, "vendors")

func generateVendorCode() string {
	return fmt.Sprintf("VEN-%04d", rand.Intn(9000)+1000)
}

func CreateVendor() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var v models.Vendor
		if err := c.ShouldBindJSON(&v); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if v.DisplayName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Display name is required"})
			return
		}

		v.ID = primitive.NewObjectID()
		v.OrgID = orgID.(string)
		v.CreatedAt = time.Now()
		v.UpdatedAt = time.Now()
		if userID != nil {
			v.CreatedBy = userID.(string)
		}
		if v.VendorCode == "" {
			v.VendorCode = generateVendorCode()
		}
		if v.Status == "" {
			v.Status = "active"
		}
		v.OutstandingPayable = 0

		if _, err := vendorCollection.InsertOne(ctx, v); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create vendor", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Vendor created successfully",
			"data":    gin.H{"id": v.ID.Hex(), "vendorCode": v.VendorCode},
		})
	}
}

func GetAllVendors() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		filter := bson.M{"orgId": orgID}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if search := c.Query("search"); search != "" {
			filter["$or"] = []bson.M{
				{"displayName": bson.M{"$regex": search, "$options": "i"}},
				{"companyName": bson.M{"$regex": search, "$options": "i"}},
				{"vendorCode": bson.M{"$regex": search, "$options": "i"}},
				{"email": bson.M{"$regex": search, "$options": "i"}},
			}
		}

		total, _ := vendorCollection.CountDocuments(ctx, filter)

		page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
		limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "50"), 10, 64)
		skip := (page - 1) * limit

		opts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetSkip(skip).
			SetLimit(limit)

		cursor, err := vendorCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch vendors"})
			return
		}
		defer cursor.Close(ctx)

		var vendors []models.Vendor
		if err := cursor.All(ctx, &vendors); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode vendors"})
			return
		}
		if vendors == nil {
			vendors = []models.Vendor{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Vendors retrieved successfully",
			"data":    gin.H{"vendors": vendors, "total": total, "page": page, "limit": limit},
		})
	}
}

func GetVendorByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid vendor ID"})
			return
		}

		var v models.Vendor
		err = vendorCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&v)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Vendor not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve vendor"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor retrieved", "data": v})
	}
}

func UpdateVendor() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid vendor ID"})
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
		delete(updates, "outstandingPayable")
		updates["updatedAt"] = time.Now()

		result, err := vendorCollection.UpdateOne(ctx, bson.M{"_id": objID, "orgId": orgID}, bson.M{"$set": updates})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update vendor"})
			return
		}
		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Vendor not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor updated successfully"})
	}
}

func DeleteVendor() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid vendor ID"})
			return
		}

		result, err := vendorCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgID})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to delete vendor"})
			return
		}
		if result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Vendor not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor deleted successfully"})
	}
}

func GetVendorStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		total, _ := vendorCollection.CountDocuments(ctx, bson.M{"orgId": orgID})
		active, _ := vendorCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "active"})

		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgID}}},
			{{Key: "$group", Value: bson.M{
				"_id":                nil,
				"totalPayable":       bson.M{"$sum": "$outstandingPayable"},
			}}},
		}
		cursor, _ := vendorCollection.Aggregate(ctx, pipeline)
		var agg []bson.M
		if cursor != nil {
			cursor.All(ctx, &agg)
		}

		totalPayable := 0.0
		if len(agg) > 0 {
			if v, ok := agg[0]["totalPayable"].(float64); ok {
				totalPayable = v
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"total":        total,
				"active":       active,
				"inactive":     total - active,
				"totalPayable": totalPayable,
			},
		})
	}
}

func SearchVendors() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		q := c.Query("q")

		filter := bson.M{
			"orgId": orgID,
			"$or": []bson.M{
				{"displayName": bson.M{"$regex": q, "$options": "i"}},
				{"companyName": bson.M{"$regex": q, "$options": "i"}},
				{"vendorCode": bson.M{"$regex": q, "$options": "i"}},
			},
		}

		opts := options.Find().SetLimit(10).SetSort(bson.D{{Key: "displayName", Value: 1}})
		cursor, err := vendorCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Search failed"})
			return
		}
		defer cursor.Close(ctx)

		var vendors []models.Vendor
		cursor.All(ctx, &vendors)
		if vendors == nil {
			vendors = []models.Vendor{}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": vendors})
	}
}
