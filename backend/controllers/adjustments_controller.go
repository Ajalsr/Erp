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

var adjustmentCollection *mongo.Collection = config.GetCollection(config.DB, "stock_adjustments")

func CreateAdjustment() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var adj models.StockAdjustment
		if err := c.ShouldBindJSON(&adj); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if adj.ItemID == "" || adj.Quantity <= 0 || (adj.Type != "increase" && adj.Type != "decrease") {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "itemId, quantity (> 0), and type (increase|decrease) are required"})
			return
		}

		// Fetch the item to get current qty and validate
		itemObjID, err := primitive.ObjectIDFromHex(adj.ItemID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid item ID"})
			return
		}

		var stock models.Stock
		if err := stockCollection.FindOne(ctx, bson.M{"_id": itemObjID, "orgId": orgIDStr}).Decode(&stock); err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Item not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch item"})
			}
			return
		}

		currentQty := 0.0
		fmt.Sscanf(stock.Quantity, "%f", &currentQty)

		if adj.Type == "decrease" && adj.Quantity > currentQty {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": fmt.Sprintf("Insufficient stock. Available: %.2f, Requested: %.2f", currentQty, adj.Quantity),
			})
			return
		}

		var newQty float64
		if adj.Type == "increase" {
			newQty = currentQty + adj.Quantity
		} else {
			newQty = currentQty - adj.Quantity
		}

		// Per-warehouse breakdown: apply against the default warehouse (manual
		// adjustments aren't warehouse-scoped yet).
		defWh, _ := defaultWarehouse(ctx, orgIDStr)
		whMap := seedWarehouseMap(stock.WarehouseStock, currentQty, defWh)
		if adj.Type == "increase" {
			whMap = addToWarehouse(whMap, defWh, adj.Quantity)
		} else {
			whMap = deductWarehouses(whMap, defWh, adj.Quantity)
		}

		// Update stock quantity
		_, err = stockCollection.UpdateOne(ctx,
			bson.M{"_id": itemObjID, "orgId": orgIDStr},
			bson.M{"$set": bson.M{"quantity": fmt.Sprintf("%g", newQty), "warehouseStock": whMap, "updated_at": time.Now()}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update stock"})
			return
		}

		// Save adjustment record
		adj.ID = primitive.NewObjectID()
		adj.OrgID = orgIDStr
		adj.ItemName = stock.Name
		adj.ItemCode = stock.ItemCode
		adj.PreviousQty = currentQty
		adj.NewQty = newQty
		adj.CreatedAt = time.Now()
		if adj.AdjustedAt.IsZero() {
			adj.AdjustedAt = time.Now()
		}
		if userID != nil {
			adj.CreatedBy = userID.(string)
		}
		if adj.Reason == "" {
			adj.Reason = "other"
		}

		if _, err := adjustmentCollection.InsertOne(ctx, adj); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Stock updated but failed to save adjustment record"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Adjustment created successfully",
			"data": gin.H{
				"id":          adj.ID.Hex(),
				"previousQty": currentQty,
				"newQty":      newQty,
			},
		})
	}
}

func GetAllAdjustments() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if itemID := c.Query("itemId"); itemID != "" {
			filter["itemId"] = itemID
		}
		if adjType := c.Query("type"); adjType != "" {
			filter["type"] = adjType
		}

		total, _ := adjustmentCollection.CountDocuments(ctx, filter)

		limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "100"), 10, 64)
		if limit < 1 || limit > 500 {
			limit = 100
		}
		page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
		if page < 1 {
			page = 1
		}
		skip := (page - 1) * limit

		opts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetSkip(skip).
			SetLimit(limit)

		cursor, err := adjustmentCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch adjustments"})
			return
		}
		defer cursor.Close(ctx)

		var adjustments []models.StockAdjustment
		if err := cursor.All(ctx, &adjustments); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode adjustments"})
			return
		}
		if adjustments == nil {
			adjustments = []models.StockAdjustment{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Adjustments retrieved successfully",
			"data":    gin.H{"adjustments": adjustments, "total": total, "page": page, "limit": limit},
		})
	}
}
