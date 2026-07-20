package controllers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/backend/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// GetNextNumberPreview returns the next number an entity would get under the org's
// configured format, without consuming it — for read-only previews on create forms.
// GET /api/numbering/preview?key=sales_order
func GetNextNumberPreview() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		key := c.Query("key")

		type src struct {
			coll  *mongo.Collection
			field string
		}
		sources := map[string]src{
			"sales_order":    {salesOrdersCollection, "orderNumber"},
			"purchase_order": {purchaseOrderCollection, "orderNumber"},
			"quote":          {quoteCollection, "quoteNumber"},
			"invoice":        {invoiceCollection, "invoiceNumber"},
			"bill":           {billCollection, "billNumber"},
		"expense":        {expenseCollection, "expenseNumber"},
			"customer":       {customersCollection, "customerCode"},
			"credit_note":    {creditNoteCollection, "creditNoteNumber"},
			"debit_note":     {debitNoteCollection, "debitNoteNumber"},
			"payment":        {paymentCollection, "paymentNumber"},
			"grn":            {grnCollection, "grnNumber"},
			"delivery_note":  {deliveryNotesCollection, "dnNumber"},
			"employee":       {employeeCollection, "employeeCode"},
			"pay_run":        {payRunCollection, "runNumber"},
		}
		s, ok := sources[key]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Unknown numbering key"})
			return
		}

		number := nextNumber(ctx, fmt.Sprintf("%v", orgID), key, s.coll, s.field)
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": gin.H{"number": number}})
	}
}

// ── Configurable document/entity numbering ─────────────────────────────────
//
// Every auto-generated number (customer code, invoice number, …) flows through
// nextNumber, which loads the org's configured format from org_settings and
// falls back to the entity's legacy default. Formats are edited in the UI under
// Organization → Settings → numbering.

// Format builders reproducing the legacy patterns.

func fmtSeg(prefix string, parts ...utils.NumberSegment) utils.NumberFormat {
	segs := []utils.NumberSegment{{Type: "literal", Value: prefix}}
	segs = append(segs, parts...)
	return utils.NumberFormat{Segments: segs}
}

var (
	seg4      = utils.NumberSegment{Type: "sequence", Mode: "digit", Digits: 4, Start: 1}
	segYear4  = utils.NumberSegment{Type: "year", Digits: 4}
	segMonth2 = utils.NumberSegment{Type: "month", Digits: 2}
	segYear2  = utils.NumberSegment{Type: "year", Digits: 2}
	segDash   = utils.NumberSegment{Type: "literal", Value: "-"}
)

// entityDefaultFormats[key] is used until an org customises that entity.
var entityDefaultFormats = map[string]utils.NumberFormat{
	// MMYY + 2-digit counter (e.g. 042607)
	"customer": {Segments: []utils.NumberSegment{segMonth2, segYear2, {Type: "sequence", Mode: "digit", Digits: 2, Start: 1}}},

	// PREFIX-YYYY-0001
	"invoice":       fmtSeg("INV-", segYear4, segDash, seg4),
	"quote":         fmtSeg("QUO-", segYear4, segDash, seg4),
	"delivery_note": fmtSeg("DN-", segYear4, segDash, seg4),
	"letter":        fmtSeg("LTR-", segYear4, segDash, seg4),

	// PREFIX-0001
	"credit_note":   fmtSeg("CN-", seg4),
	"debit_note":    fmtSeg("DN-", seg4),
	"grn":           fmtSeg("GRN-", seg4),
	"vendor":        fmtSeg("VEN-", seg4),
	"lpo":           fmtSeg("LPO-", seg4),
	"employee":      fmtSeg("EMP-", seg4),
	"leave_request": fmtSeg("LR-", seg4),

	// PREFIX-YYYYMM-0001
	"bill":           fmtSeg("BILL-", segYear4, segMonth2, segDash, seg4),
	"expense":        fmtSeg("EXP-", segYear4, segMonth2, segDash, seg4),
	"payment":        fmtSeg("PAY-", segYear4, segMonth2, segDash, seg4),
	"vendor_payment": fmtSeg("VPAY-", segYear4, segMonth2, segDash, seg4),
	"advance":        fmtSeg("ADV-", segYear4, segMonth2, segDash, seg4),
	"vendor_credit":  fmtSeg("VCR-", segYear4, segMonth2, segDash, seg4),
	"journal_entry":  fmtSeg("JE-", segYear4, segMonth2, segDash, seg4),

	// PREFIX + MM + YY + 0001 (e.g. SO04260001)
	"sales_order":    fmtSeg("SO", segMonth2, segYear2, seg4),
	"purchase_order": fmtSeg("PO", segMonth2, segYear2, seg4),

	// PREFIX-YYYY-0001 — payroll. "PYR-" not "PAY-": that prefix is already used
	// by payment numbering (below), and reusing it here would make pay-run and
	// payment references visually indistinguishable on statements.
	"pay_run": fmtSeg("PYR-", segYear4, segDash, seg4),
	"payslip": fmtSeg("PS-", segYear4, segDash, seg4),
}

// loadNumberFormat reads the org's configured format for the given entity key
// from org_settings, falling back to def.
func loadNumberFormat(ctx context.Context, orgID, key string, def utils.NumberFormat) utils.NumberFormat {
	var doc struct {
		NumberingFormats map[string]utils.NumberFormat `bson:"numberingFormats"`
	}
	err := config.GetCollection(config.DB, "org_settings").
		FindOne(ctx, bson.M{"orgId": orgID}).Decode(&doc)
	if err == nil {
		if f, ok := doc.NumberingFormats[key]; ok && len(f.Segments) > 0 {
			return f
		}
	}
	return def
}

// nextNumber builds the next number for entity `key`, scoped to the org.
func nextNumber(ctx context.Context, orgID, key string, coll *mongo.Collection, field string) string {
	format := loadNumberFormat(ctx, orgID, key, entityDefaultFormats[key])
	n, err := utils.GenerateFormattedNumber(ctx, coll, field, bson.M{"orgId": orgID}, format, time.Now())
	if err != nil {
		log.Printf("numbering: %s generation warning: %v", key, err)
	}
	return n
}
