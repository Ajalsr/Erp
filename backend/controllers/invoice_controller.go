package controllers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
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

func generatePublicToken() string {
	b := make([]byte, 18)
	rand.Read(b)
	return hex.EncodeToString(b)
}

var invoiceCollection *mongo.Collection = config.GetCollection(config.DB, "invoices")

func CreateInvoice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var inv models.Invoice
		if err := c.ShouldBindJSON(&inv); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}

		inv.ID = primitive.NewObjectID()
		inv.OrgID = orgID.(string)
		inv.CreatedBy = func() string {
			if userID != nil {
				return userID.(string)
			}
			return ""
		}()
		inv.CreatedAt = time.Now()
		inv.UpdatedAt = time.Now()

		if inv.Status == "" {
			inv.Status = "sent"
		}
		if inv.Status != "draft" && inv.PublicToken == "" {
			inv.PublicToken = generatePublicToken()
		}

		// Assign IDs to line items
		for i := range inv.LineItems {
			inv.LineItems[i].ID = primitive.NewObjectID()
		}

		_, err := invoiceCollection.InsertOne(ctx, inv)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create invoice", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Invoice created successfully",
			"data":    gin.H{"id": inv.ID.Hex(), "invoiceNumber": inv.InvoiceNumber},
		})
	}
}

func GetAllInvoices() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
		limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 64)
		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}
		skip := (page - 1) * limit

		// Auto-mark overdue: any sent/unpaid invoice past its due date
		today := time.Now().Format("2006-01-02")
		invoiceCollection.UpdateMany(ctx, bson.M{
			"orgId":   orgID,
			"status":  bson.M{"$in": []string{"unpaid", "sent"}},
			"dueDate": bson.M{"$lt": today, "$ne": ""},
		}, bson.M{"$set": bson.M{"status": "overdue", "updatedAt": time.Now()}})

		filter := bson.M{"orgId": orgID}
		if status := c.Query("status"); status != "" && status != "all" {
			filter["status"] = status
		}
		if customerId := c.Query("customerId"); customerId != "" {
			filter["customerId"] = customerId
		}

		total, _ := invoiceCollection.CountDocuments(ctx, filter)

		opts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetSkip(skip).
			SetLimit(limit)

		cursor, err := invoiceCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch invoices", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var invoices []models.Invoice
		if err := cursor.All(ctx, &invoices); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode invoices", "error": err.Error()})
			return
		}
		if invoices == nil {
			invoices = []models.Invoice{}
		}

		// Fill in billTo.name for invoices where it was not stored
		var missingIDs []primitive.ObjectID
		for _, inv := range invoices {
			if inv.BillTo.Name == "" && inv.CustomerID != "" {
				if oid, err2 := primitive.ObjectIDFromHex(inv.CustomerID); err2 == nil {
					missingIDs = append(missingIDs, oid)
				}
			}
		}
		if len(missingIDs) > 0 {
			cCursor, err2 := customersCollection.Find(ctx,
				bson.M{"_id": bson.M{"$in": missingIDs}},
				options.Find().SetProjection(bson.M{"customerDisplayName": 1, "companyName": 1}),
			)
			if err2 == nil {
				defer cCursor.Close(ctx)
				var custDocs []struct {
					ID                  primitive.ObjectID `bson:"_id"`
					CustomerDisplayName string             `bson:"customerDisplayName"`
					CompanyName         string             `bson:"companyName"`
				}
				cCursor.All(ctx, &custDocs)
				nameMap := map[string]string{}
				for _, cd := range custDocs {
					name := cd.CustomerDisplayName
					if name == "" {
						name = cd.CompanyName
					}
					nameMap[cd.ID.Hex()] = name
				}
				for i, inv := range invoices {
					if inv.BillTo.Name == "" && inv.CustomerID != "" {
						if name, ok := nameMap[inv.CustomerID]; ok && name != "" {
							invoices[i].BillTo.Name = name
						}
					}
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Invoices retrieved successfully",
			"data": gin.H{
				"invoices":   invoices,
				"total":      total,
				"page":       page,
				"limit":      limit,
				"totalPages": (total + limit - 1) / limit,
			},
		})
	}
}

func GetInvoiceByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid invoice ID"})
			return
		}

		var inv models.Invoice
		err = invoiceCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&inv)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Invoice not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve invoice", "error": err.Error()})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Invoice retrieved successfully", "data": inv})
	}
}

func GetInvoiceStats() gin.HandlerFunc {
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
				"paid":  bson.M{"$sum": "$amountPaid"},
			}}},
		}

		cursor, err := invoiceCollection.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Stats failed"})
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
			pd, _ := r["paid"].(float64)
			result[st] = gin.H{"count": cnt, "total": tot, "paid": pd, "balance": tot - pd}
		}

		// Convenience: sum of unpaid + partial = outstanding
		outstanding := 0.0
		outstandingCount := int32(0)
		for _, st := range []string{"unpaid", "partial", "overdue"} {
			if v, ok := result[st]; ok {
				if b, ok := v["balance"].(float64); ok {
					outstanding += b
				}
				if n, ok := v["count"].(int32); ok {
					outstandingCount += n
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"byStatus":          result,
				"outstandingTotal":  outstanding,
				"outstandingCount":  outstandingCount,
			},
		})
	}
}

// UpdateInvoice replaces all editable fields on a draft invoice (used when
// the user saves as draft then later clicks "Issue Invoice").
func UpdateInvoice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid invoice ID"})
			return
		}

		orgID, _ := c.Get("orgId")

		// Only allow editing drafts — once issued an invoice is immutable here
		var existing models.Invoice
		err = invoiceCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&existing)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Invoice not found"})
			return
		}
		if existing.Status != "draft" {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "Only draft invoices can be updated"})
			return
		}

		var payload models.Invoice
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}

		for i := range payload.LineItems {
			if payload.LineItems[i].ID.IsZero() {
				payload.LineItems[i].ID = primitive.NewObjectID()
			}
		}

		fields := bson.M{
			"status":        payload.Status,
			"invoiceNumber": payload.InvoiceNumber,
			"issueDate":     payload.IssueDate,
			"dueDate":       payload.DueDate,
			"currency":      payload.Currency,
			"paymentTerms":  payload.PaymentTerms,
			"lineItems":     payload.LineItems,
			"totals":        payload.Totals,
			"notes":         payload.Notes,
			"billTo":        payload.BillTo,
			"customerId":    payload.CustomerID,
			"updatedAt":     time.Now(),
		}
		if payload.Status != "draft" && existing.PublicToken == "" {
			fields["publicToken"] = generatePublicToken()
		}
		update := bson.M{"$set": fields}

		result, err := invoiceCollection.UpdateOne(ctx, bson.M{"_id": objectID, "orgId": orgID}, update)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update invoice"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Invoice updated successfully",
			"data":    gin.H{"id": existing.ID.Hex(), "invoiceNumber": payload.InvoiceNumber},
		})
	}
}

func UpdateInvoiceStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid invoice ID"})
			return
		}

		var req struct {
			Status string `json:"status" binding:"required,oneof=draft unpaid sent paid partial overdue void"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid status", "error": err.Error()})
			return
		}

		orgID, _ := c.Get("orgId")
		update := bson.M{"$set": bson.M{"status": req.Status, "updatedAt": time.Now()}}
		result, err := invoiceCollection.UpdateOne(ctx, bson.M{"_id": objectID, "orgId": orgID}, update)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Invoice not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Invoice status updated"})
	}
}

// PATCH /api/invoices/:id/void
func VoidInvoice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid invoice ID"})
			return
		}

		orgID, _ := c.Get("orgId")

		var existing models.Invoice
		if err = invoiceCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&existing); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Invoice not found"})
			return
		}
		if existing.Status == "void" {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "Invoice is already void"})
			return
		}
		if existing.Status == "paid" {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "Paid invoices cannot be voided. Raise a credit note instead."})
			return
		}

		var req struct {
			Reason string `json:"reason"`
		}
		c.ShouldBindJSON(&req)

		_, err = invoiceCollection.UpdateOne(ctx, bson.M{"_id": objectID, "orgId": orgID}, bson.M{"$set": bson.M{
			"status":     "void",
			"voidReason": req.Reason,
			"voidedAt":   time.Now(),
			"updatedAt":  time.Now(),
		}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to void invoice"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Invoice voided"})
	}
}

// GET /api/invoices/public/:token  — no auth required
func GetPublicInvoice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		token := c.Param("token")
		if token == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid token"})
			return
		}

		var inv models.Invoice
		err := invoiceCollection.FindOne(ctx, bson.M{"publicToken": token}).Decode(&inv)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Invoice not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": inv})
	}
}
