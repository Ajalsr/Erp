package controllers

import (
	"context"
	"fmt"
	"net/http"
	"sort"
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

var creditNoteCollection *mongo.Collection = config.GetCollection(config.DB, "credit_notes")

// ── Package-level helpers (also used by debit_note_controller.go) ─────────────

func calcVATBreakdown(items []models.CNLineItem) []models.VATLine {
	type acc struct{ taxable, vat float64 }
	rateMap := make(map[float64]*acc)
	for _, item := range items {
		a, ok := rateMap[item.TaxRate]
		if !ok {
			a = &acc{}
			rateMap[item.TaxRate] = a
		}
		a.taxable += item.Qty * item.UnitPrice
		a.vat += item.TaxAmt
	}
	lines := make([]models.VATLine, 0, len(rateMap))
	for rate, a := range rateMap {
		lines = append(lines, models.VATLine{
			Rate:          rate,
			TaxableAmount: round2(a.taxable),
			VATAmount:     round2(a.vat),
		})
	}
	sort.Slice(lines, func(i, j int) bool { return lines[i].Rate < lines[j].Rate })
	return lines
}

func calcCNTotals(items []models.CNLineItem) models.CNTotals {
	var sub, vat float64
	for _, item := range items {
		sub += item.Qty * item.UnitPrice
		vat += item.TaxAmt
	}
	return models.CNTotals{
		Subtotal:   round2(sub),
		VATTotal:   round2(vat),
		GrandTotal: round2(sub + vat),
	}
}

// nextCNNumber returns the next sequential credit note number for the org.
// Format: CN-0001, CN-0002, … per org (resets per org, not globally).
func nextCNNumber(ctx context.Context, orgID string) string {
	opts := options.FindOne().SetSort(bson.D{{Key: "creditNoteNumber", Value: -1}})
	var last bson.M
	next := 1
	if err := creditNoteCollection.FindOne(ctx, bson.M{"orgId": orgID}, opts).Decode(&last); err == nil {
		if num, ok := last["creditNoteNumber"].(string); ok {
			seqStr := strings.TrimPrefix(num, "CN-")
			if seq, err := strconv.Atoi(seqStr); err == nil {
				next = seq + 1
			}
		}
	}
	return fmt.Sprintf("CN-%04d", next)
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// POST /api/credit-notes
func CreateCreditNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var body models.CreditNote
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid body", "error": err.Error()})
			return
		}
		if body.CustomerID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "customerId is required"})
			return
		}
		if body.Reason == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "reason is required"})
			return
		}
		if len(body.LineItems) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "at least one line item is required"})
			return
		}

		// Ensure line item IDs
		for i := range body.LineItems {
			if body.LineItems[i].ID.IsZero() {
				body.LineItems[i].ID = primitive.NewObjectID()
			}
		}

		// Auto-calculate totals and VAT breakdown (client values are overridden)
		body.Totals = calcCNTotals(body.LineItems)
		body.VATBreakdown = calcVATBreakdown(body.LineItems)

		// Validate against source document balance
		if body.SourceDocID != "" {
			srcID, err := primitive.ObjectIDFromHex(body.SourceDocID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid sourceDocId"})
				return
			}
			var inv models.Invoice
			if err = invoiceCollection.FindOne(ctx, bson.M{"_id": srcID, "orgId": orgID}).Decode(&inv); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "source invoice not found"})
				return
			}
			if body.Totals.GrandTotal > inv.BalanceDue+0.005 {
				c.JSON(http.StatusBadRequest, gin.H{
					"message": fmt.Sprintf("credit note total (%.2f) exceeds invoice balance due (%.2f)", body.Totals.GrandTotal, inv.BalanceDue),
				})
				return
			}
		}

		body.CreditNoteNumber = nextCNNumber(ctx, orgID.(string))
		body.OrgID = orgID.(string)
		body.Status = "draft"
		body.CreatedAt = time.Now()
		body.UpdatedAt = time.Now()
		if userID != nil {
			body.CreatedBy = userID.(string)
		}
		if body.Date == "" {
			body.Date = time.Now().Format("2006-01-02")
		}

		oid := primitive.NewObjectID()
		body.ID = oid.Hex()

		doc := bson.M{
			"_id":              oid,
			"creditNoteNumber": body.CreditNoteNumber,
			"sourceDocId":      body.SourceDocID,
			"sourceDocType":    body.SourceDocType,
			"sourceDocNumber":  body.SourceDocNumber,
			"customerId":       body.CustomerID,
			"customerName":     body.CustomerName,
			"date":             body.Date,
			"reason":           body.Reason,
			"lineItems":        body.LineItems,
			"totals":           body.Totals,
			"vatBreakdown":     body.VATBreakdown,
			"status":           body.Status,
			"notes":            body.Notes,
			"orgId":            body.OrgID,
			"createdAt":        body.CreatedAt,
			"updatedAt":        body.UpdatedAt,
			"createdBy":        body.CreatedBy,
		}

		if _, err := creditNoteCollection.InsertOne(ctx, doc); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create credit note"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message": "credit note created",
			"data":    gin.H{"id": oid.Hex(), "creditNoteNumber": body.CreditNoteNumber},
		})
	}
}

// GET /api/credit-notes
func GetAllCreditNotes() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		filter := bson.M{"orgId": orgID}
		if s := c.Query("status"); s != "" && s != "all" {
			filter["status"] = s
		}
		if cid := c.Query("customerId"); cid != "" {
			filter["customerId"] = cid
		}

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := creditNoteCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to fetch credit notes"})
			return
		}
		defer cursor.Close(ctx)

		var notes []bson.M
		cursor.All(ctx, &notes)
		if notes == nil {
			notes = []bson.M{}
		}
		c.JSON(http.StatusOK, gin.H{"data": notes})
	}
}

// GET /api/credit-notes/:id
func GetCreditNoteByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid id"})
			return
		}
		var cn bson.M
		if err = creditNoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&cn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "credit note not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": cn})
	}
}

// PATCH /api/credit-notes/:id/submit — draft → pending_approval
func SubmitCreditNote() gin.HandlerFunc {
	return cnTransition("draft", "pending_approval", "only draft credit notes can be submitted")
}

// PATCH /api/credit-notes/:id/approve — pending_approval → approved
func ApproveCreditNote() gin.HandlerFunc {
	return cnTransition("pending_approval", "approved", "only pending_approval credit notes can be approved")
}

// PATCH /api/credit-notes/:id/close — applied → closed
func CloseCreditNote() gin.HandlerFunc {
	return cnTransition("applied", "closed", "only applied credit notes can be closed")
}

func cnTransition(from, to, errMsg string) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid id"})
			return
		}
		res, err := creditNoteCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": orgID, "status": from},
			bson.M{"$set": bson.M{"status": to, "updatedAt": time.Now()}},
		)
		if err != nil || res.MatchedCount == 0 {
			c.JSON(http.StatusConflict, gin.H{"message": errMsg})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "status updated to " + to})
	}
}

// PATCH /api/credit-notes/:id/apply — approved → applied, reduces invoice balance.
// Body (optional): {"invoiceId": "<hex>"} — required only when CN has no linked sourceDocId.
func ApplyCreditNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid id"})
			return
		}

		var cn bson.M
		if err = creditNoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&cn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "credit note not found"})
			return
		}
		if cn["status"] != "approved" {
			c.JSON(http.StatusConflict, gin.H{"message": "only approved credit notes can be applied"})
			return
		}

		// Resolve invoice ID: prefer sourceDocId on CN; fall back to body param.
		sourceDocID, _ := cn["sourceDocId"].(string)
		if sourceDocID == "" {
			var body struct {
				InvoiceID string `json:"invoiceId"`
			}
			_ = c.ShouldBindJSON(&body)
			sourceDocID = body.InvoiceID
		}
		if sourceDocID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "no invoice linked — pass invoiceId in request body"})
			return
		}

		invID, err := primitive.ObjectIDFromHex(sourceDocID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid invoiceId"})
			return
		}

		var inv models.Invoice
		if err = invoiceCollection.FindOne(ctx, bson.M{"_id": invID, "orgId": orgID}).Decode(&inv); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "invoice not found"})
			return
		}

		// Customer must match when CN was created without a linked invoice.
		cnCustomerID, _ := cn["customerId"].(string)
		if cnCustomerID != "" && inv.CustomerID != "" && cnCustomerID != inv.CustomerID {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invoice does not belong to the same customer as the credit note"})
			return
		}

		totals, _ := cn["totals"].(bson.M)
		creditAmount := 0.0
		if totals != nil {
			creditAmount, _ = totals["grandTotal"].(float64)
		}

		if creditAmount > inv.BalanceDue+0.005 {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": fmt.Sprintf("credit note total (%.2f) exceeds invoice balance due (%.2f)", creditAmount, inv.BalanceDue),
			})
			return
		}

		newBalance := round2(inv.BalanceDue - creditAmount)
		newPaid := round2(inv.AmountPaid + creditAmount)
		newStatus := inv.Status
		if newBalance <= 0 {
			newBalance = 0
			newStatus = "paid"
		} else {
			newStatus = "partial"
		}

		invoiceCollection.UpdateOne(ctx, bson.M{"_id": invID}, bson.M{"$set": bson.M{
			"balanceDue": newBalance,
			"amountPaid": newPaid,
			"status":     newStatus,
			"updatedAt":  time.Now(),
		}})

		// Record which invoice was ultimately applied to (for manual CNs).
		cnUpdate := bson.M{"status": "applied", "updatedAt": time.Now()}
		if cn["sourceDocId"] == nil || cn["sourceDocId"] == "" {
			cnUpdate["sourceDocId"] = sourceDocID
		}
		creditNoteCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": cnUpdate})

		c.JSON(http.StatusOK, gin.H{
			"message": "credit note applied",
			"data":    gin.H{"newInvoiceBalance": newBalance, "invoiceStatus": newStatus},
		})
	}
}

// GET /api/credit-notes/stats
func GetCreditNoteStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgID}}},
			{{Key: "$group", Value: bson.D{
				{Key: "_id", Value: "$status"},
				{Key: "count", Value: bson.M{"$sum": 1}},
				{Key: "total", Value: bson.M{"$sum": "$totals.grandTotal"}},
			}}},
		}

		cursor, err := creditNoteCollection.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "aggregation failed"})
			return
		}
		defer cursor.Close(ctx)

		var rows []bson.M
		cursor.All(ctx, &rows)

		result := bson.M{
			"totalIssued":     0,
			"totalApplied":    0.0,
			"totalPending":    0.0,
			"totalVoid":       0,
			"countByStatus":   bson.M{},
		}
		for _, row := range rows {
			status, _ := row["_id"].(string)
			count, _  := row["count"].(int32)
			total, _  := row["total"].(float64)

			counts := result["countByStatus"].(bson.M)
			counts[status] = bson.M{"count": count, "total": round2(total)}

			switch status {
			case "applied", "closed":
				result["totalIssued"] = result["totalIssued"].(int) + int(count)
				result["totalApplied"] = round2(result["totalApplied"].(float64) + total)
			case "draft", "pending_approval", "approved":
				result["totalIssued"] = result["totalIssued"].(int) + int(count)
				result["totalPending"] = round2(result["totalPending"].(float64) + total)
			case "void":
				result["totalVoid"] = result["totalVoid"].(int) + int(count)
			}
		}

		c.JSON(http.StatusOK, gin.H{"data": result})
	}
}

// GET /api/credit-notes/by-invoice/:invoiceId
func GetCreditNotesByInvoice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		invoiceID := c.Param("invoiceId")

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := creditNoteCollection.Find(ctx, bson.M{"orgId": orgID, "sourceDocId": invoiceID}, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to fetch credit notes"})
			return
		}
		defer cursor.Close(ctx)

		var notes []bson.M
		cursor.All(ctx, &notes)
		if notes == nil {
			notes = []bson.M{}
		}
		c.JSON(http.StatusOK, gin.H{"data": notes})
	}
}

// PATCH /api/credit-notes/:id/void — draft | pending_approval | approved → void
func VoidCreditNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid id"})
			return
		}

		var cn bson.M
		if err = creditNoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&cn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "credit note not found"})
			return
		}
		switch cn["status"] {
		case "applied", "closed":
			c.JSON(http.StatusConflict, gin.H{"message": "applied or closed credit notes cannot be voided"})
			return
		}

		creditNoteCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": bson.M{
			"status":    "void",
			"updatedAt": time.Now(),
		}})
		c.JSON(http.StatusOK, gin.H{"message": "credit note voided"})
	}
}
