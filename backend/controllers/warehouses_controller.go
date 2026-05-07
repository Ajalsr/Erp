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

var warehouseCollection *mongo.Collection = config.GetCollection(config.DB, "warehouses")

func CreateWarehouse() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var w models.Warehouse
		if err := c.ShouldBindJSON(&w); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if w.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Warehouse name is required"})
			return
		}

		if w.IsDefault {
			warehouseCollection.UpdateMany(ctx,
				bson.M{"orgId": orgIDStr, "isDefault": true},
				bson.M{"$set": bson.M{"isDefault": false, "updatedAt": time.Now()}},
			)
		}

		w.ID = primitive.NewObjectID()
		w.OrgID = orgIDStr
		w.CreatedAt = time.Now()
		w.UpdatedAt = time.Now()
		if userID != nil {
			w.CreatedBy = userID.(string)
		}
		if w.Status == "" {
			w.Status = "active"
		}

		if _, err := warehouseCollection.InsertOne(ctx, w); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create warehouse", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Warehouse created successfully",
			"data":    gin.H{"id": w.ID.Hex(), "name": w.Name},
		})
	}
}

func GetAllWarehouses() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := warehouseCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch warehouses"})
			return
		}
		defer cursor.Close(ctx)

		var warehouses []models.Warehouse
		if err := cursor.All(ctx, &warehouses); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode warehouses"})
			return
		}
		if warehouses == nil {
			warehouses = []models.Warehouse{}
		}

		total, _ := warehouseCollection.CountDocuments(ctx, filter)
		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Warehouses retrieved successfully",
			"data":    gin.H{"warehouses": warehouses, "total": total},
		})
	}
}

func GetWarehouseByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid warehouse ID"})
			return
		}

		var w models.Warehouse
		if err := warehouseCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&w); err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Warehouse not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve warehouse"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Warehouse retrieved", "data": w})
	}
}

func UpdateWarehouse() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid warehouse ID"})
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

		if isDefault, ok := updates["isDefault"].(bool); ok && isDefault {
			warehouseCollection.UpdateMany(ctx,
				bson.M{"orgId": orgIDStr, "isDefault": true},
				bson.M{"$set": bson.M{"isDefault": false, "updatedAt": time.Now()}},
			)
		}

		updates["updatedAt"] = time.Now()
		result, err := warehouseCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": updates},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Warehouse not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Warehouse updated successfully"})
	}
}

func DeleteWarehouse() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid warehouse ID"})
			return
		}

		result, err := warehouseCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr})
		if err != nil || result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Warehouse not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Warehouse deleted successfully"})
	}
}
