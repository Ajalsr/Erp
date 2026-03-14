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

var salesOrdersCollection *mongo.Collection = config.GetCollection(config.DB, "sales_orders")
var itemsCollection *mongo.Collection = config.GetCollection(config.DB, "stocks")

// calculateItemAmount computes the final line amount using structured discount fields.
// discountType: "percentage" → discount is a percent (e.g. 15 means 15%)
// discountType: "fixed"      → discount is a fixed AED value
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

		// Convert customer ID
		customerObjectID, err := primitive.ObjectIDFromHex(req.CustomerID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid customer ID format",
				"error":   err.Error(),
			})
			return
		}

		// Get customer details
		var customer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": customerObjectID}).Decode(&customer)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{
					"status":  http.StatusNotFound,
					"message": "Customer not found",
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  http.StatusInternalServerError,
					"message": "Failed to retrieve customer",
					"error":   err.Error(),
				})
			}
			return
		}

		// Process items — recalculate amount server-side for integrity
		var orderItems []models.SalesOrderItem
		var subTotal float64

		for _, itemReq := range req.Items {
			fmt.Printf("Processing item: %+v\n", itemReq)

			itemObjectID, err := primitive.ObjectIDFromHex(itemReq.ItemID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"status":  http.StatusBadRequest,
					"message": fmt.Sprintf("Invalid item ID format: %s", itemReq.ItemID),
					"error":   err.Error(),
				})
				return
			}

			// Get item from inventory
			var inventoryItem models.Stock
			err = itemsCollection.FindOne(ctx, bson.M{"_id": itemObjectID}).Decode(&inventoryItem)
			if err != nil {
				if err == mongo.ErrNoDocuments {
					c.JSON(http.StatusNotFound, gin.H{
						"status":  http.StatusNotFound,
						"message": fmt.Sprintf("Item not found: %s", itemReq.ItemID),
					})
				} else {
					c.JSON(http.StatusInternalServerError, gin.H{
						"status":  http.StatusInternalServerError,
						"message": "Failed to retrieve item",
						"error":   err.Error(),
					})
				}
				return
			}

			// Use rate from request (user may have overridden); fall back to inventory price
			rate := itemReq.Rate
			if rate <= 0 {
				if inventoryRate, err := strconv.ParseFloat(inventoryItem.SellingPrice, 64); err == nil {
					rate = inventoryRate
				}
			}

			// Recalculate amount server-side using structured discount fields
			// discountType: "percentage" or "fixed"
			amount := calculateItemAmount(itemReq.Quantity, rate, itemReq.Discount.Float64(), itemReq.DiscountType)

			// Compute DiscountAED for storage
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

		// Generate order number if not provided
		if req.OrderNumber == "" {
			req.OrderNumber = generateOrderNumber(ctx)
		}

		salesOrder := models.SalesOrder{
			ID:                   primitive.NewObjectID(),
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
			Status:               "open",
			CreatedAt:            time.Now(),
			UpdatedAt:            time.Now(),
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

		c.JSON(http.StatusCreated, gin.H{
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
		})
	}
}

func generateOrderNumber(ctx context.Context) string {
	now := time.Now()
	year := now.Year() % 100
	month := int(now.Month())

	prefix := fmt.Sprintf("SO%02d%02d", month, year)
	filter := bson.M{
		"orderNumber": bson.M{
			"$regex": "^" + prefix,
		},
	}

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

	return fmt.Sprintf("%s%04d", prefix, nextSequence)
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

		filter := bson.M{}

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
			start, err1 := time.Parse("2006-01-02", startDate)
			end, err2 := time.Parse("2006-01-02", endDate)
			if err1 == nil && err2 == nil {
				filter["orderDate"] = bson.M{
					"$gte": start,
					"$lte": end.AddDate(0, 0, 1),
				}
			}
		}

		total, err := salesOrdersCollection.CountDocuments(ctx, filter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to count sales orders",
				"error":   err.Error(),
			})
			return
		}

		findOptions := options.Find().
			SetSkip(int64(skip)).
			SetLimit(int64(limit)).
			SetSort(bson.D{{Key: "createdAt", Value: -1}})

		cursor, err := salesOrdersCollection.Find(ctx, filter, findOptions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to fetch sales orders",
				"error":   err.Error(),
			})
			return
		}
		defer cursor.Close(ctx)

		var salesOrders []models.SalesOrder
		if err := cursor.All(ctx, &salesOrders); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to decode sales orders",
				"error":   err.Error(),
			})
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
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid sales order ID format",
				"error":   err.Error(),
			})
			return
		}

		var salesOrder models.SalesOrder
		err = salesOrdersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&salesOrder)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{
					"status":  http.StatusNotFound,
					"message": "Sales order not found",
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  http.StatusInternalServerError,
					"message": "Failed to retrieve sales order",
					"error":   err.Error(),
				})
			}
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
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid sales order ID format",
				"error":   err.Error(),
			})
			return
		}

		var req struct {
			Status string `json:"status" binding:"required,oneof=draft pending approved shipped completed cancelled open"`
		}

		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		update := bson.M{
			"$set": bson.M{
				"status":    req.Status,
				"updatedAt": time.Now(),
			},
		}

		result, err := salesOrdersCollection.UpdateOne(ctx, bson.M{"_id": objectID}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to update sales order status",
				"error":   err.Error(),
			})
			return
		}

		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  http.StatusNotFound,
				"message": "Sales order not found",
			})
			return
		}

		ws.GlobalHub.Broadcast(ws.Event{Type: "sales_orders_updated", Action: "update", ID: id})

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

func UpdateSalesOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid sales order ID format",
				"error":   err.Error(),
			})
			return
		}

		var req models.UpdateSalesOrderRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		var existingOrder models.SalesOrder
		err = salesOrdersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&existingOrder)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{
					"status":  http.StatusNotFound,
					"message": "Sales order not found",
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  http.StatusInternalServerError,
					"message": "Failed to retrieve sales order",
					"error":   err.Error(),
				})
			}
			return
		}

		setFields := bson.M{"updatedAt": time.Now()}

		if req.Status != nil {
			setFields["status"] = *req.Status
		}
		if req.ShippingCharges != nil {
			setFields["shippingCharges"] = *req.ShippingCharges
		}
		if req.Adjustment != nil {
			setFields["adjustment"] = *req.Adjustment
		}
		if req.CustomerNotes != nil {
			setFields["customerNotes"] = *req.CustomerNotes
		}
		if req.TermsAndConditions != nil {
			setFields["termsAndConditions"] = *req.TermsAndConditions
		}

		// Recalculate total if shipping or adjustment changed
		if req.ShippingCharges != nil || req.Adjustment != nil {
			newShipping := existingOrder.ShippingCharges
			newAdjustment := existingOrder.Adjustment
			if req.ShippingCharges != nil {
				newShipping = *req.ShippingCharges
			}
			if req.Adjustment != nil {
				newAdjustment = *req.Adjustment
			}
			newTotal := math.Round((existingOrder.SubTotal+existingOrder.VAT+newShipping+newAdjustment)*100) / 100
			setFields["total"] = newTotal
		}

		result, err := salesOrdersCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": setFields})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to update sales order",
				"error":   err.Error(),
			})
			return
		}

		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{
				"status":  http.StatusNotFound,
				"message": "Sales order not found",
			})
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
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid sales order ID format",
				"error":   err.Error(),
			})
			return
		}

		var existingOrder models.SalesOrder
		err = salesOrdersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&existingOrder)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{
					"status":  http.StatusNotFound,
					"message": "Sales order not found",
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  http.StatusInternalServerError,
					"message": "Failed to retrieve sales order",
					"error":   err.Error(),
				})
			}
			return
		}

		update := bson.M{
			"$set": bson.M{
				"status":    "cancelled",
				"updatedAt": time.Now(),
			},
		}

		result, err := salesOrdersCollection.UpdateOne(ctx, bson.M{"_id": objectID}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to cancel sales order",
				"error":   err.Error(),
			})
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

func GetSalesOrderStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		now := time.Now()
		todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		weekStart := todayStart.AddDate(0, 0, -int(now.Weekday())+1)
		monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

		totalOrders, _ := salesOrdersCollection.CountDocuments(ctx, bson.M{})

		pipeline := []bson.M{
			{
				"$group": bson.M{
					"_id":         "$status",
					"count":       bson.M{"$sum": 1},
					"totalAmount": bson.M{"$sum": "$total"},
				},
			},
		}

		cursor, err := salesOrdersCollection.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to get sales order statistics",
				"error":   err.Error(),
			})
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

		todayOrders, _ := salesOrdersCollection.CountDocuments(ctx, bson.M{
			"createdAt": bson.M{"$gte": todayStart},
		})
		thisWeekOrders, _ := salesOrdersCollection.CountDocuments(ctx, bson.M{
			"createdAt": bson.M{"$gte": weekStart},
		})
		thisMonthOrders, _ := salesOrdersCollection.CountDocuments(ctx, bson.M{
			"createdAt": bson.M{"$gte": monthStart},
		})

		topCustomersPipeline := []bson.M{
			{
				"$group": bson.M{
					"_id":          "$customerId",
					"customerName": bson.M{"$first": "$customerName"},
					"orderCount":   bson.M{"$sum": 1},
					"totalAmount":  bson.M{"$sum": "$total"},
				},
			},
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

					topCustomers = append(topCustomers, models.TopCustomer{
						CustomerID:   customerID,
						CustomerName: customerName,
						OrderCount:   orderCount,
						TotalAmount:  amount,
					})
				}
			}
		}

		stats := models.SalesOrderStats{
			TotalOrders:     totalOrders,
			TotalAmount:     totalAmount,
			PendingOrders:   statusStats["pending"],
			ApprovedOrders:  statusStats["approved"],
			ShippedOrders:   statusStats["shipped"],
			CompletedOrders: statusStats["completed"],
			CancelledOrders: statusStats["cancelled"],
			TodayOrders:     todayOrders,
			ThisWeekOrders:  thisWeekOrders,
			ThisMonthOrders: thisMonthOrders,
			TopCustomers:    topCustomers,
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Sales order statistics retrieved successfully",
			"data":    stats,
		})
	}
}

func SearchSalesOrders() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		query := c.Query("q")
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

		if query == "" {
			c.JSON(http.StatusOK, gin.H{
				"status":  http.StatusOK,
				"message": "No search query provided",
				"data":    []interface{}{},
			})
			return
		}

		filter := bson.M{
			"$or": []bson.M{
				{"orderNumber": bson.M{"$regex": query, "$options": "i"}},
				{"customerName": bson.M{"$regex": query, "$options": "i"}},
				{"lpoNumber": bson.M{"$regex": query, "$options": "i"}},
				{"customerCode": bson.M{"$regex": query, "$options": "i"}},
			},
		}

		findOptions := options.Find().
			SetLimit(int64(limit)).
			SetSort(bson.D{{Key: "createdAt", Value: -1}})

		var orders []models.SalesOrder
		cursor, err := salesOrdersCollection.Find(ctx, filter, findOptions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to search sales orders",
				"error":   err.Error(),
			})
			return
		}
		defer cursor.Close(ctx)

		if err := cursor.All(ctx, &orders); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to decode search results",
				"error":   err.Error(),
			})
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

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Sales orders search completed successfully",
			"data":    response,
			"count":   len(response),
		})
	}
}
