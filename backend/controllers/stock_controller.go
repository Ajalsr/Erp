package controllers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/net/context"
)

func GetAllStocks() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		var stocks []models.Stock
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		collection := config.GetCollection(config.DB, "stocks")
		results, err := collection.Find(ctx, bson.M{"orgId": orgIDStr})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer results.Close(ctx)

		if err := results.All(ctx, &stocks); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "success",
			"data":    stocks,
		})
	}
}

var stockCollection = config.GetCollection(config.DB, "stocks")

func AddItem() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		var item models.Stock
		defer cancel()

		if err := c.BindJSON(&item); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "error",
				"error":   err.Error(),
			})
			return
		}

		orgID, _ := c.Get("orgId")
		item.ID = primitive.NewObjectID()
		item.OrgID = fmt.Sprintf("%v", orgID)
		item.CreatedAt = time.Now()
		item.UpdatedAt = time.Now()

		result, err := stockCollection.InsertOne(ctx, item)

		// Removed debug fmt.Println(result) — do not log insert results in production

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "err",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Item Added Successfully",
			"data": gin.H{
				"_id":        item.ID,
				"insertedId": result.InsertedID,
			},
		})
	}
}

// ─── REDUCE STOCK ─────────────────────────────────────────────────────────────
// Guards against reducing below zero — returns 422 Unprocessable if stock is insufficient.
func ReduceStock() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid item ID format", "error": err.Error()})
			return
		}

		var body struct {
			ReduceBy float64 `json:"reduceBy"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.ReduceBy <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "reduceBy must be a positive number"})
			return
		}

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		var stock models.Stock
		err = stockCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgIDStr}).Decode(&stock)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Stock item not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve stock item", "error": err.Error()})
			}
			return
		}

		// Parse current quantity from string field
		currentQty := 0.0
		fmt.Sscanf(stock.Quantity, "%f", &currentQty)

		// Guard: never allow stock to go negative
		if body.ReduceBy > currentQty {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"status":  http.StatusUnprocessableEntity,
				"message": "Insufficient stock",
				"data": gin.H{
					"available": currentQty,
					"requested": body.ReduceBy,
				},
			})
			return
		}

		newQty := currentQty - body.ReduceBy
		update := bson.M{"$set": bson.M{"quantity": fmt.Sprintf("%g", newQty), "updated_at": time.Now()}}
		_, err = stockCollection.UpdateOne(ctx, bson.M{"_id": objectID, "orgId": orgIDStr}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update stock quantity", "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Stock reduced successfully",
			"data":    gin.H{"previousQty": currentQty, "reducedBy": body.ReduceBy, "newQty": newQty},
		})
	}
}

// ─── INCREASE STOCK ───────────────────────────────────────────────────────────
func IncreaseStock() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid item ID format", "error": err.Error()})
			return
		}

		var body struct {
			IncreaseBy float64 `json:"increaseBy"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.IncreaseBy <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "increaseBy must be a positive number"})
			return
		}

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		var stock models.Stock
		err = stockCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgIDStr}).Decode(&stock)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Stock item not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve stock item", "error": err.Error()})
			}
			return
		}

		currentQty := 0.0
		fmt.Sscanf(stock.Quantity, "%f", &currentQty)
		newQty := currentQty + body.IncreaseBy

		update := bson.M{"$set": bson.M{"quantity": fmt.Sprintf("%g", newQty), "updated_at": time.Now()}}
		_, err = stockCollection.UpdateOne(ctx, bson.M{"_id": stock.ID, "orgId": orgIDStr}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update stock quantity", "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Stock increased successfully",
			"data":    gin.H{"previousQty": currentQty, "increasedBy": body.IncreaseBy, "newQty": newQty},
		})
	}
}
