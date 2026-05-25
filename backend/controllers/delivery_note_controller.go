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

var deliveryNotesCollection *mongo.Collection = config.GetCollection(config.DB, "delivery_notes")

func generateDNNumber(ctx context.Context, orgID string) string {
	count, _ := deliveryNotesCollection.CountDocuments(ctx, bson.M{"orgId": orgID})
	year := time.Now().Year()
	return fmt.Sprintf("DN-%d-%04d", year, count+1)
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
func CreateDeliveryNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var req models.DeliveryNote
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}

		if req.DNNumber == "" {
			req.DNNumber = generateDNNumber(ctx, fmt.Sprintf("%v", orgID))
		}
		if req.Status == "" {
			req.Status = "draft"
		}

		req.ID = primitive.NewObjectID()
		req.OrgID = fmt.Sprintf("%v", orgID)
		req.CreatedBy = fmt.Sprintf("%v", userID)
		req.CreatedAt = time.Now()
		req.UpdatedAt = time.Now()
		if req.Date == "" {
			req.Date = time.Now().Format("02 Jan 2006")
		}

		result, err := deliveryNotesCollection.InsertOne(ctx, req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create delivery note", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Delivery note created successfully",
			"data": gin.H{
				"id":       req.ID.Hex(),
				"dnNumber": req.DNNumber,
				"status":   req.Status,
				"insertedId": result.InsertedID,
			},
		})
	}
}

// ─── GET ALL ──────────────────────────────────────────────────────────────────
func GetAllDeliveryNotes() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		filter := bson.M{"orgId": fmt.Sprintf("%v", orgID)}

		if status := c.Query("status"); status != "" && status != "all" {
			filter["status"] = status
		}
		if c.Query("backorder") == "true" {
			filter["dnNumber"] = bson.M{"$regex": "^BO-"}
		}
		if itemID := c.Query("itemId"); itemID != "" {
			filter["items.itemId"] = itemID
		}
		if search := c.Query("search"); search != "" {
			filter["$or"] = []bson.M{
				{"dnNumber":     bson.M{"$regex": search, "$options": "i"}},
				{"customerName": bson.M{"$regex": search, "$options": "i"}},
				{"orderNumber":  bson.M{"$regex": search, "$options": "i"}},
			}
		}

		page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
		limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "50"), 10, 64)
		skip := (page - 1) * limit

		total, _ := deliveryNotesCollection.CountDocuments(ctx, filter)
		opts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetSkip(skip).
			SetLimit(limit)

		cursor, err := deliveryNotesCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch delivery notes"})
			return
		}
		defer cursor.Close(ctx)

		var notes []models.DeliveryNote
		if err := cursor.All(ctx, &notes); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode delivery notes"})
			return
		}
		if notes == nil {
			notes = []models.DeliveryNote{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Delivery notes retrieved successfully",
			"data": gin.H{
				"deliveryNotes": notes,
				"total":         total,
				"page":          page,
				"limit":         limit,
			},
		})
	}
}

// ─── GET STATS ────────────────────────────────────────────────────────────────
func GetDeliveryNoteStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		base := bson.M{"orgId": fmt.Sprintf("%v", orgID)}

		orgIDStr := fmt.Sprintf("%v", orgID)
		total, _ := deliveryNotesCollection.CountDocuments(ctx, base)
		draft, _ := deliveryNotesCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "status": "draft"})
		confirmed, _ := deliveryNotesCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "status": "confirmed"})
		dispatched, _ := deliveryNotesCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "status": "dispatched"})
		delivered, _ := deliveryNotesCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "status": "delivered"})
		backorders, _ := deliveryNotesCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "dnNumber": bson.M{"$regex": "^BO-"}})

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Stats retrieved",
			"data": gin.H{
				"total": total, "draft": draft, "confirmed": confirmed,
				"dispatched": dispatched, "delivered": delivered, "backorders": backorders,
			},
		})
	}
}

// ─── GET BY ID ────────────────────────────────────────────────────────────────
func GetDeliveryNoteByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid delivery note ID"})
			return
		}

		orgID, _ := c.Get("orgId")
		var note models.DeliveryNote
		err = deliveryNotesCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": fmt.Sprintf("%v", orgID)}).Decode(&note)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Delivery note not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch delivery note"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Delivery note retrieved", "data": note})
	}
}

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────
func UpdateDeliveryNoteStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid delivery note ID"})
			return
		}

		var body struct {
			Status string `json:"status"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Status == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Status is required"})
			return
		}

		allowed := map[string]bool{"draft": true, "confirmed": true, "dispatched": true, "delivered": true}
		if !allowed[body.Status] {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid status value"})
			return
		}

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		// Fetch the DN before updating (need items + salesOrderIds for fulfillment sync)
		var dn models.DeliveryNote
		if err := deliveryNotesCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgIDStr}).Decode(&dn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Delivery note not found"})
			return
		}

		// Enforce progression: draft→confirmed→dispatched→delivered (no skipping, no going back)
		progressionOrder := map[string]int{"draft": 0, "confirmed": 1, "dispatched": 2, "delivered": 3}
		if progressionOrder[body.Status] != progressionOrder[dn.Status]+1 {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": fmt.Sprintf("Cannot transition from '%s' to '%s'", dn.Status, body.Status),
			})
			return
		}

		setFields := bson.M{"status": body.Status, "updatedAt": time.Now()}
		if body.Status == "delivered" {
			now := time.Now()
			setFields["deliveredAt"] = now
		}

		result, err := deliveryNotesCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": orgIDStr},
			bson.M{"$set": setFields},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update status"})
			return
		}
		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Delivery note not found"})
			return
		}

		// On dispatched: deduct stock + create back-order DN for any unfulfilled qty
		if body.Status == "dispatched" {
			go deductStockOnDispatch(dn, orgIDStr)
			go createBackorderDN(dn, orgIDStr)
		}

		// On delivered/dispatched: recompute fulfilled qty per SO item from all DNs
		if body.Status == "delivered" || body.Status == "dispatched" {
			go syncSOFulfillment(dn.SalesOrderIDs, orgIDStr, body.Status)
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Status updated successfully", "data": gin.H{"status": body.Status}})
	}
}

// ─── MARK INVOICED ────────────────────────────────────────────────────────────
func MarkDeliveryNoteInvoiced() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid delivery note ID"})
			return
		}

		var body struct {
			InvoiceID     string `json:"invoiceId"`
			InvoiceNumber string `json:"invoiceNumber"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.InvoiceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "invoiceId is required"})
			return
		}

		orgID, _ := c.Get("orgId")
		result, err := deliveryNotesCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": fmt.Sprintf("%v", orgID)},
			bson.M{"$set": bson.M{
				"invoiceId":     body.InvoiceID,
				"invoiceNumber": body.InvoiceNumber,
				"updatedAt":     time.Now(),
			}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to mark as invoiced"})
			return
		}
		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Delivery note not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Delivery note marked as invoiced", "data": gin.H{"invoiceId": body.InvoiceID, "invoiceNumber": body.InvoiceNumber}})
	}
}

// syncSOFulfillment recomputes the fulfilledQty on every SalesOrderItem for the
// given SO IDs by aggregating outboundQuantity across all delivered/dispatched DNs.
func syncSOFulfillment(soIDs []string, orgID string, dnStatus string) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	for _, soID := range soIDs {
		// Sum outboundQuantity per itemId from all DNs that reference this SO
		// and are in delivered or dispatched status
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{
				"orgId":         orgID,
				"salesOrderIds": soID,
				"status":        bson.M{"$in": []string{"delivered", "dispatched"}},
			}}},
			{{Key: "$unwind", Value: "$items"}},
			{{Key: "$match", Value: bson.M{"items.salesOrderId": soID}}},
			{{Key: "$group", Value: bson.M{
				"_id":   "$items.itemId",
				"total": bson.M{"$sum": "$items.outboundQuantity"},
			}}},
		}

		cursor, err := deliveryNotesCollection.Aggregate(ctx, pipeline)
		if err != nil {
			continue
		}
		var rows []struct {
			ItemID string  `bson:"_id"`
			Total  float64 `bson:"total"`
		}
		cursor.All(ctx, &rows)
		cursor.Close(ctx)

		if len(rows) == 0 {
			continue
		}

		// Build fulfilled map: itemId → total fulfilled qty
		fulfilled := map[string]float64{}
		for _, r := range rows {
			fulfilled[r.ItemID] = r.Total
		}

		// Fetch SO
		soObjID, err := primitive.ObjectIDFromHex(soID)
		if err != nil {
			continue
		}
		var so models.SalesOrder
		if err := salesOrdersCollection.FindOne(ctx, bson.M{"_id": soObjID, "orgId": orgID}).Decode(&so); err != nil {
			continue
		}

		// Update each item's fulfilledQty + compute overall fulfillment status
		allFulfilled := true
		anyFulfilled := false
		for i := range so.Items {
			qty := fulfilled[so.Items[i].ItemID]
			so.Items[i].FulfilledQty = qty
			if qty < so.Items[i].Quantity {
				allFulfilled = false
			}
			if qty > 0 {
				anyFulfilled = true
			}
		}

		fulfillmentStatus := "unfulfilled"
		if allFulfilled {
			fulfillmentStatus = "fulfilled"
		} else if anyFulfilled {
			fulfillmentStatus = "partial"
		}

		setFields := bson.M{
			"items":             so.Items,
			"fulfillmentStatus": fulfillmentStatus,
			"updatedAt":         time.Now(),
		}
		nonFinal := map[string]bool{
			"draft": true, "pending": true, "open": true, "approved": true,
			"confirmed": true, "pending_approval": true,
		}
		if dnStatus == "dispatched" && nonFinal[so.Status] {
			setFields["status"] = "shipped"
		} else if dnStatus == "delivered" && so.Status == "shipped" {
			setFields["status"] = "completed"
		}

		salesOrdersCollection.UpdateOne(ctx,
			bson.M{"_id": soObjID, "orgId": orgID},
			bson.M{"$set": setFields},
		)
	}
}

// deductStockOnDispatch deducts the actual outboundQuantity for each DN item from stock.
// Runs as a goroutine after DN status → dispatched.
func deductStockOnDispatch(dn models.DeliveryNote, orgID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	for _, item := range dn.Items {
		if item.ItemID == "" || item.OutboundQuantity <= 0 {
			continue
		}
		itemObjID, err := primitive.ObjectIDFromHex(item.ItemID)
		if err != nil {
			continue
		}
		var stock models.Stock
		if err := stockCollection.FindOne(ctx, bson.M{"_id": itemObjID, "orgId": orgID}).Decode(&stock); err != nil {
			continue
		}
		currentQty := 0.0
		fmt.Sscanf(stock.Quantity, "%f", &currentQty)
		newQty := currentQty - item.OutboundQuantity
		if newQty < 0 {
			newQty = 0
		}
		stockCollection.UpdateOne(ctx,
			bson.M{"_id": itemObjID, "orgId": orgID},
			bson.M{"$set": bson.M{"quantity": fmt.Sprintf("%g", newQty), "updated_at": time.Now()}},
		)
		// Audit trail
		adj := models.StockAdjustment{
			ID:          primitive.NewObjectID(),
			OrgID:       orgID,
			ItemID:      item.ItemID,
			ItemName:    item.Name,
			ItemCode:    item.ItemCode,
			Quantity:    item.OutboundQuantity,
			Type:        "decrease",
			Reason:      "sale",
			Reference:   dn.DNNumber,
			PreviousQty: currentQty,
			NewQty:      newQty,
			AdjustedAt:  time.Now(),
			CreatedAt:   time.Now(),
		}
		adjustmentCollection.InsertOne(ctx, adj)
	}
}

// createBackorderDN checks each SO linked to the dispatched DN.
// If any item's total fulfilled qty < ordered qty, it creates a draft DN
// for the remaining quantities so the warehouse can dispatch the rest later.
func createBackorderDN(dn models.DeliveryNote, orgID string) {
	// Small delay so syncSOFulfillment can commit fulfilledQty first
	time.Sleep(2 * time.Second)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Group DN items by SalesOrderID
	soItemMap := map[string][]models.DNItem{}
	for _, item := range dn.Items {
		if item.SalesOrderID == "" {
			continue
		}
		soItemMap[item.SalesOrderID] = append(soItemMap[item.SalesOrderID], item)
	}

	var backorderItems []models.DNItem

	for soID, dnItems := range soItemMap {
		soObjID, err := primitive.ObjectIDFromHex(soID)
		if err != nil {
			continue
		}
		var so models.SalesOrder
		if err := salesOrdersCollection.FindOne(ctx, bson.M{"_id": soObjID, "orgId": orgID}).Decode(&so); err != nil {
			continue
		}

		// Build ordered qty map: itemID → ordered qty
		orderedMap := map[string]float64{}
		for _, soItem := range so.Items {
			orderedMap[soItem.ItemID] = soItem.Quantity
		}

		// Aggregate total fulfilled qty per itemID from all dispatched/delivered DNs for this SO
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{
				"orgId":         orgID,
				"salesOrderIds": soID,
				"status":        bson.M{"$in": []string{"dispatched", "delivered"}},
			}}},
			{{Key: "$unwind", Value: "$items"}},
			{{Key: "$match", Value: bson.M{"items.salesOrderId": soID}}},
			{{Key: "$group", Value: bson.M{
				"_id":   "$items.itemId",
				"total": bson.M{"$sum": "$items.outboundQuantity"},
			}}},
		}
		cursor, err := deliveryNotesCollection.Aggregate(ctx, pipeline)
		if err != nil {
			continue
		}
		var rows []struct {
			ItemID string  `bson:"_id"`
			Total  float64 `bson:"total"`
		}
		cursor.All(ctx, &rows)
		cursor.Close(ctx)

		fulfilled := map[string]float64{}
		for _, r := range rows {
			fulfilled[r.ItemID] = r.Total
		}

		// Find items with remaining qty
		for _, item := range dnItems {
			ordered := orderedMap[item.ItemID]
			remaining := ordered - fulfilled[item.ItemID]
			if remaining > 0.001 {
				backorderItems = append(backorderItems, models.DNItem{
					ItemID:           item.ItemID,
					Name:             item.Name,
					ItemCode:         item.ItemCode,
					Unit:             item.Unit,
					OutboundQuantity: remaining,
					Rate:             item.Rate,
					SellingPrice:     item.SellingPrice,
					Discount:         item.Discount,
					SalesOrderID:     item.SalesOrderID,
					SalesOrderNumber: item.SalesOrderNumber,
				})
			}
		}
	}

	if len(backorderItems) == 0 {
		return
	}

	// Create draft back-order DN
	boID := primitive.NewObjectID()
	boNumber := "BO-" + dn.DNNumber
	backorder := bson.M{
		"_id":             boID,
		"dnNumber":        boNumber,
		"date":            time.Now().Format("02 Jan 2006"),
		"customerName":    dn.CustomerName,
		"customerId":      dn.CustomerID,
		"customerCode":    dn.CustomerCode,
		"customerPhone":   dn.CustomerPhone,
		"customerEmail":   dn.CustomerEmail,
		"customerAddress": dn.CustomerAddress,
		"custPoNo":        dn.CustPoNo,
		"custPoDate":      dn.CustPoDate,
		"salesperson":     dn.Salesperson,
		"orderNumber":     dn.OrderNumber,
		"salesOrderIds":   dn.SalesOrderIDs,
		"items":           backorderItems,
		"note":            fmt.Sprintf("Back-order from %s — unfulfilled quantities", dn.DNNumber),
		"status":          "draft",
		"subTotal":        0.0,
		"totalDiscount":   0.0,
		"totalTax":        0.0,
		"grandTotal":      0.0,
		"orgId":           orgID,
		"createdAt":       time.Now(),
		"updatedAt":       time.Now(),
	}
	deliveryNotesCollection.InsertOne(ctx, backorder)
}
