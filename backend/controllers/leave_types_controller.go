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

var leaveTypeCollection *mongo.Collection = config.GetCollection(config.DB, "leave_types")

func CreateLeaveType() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var lt models.LeaveType
		if err := c.ShouldBindJSON(&lt); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if lt.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Leave type name is required"})
			return
		}

		lt.ID = primitive.NewObjectID()
		lt.OrgID = orgIDStr
		lt.CreatedAt = time.Now()
		lt.UpdatedAt = time.Now()
		if userID != nil {
			lt.CreatedBy = userID.(string)
		}
		if lt.Status == "" {
			lt.Status = "active"
		}

		if _, err := leaveTypeCollection.InsertOne(ctx, lt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create leave type", "error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Leave type created successfully", "data": gin.H{"id": lt.ID.Hex(), "name": lt.Name}})
	}
}

func GetAllLeaveTypes() gin.HandlerFunc {
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
		cursor, err := leaveTypeCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch leave types"})
			return
		}
		defer cursor.Close(ctx)

		var leaveTypes []models.LeaveType
		if err := cursor.All(ctx, &leaveTypes); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode leave types"})
			return
		}
		if leaveTypes == nil {
			leaveTypes = []models.LeaveType{}
		}

		total, _ := leaveTypeCollection.CountDocuments(ctx, filter)
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Leave types retrieved successfully", "data": gin.H{"leaveTypes": leaveTypes, "total": total}})
	}
}

func GetLeaveTypeByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid leave type ID"})
			return
		}

		var lt models.LeaveType
		if err := leaveTypeCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&lt); err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Leave type not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve leave type"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Leave type retrieved", "data": lt})
	}
}

func UpdateLeaveType() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid leave type ID"})
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
		result, err := leaveTypeCollection.UpdateOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}, bson.M{"$set": updates})
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Leave type not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Leave type updated successfully"})
	}
}

func DeleteLeaveType() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid leave type ID"})
			return
		}

		if n, _ := leaveRequestCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "leaveTypeId": id}); n > 0 {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "This leave type has requests on record — set status to inactive instead of deleting"})
			return
		}

		result, err := leaveTypeCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr})
		if err != nil || result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Leave type not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Leave type deleted successfully"})
	}
}
