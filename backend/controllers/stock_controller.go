package controllers

import (
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

		// Build item-group id → name map
		igMap := map[string]string{}
		igCol := config.GetCollection(config.DB, "item_groups")
		igCursor, igErr := igCol.Find(ctx, bson.M{"orgId": orgIDStr})
		if igErr == nil {
			defer igCursor.Close(ctx)
			var groups []bson.M
			igCursor.All(ctx, &groups)
			for _, g := range groups {
				if id, ok := g["_id"].(primitive.ObjectID); ok {
					igMap[id.Hex()] = fmt.Sprintf("%v", g["name"])
				}
			}
		}

		type StockWithCategory struct {
			models.Stock
			CategoryName string `json:"categoryName,omitempty"`
		}
		enriched := make([]StockWithCategory, len(stocks))
		for i, s := range stocks {
			enriched[i] = StockWithCategory{Stock: s, CategoryName: igMap[s.Category]}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "success",
			"data":    enriched,
		})
	}
}

var stockCollection = config.GetCollection(config.DB, "stocks")

// GetItemStockAvailability returns in-hand, committed, and available qty for one item.
// Committed = qty already reserved in open/confirmed/processing sales orders.
// Available = in-hand - committed (floored at 0).
func GetItemStockAvailability() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		itemIDStr := c.Param("id")
		itemObjID, err := primitive.ObjectIDFromHex(itemIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid item ID"})
			return
		}

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		// ── 1. In-hand quantity from the stocks document ──────────────────
		var stock models.Stock
		if err := stockCollection.FindOne(ctx, bson.M{"_id": itemObjID}).Decode(&stock); err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"message": "Item not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
			}
			return
		}
		inHand, _ := strconv.ParseFloat(stock.Quantity, 64)

		// ── 2. Committed qty from open/confirmed/processing orders ─────────
		soCol := config.GetCollection(config.DB, "sales_orders")
		pipeline := []bson.M{
			{"$match": bson.M{
				"orgId":          orgIDStr,
				"status":         bson.M{"$in": []string{"open", "confirmed", "processing"}},
				"items.itemId":   itemIDStr,
			}},
			{"$unwind": "$items"},
			{"$match": bson.M{"items.itemId": itemIDStr}},
			{"$group": bson.M{
				"_id":       nil,
				"committed": bson.M{"$sum": "$items.quantity"},
			}},
		}
		cur, err := soCol.Aggregate(ctx, pipeline)
		var committedRes []struct {
			Committed float64 `bson:"committed"`
		}
		if err == nil {
			_ = cur.All(ctx, &committedRes)
		}
		committed := 0.0
		if len(committedRes) > 0 {
			committed = committedRes[0].Committed
		}

		// ── 3. Requested qty from pending_approval orders ────────────
		reqPipeline := []bson.M{
			{"$match": bson.M{
				"orgId":        orgIDStr,
				"status":       "pending_approval",
				"items.itemId": itemIDStr,
			}},
			{"$unwind": "$items"},
			{"$match": bson.M{"items.itemId": itemIDStr}},
			{"$group": bson.M{
				"_id":       nil,
				"requested": bson.M{"$sum": "$items.quantity"},
			}},
		}
		reqCur, err2 := soCol.Aggregate(ctx, reqPipeline)
		var requestedRes []struct {
			Requested float64 `bson:"requested"`
		}
		if err2 == nil {
			_ = reqCur.All(ctx, &requestedRes)
		}
		requested := 0.0
		if len(requestedRes) > 0 {
			requested = requestedRes[0].Requested
		}

		available := inHand - committed
		if available < 0 {
			available = 0
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "success",
			"data": gin.H{
				"itemId":    itemIDStr,
				"itemName":  stock.Name,
				"unit":      stock.Unit,
				"inHand":    inHand,
				"committed": committed,
				"requested": requested,
				"available": available,
			},
		})
	}
}

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
