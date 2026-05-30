package controllers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
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
				"taxableAmt":   bson.M{"$sum": "$subTotal"},
				"outputVAT":    bson.M{"$sum": "$taxTotal"},
				"grandTotal":   bson.M{"$sum": "$grandTotal"},
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
				"cnTaxable": bson.M{"$sum": "$subTotal"},
				"cnVAT":     bson.M{"$sum": "$taxTotal"},
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
