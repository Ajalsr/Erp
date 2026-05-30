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

		// Validate source document exists (no balance cap — paid invoices can still be credited as refunds)
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
			// CN total must not exceed the invoice grand total (not balance due — paid invoices are valid returns)
			if body.Totals.GrandTotal > inv.Totals.GrandTotal+0.005 {
				c.JSON(http.StatusBadRequest, gin.H{
					"message": fmt.Sprintf("credit note total (%.2f) exceeds invoice total (%.2f)", body.Totals.GrandTotal, inv.Totals.GrandTotal),
				})
				return
			}
		}

		body.CreditNoteNumber = nextCNNumber(ctx, orgID.(string))
		body.OrgID = orgID.(string)
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

		// When raised directly from an invoice, auto-apply immediately.
		// CN is created as "approved" then applied in the same request.
		cnTotal := body.Totals.GrandTotal
		appliedAmt := 0.0
		remainingAmt := cnTotal
		cnStatus := "draft"

		var newInvBalance, newInvPaid float64
		var newInvStatus string
		var invOID primitive.ObjectID

		if body.SourceDocID != "" {
			invOID, _ = primitive.ObjectIDFromHex(body.SourceDocID)
			var inv models.Invoice
			if err := invoiceCollection.FindOne(ctx, bson.M{"_id": invOID, "orgId": orgID}).Decode(&inv); err == nil {
				if inv.BalanceDue > 0.005 {
					// Unpaid/partial invoice — reduce balance
					applyAmt := cnTotal
					if applyAmt > inv.BalanceDue {
						applyAmt = inv.BalanceDue
					}
					appliedAmt = round2(applyAmt)
					remainingAmt = round2(cnTotal - appliedAmt)
					newInvBalance = round2(inv.BalanceDue - appliedAmt)
					newInvPaid = round2(inv.AmountPaid + appliedAmt)
					newInvStatus = "partial"
					if newInvBalance <= 0 {
						newInvBalance = 0
						newInvStatus = "paid"
					}
					if remainingAmt <= 0 {
						cnStatus = "closed"
					} else {
						cnStatus = "approved"
					}
				} else {
					// Paid invoice — CN becomes a pure refund credit, no balance to reduce
					appliedAmt = 0
					remainingAmt = cnTotal
					cnStatus = "approved"
				}
			} else {
				cnStatus = "draft"
			}
		} else {
			cnStatus = "draft"
		}

		doc := bson.M{
			"_id":              oid,
			"creditNoteNumber": body.CreditNoteNumber,
			"sourceDocId":      body.SourceDocID,
			"sourceDocType":    body.SourceDocType,
			"sourceDocNumber":  body.SourceDocNumber,
			"customerId":       body.CustomerID,
			"customerName":     body.CustomerName,
			"cnType":           body.CnType,
			"date":             body.Date,
			"reason":           body.Reason,
			"lineItems":        body.LineItems,
			"totals":           body.Totals,
			"vatBreakdown":     body.VATBreakdown,
			"status":           cnStatus,
			"remainingAmount":  remainingAmt,
			"appliedAmount":    appliedAmt,
			"refundedAmount":   0.0,
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

		// Apply to invoice if raised from one
		if body.SourceDocID != "" && appliedAmt > 0 {
			invoiceCollection.UpdateOne(ctx, bson.M{"_id": invOID}, bson.M{"$set": bson.M{
				"balanceDue": newInvBalance,
				"amountPaid": newInvPaid,
				"status":     newInvStatus,
				"updatedAt":  time.Now(),
			}})
		}

		c.JSON(http.StatusCreated, gin.H{
			"message": "credit note created",
			"data": gin.H{
				"id":               oid.Hex(),
				"creditNoteNumber": body.CreditNoteNumber,
				"appliedAmount":    appliedAmt,
				"newInvoiceBalance": newInvBalance,
				"invoiceStatus":    newInvStatus,
			},
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

// PATCH /api/credit-notes/:id/apply — approved → partial use or closed.
// Body: {"invoiceId": "<hex>", "amount": 50.00}
// amount defaults to full remaining balance. invoiceId overrides sourceDocId.
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
		if cn["status"] != "approved" && cn["status"] != "applied" {
			c.JSON(http.StatusConflict, gin.H{"message": "only approved credit notes can be applied"})
			return
		}

		var body struct {
			InvoiceID string  `json:"invoiceId"`
			Amount    float64 `json:"amount"`
		}
		_ = c.ShouldBindJSON(&body)

		// Resolve invoice: body param takes priority, then sourceDocId on CN
		sourceDocID, _ := cn["sourceDocId"].(string)
		if body.InvoiceID != "" {
			sourceDocID = body.InvoiceID
		}
		if sourceDocID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invoiceId required"})
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
		cnCustomerID, _ := cn["customerId"].(string)
		if cnCustomerID != "" && inv.CustomerID != "" && cnCustomerID != inv.CustomerID {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invoice does not belong to the same customer"})
			return
		}

		// Resolve remaining balance (fallback for old CNs without the field)
		remaining := 0.0
		if r, ok := cn["remainingAmount"].(float64); ok && r > 0 {
			remaining = r
		} else {
			if t, ok := cn["totals"].(bson.M); ok {
				remaining, _ = t["grandTotal"].(float64)
			}
		}

		creditAmount := round2(body.Amount)
		if creditAmount <= 0 {
			creditAmount = remaining
		}
		if creditAmount > remaining+0.005 {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": fmt.Sprintf("amount (%.2f) exceeds remaining credit (%.2f)", creditAmount, remaining),
			})
			return
		}
		if creditAmount > inv.BalanceDue+0.005 {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": fmt.Sprintf("amount (%.2f) exceeds invoice balance due (%.2f)", creditAmount, inv.BalanceDue),
			})
			return
		}

		newInvBalance := round2(inv.BalanceDue - creditAmount)
		newInvPaid   := round2(inv.AmountPaid + creditAmount)
		newInvStatus := "partial"
		if newInvBalance <= 0 {
			newInvBalance = 0
			newInvStatus  = "paid"
		}
		invoiceCollection.UpdateOne(ctx, bson.M{"_id": invID}, bson.M{"$set": bson.M{
			"balanceDue": newInvBalance,
			"amountPaid": newInvPaid,
			"status":     newInvStatus,
			"updatedAt":  time.Now(),
		}})

		newRemaining  := round2(remaining - creditAmount)
		oldApplied, _ := cn["appliedAmount"].(float64)
		// Accumulate per-invoice applied amount (reset when invoice changes)
		prevInvID, _ := cn["appliedToInvoiceId"].(string)
		prevPerInvoice, _ := cn["appliedToInvoiceAmount"].(float64)
		perInvoiceAmt := creditAmount
		if prevInvID == sourceDocID {
			perInvoiceAmt = round2(prevPerInvoice + creditAmount)
		}

		cnUpdate := bson.M{
			"remainingAmount":        newRemaining,
			"appliedAmount":          round2(oldApplied + creditAmount),
			"appliedToInvoiceId":     sourceDocID,
			"appliedToInvoiceAmount": perInvoiceAmt,
			"updatedAt":              time.Now(),
		}
		if newRemaining <= 0 {
			cnUpdate["status"] = "closed"
		} else {
			cnUpdate["status"] = "applied"
		}
		if cn["sourceDocId"] == nil || cn["sourceDocId"] == "" {
			cnUpdate["sourceDocId"]     = sourceDocID
			cnUpdate["sourceDocNumber"] = inv.InvoiceNumber
		}
		applicationEntry := bson.M{
			"invoiceId":     sourceDocID,
			"invoiceNumber": inv.InvoiceNumber,
			"amount":        creditAmount,
			"date":          time.Now().Format("2006-01-02"),
		}
		creditNoteCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{
			"$set":  cnUpdate,
			"$push": bson.M{"applications": applicationEntry},
		})

		c.JSON(http.StatusOK, gin.H{
			"message": "credit note applied",
			"data": gin.H{
				"appliedAmount":     creditAmount,
				"remainingAmount":   newRemaining,
				"newInvoiceBalance": newInvBalance,
				"invoiceStatus":     newInvStatus,
			},
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
		cursor, err := creditNoteCollection.Find(ctx, bson.M{
			"orgId": orgID,
			"$or":   []bson.M{
				{"sourceDocId":         invoiceID},
				{"appliedToInvoiceId":  invoiceID},
			},
		}, opts)
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

// PATCH /api/credit-notes/:id/refund — approved → refunded (cash goes back to customer, no invoice touched)
// Body: { amount, paymentMode, reference, notes }
func RefundCreditNote() gin.HandlerFunc {
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
			c.JSON(http.StatusConflict, gin.H{"message": "only approved credit notes can be refunded as cash"})
			return
		}

		var body struct {
			Amount      float64                `json:"amount"`
			PaymentMode string                 `json:"paymentMode"`
			Reference   string                 `json:"reference"`
			Details     map[string]interface{} `json:"details"`
			Notes       string                 `json:"notes"`
		}
		_ = c.ShouldBindJSON(&body)

		// Resolve remaining balance (fallback for old CNs without the field)
		remaining := 0.0
		if r, ok := cn["remainingAmount"].(float64); ok && r > 0 {
			remaining = r
		} else {
			if totals, ok := cn["totals"].(bson.M); ok {
				remaining, _ = totals["grandTotal"].(float64)
			}
		}
		if body.Amount <= 0 {
			body.Amount = remaining
		}
		body.Amount = round2(body.Amount)
		if body.Amount > remaining+0.005 {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": fmt.Sprintf("refund amount (%.2f) cannot exceed remaining credit (%.2f)", body.Amount, remaining),
			})
			return
		}

		newRemaining    := round2(remaining - body.Amount)
		oldRefunded, _  := cn["refundedAmount"].(float64)
		cnUpdate := bson.M{
			"remainingAmount": newRemaining,
			"refundedAmount":  round2(oldRefunded + body.Amount),
			"refundedAt":      time.Now(),
			"refundMethod":    body.PaymentMode,
			"refundRef":       body.Reference,
			"refundDetails":   body.Details,
			"refundNotes":     body.Notes,
			"updatedAt":       time.Now(),
		}
		if newRemaining <= 0 {
			cnUpdate["status"] = "closed"
		}
		creditNoteCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": cnUpdate})

		c.JSON(http.StatusOK, gin.H{
			"message": "credit note refunded as cash",
			"data":    gin.H{"refundedAmount": body.Amount, "remainingAmount": newRemaining},
		})
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
