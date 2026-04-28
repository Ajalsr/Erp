package controllers

import (
	"context"
	"fmt"
	"math"
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

var purchaseOrderCollection *mongo.Collection = config.GetCollection(config.DB, "purchase_orders")

// round2 rounds to 2 decimal places
func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

// calcLineBase returns the taxable base for one line (qty × rate − discount)
func calcLineBase(qty, rate, discount float64, discountType string) float64 {
	base := qty * rate
	switch discountType {
	case "percentage":
		base = base - base*(discount/100)
	case "fixed":
		base = base - discount
	}
	if base < 0 {
		base = 0
	}
	return round2(base)
}

// buildTaxGroups groups lines by unit rate and computes VAT per group
// This matches the display: all items at rate 750 → one group, rate 250 → another
func buildTaxGroups(items []models.PurchaseOrderItem) []models.TaxGroup {
	type groupAcc struct {
		rate float64
		base float64
	}
	// Use a slice to preserve insertion order
	order := []float64{}
	groups := map[float64]*groupAcc{}

	for _, item := range items {
		if _, exists := groups[item.Rate]; !exists {
			order = append(order, item.Rate)
			groups[item.Rate] = &groupAcc{rate: item.Rate}
		}
		groups[item.Rate].base += item.BaseAmount
	}

	result := make([]models.TaxGroup, 0, len(order))
	for _, rate := range order {
		g := groups[rate]
		base := round2(g.base)
		tax := round2(base * 0.05)
		result = append(result, models.TaxGroup{
			Rate:       rate,
			TaxRate:    5,
			BaseAmount: base,
			TaxAmount:  tax,
		})
	}
	return result
}

func CreatePurchaseOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		var req models.PurchaseOrder
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		// ── Process each line item ────────────────────────────────────────
		var processedItems []models.PurchaseOrderItem
		var subTotal float64

		for _, item := range req.Items {
			base := calcLineBase(item.Quantity, item.Rate, item.Discount, item.DiscountType)
			tax := round2(base * 0.05) // 5% VAT per line
			amount := round2(base + tax)

			processedItems = append(processedItems, models.PurchaseOrderItem{
				ID:           primitive.NewObjectID(),
				ItemID:       item.ItemID,
				Details:      item.Details,
				Quantity:     item.Quantity,
				Rate:         item.Rate,
				Discount:     item.Discount,
				DiscountType: item.DiscountType,
				BaseAmount:   base,
				TaxRate:      5,
				TaxAmount:    tax,
				Amount:       amount,
				Unit:         item.Unit,
			})
			subTotal += base
		}

		subTotal = round2(subTotal)

		// ── Build grouped tax breakdown ───────────────────────────────────
		taxGroups := buildTaxGroups(processedItems)
		totalTax := round2(func() float64 {
			t := 0.0
			for _, g := range taxGroups {
				t += g.TaxAmount
			}
			return t
		}())

		shipping := round2(req.ShippingCharges)
		adjustment := round2(req.Adjustment)
		total := round2(subTotal + totalTax + shipping + adjustment)

		// ── Generate order number ─────────────────────────────────────────
		if req.OrderNumber == "" {
			req.OrderNumber = generatePONumber(ctx)
		}

		// ── CreatedBy / OrgID from JWT ───────────────────────────────────
		createdBy := ""
		if uid, exists := c.Get("userId"); exists {
			createdBy = fmt.Sprintf("%v", uid)
		}
		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		po := models.PurchaseOrder{
			ID:                   primitive.NewObjectID(),
			OrderNumber:          req.OrderNumber,
			VendorID:             req.VendorID,
			VendorName:           req.VendorName,
			OrderDate:            req.OrderDate,
			ExpectedDeliveryDate: req.ExpectedDeliveryDate,
			PaymentTerms:         req.PaymentTerms,
			DeliveryAddress:      req.DeliveryAddress,
			ShipmentPreference:   req.ShipmentPreference,
			ReferenceNo:          req.ReferenceNo,
			Items:                processedItems,
			SubTotal:             subTotal,
			TaxGroups:            taxGroups,
			TotalTax:             totalTax,
			ShippingCharges:      shipping,
			Adjustment:           adjustment,
			Total:                total,
			CustomerNotes:        req.CustomerNotes,
			TermsAndConditions:   req.TermsAndConditions,
			Status:               "draft",
			OrgID:                orgIDStr,
			CreatedAt:            time.Now(),
			UpdatedAt:            time.Now(),
			CreatedBy:            createdBy,
		}

		_, err := purchaseOrderCollection.InsertOne(ctx, po)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to create purchase order",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Purchase order created successfully",
			"data": gin.H{
				"id":          po.ID.Hex(),
				"orderNumber": po.OrderNumber,
				"subTotal":    po.SubTotal,
				"taxGroups":   po.TaxGroups,
				"totalTax":    po.TotalTax,
				"total":       po.Total,
				"status":      po.Status,
			},
		})
	}
}

func UpdatePurchaseOrderStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid purchase order ID"})
			return
		}

		var body struct {
			Status string `json:"status"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Status == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "status field is required"})
			return
		}

		result, err := purchaseOrderCollection.UpdateOne(ctx,
			bson.M{"_id": objectID},
			bson.M{"$set": bson.M{"status": body.Status, "updatedAt": time.Now()}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update purchase order status"})
			return
		}
		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Purchase order not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Purchase order status updated"})
	}
}

func generatePONumber(ctx context.Context) string {
	now := time.Now()
	prefix := fmt.Sprintf("PO%02d%02d", int(now.Month()), now.Year()%100)
	filter := bson.M{"orderNumber": bson.M{"$regex": "^" + prefix}}
	opts := options.FindOne().SetSort(bson.D{{Key: "orderNumber", Value: -1}})
	var last bson.M
	next := 1
	if err := purchaseOrderCollection.FindOne(ctx, filter, opts).Decode(&last); err == nil {
		if num, ok := last["orderNumber"].(string); ok && len(num) >= 10 {
			if seq, err := strconv.Atoi(num[6:]); err == nil {
				next = seq + 1
			}
		}
	}
	return fmt.Sprintf("%s%04d", prefix, next)
}

func GetAllPurchaseOrders() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "15"))
		skip := (page - 1) * limit

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		andClauses := []bson.M{
			{"$or": []bson.M{
				{"orgId": orgIDStr},
				{"orgId": bson.M{"$exists": false}},
			}},
		}
		if status := c.Query("status"); status != "" {
			andClauses = append(andClauses, bson.M{"status": status})
		}
		if q := c.Query("q"); q != "" {
			andClauses = append(andClauses, bson.M{"$or": []bson.M{
				{"orderNumber": bson.M{"$regex": q, "$options": "i"}},
				{"vendorName": bson.M{"$regex": q, "$options": "i"}},
			}})
		}
		filter := bson.M{"$and": andClauses}

		total, _ := purchaseOrderCollection.CountDocuments(ctx, filter)
		opts := options.Find().
			SetSkip(int64(skip)).
			SetLimit(int64(limit)).
			SetSort(bson.D{{Key: "createdAt", Value: -1}})

		cursor, err := purchaseOrderCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "message": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var orders []models.PurchaseOrder
		cursor.All(ctx, &orders)
		if orders == nil {
			orders = []models.PurchaseOrder{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Purchase orders retrieved successfully",
			"data": gin.H{
				"purchaseOrders": orders,
				"total":          total,
				"page":           page,
				"limit":          limit,
				"totalPages":     int(math.Ceil(float64(total) / float64(limit))),
			},
		})
	}
}

func GetPurchaseOrderStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		orgFilter := bson.M{"$or": []bson.M{
			{"orgId": orgIDStr},
			{"orgId": bson.M{"$exists": false}},
		}}

		total, _ := purchaseOrderCollection.CountDocuments(ctx, orgFilter)
		pending, _ := purchaseOrderCollection.CountDocuments(ctx, bson.M{"$and": []bson.M{orgFilter, {"status": "pending"}}})
		ordered, _ := purchaseOrderCollection.CountDocuments(ctx, bson.M{"$and": []bson.M{orgFilter, {"status": "ordered"}}})
		received, _ := purchaseOrderCollection.CountDocuments(ctx, bson.M{"$and": []bson.M{orgFilter, {"status": "received"}}})

		// Total value pipeline
		pipeline := []bson.M{
			{"$match": orgFilter},
			{"$group": bson.M{"_id": nil, "totalAmount": bson.M{"$sum": "$total"}}},
		}
		cursor, _ := purchaseOrderCollection.Aggregate(ctx, pipeline)
		var aggResult []bson.M
		cursor.All(ctx, &aggResult)
		totalAmount := 0.0
		if len(aggResult) > 0 {
			totalAmount, _ = aggResult[0]["totalAmount"].(float64)
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Stats retrieved",
			"data": gin.H{
				"totalOrders":    total,
				"pendingOrders":  pending,
				"orderedOrders":  ordered,
				"receivedOrders": received,
				"totalAmount":    round2(totalAmount),
			},
		})
	}
}
