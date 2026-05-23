package controllers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/backend/utils"
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
			inv.Status = "unpaid"
		}
		if inv.Status != "draft" && inv.PublicToken == "" {
			inv.PublicToken = generatePublicToken()
		}

		// Always reset payment fields on creation — never trust client values
		inv.AmountPaid = 0
		inv.BalanceDue = inv.Totals.GrandTotal

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

		// Auto-mark overdue: any unpaid invoice past its due date (skip proformas)
		today := time.Now().Format("2006-01-02")
		invoiceCollection.UpdateMany(ctx, bson.M{
			"orgId":   orgID,
			"status":  "unpaid",
			"dueDate": bson.M{"$lt": today, "$ne": ""},
			"type":    bson.M{"$ne": "proforma"},
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
			{{Key: "$match", Value: bson.M{"orgId": orgID, "type": bson.M{"$ne": "proforma"}}}},
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
			Status string `json:"status" binding:"required,oneof=draft unpaid paid partial overdue void"`
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
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
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
		if existing.Status == "unpaid" || existing.Status == "overdue" || existing.Status == "partial" {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "Issued invoices cannot be voided. Raise a credit note instead."})
			return
		}

		var req struct {
			Reason string `json:"reason"`
		}
		c.ShouldBindJSON(&req)

		// ── 1. Find all payments linked to this invoice ───────────────────────
		var linkedPayments []models.Payment
		if payCur, e := paymentCollection.Find(ctx, bson.M{
			"invoiceId": existing.ID.Hex(),
			"orgId":     orgID,
		}); e == nil {
			_ = payCur.All(ctx, &linkedPayments)
			payCur.Close(ctx)
		}

		// ── 2. Unlink each payment → unapplied credit ─────────────────────────
		for _, pmt := range linkedPayments {
			note := "[Unapplied — Invoice " + existing.InvoiceNumber + " voided]"
			if pmt.Notes != "" {
				note += " " + pmt.Notes
			}
			paymentCollection.UpdateOne(ctx,
				bson.M{"_id": pmt.ID},
				bson.M{"$set": bson.M{
					"invoiceId":     "",
					"invoiceNumber": "",
					"notes":         note,
					"updatedAt":     time.Now(),
				}},
			)
		}

		// ── 3. Reverse customer AR impact ─────────────────────────────────────
		// CreatePayment decremented outstanding_balance by amountPaid.
		// Voiding reverses that decrement and surfaces the amount as unused credit.
		// The unpaid balance (balanceDue) is removed from AR by the invoice status
		// change alone — all AR queries must filter status != "void".
		if existing.CustomerID != "" && existing.AmountPaid > 0 {
			if custObjID, e2 := primitive.ObjectIDFromHex(existing.CustomerID); e2 == nil {
				histEntry := bson.M{
					"action":    "invoice_voided_payment_unapplied",
					"timestamp": time.Now(),
					"details": bson.M{
						"invoiceId":       existing.ID.Hex(),
						"invoiceNumber":   existing.InvoiceNumber,
						"unappliedAmount": existing.AmountPaid,
						"paymentsCount":   len(linkedPayments),
						"reason":          req.Reason,
					},
				}
				customersCollection.UpdateOne(ctx,
					bson.M{"_id": custObjID, "orgId": orgID},
					bson.M{
						"$inc":  bson.M{
							"outstanding_balance": existing.AmountPaid,  // reverse payment decrements
							"unused_credits":      existing.AmountPaid,  // surface as credit on account
						},
						"$push": bson.M{"history": histEntry},
						"$set":  bson.M{"updated_at": time.Now()},
					},
				)
			}
		} else if existing.CustomerID != "" {
			// Fully unpaid void — still log to history so AR aging audit trail is complete
			if custObjID, e2 := primitive.ObjectIDFromHex(existing.CustomerID); e2 == nil {
				customersCollection.UpdateOne(ctx,
					bson.M{"_id": custObjID, "orgId": orgID},
					bson.M{
						"$push": bson.M{"history": bson.M{
							"action":    "invoice_voided",
							"timestamp": time.Now(),
							"details": bson.M{
								"invoiceId":     existing.ID.Hex(),
								"invoiceNumber": existing.InvoiceNumber,
								"balanceDue":    existing.Totals.GrandTotal,
								"reason":        req.Reason,
							},
						}},
						"$set": bson.M{"updated_at": time.Now()},
					},
				)
			}
		}

		// ── 4. Void the invoice ───────────────────────────────────────────────
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

		msg := "Invoice voided"
		if len(linkedPayments) > 0 {
			msg = "Invoice voided — " + strconv.Itoa(len(linkedPayments)) + " payment(s) converted to unapplied credits"
		}
		c.JSON(http.StatusOK, gin.H{
			"status":             http.StatusOK,
			"message":            msg,
			"unappliedPayments":  len(linkedPayments),
			"unappliedAmount":    existing.AmountPaid,
		})
	}
}

// POST /api/invoices/:id/send — email invoice to the customer
func SendInvoice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid invoice ID"})
			return
		}

		var inv models.Invoice
		if err := invoiceCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&inv); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Invoice not found"})
			return
		}

		// Optional override email in body
		var req struct {
			ToEmail string `json:"toEmail"`
			Message string `json:"message"`
		}
		c.ShouldBindJSON(&req)

		toEmail := req.ToEmail
		if toEmail == "" {
			// Fall back to customer record
			var cust models.Customer
			if custID, err2 := primitive.ObjectIDFromHex(inv.CustomerID); err2 == nil {
				customersCollection.FindOne(ctx, bson.M{"_id": custID}).Decode(&cust)
				toEmail = cust.CustomerEmail
			}
		}
		if toEmail == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "No recipient email found for this customer"})
			return
		}

		if err := utils.SendInvoiceEmail(toEmail, inv, req.Message, false); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to send invoice email", "error": err.Error()})
			return
		}

		// Promote draft to unpaid when email is sent
		if inv.Status == "draft" {
			token := inv.PublicToken
			if token == "" {
				token = generatePublicToken()
			}
			invoiceCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": bson.M{
				"status": "unpaid", "publicToken": token, "updatedAt": time.Now(),
			}})
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Invoice sent to " + toEmail})
	}
}

// POST /api/invoices/:id/send-reminder — email a payment reminder for overdue invoices
func SendInvoiceReminder() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid invoice ID"})
			return
		}

		var inv models.Invoice
		if err := invoiceCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&inv); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Invoice not found"})
			return
		}

		var req struct {
			ToEmail string `json:"toEmail"`
			Message string `json:"message"`
		}
		c.ShouldBindJSON(&req)

		toEmail := req.ToEmail
		if toEmail == "" {
			var cust models.Customer
			if custID, err2 := primitive.ObjectIDFromHex(inv.CustomerID); err2 == nil {
				customersCollection.FindOne(ctx, bson.M{"_id": custID}).Decode(&cust)
				toEmail = cust.CustomerEmail
			}
		}
		if toEmail == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "No recipient email found for this customer"})
			return
		}

		if err := utils.SendInvoiceEmail(toEmail, inv, req.Message, true); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to send reminder email", "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Reminder sent to " + toEmail})
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

// FinalizeProforma converts a proforma invoice into a real invoice.
// POST /api/invoices/:id/finalize
func FinalizeProforma() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid invoice ID"})
			return
		}

		var inv models.Invoice
		if err := invoiceCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&inv); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Invoice not found"})
			return
		}
		if inv.Type != "proforma" {
			c.JSON(http.StatusConflict, gin.H{"message": "Only proforma invoices can be finalized"})
			return
		}
		if inv.ProformaConvertedTo != "" {
			c.JSON(http.StatusConflict, gin.H{"message": "Proforma already finalized"})
			return
		}

		invCount, _ := invoiceCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "type": bson.M{"$ne": "proforma"}})
		newInv := models.Invoice{
			ID:                  primitive.NewObjectID(),
			InvoiceNumber:       fmt.Sprintf("INV-%d-%04d", time.Now().Year(), invCount+1),
			IssueDate:           time.Now().Format("2006-01-02"),
			DueDate:             inv.DueDate,
			Currency:            inv.Currency,
			PaymentTerms:        inv.PaymentTerms,
			From:                inv.From,
			BillTo:              inv.BillTo,
			CustomerID:          inv.CustomerID,
			LineItems:           inv.LineItems,
			Totals:              inv.Totals,
			Notes:               inv.Notes,
			Status:              "unpaid",
			BalanceDue:          inv.Totals.GrandTotal,
			Type:                "invoice",
			PublicToken:         generatePublicToken(),
			LinkedSalesOrderIDs: inv.LinkedSalesOrderIDs,
			LinkedDNID:          inv.LinkedDNID,
			LinkedDNNumber:      inv.LinkedDNNumber,
			OrgID:               orgID.(string),
			CreatedBy:           inv.CreatedBy,
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		}
		for i := range newInv.LineItems {
			newInv.LineItems[i].ID = primitive.NewObjectID()
		}

		if _, err := invoiceCollection.InsertOne(ctx, newInv); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create invoice from proforma"})
			return
		}

		// Mark proforma as finalized
		invoiceCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": orgID},
			bson.M{"$set": bson.M{
				"proformaConvertedTo":       newInv.ID.Hex(),
				"proformaConvertedToNumber": newInv.InvoiceNumber,
				"updatedAt":                 time.Now(),
			}},
		)

		// Link SO(s) and DN to the real invoice
		orgIDStr := orgID.(string)
		go func() {
			bgCtx, bgCancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer bgCancel()
			for _, soIDStr := range inv.LinkedSalesOrderIDs {
				if soObjID, err := primitive.ObjectIDFromHex(soIDStr); err == nil {
					salesOrdersCollection.UpdateOne(bgCtx,
						bson.M{"_id": soObjID, "orgId": orgIDStr},
						bson.M{"$set": bson.M{"status": "invoiced", "updatedAt": time.Now()}},
					)
				}
			}
			if inv.LinkedDNID != "" {
				if dnObjID, err := primitive.ObjectIDFromHex(inv.LinkedDNID); err == nil {
					deliveryNotesCollection.UpdateOne(bgCtx,
						bson.M{"_id": dnObjID, "orgId": orgIDStr},
						bson.M{"$set": bson.M{
							"invoiceId":     newInv.ID.Hex(),
							"invoiceNumber": newInv.InvoiceNumber,
							"updatedAt":     time.Now(),
						}},
					)
				}
			}
		}()

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Proforma finalized",
			"data":    gin.H{"invoiceId": newInv.ID.Hex(), "invoiceNumber": newInv.InvoiceNumber},
		})
	}
}

// GetInvoiceAging returns unpaid invoices grouped into aging buckets.
// GET /api/invoices/aging
func GetInvoiceAging() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		today := time.Now().Format("2006-01-02")
		// Auto-mark overdue first
		invoiceCollection.UpdateMany(ctx, bson.M{
			"orgId":   orgID,
			"status":  "unpaid",
			"dueDate": bson.M{"$lt": today, "$ne": ""},
		}, bson.M{"$set": bson.M{"status": "overdue", "updatedAt": time.Now()}})

		filter := bson.M{
			"orgId":  orgID,
			"status": bson.M{"$in": []string{"unpaid", "partial", "overdue"}},
			"type":   bson.M{"$ne": "proforma"},
		}

		cursor, err := invoiceCollection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "dueDate", Value: 1}}))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch invoices"})
			return
		}
		defer cursor.Close(ctx)

		var invoices []models.Invoice
		cursor.All(ctx, &invoices)

		type AgingEntry struct {
			InvoiceID     string  `json:"invoiceId"`
			InvoiceNumber string  `json:"invoiceNumber"`
			CustomerID    string  `json:"customerId"`
			CustomerName  string  `json:"customerName"`
			IssueDate     string  `json:"issueDate"`
			DueDate       string  `json:"dueDate"`
			GrandTotal    float64 `json:"grandTotal"`
			AmountPaid    float64 `json:"amountPaid"`
			BalanceDue    float64 `json:"balanceDue"`
			DaysOverdue   int     `json:"daysOverdue"`
			Bucket        string  `json:"bucket"`
		}

		todayTime := time.Now().Truncate(24 * time.Hour)
		buckets := map[string][]AgingEntry{
			"current": {},
			"1-30":    {},
			"31-60":   {},
			"61-90":   {},
			"90+":     {},
		}
		bucketTotals := map[string]float64{"current": 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0}

		for _, inv := range invoices {
			balance := inv.Totals.GrandTotal - inv.AmountPaid
			if balance <= 0 {
				continue
			}
			dueTime, err := time.Parse("2006-01-02", inv.DueDate)
			if err != nil {
				dueTime = todayTime
			}
			daysOverdue := int(todayTime.Sub(dueTime).Hours() / 24)

			var bucket string
			switch {
			case daysOverdue <= 0:
				bucket = "current"
			case daysOverdue <= 30:
				bucket = "1-30"
			case daysOverdue <= 60:
				bucket = "31-60"
			case daysOverdue <= 90:
				bucket = "61-90"
			default:
				bucket = "90+"
			}

			entry := AgingEntry{
				InvoiceID:     inv.ID.Hex(),
				InvoiceNumber: inv.InvoiceNumber,
				CustomerID:    inv.CustomerID,
				CustomerName:  inv.BillTo.Name,
				IssueDate:     inv.IssueDate,
				DueDate:       inv.DueDate,
				GrandTotal:    inv.Totals.GrandTotal,
				AmountPaid:    inv.AmountPaid,
				BalanceDue:    balance,
				DaysOverdue:   daysOverdue,
				Bucket:        bucket,
			}
			buckets[bucket] = append(buckets[bucket], entry)
			bucketTotals[bucket] += balance
		}

		// Customer summary
		custMap := map[string]map[string]float64{}
		custNameMap := map[string]string{}
		for bucket, entries := range buckets {
			for _, e := range entries {
				if _, ok := custMap[e.CustomerID]; !ok {
					custMap[e.CustomerID] = map[string]float64{}
				}
				custMap[e.CustomerID][bucket] += e.BalanceDue
				if e.CustomerName != "" {
					custNameMap[e.CustomerID] = e.CustomerName
				}
			}
		}

		type CustSummary struct {
			CustomerID   string  `json:"customerId"`
			CustomerName string  `json:"customerName"`
			Current      float64 `json:"current"`
			Days1_30     float64 `json:"days1_30"`
			Days31_60    float64 `json:"days31_60"`
			Days61_90    float64 `json:"days61_90"`
			Days90Plus   float64 `json:"days90Plus"`
			Total        float64 `json:"total"`
		}
		var customerSummary []CustSummary
		for cid, bkts := range custMap {
			cs := CustSummary{
				CustomerID:   cid,
				CustomerName: custNameMap[cid],
				Current:      bkts["current"],
				Days1_30:     bkts["1-30"],
				Days31_60:    bkts["31-60"],
				Days61_90:    bkts["61-90"],
				Days90Plus:   bkts["90+"],
				Total:        bkts["current"] + bkts["1-30"] + bkts["31-60"] + bkts["61-90"] + bkts["90+"],
			}
			customerSummary = append(customerSummary, cs)
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"buckets":         buckets,
				"bucketTotals":    bucketTotals,
				"customerSummary": customerSummary,
				"asOf":            today,
			},
		})
	}
}

// POST /api/invoices/:id/return
func CreateSalesReturn() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		invoiceID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid invoice ID"})
			return
		}

		var body struct {
			Items           []models.SalesReturnItem `json:"items"`
			Notes           string                   `json:"notes"`
			Mode            string                   `json:"mode"`            // "credit" | "refund"
			RefundPaymentID string                   `json:"refundPaymentId"` // required when mode=refund
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body", "error": err.Error()})
			return
		}
		if body.Mode == "" {
			body.Mode = "reduce"
		}

		activeItems := make([]models.SalesReturnItem, 0)
		for _, item := range body.Items {
			if item.Qty > 0 && item.ItemName != "" {
				subtotal := round2(item.Qty * item.UnitPrice)
				taxAmt := round2(subtotal * (item.TaxRate / 100))
				item.Total = round2(subtotal + taxAmt)
				activeItems = append(activeItems, item)
			}
		}
		if len(activeItems) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "At least one item with qty > 0 required"})
			return
		}

		var inv models.Invoice
		if err := invoiceCollection.FindOne(ctx, bson.M{"_id": invoiceID, "orgId": orgIDStr}).Decode(&inv); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Invoice not found"})
			return
		}
		if inv.Status == "draft" || inv.Status == "void" || inv.Type == "proforma" {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"message": "Cannot create return for draft, void, or proforma invoices"})
			return
		}

		createdByStr := ""
		if userID != nil {
			createdByStr = userID.(string)
		}

		// Stock increase for items that have a stockId
		for _, item := range activeItems {
			if item.StockID == "" {
				continue
			}
			itemObjID, err := primitive.ObjectIDFromHex(item.StockID)
			if err != nil {
				continue
			}
			var stock models.Stock
			if err := stockCollection.FindOne(ctx, bson.M{"_id": itemObjID, "orgId": orgIDStr}).Decode(&stock); err != nil {
				continue
			}
			currentQty := 0.0
			fmt.Sscanf(stock.Quantity, "%f", &currentQty)
			newQty := currentQty + item.Qty
			stockCollection.UpdateOne(ctx,
				bson.M{"_id": itemObjID, "orgId": orgIDStr},
				bson.M{"$set": bson.M{"quantity": fmt.Sprintf("%g", newQty), "updated_at": time.Now()}},
			)
			adj := models.StockAdjustment{
				ID:          primitive.NewObjectID(),
				OrgID:       orgIDStr,
				ItemID:      item.StockID,
				ItemName:    stock.Name,
				ItemCode:    stock.ItemCode,
				Quantity:    item.Qty,
				Type:        "increase",
				Reason:      "return",
				Reference:   inv.InvoiceNumber,
				PreviousQty: currentQty,
				NewQty:      newQty,
				AdjustedAt:  time.Now(),
				CreatedAt:   time.Now(),
				CreatedBy:   createdByStr,
			}
			adjustmentCollection.InsertOne(ctx, adj)
		}

		retNum := fmt.Sprintf("RET-%04d", len(inv.SalesReturns)+1)
		salesReturn := models.SalesReturn{
			ID:           primitive.NewObjectID(),
			ReturnNumber: retNum,
			Date:         time.Now().Format("2006-01-02"),
			Mode:         body.Mode,
			Items:        activeItems,
			Notes:        body.Notes,
			CreatedAt:    time.Now(),
			CreatedBy:    createdByStr,
		}

		responseExtra := gin.H{}

		if body.Mode == "reduce" {
			// ── Direct balance reduction (unpaid / overdue / partial) ─────────────
			returnAmt := 0.0
			for _, item := range activeItems {
				returnAmt += item.Total
			}
			returnAmt = round2(returnAmt)
			newBalance := round2(inv.BalanceDue - returnAmt)
			if newBalance < 0 {
				newBalance = 0
			}

			var newStatus string
			invUpdate := bson.M{"balanceDue": newBalance, "updatedAt": time.Now()}
			if newBalance <= 0 && inv.AmountPaid <= 0 {
				// All goods returned, customer never paid → void the invoice
				newStatus = "void"
				invUpdate["status"] = "void"
				invUpdate["voidReason"] = "Goods fully returned"
				invUpdate["voidedAt"] = time.Now()
			} else if newBalance <= 0 {
				newStatus = "paid"
				invUpdate["status"] = "paid"
			} else if inv.AmountPaid > 0 {
				newStatus = "partial"
				invUpdate["status"] = "partial"
			} else {
				newStatus = "unpaid"
				invUpdate["status"] = "unpaid"
			}
			invoiceCollection.UpdateOne(ctx, bson.M{"_id": invoiceID, "orgId": orgIDStr}, bson.M{"$set": invUpdate})
			salesReturn.RefundAmount = returnAmt
			responseExtra = gin.H{"reducedAmount": returnAmt, "newInvoiceStatus": newStatus, "newBalance": newBalance}

		} else if body.Mode == "refund" {
			// ── Cash refund path ─────────────────────────────────────────────────
			if body.RefundPaymentID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "refundPaymentId required for refund mode"})
				return
			}
			pmtObjID, err := primitive.ObjectIDFromHex(body.RefundPaymentID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid refundPaymentId"})
				return
			}
			var pmt models.Payment
			if err = paymentCollection.FindOne(ctx, bson.M{"_id": pmtObjID, "orgId": orgIDStr}).Decode(&pmt); err != nil {
				c.JSON(http.StatusNotFound, gin.H{"message": "Payment not found"})
				return
			}
			if pmt.IsRefunded {
				c.JSON(http.StatusConflict, gin.H{"message": "Payment already refunded"})
				return
			}

			// Refund amount = sum of return items total
			refundAmt := 0.0
			for _, item := range activeItems {
				refundAmt += item.Total
			}
			refundAmt = round2(refundAmt)
			if refundAmt > pmt.Amount {
				refundAmt = pmt.Amount
			}

			// Reverse on invoice
			newPaid := round2(inv.AmountPaid - refundAmt)
			if newPaid < 0 { newPaid = 0 }

			var newStatus string
			invUpdate := bson.M{"updatedAt": time.Now()}
			if newPaid <= 0 {
				// Payment fully reversed + goods returned → void
				newStatus = "void"
				invUpdate["amountPaid"] = 0.0
				invUpdate["balanceDue"] = 0.0
				invUpdate["status"]     = "void"
				invUpdate["voidReason"] = "Goods returned, payment fully refunded"
				invUpdate["voidedAt"]   = time.Now()
			} else {
				newBalance := round2(inv.Totals.GrandTotal - newPaid)
				if newBalance < 0 { newBalance = 0 }
				newStatus = "partial"
				invUpdate["amountPaid"] = newPaid
				invUpdate["balanceDue"] = newBalance
				invUpdate["status"]     = newStatus
			}
			invoiceCollection.UpdateOne(ctx, bson.M{"_id": invoiceID, "orgId": orgIDStr}, bson.M{"$set": invUpdate})

			// Mark payment refunded
			paymentCollection.UpdateOne(ctx, bson.M{"_id": pmtObjID, "orgId": orgIDStr}, bson.M{"$set": bson.M{
				"isRefunded":     true,
				"refundedAmount": refundAmt,
				"refundedAt":     time.Now(),
				"refundReason":   "Sales return — " + retNum,
				"updatedAt":      time.Now(),
			}})

			salesReturn.RefundPaymentID = body.RefundPaymentID
			salesReturn.RefundAmount = refundAmt
			responseExtra = gin.H{"refundedAmount": refundAmt, "newInvoiceStatus": newStatus}

		} else {
			// ── Credit note path (paid invoice) ──────────────────────────────────
			cnNumber := nextCNNumber(ctx, orgIDStr)
			cnItems := make([]models.CNLineItem, 0, len(activeItems))
			for _, item := range activeItems {
				subtotal := round2(item.Qty * item.UnitPrice)
				taxAmt := round2(subtotal * (item.TaxRate / 100))
				cnItems = append(cnItems, models.CNLineItem{
					ID:          primitive.NewObjectID(),
					Description: item.ItemName,
					Qty:         item.Qty,
					UnitPrice:   item.UnitPrice,
					TaxRate:     item.TaxRate,
					TaxAmt:      taxAmt,
					Total:       round2(subtotal + taxAmt),
				})
			}
			totals := calcCNTotals(cnItems)
			vatBreakdown := calcVATBreakdown(cnItems)
			cnOID := primitive.NewObjectID()
			creditNoteCollection.InsertOne(ctx, bson.M{
				"_id":              cnOID,
				"creditNoteNumber": cnNumber,
				"sourceDocId":      inv.ID.Hex(),
				"sourceDocType":    "invoice",
				"sourceDocNumber":  inv.InvoiceNumber,
				"customerId":       inv.CustomerID,
				"customerName":     inv.BillTo.Name,
				"date":             time.Now().Format("2006-01-02"),
				"reason":           "Sales return",
				"lineItems":        cnItems,
				"totals":           totals,
				"vatBreakdown":     vatBreakdown,
				"status":           "draft",
				"remainingAmount":  totals.GrandTotal,
				"appliedAmount":    0.0,
				"refundedAmount":   0.0,
				"notes":            body.Notes,
				"orgId":            orgIDStr,
				"createdAt":        time.Now(),
				"updatedAt":        time.Now(),
				"createdBy":        createdByStr,
			})
			salesReturn.CreditNoteID = cnOID.Hex()
			salesReturn.CreditNoteNum = cnNumber
			responseExtra = gin.H{"creditNoteId": cnOID.Hex(), "creditNoteNum": cnNumber}
		}

		invoiceCollection.UpdateOne(ctx,
			bson.M{"_id": invoiceID, "orgId": orgIDStr},
			bson.M{
				"$push": bson.M{"salesReturns": salesReturn},
				"$set":  bson.M{"updatedAt": time.Now()},
			},
		)

		resp := gin.H{"message": "Return processed", "returnNumber": retNum}
		for k, v := range responseExtra {
			resp[k] = v
		}
		c.JSON(http.StatusCreated, resp)
	}
}
