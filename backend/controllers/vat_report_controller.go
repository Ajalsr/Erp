package controllers

import (
	"context"
	"net/http"
	"time"

	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// GET /api/reports/vat?from=2024-01-01&to=2024-03-31
// Returns VAT-201 style summary: taxable sales, output VAT, taxable purchases, input VAT, net payable.
func GetVATReport() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		from := c.Query("from")
		to := c.Query("to")

		if from == "" || to == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "from and to query params required (YYYY-MM-DD)"})
			return
		}

		dateFilter := bson.M{"$gte": from, "$lte": to}

		// ── Sales (output VAT) from invoices ──────────────────────────────────
		invoicePipeline := []bson.M{
			{"$match": bson.M{
				"orgId":     orgID,
				"issueDate": dateFilter,
				"status":    bson.M{"$nin": []string{"void", "draft"}},
				"type":      bson.M{"$ne": "proforma"},
			}},
			{"$group": bson.M{
				"_id":          nil,
				"taxableAmt":   bson.M{"$sum": "$totals.subtotal"},
				"outputVAT":    bson.M{"$sum": "$totals.taxTotal"},
				"grandTotal":   bson.M{"$sum": "$totals.grandTotal"},
				"invoiceCount": bson.M{"$sum": 1},
			}},
		}
		invCursor, _ := invoiceCollection.Aggregate(ctx, invoicePipeline)
		var invResult []struct {
			TaxableAmt   float64 `bson:"taxableAmt"`
			OutputVAT    float64 `bson:"outputVAT"`
			GrandTotal   float64 `bson:"grandTotal"`
			InvoiceCount int     `bson:"invoiceCount"`
		}
		invCursor.All(ctx, &invResult)

		var taxableSales, outputVAT, totalSales float64
		var invoiceCount int
		if len(invResult) > 0 {
			taxableSales = invResult[0].TaxableAmt
			outputVAT = invResult[0].OutputVAT
			totalSales = invResult[0].GrandTotal
			invoiceCount = invResult[0].InvoiceCount
		}

		// ── Credit notes (adjustments to output VAT) ─────────────────────────
		cnPipeline := []bson.M{
			{"$match": bson.M{
				"orgId":  orgID,
				"date":   dateFilter,
				"status": bson.M{"$in": []string{"approved", "applied", "closed"}},
			}},
			{"$group": bson.M{
				"_id":       nil,
				"cnTaxable": bson.M{"$sum": "$totals.subtotal"},
				"cnVAT":     bson.M{"$sum": "$totals.vatTotal"},
			}},
		}
		cnCursor, _ := creditNoteCollection.Aggregate(ctx, cnPipeline)
		var cnResult []struct {
			CnTaxable float64 `bson:"cnTaxable"`
			CnVAT     float64 `bson:"cnVAT"`
		}
		cnCursor.All(ctx, &cnResult)
		var cnTaxable, cnVAT float64
		if len(cnResult) > 0 {
			cnTaxable = cnResult[0].CnTaxable
			cnVAT = cnResult[0].CnVAT
		}

		// ── Purchases Box 9: standard input VAT (rcmApplicable=false) ────────
		box9Pipeline := []bson.M{
			{"$match": bson.M{
				"orgId":         orgID,
				"billDate":      dateFilter,
				"status":        bson.M{"$nin": []string{"void", "draft"}},
				"rcmApplicable": false,
			}},
			{"$group": bson.M{
				"_id":        nil,
				"taxablePur": bson.M{"$sum": "$totals.subtotal"},
				"inputVAT":   bson.M{"$sum": "$totals.taxTotal"},
				"billCount":  bson.M{"$sum": 1},
			}},
		}
		box9Cursor, _ := billCollection.Aggregate(ctx, box9Pipeline)
		var box9Result []struct {
			TaxablePur float64 `bson:"taxablePur"`
			InputVAT   float64 `bson:"inputVAT"`
			BillCount  int     `bson:"billCount"`
		}
		box9Cursor.All(ctx, &box9Result)
		var taxablePurchases, box9VAT float64
		var billCount int
		if len(box9Result) > 0 {
			taxablePurchases = box9Result[0].TaxablePur
			box9VAT = box9Result[0].InputVAT
			billCount = box9Result[0].BillCount
		}

		// ── Purchases Box 10: RCM input VAT (rcmApplicable=true) ─────────────
		box10Pipeline := []bson.M{
			{"$match": bson.M{
				"orgId":         orgID,
				"billDate":      dateFilter,
				"status":        bson.M{"$nin": []string{"void", "draft"}},
				"rcmApplicable": true,
			}},
			{"$group": bson.M{
				"_id":           nil,
				"rcmTaxable":    bson.M{"$sum": "$totals.subtotal"},
				"rcmInputVAT":   bson.M{"$sum": "$rcmInputVat"},
				"rcmOutputVAT":  bson.M{"$sum": "$rcmOutputVat"},
				"rcmCount":      bson.M{"$sum": 1},
			}},
		}
		box10Cursor, _ := billCollection.Aggregate(ctx, box10Pipeline)
		var box10Result []struct {
			RCMTaxable   float64 `bson:"rcmTaxable"`
			RCMInputVAT  float64 `bson:"rcmInputVAT"`
			RCMOutputVAT float64 `bson:"rcmOutputVAT"`
			RCMCount     int     `bson:"rcmCount"`
		}
		box10Cursor.All(ctx, &box10Result)
		var box10VAT, box10OutputVAT, rcmTaxable float64
		var rcmCount int
		if len(box10Result) > 0 {
			rcmTaxable = box10Result[0].RCMTaxable
			box10VAT = box10Result[0].RCMInputVAT
			box10OutputVAT = box10Result[0].RCMOutputVAT
			rcmCount = box10Result[0].RCMCount
		}
		billCount += rcmCount

		// Box 11 = Box 9 + Box 10
		inputVAT := box9VAT + box10VAT

		// ── Per-rate breakdown from invoice line items ────────────────────────
		ratePipeline := []bson.M{
			{"$match": bson.M{
				"orgId":     orgID,
				"issueDate": dateFilter,
				"status":    bson.M{"$nin": []string{"void", "draft"}},
				"type":      bson.M{"$ne": "proforma"},
			}},
			{"$unwind": "$lineItems"},
			{"$group": bson.M{
				"_id":     "$lineItems.taxRate",
				"taxable": bson.M{"$sum": "$lineItems.subtotal"},
				"vat":     bson.M{"$sum": "$lineItems.taxAmt"},
			}},
			{"$sort": bson.M{"_id": 1}},
		}
		rateCursor, _ := invoiceCollection.Aggregate(ctx, ratePipeline)
		var rateBreakdown []struct {
			Rate    float64 `bson:"_id"     json:"rate"`
			Taxable float64 `bson:"taxable" json:"taxable"`
			VAT     float64 `bson:"vat"     json:"vat"`
		}
		rateCursor.All(ctx, &rateBreakdown)

		// Box 3 = RCM output VAT (self-assessed, part of total output)
		totalOutputVAT := outputVAT - cnVAT + box10OutputVAT
		netVATPayable := totalOutputVAT - inputVAT

		c.JSON(http.StatusOK, gin.H{
			"data": gin.H{
				"period": gin.H{"from": from, "to": to},
				"sales": gin.H{
					"taxableAmount": taxableSales,
					"outputVAT":     outputVAT,
					"totalSales":    totalSales,
					"invoiceCount":  invoiceCount,
				},
				"creditNoteAdjustments": gin.H{
					"taxableAmount": cnTaxable,
					"vatAdjusted":   cnVAT,
				},
				"purchases": gin.H{
					"taxableAmount":    taxablePurchases,
					"box9InputVAT":     box9VAT,
					"rcmTaxable":       rcmTaxable,
					"box10RCMInputVAT": box10VAT,
					"box10RCMOutputVAT": box10OutputVAT,
					"box11TotalInputVAT": inputVAT,
					"billCount":        billCount,
				},
				"netVATPayable": netVATPayable,
				"rateBreakdown": rateBreakdown,
			},
		})
	}
}

// vatLine is one row of the FTA-style VAT report (Sales or Purchases sheet).
type vatLine struct {
	Kind        string  `json:"kind"`        // "sale" | "purchase"
	Number      string  `json:"number"`      // tax invoice / bill number
	Date        string  `json:"date"`        // YYYY-MM-DD
	Amount      float64 `json:"amount"`      // taxable amount, before VAT
	VAT         float64 `json:"vat"`         // VAT amount
	Party       string  `json:"party"`       // customer (sale) / supplier (purchase)
	TRN         string  `json:"trn"`         // party TRN
	Description string  `json:"description"` // clear description
	Imported    bool    `json:"imported"`    // RCM only: goods imported into UAE (appears on FTA portal)
}

// GetVATReportLines — GET /api/reports/vat/lines?from=YYYY-MM-DD&to=YYYY-MM-DD[&type=sales|purchases|combined]
// Returns the per-transaction rows behind the VAT return: Sales (output VAT from
// invoices) and Purchases (input VAT from bills), matching the FTA template's
// Sales/Purchases sheets. type filters which side is returned (default combined).
func GetVATReportLines() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		from := c.Query("from")
		to := c.Query("to")
		kind := c.Query("type") // "sales" | "purchases" | "" (combined)
		if from == "" || to == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "from and to query params required (YYYY-MM-DD)"})
			return
		}
		dateFilter := bson.M{"$gte": from, "$lte": to}

		sales := []vatLine{}
		purchases := []vatLine{}
		rcm := []vatLine{}
		var salesTaxable, salesVAT, purchaseTaxable, purchaseVAT, rcmTaxable, rcmVAT float64

		// ── Sales (output VAT) from invoices ──────────────────────────────
		if kind != "purchases" {
			cur, err := invoiceCollection.Find(ctx, bson.M{
				"orgId":     orgID,
				"issueDate": dateFilter,
				"status":    bson.M{"$nin": []string{"void", "draft"}},
				"type":      bson.M{"$ne": "proforma"},
			}, options.Find().SetSort(bson.D{{Key: "issueDate", Value: 1}}))
			if err == nil {
				var invs []models.Invoice
				cur.All(ctx, &invs)
				for _, inv := range invs {
					sales = append(sales, vatLine{
						Kind: "sale", Number: inv.InvoiceNumber, Date: inv.IssueDate,
						Amount: inv.Totals.Subtotal, VAT: inv.Totals.TaxTotal,
						Party: inv.BillTo.Name, TRN: inv.BillTo.TRN, Description: inv.Notes.Customer,
					})
					salesTaxable += inv.Totals.Subtotal
					salesVAT += inv.Totals.TaxTotal
				}
			}
		}

		// ── Purchases (input VAT) from bills ──────────────────────────────
		if kind != "sales" {
			cur, err := billCollection.Find(ctx, bson.M{
				"orgId":    orgID,
				"billDate": dateFilter,
				"status":   bson.M{"$nin": []string{"void", "draft"}},
			}, options.Find().SetSort(bson.D{{Key: "billDate", Value: 1}}))
			if err == nil {
				var bills []models.Bill
				cur.All(ctx, &bills)
				for _, b := range bills {
					number := b.BillNumber
					if b.VendorRef != "" {
						number = b.VendorRef // vendor's own tax-invoice number, per FTA
					}
					purchases = append(purchases, vatLine{
						Kind: "purchase", Number: number, Date: b.BillDate,
						Amount: b.Totals.Subtotal, VAT: b.Totals.TaxTotal,
						Party: b.VendorName, TRN: b.VendorTRN, Description: b.PONumber,
					})
					purchaseTaxable += b.Totals.Subtotal
					purchaseVAT += b.Totals.TaxTotal
				}
			}
		}

		// ── RCM (reverse charge) from bills where rcmApplicable=true ───────
		// Matches template sheet 5: supplies under RCM, split by whether they're
		// goods imported into the UAE (appear on the FTA portal) or not.
		{
			cur, err := billCollection.Find(ctx, bson.M{
				"orgId":         orgID,
				"billDate":      dateFilter,
				"status":        bson.M{"$nin": []string{"void", "draft"}},
				"rcmApplicable": true,
			}, options.Find().SetSort(bson.D{{Key: "billDate", Value: 1}}))
			if err == nil {
				var bills []models.Bill
				cur.All(ctx, &bills)
				for _, b := range bills {
					number := b.BillNumber
					if b.VendorRef != "" {
						number = b.VendorRef
					}
					rcm = append(rcm, vatLine{
						Kind: "rcm", Number: number, Date: b.BillDate,
						Amount: b.Totals.Subtotal, VAT: b.RCMOutputVAT,
						Party: b.VendorName, TRN: b.VendorTRN, Description: b.RCMType,
						Imported: b.RCMType == "import",
					})
					rcmTaxable += b.Totals.Subtotal
					rcmVAT += b.RCMOutputVAT
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"data": gin.H{
				"period":    gin.H{"from": from, "to": to},
				"sales":     sales,
				"purchases": purchases,
				"rcm":       rcm,
				"totals": gin.H{
					"salesTaxable":    salesTaxable,
					"salesVAT":        salesVAT,
					"purchaseTaxable": purchaseTaxable,
					"purchaseVAT":     purchaseVAT,
					"rcmTaxable":      rcmTaxable,
					"rcmVAT":          rcmVAT,
					"netVATPayable":   salesVAT - purchaseVAT,
				},
			},
		})
	}
}
