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
	"github.com/backend/ws"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var salesOrdersCollection = config.GetCollection(config.DB, "sales_orders")
var itemsCollection = config.GetCollection(config.DB, "stocks")

// calculateItemAmount computes the final line amount using structured discount fields.
func calculateItemAmount(quantity, rate, discount float64, discountType string) float64 {
	base := quantity * rate
	if base <= 0 {
		return 0
	}
	var discountAED float64
	switch discountType {
	case "percentage":
		discountAED = base * (discount / 100)
	case "fixed":
		discountAED = discount
	default:
		discountAED = 0
	}
	result := base - discountAED
	if result < 0 {
		result = 0
	}
	return math.Round(result*100) / 100
}

func CreateSalesOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		var req models.SalesOrder
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		customerObjectID, err := primitive.ObjectIDFromHex(req.CustomerID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid customer ID format",
				"error":   err.Error(),
			})
			return
		}

		var customer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": customerObjectID}).Decode(&customer)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Customer not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve customer", "error": err.Error()})
			}
			return
		}

		orgID, _  := c.Get("orgId")
		userID, _ := c.Get("userId")

		// ── Duplicate LPO check ───────────────────────────────────────────────
		// Rejected SOs free up their LPO number — only block on active/pending/approved SOs.
		if req.LpoNumber != "" {
			count, _ := salesOrdersCollection.CountDocuments(ctx, bson.M{
				"orgId":     fmt.Sprintf("%v", orgID),
				"lpoNumber": req.LpoNumber,
				"status":    bson.M{"$ne": "rejected"},
			})
			if count > 0 {
				c.JSON(http.StatusConflict, gin.H{
					"status":  http.StatusConflict,
					"message": fmt.Sprintf("LPO number '%s' is already in use by an active order.", req.LpoNumber),
				})
				return
			}
		}

		var orderItems []models.SalesOrderItem
		var subTotal float64

		for _, itemReq := range req.Items {
			// Removed debug fmt.Printf — do not log order payloads in production

			itemObjectID, err := primitive.ObjectIDFromHex(itemReq.ItemID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"status":  http.StatusBadRequest,
					"message": "Invalid item ID format: " + itemReq.ItemID,
					"error":   err.Error(),
				})
				return
			}

			var inventoryItem models.Stock
			err = itemsCollection.FindOne(ctx, bson.M{"_id": itemObjectID}).Decode(&inventoryItem)
			if err != nil {
				if err == mongo.ErrNoDocuments {
					c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Item not found: " + itemReq.ItemID})
				} else {
					c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve item", "error": err.Error()})
				}
				return
			}

			rate := itemReq.Rate
			if rate <= 0 {
				if inventoryRate, err := strconv.ParseFloat(inventoryItem.SellingPrice, 64); err == nil {
					rate = inventoryRate
				}
			}

			amount := calculateItemAmount(itemReq.Quantity, rate, itemReq.Discount.Float64(), itemReq.DiscountType)

			base := itemReq.Quantity * rate
			var discountAED float64
			switch itemReq.DiscountType {
			case "percentage":
				discountAED = math.Round(base*(itemReq.Discount.Float64()/100)*100) / 100
			case "fixed":
				discountAED = itemReq.Discount.Float64()
			}

			orderItem := models.SalesOrderItem{
				ID:           primitive.NewObjectID(),
				ItemID:       itemReq.ItemID,
				Details:      inventoryItem.Name,
				Quantity:     itemReq.Quantity,
				Rate:         rate,
				Discount:     itemReq.Discount,
				DiscountType: itemReq.DiscountType,
				DiscountUnit: itemReq.DiscountUnit,
				DiscountAED:  models.FlexFloat(discountAED),
				Amount:       amount,
				Unit:         inventoryItem.Unit,
			}

			orderItems = append(orderItems, orderItem)
			subTotal += amount
		}

		subTotal = math.Round(subTotal*100) / 100
		vat := math.Round(subTotal*0.05*100) / 100
		shipping := math.Round(req.ShippingCharges*100) / 100
		adjustment := math.Round(req.Adjustment*100) / 100
		total := math.Round((subTotal+vat+shipping+adjustment)*100) / 100

		// ── Role check: admin/owner vs non-privileged ─────────────────────────
		privileged := false
		orgIDStr := fmt.Sprintf("%v", orgID)
		if orgObjID, parseErr := primitive.ObjectIDFromHex(orgIDStr); parseErr == nil {
			if role, ok := getMemberRole(ctx, orgObjID, fmt.Sprintf("%v", userID)); ok {
				privileged = isAdminOrOwner(role)
			}
		}
		// ── Credit limit check ────────────────────────────────────────────────
		// When CreditLimitAction == "block" (or "block" is the org default) and the
		// new order would push the customer over their credit limit, return 422 and
		// refuse to save. Otherwise include a creditWarning in the 201 response.
		var creditWarning gin.H
		if customer.CreditLimit > 0 {
			invCol := config.GetCollection(config.DB, "invoices")
			soCol := config.GetCollection(config.DB, "sales_orders")

			invPipeline := []bson.M{
				{"$match": bson.M{
					"orgId":      orgID,
					"customerId": req.CustomerID,
					"status":     bson.M{"$in": []string{"unpaid", "partially_paid", "overdue"}},
				}},
				{"$group": bson.M{"_id": nil, "total": bson.M{"$sum": "$balanceDue"}}},
			}
			var invRes []struct{ Total float64 `bson:"total"` }
			if cur, err2 := invCol.Aggregate(ctx, invPipeline); err2 == nil {
				_ = cur.All(ctx, &invRes)
			}
			var unpaidInv float64
			if len(invRes) > 0 {
				unpaidInv = invRes[0].Total
			}

			soPipeline := []bson.M{
				{"$match": bson.M{
					"orgId":      orgID,
					"customerId": req.CustomerID,
					"status":     bson.M{"$in": []string{"open", "confirmed", "processing"}},
				}},
				{"$group": bson.M{"_id": nil, "total": bson.M{"$sum": "$total"}}},
			}
			var soRes []struct{ Total float64 `bson:"total"` }
			if cur, err2 := soCol.Aggregate(ctx, soPipeline); err2 == nil {
				_ = cur.All(ctx, &soRes)
			}
			var openOrd float64
			if len(soRes) > 0 {
				openOrd = soRes[0].Total
			}

			currentUsed := unpaidInv + openOrd
			projectedUsed := currentUsed + total
			if projectedUsed > customer.CreditLimit {
				info := gin.H{
					"creditLimit":   customer.CreditLimit,
					"currentUsed":   math.Round(currentUsed*100) / 100,
					"thisOrder":     total,
					"projectedUsed": math.Round(projectedUsed*100) / 100,
					"exceeded":      true,
				}
				action := customer.CreditLimitAction
			if action == "" {
				action = "warn"
			}
			if action == "block" {
					c.JSON(http.StatusUnprocessableEntity, gin.H{
						"status":        http.StatusUnprocessableEntity,
						"message":       "Order blocked: this order would exceed the customer's credit limit",
						"creditBlocked": info,
					})
					return
				}
				creditWarning = info
			}
		}

		if req.OrderNumber == "" {
			req.OrderNumber = generateOrderNumber(ctx)
		}
		soStatus := func() string { if privileged { return "open" }; return "pending_approval" }()
		now := time.Now()
		salesOrder := models.SalesOrder{
			ID:                   primitive.NewObjectID(),
			OrgID:                orgID.(string),
			OrderNumber:          req.OrderNumber,
			CustomerID:           req.CustomerID,
			CustomerName:         customer.CustomerDisplayName,
			CustomerCode:         customer.CustomerCode,
			SalesType:            req.SalesType,
			OrderDate:            req.OrderDate,
			LpoNumber:            req.LpoNumber,
			LpoDate:              req.LpoDate,
			LpoValue:             req.LpoValue,
			ExpectedShipmentDate: req.ExpectedShipmentDate,
			PaymentTerms:         req.PaymentTerms,
			Salesperson:          req.Salesperson,
			Items:                orderItems,
			SubTotal:             subTotal,
			ShippingCharges:      shipping,
			Adjustment:           adjustment,
			VAT:                  vat,
			Total:                total,
			CustomerNotes:        req.CustomerNotes,
			TermsAndConditions:   req.TermsAndConditions,
			Status:               soStatus,
			CreatedBy:            fmt.Sprintf("%v", userID),
			CreatedAt:            now,
			UpdatedAt:            now,
			StatusHistory: []models.SOHistoryEntry{
				{
					Action:    "created",
					Status:    soStatus,
					ChangedBy: fmt.Sprintf("%v", userID),
					ChangedAt: now,
				},
			},
		}

		result, err := salesOrdersCollection.InsertOne(ctx, salesOrder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to create sales order",
				"error":   err.Error(),
			})
			return
		}

		ws.GlobalHub.Broadcast(ws.Event{Type: "sales_orders_updated", Action: "create", ID: salesOrder.ID.Hex()})

		// Notify admins/owners when a non-privileged user submits for approval
		if soStatus == "pending_approval" {
			go func() {
				nCtx, nCancel := context.WithTimeout(context.Background(), 8*time.Second)
				defer nCancel()
				orgObjID, _ := primitive.ObjectIDFromHex(orgIDStr)
				cur, err2 := orgMemberCollection.Find(nCtx, bson.M{
					"orgId":  orgObjID,
					"status": "active",
					"role":   bson.M{"$in": []string{"owner", "admin"}},
				})
				if err2 == nil {
					var admins []models.OrgMember
					cur.All(nCtx, &admins)
					cur.Close(nCtx)
					title := "Sales Order Needs Approval"
					msg := fmt.Sprintf("Order %s for %s (AED %.2f) submitted by %s — awaiting your approval.",
						salesOrder.OrderNumber, salesOrder.CustomerName, salesOrder.Total, fmt.Sprintf("%v", userID))
					meta := map[string]string{
						"orderId":     salesOrder.ID.Hex(),
						"orderNumber": salesOrder.OrderNumber,
						"submittedBy": fmt.Sprintf("%v", userID),
					}
					for _, m := range admins {
						pushNotificationWithMeta(m.UserID, "approval_request", title, msg, orgIDStr, "", meta)
					}
				}
			}()
		}

		resp := gin.H{
			"status":  http.StatusCreated,
			"message": "Sales order created successfully",
			"data": gin.H{
				"id":           salesOrder.ID.Hex(),
				"orderNumber":  salesOrder.OrderNumber,
				"orderDate":    salesOrder.OrderDate,
				"customerName": salesOrder.CustomerName,
				"subTotal":     salesOrder.SubTotal,
				"vat":          salesOrder.VAT,
				"total":        salesOrder.Total,
				"status":       salesOrder.Status,
				"insertedId":   result.InsertedID,
			},
		}
		if creditWarning != nil {
			resp["creditWarning"] = creditWarning
		}
		c.JSON(http.StatusCreated, resp)
	}
}

func generateOrderNumber(ctx context.Context) string {
	now := time.Now()
	year := now.Year() % 100
	month := int(now.Month())
	prefix := "SO" + strconv.Itoa(month/10) + strconv.Itoa(month%10) + strconv.Itoa(year/10) + strconv.Itoa(year%10)

	filter := bson.M{"orderNumber": bson.M{"$regex": "^" + prefix}}
	opts := options.FindOne().SetSort(bson.D{{Key: "orderNumber", Value: -1}})

	var lastOrder bson.M
	err := salesOrdersCollection.FindOne(ctx, filter, opts).Decode(&lastOrder)

	nextSequence := 1
	if err == nil {
		if lastNumber, ok := lastOrder["orderNumber"].(string); ok && len(lastNumber) >= 8 {
			seqStr := lastNumber[6:]
			if seq, err := strconv.Atoi(seqStr); err == nil {
				nextSequence = seq + 1
				if nextSequence > 9999 {
					nextSequence = 1
				}
			}
		}
	}

	seq := strconv.Itoa(nextSequence)
	for len(seq) < 4 {
		seq = "0" + seq
	}
	return prefix + seq
}

func GetAllSalesOrders() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		skip := (page - 1) * limit

		status := c.Query("status")
		customerID := c.Query("customerId")
		startDate := c.Query("startDate")
		endDate := c.Query("endDate")
		search := c.Query("search")

		orgID, _ := c.Get("orgId")
		filter := bson.M{"orgId": orgID}

		if status != "" {
			filter["status"] = status
		}

		if customerID != "" {
			customerObjectID, err := primitive.ObjectIDFromHex(customerID)
			if err == nil {
				filter["customerId"] = customerObjectID
			}
		}

		if search != "" {
			filter["$or"] = []bson.M{
				{"orderNumber": bson.M{"$regex": search, "$options": "i"}},
				{"customerName": bson.M{"$regex": search, "$options": "i"}},
				{"lpoNumber": bson.M{"$regex": search, "$options": "i"}},
			}
		}

		if startDate != "" && endDate != "" {
			// Parse in UTC to avoid timezone boundary issues
			start, err1 := time.ParseInLocation("2006-01-02", startDate, time.UTC)
			end, err2 := time.ParseInLocation("2006-01-02", endDate, time.UTC)
			if err1 == nil && err2 == nil {
				filter["orderDate"] = bson.M{
					"$gte": start,
					"$lte": end.AddDate(0, 0, 1),
				}
			}
		}

		// Record scope is "show all, lock others": list shows every order; access to
		// details/edit/delete is restricted per-record (see GetByID/Update/Delete).

		total, err := salesOrdersCollection.CountDocuments(ctx, filter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to count sales orders", "error": err.Error()})
			return
		}

		findOptions := options.Find().
			SetSkip(int64(skip)).
			SetLimit(int64(limit)).
			SetSort(bson.D{{Key: "createdAt", Value: -1}})

		cursor, err := salesOrdersCollection.Find(ctx, filter, findOptions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch sales orders", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var salesOrders []models.SalesOrder
		if err := cursor.All(ctx, &salesOrders); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode sales orders", "error": err.Error()})
			return
		}

		if salesOrders == nil {
			salesOrders = []models.SalesOrder{}
		}

		var response []models.SalesOrderResponse
		for _, order := range salesOrders {
			response = append(response, models.SalesOrderResponse{
				ID:                   order.ID.Hex(),
				OrderNumber:          order.OrderNumber,
				CustomerID:           order.CustomerID,
				CustomerName:         order.CustomerName,
				CustomerCode:         order.CustomerCode,
				SalesType:            order.SalesType,
				OrderDate:            order.OrderDate,
				LpoNumber:            order.LpoNumber,
				LpoDate:              order.LpoDate,
				LpoValue:             order.LpoValue,
				ExpectedShipmentDate: order.ExpectedShipmentDate,
				PaymentTerms:         order.PaymentTerms,
				Salesperson:          order.Salesperson,
				Items:                order.Items,
				SubTotal:             order.SubTotal,
				ShippingCharges:      order.ShippingCharges,
				Adjustment:           order.Adjustment,
				VAT:                  order.VAT,
				Total:                order.Total,
				CustomerNotes:        order.CustomerNotes,
				TermsAndConditions:   order.TermsAndConditions,
				Status:               order.Status,
				CancelReason:         order.CancelReason,
				CancelRequestedBy:    order.CancelRequestedBy,
				CreatedAt:            order.CreatedAt,
				UpdatedAt:            order.UpdatedAt,
			})
		}

		totalPages := int((total + int64(limit) - 1) / int64(limit))

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Sales orders retrieved successfully",
			"data": models.SalesOrderListResponse{
				Total:       total,
				Page:        page,
				Limit:       limit,
				TotalPages:  totalPages,
				SalesOrders: response,
			},
		})
	}
}

func GetSalesOrderByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid sales order ID format", "error": err.Error()})
			return
		}

		// FIXED: Was missing orgId check — any authenticated user from any org
		// could read another org's orders by guessing an ObjectID.
		orgID, _ := c.Get("orgId")
		orgIDStr := orgID.(string)

		var salesOrder models.SalesOrder
		err = salesOrdersCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgIDStr}).Decode(&salesOrder)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Sales order not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve sales order", "error": err.Error()})
			}
			return
		}
		// Record scope: "own" roles may only open orders they created.
		if uid, _, ownOnly := recordScope(c, "sales_orders"); ownOnly && salesOrder.CreatedBy != uid {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You can only view your own sales orders"})
			return
		}

		var customer models.Customer
		customersCollection.FindOne(ctx, bson.M{"_id": salesOrder.CustomerID}).Decode(&customer)

		response := models.SalesOrderResponse{
			ID:                   salesOrder.ID.Hex(),
			OrderNumber:          salesOrder.OrderNumber,
			CustomerID:           salesOrder.CustomerID,
			CustomerName:         salesOrder.CustomerName,
			CustomerCode:         salesOrder.CustomerCode,
			SalesType:            salesOrder.SalesType,
			OrderDate:            salesOrder.OrderDate,
			LpoNumber:            salesOrder.LpoNumber,
			LpoDate:              salesOrder.LpoDate,
			LpoValue:             salesOrder.LpoValue,
			ExpectedShipmentDate: salesOrder.ExpectedShipmentDate,
			PaymentTerms:         salesOrder.PaymentTerms,
			Salesperson:          salesOrder.Salesperson,
			Items:                salesOrder.Items,
			SubTotal:             salesOrder.SubTotal,
			ShippingCharges:      salesOrder.ShippingCharges,
			Adjustment:           salesOrder.Adjustment,
			VAT:                  salesOrder.VAT,
			Total:                salesOrder.Total,
			CustomerNotes:        salesOrder.CustomerNotes,
			TermsAndConditions:   salesOrder.TermsAndConditions,
			Status:               salesOrder.Status,
			CreatedAt:            salesOrder.CreatedAt,
			UpdatedAt:            salesOrder.UpdatedAt,
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Sales order retrieved successfully",
			"data":    response,
			"customer": gin.H{
				"id":          customer.ID.Hex(),
				"displayName": customer.CustomerDisplayName,
				"companyName": customer.CompanyName,
				"email":       customer.CustomerEmail,
				"phone":       customer.CustomerPhone,
			},
		})
	}
}

func UpdateSalesOrderStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid sales order ID format", "error": err.Error()})
			return
		}

		orgID, _ := c.Get("orgId")

		var req struct {
			Status            string `json:"status"`
			CancelReason      string `json:"cancelReason"`
			CancelRequestedBy string `json:"cancelRequestedBy"`
		}

		if err := c.ShouldBindJSON(&req); err != nil || req.Status == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body — status is required"})
			return
		}

		validStatuses := map[string]bool{
			"draft": true, "pending": true, "approved": true, "shipped": true,
			"completed": true, "cancelled": true, "open": true, "invoiced": true,
			"cancel_requested": true, "pending_approval": true, "confirmed": true, "rejected": true,
		}
		if !validStatuses[req.Status] {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid status value"})
			return
		}

		// Only admin/owner can approve, reject, confirm, or directly cancel
		if req.Status == "approved" || req.Status == "rejected" || req.Status == "confirmed" || req.Status == "cancelled" {
			statusUserID, _ := c.Get("userId")
			statusOrgIDStr := fmt.Sprintf("%v", orgID)
			if statusOrgObjID, err2 := primitive.ObjectIDFromHex(statusOrgIDStr); err2 == nil {
				if statusRole, ok2 := getMemberRole(ctx, statusOrgObjID, fmt.Sprintf("%v", statusUserID)); !ok2 || !isAdminOrOwner(statusRole) {
					c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only admin or owner can approve, reject, confirm, or cancel sales orders."})
					return
				}
			}
		}

		statusUserID, _ := c.Get("userId")
		setFields := bson.M{"status": req.Status, "updatedAt": time.Now()}
		histNote := ""
		if req.Status == "cancel_requested" {
			setFields["cancelReason"] = req.CancelReason
			setFields["cancelRequestedBy"] = req.CancelRequestedBy
			histNote = req.CancelReason
		}
		histEntry := models.SOHistoryEntry{
			Action:    "status_changed",
			Status:    req.Status,
			Note:      histNote,
			ChangedBy: fmt.Sprintf("%v", statusUserID),
			ChangedAt: time.Now(),
		}
		updateDoc := bson.M{
			"$set":  setFields,
			"$push": bson.M{"statusHistory": histEntry},
		}
		if req.Status != "cancel_requested" {
			updateDoc["$unset"] = bson.M{"cancelReason": "", "cancelRequestedBy": ""}
		}

		result, err := salesOrdersCollection.UpdateOne(ctx, bson.M{"_id": objectID, "orgId": orgID}, updateDoc)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update sales order status", "error": err.Error()})
			return
		}

		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Sales order not found"})
			return
		}

		ws.GlobalHub.Broadcast(ws.Event{Type: "sales_orders_updated", Action: "update", ID: id})

		// Notify admins/owners when any user re-submits for approval
		if req.Status == "pending_approval" {
			go func() {
				nCtx, nCancel := context.WithTimeout(context.Background(), 8*time.Second)
				defer nCancel()
				var so models.SalesOrder
				if e2 := salesOrdersCollection.FindOne(nCtx, bson.M{"_id": objectID}).Decode(&so); e2 == nil {
					submitterID := fmt.Sprintf("%v", c.MustGet("userId"))
					orgIDStr2 := fmt.Sprintf("%v", orgID)
					orgObjID, _ := primitive.ObjectIDFromHex(orgIDStr2)
					cur, err2 := orgMemberCollection.Find(nCtx, bson.M{
						"orgId":  orgObjID,
						"status": "active",
						"role":   bson.M{"$in": []string{"owner", "admin"}},
					})
					if err2 == nil {
						var admins []models.OrgMember
						cur.All(nCtx, &admins)
						cur.Close(nCtx)
						title := "Sales Order Needs Approval"
						msg := fmt.Sprintf("Order %s for %s (AED %.2f) re-submitted by %s — awaiting your approval.",
							so.OrderNumber, so.CustomerName, so.Total, submitterID)
						meta := map[string]string{
							"orderId":     id,
							"orderNumber": so.OrderNumber,
							"submittedBy": submitterID,
						}
						for _, m := range admins {
							pushNotificationWithMeta(m.UserID, "approval_request", title, msg, orgIDStr2, "", meta)
						}
					}
				}
			}()
		}

		// Notify the order creator when admin/owner approves or rejects
		if req.Status == "approved" || req.Status == "rejected" {
			go func() {
				nCtx, nCancel := context.WithTimeout(context.Background(), 8*time.Second)
				defer nCancel()
				var so models.SalesOrder
				if e2 := salesOrdersCollection.FindOne(nCtx, bson.M{"_id": objectID}).Decode(&so); e2 == nil && so.CreatedBy != "" {
					approverID := fmt.Sprintf("%v", c.MustGet("userId"))
					// Don't notify if the approver and creator are the same person
					if so.CreatedBy == approverID {
						return
					}
					var title, msg string
					if req.Status == "approved" {
						title = "Sales Order Approved"
						msg = fmt.Sprintf("Your order %s for %s has been approved.", so.OrderNumber, so.CustomerName)
					} else {
						title = "Sales Order Rejected"
						msg = fmt.Sprintf("Your order %s for %s has been rejected.", so.OrderNumber, so.CustomerName)
					}
					meta := map[string]string{
						"orderId":     id,
						"orderNumber": so.OrderNumber,
						"approvedBy":  approverID,
						"decision":    req.Status,
					}
					pushNotificationWithMeta(so.CreatedBy, "approval_result", title, msg, fmt.Sprintf("%v", orgID), "", meta)
				}
			}()
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Sales order status updated successfully",
			"data": gin.H{
				"id":            id,
				"status":        req.Status,
				"matchedCount":  result.MatchedCount,
				"modifiedCount": result.ModifiedCount,
			},
		})
	}
}

func GetSalesOrderHistory() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid sales order ID"})
			return
		}

		var so models.SalesOrder
		if err := salesOrdersCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&so); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Sales order not found"})
			return
		}

		history := so.StatusHistory
		if history == nil {
			history = []models.SOHistoryEntry{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "History retrieved successfully",
			"data": gin.H{
				"orderNumber":   so.OrderNumber,
				"createdAt":     so.CreatedAt,
				"createdBy":     so.CreatedBy,
				"statusHistory": history,
			},
		})
	}
}

func UpdateSalesOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid sales order ID format", "error": err.Error()})
			return
		}

		orgID, _ := c.Get("orgId")

		var req models.UpdateSalesOrderRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}

		var existingOrder models.SalesOrder
		err = salesOrdersCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&existingOrder)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Sales order not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve sales order", "error": err.Error()})
			}
			return
		}
		// Record scope: when the caller's scope is "own", only the creator may edit.
		if uid, _, ownOnly := recordScope(c, "sales_orders"); ownOnly && existingOrder.CreatedBy != uid {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You can only edit orders you created"})
			return
		}

		setFields := bson.M{"updatedAt": time.Now()}

		if req.Status != nil {
			setFields["status"] = *req.Status
		}
		if req.CustomerNotes != nil {
			setFields["customerNotes"] = *req.CustomerNotes
		}
		if req.TermsAndConditions != nil {
			setFields["termsAndConditions"] = *req.TermsAndConditions
		}

		// Header fields (draft edit)
		if req.CustomerID != nil {
			setFields["customerId"] = *req.CustomerID
			// Resolve customer name
			if custObjID, err2 := primitive.ObjectIDFromHex(*req.CustomerID); err2 == nil {
				var cust models.Customer
				if err3 := customersCollection.FindOne(ctx, bson.M{"_id": custObjID}).Decode(&cust); err3 == nil {
					setFields["customerName"] = cust.CustomerDisplayName
					setFields["customerCode"] = cust.CustomerCode
				}
			}
		}
		if req.SalesType != nil {
			setFields["salesType"] = *req.SalesType
		}
		if req.OrderDate != nil {
			setFields["orderDate"] = *req.OrderDate
		}
		if req.LpoNumber != nil || req.LpoDate != nil || req.LpoValue != nil {
			// LPO is locked once order is confirmed — no one can change it after that
			if existingOrder.Status == "confirmed" {
				c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "LPO is locked after confirmation."})
				return
			}
			if req.LpoNumber != nil {
				// Duplicate LPO check on update — exclude rejected and the current order
				if *req.LpoNumber != "" && *req.LpoNumber != existingOrder.LpoNumber {
					dupCount, _ := salesOrdersCollection.CountDocuments(ctx, bson.M{
						"orgId":     fmt.Sprintf("%v", orgID),
						"lpoNumber": *req.LpoNumber,
						"status":    bson.M{"$ne": "rejected"},
						"_id":       bson.M{"$ne": objectID},
					})
					if dupCount > 0 {
						c.JSON(http.StatusConflict, gin.H{
							"status":  http.StatusConflict,
							"message": fmt.Sprintf("LPO number '%s' is already in use by an active order.", *req.LpoNumber),
						})
						return
					}
				}
				setFields["lpoNumber"] = *req.LpoNumber
				// Admin saving LPO on an approved order auto-confirms it
				if existingOrder.Status == "approved" && *req.LpoNumber != "" {
					setFields["status"] = "confirmed"
				}
			}
			if req.LpoDate != nil {
				setFields["lpoDate"] = *req.LpoDate
			}
			if req.LpoValue != nil {
				setFields["lpoValue"] = *req.LpoValue
			}
		}
		if req.ExpectedShipmentDate != nil {
			setFields["expectedShipmentDate"] = *req.ExpectedShipmentDate
		}
		if req.PaymentTerms != nil {
			setFields["paymentTerms"] = *req.PaymentTerms
		}
		if req.Salesperson != nil {
			setFields["salesperson"] = *req.Salesperson
		}

		// Recalculate totals when items are provided
		subTotal := existingOrder.SubTotal
		vat := existingOrder.VAT
		if len(req.Items) > 0 {
			var newItems []models.SalesOrderItem
			var newSubTotal float64
			for _, itemReq := range req.Items {
				itemObjectID, err2 := primitive.ObjectIDFromHex(itemReq.ItemID)
				if err2 != nil {
					c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid item ID: " + itemReq.ItemID})
					return
				}
				var inventoryItem models.Stock
				if err3 := itemsCollection.FindOne(ctx, bson.M{"_id": itemObjectID}).Decode(&inventoryItem); err3 != nil {
					c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Item not found: " + itemReq.ItemID})
					return
				}
				rate := itemReq.Rate
				if rate <= 0 {
					if r, err4 := strconv.ParseFloat(inventoryItem.SellingPrice, 64); err4 == nil {
						rate = r
					}
				}
				amount := calculateItemAmount(itemReq.Quantity, rate, itemReq.Discount.Float64(), itemReq.DiscountType)
				base := itemReq.Quantity * rate
				var discountAED float64
				switch itemReq.DiscountType {
				case "percentage":
					discountAED = math.Round(base*(itemReq.Discount.Float64()/100)*100) / 100
				case "fixed":
					discountAED = itemReq.Discount.Float64()
				}
				newItems = append(newItems, models.SalesOrderItem{
					ID:           primitive.NewObjectID(),
					ItemID:       itemReq.ItemID,
					Details:      inventoryItem.Name,
					Quantity:     itemReq.Quantity,
					Rate:         rate,
					Discount:     itemReq.Discount,
					DiscountType: itemReq.DiscountType,
					DiscountUnit: itemReq.DiscountUnit,
					DiscountAED:  models.FlexFloat(discountAED),
					Amount:       amount,
					Unit:         inventoryItem.Unit,
				})
				newSubTotal += amount
			}
			newSubTotal = math.Round(newSubTotal*100) / 100
			vat = math.Round(newSubTotal*0.05*100) / 100
			subTotal = newSubTotal
			setFields["items"] = newItems
			setFields["subTotal"] = subTotal
			setFields["vat"] = vat
		}

		// Recompute total from current or updated values
		newShipping := existingOrder.ShippingCharges
		newAdjustment := existingOrder.Adjustment
		if req.ShippingCharges != nil {
			newShipping = *req.ShippingCharges
			setFields["shippingCharges"] = newShipping
		}
		if req.Adjustment != nil {
			newAdjustment = *req.Adjustment
			setFields["adjustment"] = newAdjustment
		}
		if len(req.Items) > 0 || req.ShippingCharges != nil || req.Adjustment != nil {
			setFields["total"] = math.Round((subTotal+vat+newShipping+newAdjustment)*100) / 100
		}

		result, err := salesOrdersCollection.UpdateOne(ctx, bson.M{"_id": objectID, "orgId": orgID}, bson.M{"$set": setFields})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update sales order", "error": err.Error()})
			return
		}

		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Sales order not found"})
			return
		}

		var updatedOrder models.SalesOrder
		salesOrdersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&updatedOrder)

		ws.GlobalHub.Broadcast(ws.Event{Type: "sales_orders_updated", Action: "update", ID: id})

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Sales order updated successfully",
			"data": gin.H{
				"id":                 updatedOrder.ID.Hex(),
				"orderNumber":        updatedOrder.OrderNumber,
				"customerName":       updatedOrder.CustomerName,
				"subTotal":           updatedOrder.SubTotal,
				"vat":                updatedOrder.VAT,
				"total":              updatedOrder.Total,
				"status":             updatedOrder.Status,
				"shippingCharges":    updatedOrder.ShippingCharges,
				"adjustment":         updatedOrder.Adjustment,
				"customerNotes":      updatedOrder.CustomerNotes,
				"termsAndConditions": updatedOrder.TermsAndConditions,
				"updatedAt":          updatedOrder.UpdatedAt,
				"matchedCount":       result.MatchedCount,
				"modifiedCount":      result.ModifiedCount,
			},
		})
	}
}

func DeleteSalesOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid sales order ID format", "error": err.Error()})
			return
		}

		orgID, _ := c.Get("orgId")

		var existingOrder models.SalesOrder
		err = salesOrdersCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&existingOrder)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Sales order not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve sales order", "error": err.Error()})
			}
			return
		}
		// Record scope: when the caller's scope is "own", only the creator may delete.
		if uid, _, ownOnly := recordScope(c, "sales_orders"); ownOnly && existingOrder.CreatedBy != uid {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You can only delete orders you created"})
			return
		}

		update := bson.M{"$set": bson.M{"status": "cancelled", "updatedAt": time.Now()}}
		result, err := salesOrdersCollection.UpdateOne(ctx, bson.M{"_id": objectID, "orgId": orgID}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to cancel sales order", "error": err.Error()})
			return
		}

		ws.GlobalHub.Broadcast(ws.Event{Type: "sales_orders_updated", Action: "delete", ID: id})

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Sales order cancelled successfully",
			"data": gin.H{
				"id":            id,
				"orderNumber":   existingOrder.OrderNumber,
				"customerName":  existingOrder.CustomerName,
				"status":        "cancelled",
				"matchedCount":  result.MatchedCount,
				"modifiedCount": result.ModifiedCount,
			},
		})
	}
}

func RevertSalesOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")

		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid sales order ID"})
			return
		}

		var existingOrder models.SalesOrder
		err = salesOrdersCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&existingOrder)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Sales order not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve sales order", "error": err.Error()})
			}
			return
		}

		_, err = salesOrdersCollection.UpdateOne(
			ctx,
			bson.M{"_id": objectID, "orgId": orgID},
			bson.M{
				"$set":   bson.M{"status": "cancelled", "updatedAt": time.Now()},
				"$unset": bson.M{"cancelReason": "", "cancelRequestedBy": ""},
			},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to revert sales order", "error": err.Error()})
			return
		}

		ws.GlobalHub.Broadcast(ws.Event{Type: "sales_orders_updated", Action: "delete", ID: id})

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Sales order cancelled successfully",
			"data": gin.H{
				"id":          id,
				"orderNumber": existingOrder.OrderNumber,
				"status":      "cancelled",
			},
		})
	}
}

func GetSalesOrderStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		now := time.Now()
		todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
		weekStart := todayStart.AddDate(0, 0, -int(now.Weekday())+1)
		monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

		orgID, _ := c.Get("orgId")
		totalOrders, _ := salesOrdersCollection.CountDocuments(ctx, bson.M{"orgId": orgID})

		pipeline := []bson.M{
			{"$match": bson.M{"orgId": orgID}},
			{"$group": bson.M{"_id": "$status", "count": bson.M{"$sum": 1}, "totalAmount": bson.M{"$sum": "$total"}}},
		}

		cursor, err := salesOrdersCollection.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to get sales order statistics", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		statusStats := make(map[string]int64)
		totalAmount := 0.0
		var statusResults []bson.M
		if err := cursor.All(ctx, &statusResults); err == nil {
			for _, result := range statusResults {
				if statusVal, ok := result["_id"].(string); ok {
					if count, ok := result["count"].(int64); ok {
						statusStats[statusVal] = count
					}
					if amount, ok := result["totalAmount"].(float64); ok {
						totalAmount += amount
					}
				}
			}
		}

		todayOrders, _ := salesOrdersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "createdAt": bson.M{"$gte": todayStart}})

		todayRevenue := 0.0
		todayRevPipeline := []bson.M{
			{"$match": bson.M{"orgId": orgID, "createdAt": bson.M{"$gte": todayStart}}},
			{"$group": bson.M{"_id": nil, "total": bson.M{"$sum": "$total"}}},
		}
		if trCursor, err := salesOrdersCollection.Aggregate(ctx, todayRevPipeline); err == nil {
			defer trCursor.Close(ctx)
			var trResult []bson.M
			if trCursor.All(ctx, &trResult) == nil && len(trResult) > 0 {
				if v, ok := trResult[0]["total"].(float64); ok {
					todayRevenue = v
				}
			}
		}

		thisWeekOrders, _ := salesOrdersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "createdAt": bson.M{"$gte": weekStart}})
		thisMonthOrders, _ := salesOrdersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "createdAt": bson.M{"$gte": monthStart}})

		topCustomersPipeline := []bson.M{
			{"$match": bson.M{"orgId": orgID}},
			{"$group": bson.M{"_id": "$customerId", "customerName": bson.M{"$first": "$customerName"}, "orderCount": bson.M{"$sum": 1}, "totalAmount": bson.M{"$sum": "$total"}}},
			{"$sort": bson.M{"totalAmount": -1}},
			{"$limit": 5},
		}

		topCustomersCursor, err := salesOrdersCollection.Aggregate(ctx, topCustomersPipeline)
		var topCustomers []models.TopCustomer
		if err == nil {
			defer topCustomersCursor.Close(ctx)
			var topCustomerResults []bson.M
			if err := topCustomersCursor.All(ctx, &topCustomerResults); err == nil {
				for _, result := range topCustomerResults {
					customerID := ""
					if oid, ok := result["_id"].(primitive.ObjectID); ok {
						customerID = oid.Hex()
					} else if str, ok := result["_id"].(string); ok {
						customerID = str
					}
					customerName, _ := result["customerName"].(string)
					orderCount, _ := result["orderCount"].(int64)
					amount, _ := result["totalAmount"].(float64)
					topCustomers = append(topCustomers, models.TopCustomer{CustomerID: customerID, CustomerName: customerName, OrderCount: orderCount, TotalAmount: amount})
				}
			}
		}

		stats := models.SalesOrderStats{
			TotalOrders:     totalOrders,
			TotalAmount:     totalAmount,
			PendingOrders:   statusStats["pending"] + statusStats["open"] + statusStats["draft"],
			ApprovedOrders:  statusStats["approved"],
			ShippedOrders:   statusStats["shipped"],
			CompletedOrders: statusStats["completed"],
			CancelledOrders: statusStats["cancelled"],
			TodayOrders:     todayOrders,
			TodayRevenue:    todayRevenue,
			ThisWeekOrders:  thisWeekOrders,
			ThisMonthOrders: thisMonthOrders,
			TopCustomers:    topCustomers,
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Sales order statistics retrieved successfully", "data": stats})
	}
}

func SearchSalesOrders() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		query := c.Query("q")
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

		if query == "" {
			c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "No search query provided", "data": []interface{}{}})
			return
		}

		orgID, _ := c.Get("orgId")
		filter := bson.M{
			"orgId": orgID,
			"$or": []bson.M{
				{"orderNumber": bson.M{"$regex": query, "$options": "i"}},
				{"customerName": bson.M{"$regex": query, "$options": "i"}},
				{"lpoNumber": bson.M{"$regex": query, "$options": "i"}},
				{"customerCode": bson.M{"$regex": query, "$options": "i"}},
			},
		}

		findOptions := options.Find().SetLimit(int64(limit)).SetSort(bson.D{{Key: "createdAt", Value: -1}})

		var orders []models.SalesOrder
		cursor, err := salesOrdersCollection.Find(ctx, filter, findOptions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to search sales orders", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		if err := cursor.All(ctx, &orders); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode search results", "error": err.Error()})
			return
		}

		if orders == nil {
			orders = []models.SalesOrder{}
		}

		var response []models.SalesOrderResponse
		for _, order := range orders {
			response = append(response, models.SalesOrderResponse{
				ID:           order.ID.Hex(),
				OrderNumber:  order.OrderNumber,
				CustomerName: order.CustomerName,
				CustomerCode: order.CustomerCode,
				SalesType:    order.SalesType,
				OrderDate:    order.OrderDate,
				LpoNumber:    order.LpoNumber,
				Total:        order.Total,
				Status:       order.Status,
				CreatedAt:    order.CreatedAt,
			})
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Sales orders search completed successfully", "data": response, "count": len(response)})
	}
}
