package controllers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// getUserRole returns the role of userId within orgIDStr ("owner","admin","member","viewer")
func getUserRole(ctx context.Context, userID, orgIDStr string) string {
	orgMemberCol := config.GetCollection(config.DB, "org_members")
	orgObjID, err := primitive.ObjectIDFromHex(orgIDStr)
	if err != nil {
		return "member"
	}
	var member struct {
		Role string `bson:"role"`
	}
	err = orgMemberCol.FindOne(ctx, bson.M{
		"orgId":  orgObjID,
		"userId": userID,
		"status": "active",
	}).Decode(&member)
	if err != nil {
		return "member"
	}
	return member.Role
}

// generateLPONumber creates a sequential LPO number
func generateLPONumber(ctx context.Context) string {
	count, _ := purchaseOrderCollection.CountDocuments(ctx, bson.M{"lpoNumber": bson.M{"$exists": true, "$ne": ""}})
	return fmt.Sprintf("LPO-%04d", count+1)
}

var purchaseOrderCollection *mongo.Collection = config.GetCollection(config.DB, "purchase_orders")

// normaliseOrigin maps any stored variant to the canonical form used for VAT logic.
// e.g. "Free Zone", "freezone", "free zone" → "free_zone"
func normaliseOrigin(o string) string {
	s := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(o, "-", "_"), " ", "_"))
	if strings.Contains(s, "free") || s == "free_zone" || s == "freezone" {
		return "free_zone"
	}
	if s == "overseas" {
		return "overseas"
	}
	return "mainland"
}

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
// buildTaxGroups summarises VAT by rate. Goods contribute their base at the vendor-origin
// rate; each item's freight contributes its amount at the freight rate. Grouped by tax %
// so a 0%-freight bucket shows separately from 5% goods.
func buildTaxGroups(items []models.PurchaseOrderItem) []models.TaxGroup {
	type groupAcc struct {
		taxRate float64
		base    float64
	}
	order := []float64{}
	groups := map[float64]*groupAcc{}
	add := func(taxRate, base float64) {
		if base == 0 {
			return
		}
		if _, ok := groups[taxRate]; !ok {
			order = append(order, taxRate)
			groups[taxRate] = &groupAcc{taxRate: taxRate}
		}
		groups[taxRate].base += base
	}

	for _, item := range items {
		add(item.TaxRate, item.BaseAmount)
		if item.Freight > 0 {
			add(item.FreightTaxRate, item.Freight)
		}
	}

	result := make([]models.TaxGroup, 0, len(order))
	for _, rate := range order {
		g := groups[rate]
		base := round2(g.base)
		result = append(result, models.TaxGroup{
			Rate:       rate,
			TaxRate:    rate,
			BaseAmount: base,
			TaxAmount:  round2(base * rate / 100),
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

		// Approval gate — hold the PO for an approver when the org requires it.
		if !c.GetBool("approvalReplay") {
			orgIDVal, _ := c.Get("orgId")
			userIDVal, _ := c.Get("userId")
			title := req.VendorName
			if title == "" {
				title = "Purchase order"
			}
			if holdForApproval(c, ctx, fmt.Sprintf("%v", orgIDVal), fmt.Sprintf("%v", userIDVal), "", "po", "purchase_orders", title, req.Total, req) {
				return
			}
		}

		// ── Determine VAT rate based on vendor origin ─────────────────────
		// mainland → 5% | free_zone / overseas → 0%
		appliedTaxRate := 0.05
		vendorOrigin := ""
		if req.VendorID != "" {
			if vObjID, err2 := primitive.ObjectIDFromHex(req.VendorID); err2 == nil {
				orgID, _ := c.Get("orgId")
				var vendor struct {
					Origin string `bson:"origin"`
				}
				vendorCollection.FindOne(ctx, bson.M{"_id": vObjID, "orgId": fmt.Sprintf("%v", orgID)}).Decode(&vendor)
				vendorOrigin = normaliseOrigin(vendor.Origin)
				if vendorOrigin == "free_zone" || vendorOrigin == "overseas" {
					appliedTaxRate = 0.0
				}
			}
		}

		// ── Process each line item ────────────────────────────────────────
		var processedItems []models.PurchaseOrderItem
		var subTotal float64

		for _, item := range req.Items {
			base := calcLineBase(item.Quantity, item.Rate, item.Discount, item.DiscountType)
			tax := round2(base * appliedTaxRate)
			// Optional per-item freight, taxed at its OWN rate (independent of origin VAT).
			freight := round2(item.Freight)
			freightTax := round2(freight * item.FreightTaxRate / 100)
			amount := round2(base + tax + freight + freightTax)

			processedItems = append(processedItems, models.PurchaseOrderItem{
				ID:               primitive.NewObjectID(),
				ItemID:           item.ItemID,
				Details:          item.Details,
				Quantity:         item.Quantity,
				Rate:             item.Rate,
				Discount:         item.Discount,
				DiscountType:     item.DiscountType,
				BaseAmount:       base,
				TaxRate:          appliedTaxRate * 100,
				TaxAmount:        tax,
				Amount:           amount,
				Unit:             item.Unit,
				Freight:          freight,
				FreightTaxRate:   item.FreightTaxRate,
				FreightTaxAmount: freightTax,
			})
			subTotal += base + freight
		}

		subTotal = round2(subTotal)

		// ── Build grouped tax breakdown (goods at origin rate + freight at its rate) ──
		taxGroups := buildTaxGroups(processedItems)
		totalTax := round2(func() float64 {
			t := 0.0
			for _, it := range processedItems {
				t += it.TaxAmount + it.FreightTaxAmount
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

		// ── Determine approval status based on user role ──────────────────
		role := getUserRole(ctx, createdBy, orgIDStr)
		isAdmin := role == "owner" || role == "admin"

		poStatus := "pending_approval"
		approvalStatus := "pending"
		lpoNumber := ""
		if isAdmin {
			poStatus = "issued"
			approvalStatus = "approved"
			lpoNumber = generateLPONumber(ctx)
		}

		poTypeVal := req.POType
		if poTypeVal == "" {
			poTypeVal = "goods"
		}

		po := models.PurchaseOrder{
			ID:                   primitive.NewObjectID(),
			OrderNumber:          req.OrderNumber,
			VendorID:             req.VendorID,
			VendorName:           req.VendorName,
			VendorOrigin:         vendorOrigin,
			POType:               poTypeVal,
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
			Status:               poStatus,
			ApprovalStatus:       approvalStatus,
			LPONumber:            lpoNumber,
			OrgID:                orgIDStr,
			CreatedAt:            time.Now(),
			UpdatedAt:            time.Now(),
			CreatedBy:            createdBy,
		}
		if isAdmin {
			now := time.Now()
			po.ApprovedBy = createdBy
			po.ApprovedAt = &now
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

		// ── Increment quantity_ordered in stock for goods POs only ───────
		if poTypeVal == "goods" {
			stockCol := config.GetCollection(config.DB, "stocks")
			for _, item := range processedItems {
				if item.ItemID != "" {
					if itemObjID, err := primitive.ObjectIDFromHex(item.ItemID); err == nil {
						stockCol.UpdateOne(ctx,
							bson.M{"_id": itemObjID, "orgId": orgIDStr},
							bson.M{"$inc": bson.M{"quantity_ordered": item.Quantity}},
						)
					}
				}
			}
		}

		// Push vendor history entry
		if po.VendorID != "" {
			histEntry := bson.M{
				"action":    "po_created",
				"timestamp": time.Now(),
				"user":      createdBy,
				"details":   fmt.Sprintf("Purchase order %s created. Total: AED %.2f", po.OrderNumber, po.Total),
			}
			if vObjID, err := primitive.ObjectIDFromHex(po.VendorID); err == nil {
				vendorCollection.UpdateOne(ctx,
					bson.M{"_id": vObjID, "orgId": orgIDStr},
					bson.M{
						"$push": bson.M{"history": histEntry},
						"$set":  bson.M{"updatedAt": time.Now()},
					},
				)
			}
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Purchase order created successfully",
			"data": gin.H{
				"id":             po.ID.Hex(),
				"orderNumber":    po.OrderNumber,
				"lpoNumber":      po.LPONumber,
				"approvalStatus": po.ApprovalStatus,
				"subTotal":       po.SubTotal,
				"taxGroups":      po.TaxGroups,
				"totalTax":       po.TotalTax,
				"total":          po.Total,
				"status":         po.Status,
			},
		})
	}
}

// ApprovePurchaseOrder — admin/owner only. Issues the LPO number and moves status to "issued".
func ApprovePurchaseOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid purchase order ID"})
			return
		}

		createdBy := ""
		if uid, exists := c.Get("userId"); exists {
			createdBy = fmt.Sprintf("%v", uid)
		}
		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		role := getUserRole(ctx, createdBy, orgIDStr)
		if role != "owner" && role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only admins can approve purchase orders"})
			return
		}

		lpoNumber := generateLPONumber(ctx)
		now := time.Now()

		result, err := purchaseOrderCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": orgIDStr},
			bson.M{"$set": bson.M{
				"status":         "issued",
				"approvalStatus": "approved",
				"lpoNumber":      lpoNumber,
				"approvedBy":     createdBy,
				"approvedAt":     now,
				"updatedAt":      now,
			}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to approve purchase order"})
			return
		}
		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Purchase order not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    http.StatusOK,
			"message":   "Purchase order approved",
			"lpoNumber": lpoNumber,
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

		validStatuses := map[string]bool{
			"pending_approval": true,
			"issued":           true,
			"received":         true,
			"cancelled":        true,
			"partial":          true,
		}
		if !validStatuses[body.Status] {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "invalid status: must be one of pending_approval, issued, received, cancelled, partial"})
			return
		}

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		result, err := purchaseOrderCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": orgIDStr},
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

func GetPurchaseOrderByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid purchase order ID"})
			return
		}

		var po models.PurchaseOrder
		err = purchaseOrderCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&po)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Purchase order not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve purchase order"})
			}
			return
		}
		// Record scope: "own" roles may only open purchase orders they created.
		if uid, _, ownOnly := recordScope(c, "purchase_orders"); ownOnly && po.CreatedBy != uid {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You can only view purchase orders you created"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Purchase order retrieved", "data": po})
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
			{"orgId": orgIDStr},
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

// CancelPurchaseOrder cancels a PO in draft/pending_approval/issued status
func CancelPurchaseOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid purchase order ID"})
			return
		}

		result, err := purchaseOrderCollection.UpdateOne(ctx,
			bson.M{
				"_id":    objID,
				"orgId":  orgIDStr,
				"status": bson.M{"$in": []string{"draft", "pending_approval", "issued"}},
			},
			bson.M{"$set": bson.M{"status": "cancelled", "updatedAt": time.Now()}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to cancel purchase order"})
			return
		}
		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Purchase order not found or cannot be cancelled"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Purchase order cancelled"})
	}
}

func GetPurchaseOrderStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		orgFilter := bson.M{"orgId": orgIDStr}

		total, _ := purchaseOrderCollection.CountDocuments(ctx, orgFilter)
		pending, _ := purchaseOrderCollection.CountDocuments(ctx, bson.M{"$and": []bson.M{orgFilter, {"status": "pending_approval"}}})
		ordered, _ := purchaseOrderCollection.CountDocuments(ctx, bson.M{"$and": []bson.M{orgFilter, {"status": "issued"}}})
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
