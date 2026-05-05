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

var itemGroupCollection *mongo.Collection = config.GetCollection(config.DB, "item_groups")

func CreateItemGroup() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var g models.ItemGroup
		if err := c.ShouldBindJSON(&g); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if g.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Group name is required"})
			return
		}

		g.ID = primitive.NewObjectID()
		g.OrgID = orgIDStr
		g.CreatedAt = time.Now()
		g.UpdatedAt = time.Now()
		if userID != nil {
			g.CreatedBy = userID.(string)
		}
		if g.Status == "" {
			g.Status = "active"
		}
		if g.Color == "" {
			g.Color = "#3b82f6"
		}

		if _, err := itemGroupCollection.InsertOne(ctx, g); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create group", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Item group created successfully",
			"data":    gin.H{"id": g.ID.Hex(), "name": g.Name},
		})
	}
}

func GetAllItemGroups() gin.HandlerFunc {
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
		cursor, err := itemGroupCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch groups"})
			return
		}
		defer cursor.Close(ctx)

		var groups []models.ItemGroup
		if err := cursor.All(ctx, &groups); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode groups"})
			return
		}
		if groups == nil {
			groups = []models.ItemGroup{}
		}

		total, _ := itemGroupCollection.CountDocuments(ctx, filter)

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Groups retrieved successfully",
			"data":    gin.H{"groups": groups, "total": total},
		})
	}
}

func GetItemGroupByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid group ID"})
			return
		}

		var g models.ItemGroup
		err = itemGroupCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&g)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Group not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve group"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Group retrieved", "data": g})
	}
}

func UpdateItemGroup() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid group ID"})
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

		result, err := itemGroupCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": updates},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Group not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Group updated successfully"})
	}
}

func DeleteItemGroup() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid group ID"})
			return
		}

		result, err := itemGroupCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr})
		if err != nil || result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Group not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Group deleted successfully"})
	}
}
