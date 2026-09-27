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

		// Weighted-average purchase cost per item, from purchase-order lines:
		// Σ(baseAmount) / Σ(quantity). Used as the stock-value cost when an item has no
		// cost_price set (e.g. only a PO amount was ever entered).
		avgCostMap := map[string]float64{}
		poCol := config.GetCollection(config.DB, "purchase_orders")
		poPipe := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgIDStr, "status": bson.M{"$ne": "cancelled"}}}},
			{{Key: "$unwind", Value: "$items"}},
			{{Key: "$group", Value: bson.M{
				"_id": "$items.itemId",
				"val": bson.M{"$sum": "$items.baseAmount"},
				"qty": bson.M{"$sum": "$items.quantity"},
			}}},
		}
		if cur, e := poCol.Aggregate(ctx, poPipe); e == nil {
			var rows []bson.M
			cur.All(ctx, &rows)
			toF := func(v interface{}) float64 {
				switch n := v.(type) {
				case float64:
					return n
				case int64:
					return float64(n)
				case int32:
					return float64(n)
				}
				return 0
			}
			for _, r := range rows {
				id, _ := r["_id"].(string)
				qty, val := toF(r["qty"]), toF(r["val"])
				if id != "" && qty > 0 {
					avgCostMap[id] = val / qty
				}
			}
		}

		type StockWithCategory struct {
			models.Stock
			CategoryName string `json:"categoryName,omitempty"`
			// PurchaseAvgCost: weighted-avg unit cost from POs — fallback for stock value
			// when cost_price is unset. 0 when the item was never purchased via a PO.
			PurchaseAvgCost float64 `json:"purchaseAvgCost,omitempty"`
		}
		enriched := make([]StockWithCategory, len(stocks))
		for i, s := range stocks {
			enriched[i] = StockWithCategory{Stock: s, CategoryName: igMap[s.Category], PurchaseAvgCost: avgCostMap[s.ID.Hex()]}
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

		// ── 2. Committed qty from all active orders ───────────────────────
		soCol := config.GetCollection(config.DB, "sales_orders")
		pipeline := []bson.M{
			{"$match": bson.M{
				"orgId":        orgIDStr,
				"status":       bson.M{"$in": []string{"open", "confirmed", "approved", "processing", "shipped"}},
				"items.itemId": itemIDStr,
			}},
			{"$unwind": "$items"},
			{"$match": bson.M{"items.itemId": itemIDStr}},
			{"$group": bson.M{
				"_id": nil,
				// Remaining (undispatched) qty only: ordered − already fulfilled, floored at 0.
				// Without subtracting fulfilledQty a partly-dispatched order over-reserves.
				"committed": bson.M{"$sum": bson.M{"$max": bson.A{0,
					bson.M{"$subtract": bson.A{"$items.quantity", bson.M{"$ifNull": bson.A{"$items.fulfilledQty", 0}}}},
				}}},
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

		// ── 3. Requested qty — pending_approval SOs only ──────────────────
		// NOTE: do NOT also add draft/confirmed delivery notes here. A DN derives from
		// an SO that is already counted in `committed` (fulfilledQty only increments at
		// dispatch), so adding the DN qty double-counts the same reservation. Stock on
		// hand is deducted at dispatch, at which point committed drops in lockstep.
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

		// Offload to Cloudinary; persist only the URL (same pattern as org
		// letterhead/stamp — see storeOrgImage in org_controller.go).
		url, upErr := storeOrgImage(ctx, item.Image, item.OrgID, "items/"+item.ID.Hex())
		if upErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to upload item image", "error": upErr.Error()})
			return
		}
		item.Image = url

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

// GetItemByID returns a single item by id, scoped to the org — used to load the edit form.
func GetItemByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid item ID format"})
			return
		}
		orgID, _ := c.Get("orgId")

		var item models.Stock
		if err := stockCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": fmt.Sprintf("%v", orgID)}).Decode(&item); err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Item not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch item"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": item})
	}
}

// UpdateItem edits an item's details. Stock quantities (quantity, opening_stock, the
// warehouse breakdown, committed/ordered) are managed by stock movements and are NOT
// touched here — only the descriptive/pricing/account fields are updated.
func UpdateItem() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid item ID format"})
			return
		}

		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}

		// Strip fields that must not be overwritten via an edit.
		for _, k := range []string{"_id", "orgId", "created_at", "createdBy", "created_by", "quantity", "opening_stock", "warehouseStock", "quantity_ordered", "quantity_sold"} {
			delete(body, k)
		}
		body["updated_at"] = time.Now()

		orgID, _ := c.Get("orgId")

		// Offload to Cloudinary if a new data-URL was sent; same pattern as AddItem.
		if imgVal, ok := body["image"]; ok {
			imgStr, _ := imgVal.(string)
			url, upErr := storeOrgImage(ctx, imgStr, fmt.Sprintf("%v", orgID), "items/"+objectID.Hex())
			if upErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to upload item image", "error": upErr.Error()})
				return
			}
			body["image"] = url
		}

		res, err := stockCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": fmt.Sprintf("%v", orgID)},
			bson.M{"$set": body},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update item", "error": err.Error()})
			return
		}
		if res.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Item not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Item updated successfully"})
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
		defWh, _ := defaultWarehouse(ctx, orgIDStr)
		whMap := deductWarehouses(seedWarehouseMap(stock.WarehouseStock, currentQty, defWh), defWh, body.ReduceBy)
		update := bson.M{"$set": bson.M{"quantity": fmt.Sprintf("%g", newQty), "warehouseStock": whMap, "updated_at": time.Now()}}
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

		defWh, _ := defaultWarehouse(ctx, orgIDStr)
		whMap := addToWarehouse(seedWarehouseMap(stock.WarehouseStock, currentQty, defWh), defWh, body.IncreaseBy)
		update := bson.M{"$set": bson.M{"quantity": fmt.Sprintf("%g", newQty), "warehouseStock": whMap, "updated_at": time.Now()}}
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

// BackfillWarehouseStock seeds the per-warehouse breakdown for legacy items: any stock
// with no warehouseStock map gets its whole on-hand total parked in the default
// warehouse. Idempotent — safe to run repeatedly. Run once after adding a warehouse.
func BackfillWarehouseStock() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		defWh, defWhName := defaultWarehouse(ctx, orgIDStr)
		if defWh == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "No warehouse found. Create a warehouse first."})
			return
		}

		cursor, err := stockCollection.Find(ctx, bson.M{
			"orgId": orgIDStr,
			"$or": []bson.M{
				{"warehouseStock": bson.M{"$exists": false}},
				{"warehouseStock": bson.M{"$eq": bson.M{}}},
				{"warehouseStock": nil},
			},
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "message": "Failed to read stocks"})
			return
		}
		defer cursor.Close(ctx)

		var stocks []models.Stock
		cursor.All(ctx, &stocks)

		updated := 0
		for _, s := range stocks {
			qty := 0.0
			fmt.Sscanf(s.Quantity, "%f", &qty)
			if qty == 0 {
				continue
			}
			stockCollection.UpdateOne(ctx,
				bson.M{"_id": s.ID, "orgId": orgIDStr},
				bson.M{"$set": bson.M{"warehouseStock": map[string]float64{defWh: qty}, "updated_at": time.Now()}},
			)
			updated++
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": fmt.Sprintf("Seeded %d item(s) into default warehouse '%s'", updated, defWhName),
			"data":    gin.H{"updated": updated, "defaultWarehouse": defWhName},
		})
	}
}

// POST /api/items/import — bulk-create stock items from parsed CSV rows.
// Body: { "items": [ { name, item_code, unit, selling_price, ... }, ... ] }.
func ImportItems() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		var body struct {
			Items []models.Stock `json:"items"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if len(body.Items) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "No rows to import"})
			return
		}
		if len(body.Items) > 5000 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Too many rows — import up to 5000 at a time"})
			return
		}

		orgIDStr := fmt.Sprintf("%v", mustGet(c, "orgId"))
		imported := 0
		type rowErr struct {
			Row     int    `json:"row"`
			Message string `json:"message"`
		}
		errors := []rowErr{}

		for i, it := range body.Items {
			if it.Name == "" {
				errors = append(errors, rowErr{Row: i + 1, Message: "missing item name"})
				continue
			}
			now := time.Now()
			it.ID = primitive.NewObjectID()
			it.OrgID = orgIDStr
			it.CreatedAt = now
			it.UpdatedAt = now
			if _, err := stockCollection.InsertOne(ctx, it); err != nil {
				errors = append(errors, rowErr{Row: i + 1, Message: "insert failed"})
				continue
			}
			imported++
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": fmt.Sprintf("Imported %d of %d items", imported, len(body.Items)),
			"data":    gin.H{"imported": imported, "failed": len(errors), "errors": errors},
		})
	}
}
