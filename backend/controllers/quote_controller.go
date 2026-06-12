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

var quoteCollection *mongo.Collection = config.GetCollection(config.DB, "quotes")

func CreateQuote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var q models.Quote
		if err := c.ShouldBindJSON(&q); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body", "error": err.Error()})
			return
		}

		// Approval gate — hold the create for an approver when the org requires it.
		if !c.GetBool("approvalReplay") {
			title := q.CustomerName
			if title == "" {
				title = "Quote"
			}
			if holdActionForApproval(c, ctx, fmt.Sprintf("%v", orgID), fmt.Sprintf("%v", userID), "", "quote", "create", "quotes", title, q.Totals.GrandTotal, "", q) {
				return
			}
		}

		q.ID = primitive.NewObjectID()
		q.QuoteNumber = nextNumber(ctx, fmt.Sprintf("%v", orgID), "quote", quoteCollection, "quoteNumber")
		q.OrgID = orgID.(string)
		q.CreatedBy = func() string {
			if userID != nil {
				return userID.(string)
			}
			return ""
		}()
		if q.Status == "" {
			q.Status = "draft"
		}
		if q.QuoteDate == "" {
			q.QuoteDate = time.Now().Format("2006-01-02")
		}
		for i := range q.LineItems {
			q.LineItems[i].ID = primitive.NewObjectID()
		}
		q.CreatedAt = time.Now()
		q.UpdatedAt = time.Now()

		if _, err := quoteCollection.InsertOne(ctx, q); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create quote", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Quote created successfully",
			"data":    gin.H{"id": q.ID.Hex(), "quoteNumber": q.QuoteNumber},
		})
	}
}

func GetAllQuotes() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
		limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 64)
		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 200 {
			limit = 20
		}
		skip := (page - 1) * limit

		// Auto-expire: sent quotes past their validUntil date
		today := time.Now().Format("2006-01-02")
		quoteCollection.UpdateMany(ctx, bson.M{
			"orgId":      orgID,
			"status":     bson.M{"$in": []string{"draft", "sent"}},
			"validUntil": bson.M{"$lt": today, "$ne": ""},
		}, bson.M{"$set": bson.M{"status": "expired", "updatedAt": time.Now()}})

		filter := bson.M{"orgId": orgID}
		if status := c.Query("status"); status != "" && status != "all" {
			filter["status"] = status
		}
		if customerId := c.Query("customerId"); customerId != "" {
			filter["customerId"] = customerId
		}
		// Record scope is "show all, lock others": the list shows every record; access
		// to details/edit/delete is restricted per-record (see GetQuoteByID/Update/Delete).

		total, _ := quoteCollection.CountDocuments(ctx, filter)

		opts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetSkip(skip).
			SetLimit(limit)

		cursor, err := quoteCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch quotes", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var quotes []models.Quote
		if err := cursor.All(ctx, &quotes); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to decode quotes", "error": err.Error()})
			return
		}
		if quotes == nil {
			quotes = []models.Quote{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Quotes retrieved successfully",
			"data": gin.H{
				"quotes":     quotes,
				"total":      total,
				"page":       page,
				"limit":      limit,
				"totalPages": (total + limit - 1) / limit,
			},
		})
	}
}

func GetQuoteByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid quote ID"})
			return
		}

		var q models.Quote
		if err := quoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&q); err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"message": "Quote not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to retrieve quote"})
			}
			return
		}
		// Record scope: "own" roles may only open quotes they created.
		if uid, _, ownOnly := recordScope(c, "quotes", "view"); ownOnly && q.CreatedBy != uid {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You can only view your own quotes"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": q})
	}
}

func GetQuoteStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgID}}},
			{{Key: "$group", Value: bson.M{
				"_id":   "$status",
				"count": bson.M{"$sum": 1},
				"total": bson.M{"$sum": "$totals.grandTotal"},
			}}},
		}

		cursor, err := quoteCollection.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Stats failed"})
			return
		}
		defer cursor.Close(ctx)

		var rows []bson.M
		cursor.All(ctx, &rows)

		result := map[string]gin.H{}
		for _, r := range rows {
			st, _ := r["_id"].(string)
			cnt, _ := r["count"].(int32)
			tot, _ := r["total"].(float64)
			result[st] = gin.H{"count": cnt, "total": tot}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": gin.H{"byStatus": result}})
	}
}

func UpdateQuote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid quote ID"})
			return
		}

		var existing models.Quote
		if err := quoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&existing); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Quote not found"})
			return
		}
		// Record scope: when the caller's scope is "own", only the creator may edit.
		if uid, _, ownOnly := recordScope(c, "quotes", "edit"); ownOnly && existing.CreatedBy != uid {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You can only edit quotes you created"})
			return
		}
		if existing.Status == "converted" {
			c.JSON(http.StatusConflict, gin.H{"message": "Converted quotes cannot be edited"})
			return
		}

		var payload models.Quote
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body", "error": err.Error()})
			return
		}

		for i := range payload.LineItems {
			if payload.LineItems[i].ID.IsZero() {
				payload.LineItems[i].ID = primitive.NewObjectID()
			}
		}

		// Approval gate — hold the edit for an approver when the org requires it.
		if !c.GetBool("approvalReplay") {
			userID, _ := c.Get("userId")
			title := payload.CustomerName
			if title == "" {
				title = existing.CustomerName
			}
			if holdActionForApproval(c, ctx, fmt.Sprintf("%v", orgID), fmt.Sprintf("%v", userID), "", "quote", "update", "quotes", title, payload.Totals.GrandTotal, c.Param("id"), payload) {
				return
			}
		}

		update := bson.M{"$set": bson.M{
			"status":        payload.Status,
			"quoteDate":     payload.QuoteDate,
			"validUntil":    payload.ValidUntil,
			"currency":      payload.Currency,
			"paymentTerms":  payload.PaymentTerms,
			"customerName":  payload.CustomerName,
			"customerEmail": payload.CustomerEmail,
			"customerId":    payload.CustomerID,
			"billTo":        payload.BillTo,
			"lineItems":     payload.LineItems,
			"totals":        payload.Totals,
			"notes":         payload.Notes,
			"updatedAt":     time.Now(),
		}}

		if _, err := quoteCollection.UpdateOne(ctx, bson.M{"_id": objectID, "orgId": orgID}, update); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update quote"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Quote updated successfully"})
	}
}

func UpdateQuoteStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid quote ID"})
			return
		}

		var req struct {
			Status string `json:"status" binding:"required"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid status"})
			return
		}

		// A regular member can't accept/decline their own quote — needs another reviewer.
		// Owner/admin (the approval authority) may accept/decline their own.
		if req.Status == "accepted" || req.Status == "declined" {
			var existing models.Quote
			if quoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&existing) == nil {
				userID, _ := c.Get("userId")
				if existing.CreatedBy != "" && existing.CreatedBy == fmt.Sprintf("%v", userID) {
					isPrivileged := false
					if orgObjID, e := primitive.ObjectIDFromHex(fmt.Sprintf("%v", orgID)); e == nil {
						if role, ok := getMemberRole(ctx, orgObjID, fmt.Sprintf("%v", userID)); ok {
							isPrivileged = isAdminOrOwner(role)
						}
					}
					if !isPrivileged {
						c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You can't accept or decline a quote you created"})
						return
					}
				}
			}
		}

		_, err = quoteCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": orgID},
			bson.M{"$set": bson.M{"status": req.Status, "updatedAt": time.Now()}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update status"})
			return
		}

		// Accepting a quote that came from an enquiry marks that enquiry converted.
		if req.Status == "accepted" {
			var q models.Quote
			if quoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&q) == nil && q.SourceEnquiryId != "" {
				if enqObjID, e := primitive.ObjectIDFromHex(q.SourceEnquiryId); e == nil {
					enquiryCollection.UpdateOne(ctx,
						bson.M{"_id": enqObjID, "orgId": orgID},
						bson.M{"$set": bson.M{"status": "converted", "updatedAt": time.Now()}},
					)
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Quote status updated"})
	}
}

// ConvertQuoteToInvoice creates an Invoice from the quote's line items, marks the
// quote as converted, and returns the new invoice ID.
func ConvertQuoteToInvoice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid quote ID"})
			return
		}

		var q models.Quote
		if err := quoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&q); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Quote not found"})
			return
		}
		if q.Status == "converted" {
			c.JSON(http.StatusConflict, gin.H{"message": "Quote already converted"})
			return
		}
		if q.Status != "accepted" {
			c.JSON(http.StatusConflict, gin.H{"message": "Quote must be accepted before converting"})
			return
		}

		// Build invoice line items from quote line items
		invLineItems := make([]models.InvoiceLineItem, len(q.LineItems))
		for i, li := range q.LineItems {
			invLineItems[i] = models.InvoiceLineItem{
				ID:        primitive.NewObjectID(),
				Desc:      li.Desc,
				Qty:       li.Qty,
				UnitPrice: li.UnitPrice,
				Discount:  li.Discount,
				TaxRate:   li.TaxRate,
				Subtotal:  li.Subtotal,
				DiscAmt:   li.DiscAmt,
				TaxAmt:    li.TaxAmt,
				Total:     li.Total,
			}
		}

		inv := models.Invoice{
			ID:            primitive.NewObjectID(),
			InvoiceNumber: nextNumber(ctx, fmt.Sprintf("%v", orgID), "invoice", invoiceCollection, "invoiceNumber"),
			IssueDate:     time.Now().Format("2006-01-02"),
			DueDate:       q.ValidUntil,
			Currency:      q.Currency,
			PaymentTerms:  q.PaymentTerms,
			CustomerID:    q.CustomerID,
			BillTo:        models.InvoiceParty{Name: q.BillTo.Name, Address: q.BillTo.Address, TRN: q.BillTo.TRN},
			LineItems:     invLineItems,
			Totals:        models.InvoiceTotals{Subtotal: q.Totals.Subtotal, DiscountTotal: q.Totals.DiscountTotal, TaxTotal: q.Totals.TaxTotal, GrandTotal: q.Totals.GrandTotal},
			Notes:         models.InvoiceNotes{Customer: q.Notes.Customer, Internal: q.Notes.Internal},
			Status:        "draft",
			BalanceDue:    q.Totals.GrandTotal,
			OrgID:         orgID.(string),
			CreatedBy: func() string {
				if userID != nil {
					return userID.(string)
				}
				return ""
			}(),
			PublicToken: generatePublicToken(),
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		// Multi-currency: freeze the txn→base rate + base totals carried from the quote.
		applyInvoiceFX(ctx, &inv)

		if _, err := invoiceCollection.InsertOne(ctx, inv); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create invoice from quote"})
			return
		}

		// Mark quote as converted
		quoteCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": orgID},
			bson.M{"$set": bson.M{"status": "converted", "convertedTo": inv.ID.Hex(), "updatedAt": time.Now()}},
		)

		// Auto-convert linked enquiry if this quote was created from one
		if q.SourceEnquiryId != "" {
			if enqObjID, err := primitive.ObjectIDFromHex(q.SourceEnquiryId); err == nil {
				enquiryCollection.UpdateOne(ctx,
					bson.M{"_id": enqObjID, "orgId": orgID},
					bson.M{"$set": bson.M{"status": "converted", "updatedAt": time.Now()}},
				)
			}
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Quote converted to invoice",
			"data":    gin.H{"invoiceId": inv.ID.Hex(), "invoiceNumber": inv.InvoiceNumber},
		})
	}
}

// ConvertQuoteToSalesOrder creates a draft SalesOrder from the quote's line items,
// marks the quote as converted (to SO), and returns the new SO id + orderNumber.
func ConvertQuoteToSalesOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid quote ID"})
			return
		}

		var q models.Quote
		if err := quoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&q); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Quote not found"})
			return
		}
		if q.Status == "converted" {
			c.JSON(http.StatusConflict, gin.H{"message": "Quote already converted"})
			return
		}
		if q.Status != "accepted" {
			c.JSON(http.StatusConflict, gin.H{"message": "Quote must be accepted before converting"})
			return
		}

		// Map quote line items → SO items (desc used as details, no stock deduction at draft)
		soItems := make([]models.SalesOrderItem, 0, len(q.LineItems))
		for _, li := range q.LineItems {
			soItems = append(soItems, models.SalesOrderItem{
				ID:       primitive.NewObjectID(),
				ItemID:   li.ID.Hex(), // placeholder — user can update before confirming
				Details:  li.Desc,
				Quantity: li.Qty,
				Rate:     li.UnitPrice,
				Discount: models.FlexFloat(li.Discount),
				Amount:   li.Total,
			})
		}

		createdByStr := ""
		if userID != nil {
			createdByStr = fmt.Sprintf("%v", userID)
		}

		so := models.SalesOrder{
			ID:                primitive.NewObjectID(),
			OrderNumber:       nextNumber(ctx, fmt.Sprintf("%v", orgID), "sales_order", salesOrdersCollection, "orderNumber"),
			CustomerID:        q.CustomerID,
			CustomerName:      q.CustomerName,
			SalesType:         "SO",
			OrderDate:         time.Now(),
			PaymentTerms:      q.PaymentTerms,
			Items:             soItems,
			SubTotal:          q.Totals.Subtotal,
			VAT:               q.Totals.TaxTotal,
			Total:             q.Totals.GrandTotal,
			CustomerNotes:     q.Notes.Customer,
			Status:            "draft",
			SourceQuoteID:     q.ID.Hex(),
			SourceQuoteNumber: q.QuoteNumber,
			OrgID:             orgID.(string),
			CreatedBy:         createdByStr,
			CreatedAt:         time.Now(),
			UpdatedAt:         time.Now(),
		}

		if _, err := salesOrdersCollection.InsertOne(ctx, so); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create sales order from quote"})
			return
		}

		// Mark quote as converted (to SO)
		quoteCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": orgID},
			bson.M{"$set": bson.M{
				"status":            "converted",
				"convertedToSO":     so.ID.Hex(),
				"convertedToSONumber": so.OrderNumber,
				"updatedAt":         time.Now(),
			}},
		)

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Quote converted to Sales Order",
			"data":    gin.H{"salesOrderId": so.ID.Hex(), "orderNumber": so.OrderNumber},
		})
	}
}

func DeleteQuote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid quote ID"})
			return
		}

		var existing models.Quote
		if err := quoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&existing); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Quote not found"})
			return
		}
		// Record scope: when the caller's scope is "own", only the creator may delete.
		if uid, _, ownOnly := recordScope(c, "quotes", "delete"); ownOnly && existing.CreatedBy != uid {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You can only delete quotes you created"})
			return
		}
		if existing.Status == "converted" {
			c.JSON(http.StatusConflict, gin.H{"message": "Converted quotes cannot be deleted"})
			return
		}

		quoteCollection.DeleteOne(ctx, bson.M{"_id": objectID, "orgId": orgID})
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Quote deleted"})
	}
}
