package controllers

import (
	"context"
	"log"
	"net/http"
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

var exchangeRateCollection *mongo.Collection = config.GetCollection(config.DB, "exchange_rates")

// DefaultBaseCurrency is used when an org has not set one (legacy orgs).
const DefaultBaseCurrency = "AED"

// orgBaseCurrency returns the org's reporting currency, defaulting to AED.
func orgBaseCurrency(ctx context.Context, orgID string) string {
	oid, err := primitive.ObjectIDFromHex(orgID)
	if err != nil {
		return DefaultBaseCurrency
	}
	// Project ONLY baseCurrency — org docs can carry multi-MB fields (docSettings,
	// letterhead images); decoding the whole doc here once cost ~20s and blew request
	// deadlines on every FX-touching path (bills, invoices, exchange-rate reads).
	var org models.Organization
	if err := config.GetCollection(config.DB, "organizations").
		FindOne(ctx, bson.M{"_id": oid}, options.FindOne().SetProjection(bson.M{"baseCurrency": 1})).
		Decode(&org); err != nil || strings.TrimSpace(org.BaseCurrency) == "" {
		return DefaultBaseCurrency
	}
	return strings.ToUpper(org.BaseCurrency)
}

// latestRate finds the most recent quote (asOfDate <= date) converting from→to.
// Returns (rate, true) on success.
func latestRate(ctx context.Context, orgID, from, to, date string) (float64, bool) {
	if date == "" {
		date = time.Now().Format(dateLayout)
	}
	var er models.ExchangeRate
	opts := options.FindOne().SetSort(bson.D{{Key: "asOfDate", Value: -1}})
	err := exchangeRateCollection.FindOne(ctx, bson.M{
		"orgId":        orgID,
		"fromCurrency": strings.ToUpper(from),
		"toCurrency":   strings.ToUpper(to),
		"asOfDate":     bson.M{"$lte": date},
	}, opts).Decode(&er)
	if err != nil || er.Rate <= 0 {
		return 0, false
	}
	return er.Rate, true
}

// resolveRate determines the txn→base rate for a document.
//   - same currency as base (or empty) → 1
//   - a positive client-supplied override → used as-is (frozen at posting)
//   - otherwise the latest stored quote ≤ date
//   - fallback 1 (logged by caller via the ok flag) so the ledger still balances
//
// Returns (rate, base, ok). ok=false means no real rate was found and 1 was assumed.
func resolveRate(ctx context.Context, orgID, txnCcy, override, date string, clientRate float64) (rate float64, base string, ok bool) {
	base = orgBaseCurrency(ctx, orgID)
	_ = override
	txn := strings.ToUpper(strings.TrimSpace(txnCcy))
	if txn == "" || txn == base {
		return 1, base, true
	}
	if clientRate > 0 {
		return clientRate, base, true
	}
	if r, found := latestRate(ctx, orgID, txn, base, date); found {
		return r, base, true
	}
	return 1, base, false
}

// scaleJELines converts journal lines from txn currency to base by multiplying each
// debit/credit by the rate. rate==1 returns the lines unchanged (rounded).
func scaleJELines(lines []jeLineInput, rate float64) []jeLineInput {
	if rate == 1 || rate <= 0 {
		return lines
	}
	out := make([]jeLineInput, len(lines))
	for i, l := range lines {
		l.Debit = round2(l.Debit * rate)
		l.Credit = round2(l.Credit * rate)
		out[i] = l
	}
	return out
}

// scaleTotals returns Totals converted to base currency at rate.
func scaleTotals(t models.InvoiceTotals, rate float64) models.InvoiceTotals {
	if rate == 1 || rate <= 0 {
		return t
	}
	return models.InvoiceTotals{
		Subtotal:      round2(t.Subtotal * rate),
		DiscountTotal: round2(t.DiscountTotal * rate),
		TaxTotal:      round2(t.TaxTotal * rate),
		GrandTotal:    round2(t.GrandTotal * rate),
	}
}

// applyInvoiceFX freezes the txn→base rate on an invoice and computes its base totals.
// Honours a client-supplied ExchangeRate override; otherwise pulls the latest stored
// quote for IssueDate. Returns the resolved rate (also set on inv.ExchangeRate).
func applyInvoiceFX(ctx context.Context, inv *models.Invoice) float64 {
	rate, base, ok := resolveRate(ctx, inv.OrgID, inv.Currency, "", inv.IssueDate, inv.ExchangeRate)
	if !ok {
		log.Printf("applyInvoiceFX: no FX rate for %s→%s on %s (org %s) — assuming 1; GL may be mis-stated until a rate is entered",
			inv.Currency, base, inv.IssueDate, inv.OrgID)
	}
	inv.ExchangeRate = rate
	inv.BaseCurrency = base
	inv.BaseTotals = scaleTotals(inv.Totals, rate)
	return rate
}

// applyBillFX freezes the txn→base rate on a bill and computes its base totals,
// honouring a client-supplied ExchangeRate override. Returns the resolved rate.
func applyBillFX(ctx context.Context, b *models.Bill) float64 {
	rate, base, ok := resolveRate(ctx, b.OrgID, b.Currency, "", b.BillDate, b.ExchangeRate)
	if !ok {
		log.Printf("applyBillFX: no FX rate for %s→%s on %s (org %s) — assuming 1; GL may be mis-stated until a rate is entered",
			b.Currency, base, b.BillDate, b.OrgID)
	}
	b.ExchangeRate = rate
	b.BaseCurrency = base
	if rate == 1 || rate <= 0 {
		b.BaseTotals = b.Totals
	} else {
		b.BaseTotals = models.BillTotals{
			Subtotal:      round2(b.Totals.Subtotal * rate),
			DiscountTotal: round2(b.Totals.DiscountTotal * rate),
			TaxTotal:      round2(b.Totals.TaxTotal * rate),
			Shipping:      round2(b.Totals.Shipping * rate),
			Adjustment:    round2(b.Totals.Adjustment * rate),
			GrandTotal:    round2(b.Totals.GrandTotal * rate),
		}
	}
	return rate
}

// buildPaymentReceiptJE returns base-currency journal lines for a customer payment
// applied to a receivable, recognising realised FX gain/loss when the payment-date
// rate differs from the rate the invoice was booked at.
//
//	DR Bank      = amount × paymentRate   (base value of cash received)
//	CR AR (1100) = amount × invoiceRate   (base value of receivable relieved)
//	CR FX Gain (4300) / DR FX Loss (5800) = the difference
//
// Same-currency payments (txn == base) post the simple 1:1 entry.
func buildPaymentReceiptJE(ctx context.Context, orgID, bankCode string, amount float64, txnCcy string, invoiceRate float64, date string) []jeLineInput {
	if bankCode == "" {
		bankCode = "1001"
	}
	base := orgBaseCurrency(ctx, orgID)
	txn := strings.ToUpper(strings.TrimSpace(txnCcy))
	if txn == "" || txn == base {
		return []jeLineInput{
			{AccountCode: bankCode, Debit: amount},
			{AccountCode: "1100", Credit: amount},
		}
	}
	if invoiceRate <= 0 {
		invoiceRate = 1
	}
	payRate, _, ok := resolveRate(ctx, orgID, txn, "", date, 0)
	if !ok {
		log.Printf("buildPaymentReceiptJE: no FX rate for %s→%s on %s (org %s) — assuming invoice rate; no FX gain/loss recognised",
			txn, base, date, orgID)
		payRate = invoiceRate
	}
	baseCash := round2(amount * payRate)
	baseAR := round2(amount * invoiceRate)
	lines := []jeLineInput{
		{AccountCode: bankCode, Debit: baseCash},
		{AccountCode: "1100", Credit: baseAR},
	}
	if diff := round2(baseCash - baseAR); diff > 0 {
		lines = append(lines, jeLineInput{AccountCode: "4300", Credit: diff, Description: "Realised FX gain"})
	} else if diff < 0 {
		lines = append(lines, jeLineInput{AccountCode: "5800", Debit: -diff, Description: "Realised FX loss"})
	}
	return lines
}

// buildVendorPaymentJE returns base-currency journal lines for a payment to a vendor
// against a payable, recognising realised FX gain/loss when the payment-date rate
// differs from the rate the bill was booked at.
//
//	DR AP (2000) = amount × billRate      (base value of payable relieved)
//	CR Bank      = amount × paymentRate    (base value of cash paid)
//	CR FX Gain (4300) / DR FX Loss (5800) = the difference
//
// Paying a foreign payable for fewer base units than it was booked at is a gain.
func buildVendorPaymentJE(ctx context.Context, orgID, bankCode string, amount float64, txnCcy string, billRate float64, date string) []jeLineInput {
	if bankCode == "" {
		bankCode = "1001"
	}
	base := orgBaseCurrency(ctx, orgID)
	txn := strings.ToUpper(strings.TrimSpace(txnCcy))
	if txn == "" || txn == base {
		return []jeLineInput{
			{AccountCode: "2000", Debit: amount},
			{AccountCode: bankCode, Credit: amount},
		}
	}
	if billRate <= 0 {
		billRate = 1
	}
	payRate, _, ok := resolveRate(ctx, orgID, txn, "", date, 0)
	if !ok {
		log.Printf("buildVendorPaymentJE: no FX rate for %s→%s on %s (org %s) — assuming bill rate; no FX gain/loss recognised",
			txn, base, date, orgID)
		payRate = billRate
	}
	baseAP := round2(amount * billRate)
	baseCash := round2(amount * payRate)
	lines := []jeLineInput{
		{AccountCode: "2000", Debit: baseAP},
		{AccountCode: bankCode, Credit: baseCash},
	}
	// Paid fewer base units than booked (baseAP > baseCash) → gain.
	if diff := round2(baseAP - baseCash); diff > 0 {
		lines = append(lines, jeLineInput{AccountCode: "4300", Credit: diff, Description: "Realised FX gain"})
	} else if diff < 0 {
		lines = append(lines, jeLineInput{AccountCode: "5800", Debit: -diff, Description: "Realised FX loss"})
	}
	return lines
}

// ── HTTP handlers ─────────────────────────────────────────────────

// CreateExchangeRate stores a manual FX quote. ToCurrency defaults to org base.
func CreateExchangeRate() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var er models.ExchangeRate
		if err := c.ShouldBindJSON(&er); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		er.FromCurrency = strings.ToUpper(strings.TrimSpace(er.FromCurrency))
		er.ToCurrency = strings.ToUpper(strings.TrimSpace(er.ToCurrency))
		if er.ToCurrency == "" {
			er.ToCurrency = orgBaseCurrency(ctx, orgID.(string))
		}
		if er.FromCurrency == "" || er.Rate <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "fromCurrency and a positive rate are required"})
			return
		}
		if er.AsOfDate == "" {
			er.AsOfDate = time.Now().Format(dateLayout)
		}

		er.ID = primitive.NewObjectID()
		er.OrgID = orgID.(string)
		if userID != nil {
			er.CreatedBy = userID.(string)
		}
		er.CreatedAt = time.Now()

		if _, err := exchangeRateCollection.InsertOne(ctx, er); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to save rate", "error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Exchange rate saved", "data": er})
	}
}

// GetExchangeRates lists the org's quotes, newest first.
func GetExchangeRates() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		opts := options.Find().SetSort(bson.D{{Key: "asOfDate", Value: -1}, {Key: "createdAt", Value: -1}})
		cursor, err := exchangeRateCollection.Find(ctx, bson.M{"orgId": orgID}, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch rates", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var rates []models.ExchangeRate
		if err := cursor.All(ctx, &rates); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode", "error": err.Error()})
			return
		}
		if rates == nil {
			rates = []models.ExchangeRate{}
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "baseCurrency": orgBaseCurrency(ctx, orgID.(string)), "data": rates})
	}
}

// GetLatestRate resolves the effective rate for from→base as of an optional date.
// Query: ?from=USD&date=YYYY-MM-DD. Used by create forms to prefill the rate.
func GetLatestRate() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		from := strings.ToUpper(c.Query("from"))
		date := c.Query("date")
		base := orgBaseCurrency(ctx, orgID.(string))

		if from == "" || from == base {
			c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "base": base, "from": from, "rate": 1, "found": true})
			return
		}
		rate, found := latestRate(ctx, orgID.(string), from, base, date)
		if !found {
			rate = 1
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "base": base, "from": from, "rate": rate, "found": found})
	}
}
