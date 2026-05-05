package controllers

import (
	"context"
	"fmt"
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

var accountCollection *mongo.Collection = config.GetCollection(config.DB, "accounts")

func CreateAccount() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var a models.Account
		if err := c.ShouldBindJSON(&a); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if a.AccountCode == "" || a.AccountName == "" || a.AccountType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "accountCode, accountName, and accountType are required"})
			return
		}

		// Ensure code is unique within the org
		existing := accountCollection.FindOne(ctx, bson.M{"orgId": orgIDStr, "accountCode": a.AccountCode})
		if existing.Err() == nil {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "Account code already exists"})
			return
		}

		a.ID = primitive.NewObjectID()
		a.OrgID = orgIDStr
		a.CreatedAt = time.Now()
		a.UpdatedAt = time.Now()
		if userID != nil {
			a.CreatedBy = userID.(string)
		}
		if a.Status == "" {
			a.Status = "active"
		}

		if _, err := accountCollection.InsertOne(ctx, a); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create account", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Account created successfully",
			"data":    gin.H{"id": a.ID.Hex(), "accountCode": a.AccountCode},
		})
	}
}

func GetAllAccounts() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if accountType := c.Query("type"); accountType != "" {
			filter["accountType"] = accountType
		}
		if search := c.Query("search"); search != "" {
			filter["$or"] = []bson.M{
				{"accountCode": bson.M{"$regex": search, "$options": "i"}},
				{"accountName": bson.M{"$regex": search, "$options": "i"}},
			}
		}

		total, _ := accountCollection.CountDocuments(ctx, filter)

		limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "200"), 10, 64)
		if limit < 1 || limit > 500 {
			limit = 200
		}
		page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
		if page < 1 {
			page = 1
		}
		skip := (page - 1) * limit

		opts := options.Find().
			SetSort(bson.D{{Key: "accountCode", Value: 1}}).
			SetSkip(skip).
			SetLimit(limit)

		cursor, err := accountCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch accounts"})
			return
		}
		defer cursor.Close(ctx)

		var accounts []models.Account
		if err := cursor.All(ctx, &accounts); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode accounts"})
			return
		}
		if accounts == nil {
			accounts = []models.Account{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Accounts retrieved successfully",
			"data":    gin.H{"accounts": accounts, "total": total, "page": page, "limit": limit},
		})
	}
}

func GetAccountByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid account ID"})
			return
		}

		var a models.Account
		err = accountCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&a)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Account not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve account"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Account retrieved", "data": a})
	}
}

func UpdateAccount() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid account ID"})
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
		delete(updates, "createdBy")
		updates["updatedAt"] = time.Now()

		result, err := accountCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": updates},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Account not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Account updated successfully"})
	}
}

func DeleteAccount() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid account ID"})
			return
		}

		result, err := accountCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr})
		if err != nil || result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Account not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Account deleted successfully"})
	}
}

func GetAccountStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgIDStr}}},
			{{Key: "$group", Value: bson.M{
				"_id":   "$accountType",
				"count": bson.M{"$sum": 1},
			}}},
		}

		cursor, err := accountCollection.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Stats failed"})
			return
		}
		defer cursor.Close(ctx)

		var results []bson.M
		cursor.All(ctx, &results)

		byType := map[string]int64{}
		total := int64(0)
		for _, r := range results {
			t, _ := r["_id"].(string)
			cnt, _ := r["count"].(int32)
			byType[t] = int64(cnt)
			total += int64(cnt)
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data":   gin.H{"byType": byType, "total": total},
		})
	}
}
