package controllers

import (
	"net/http"
	"sort"
	"time"

	"github.com/backend/config"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/net/context"
)

// SOATransaction is one row in the statement (invoice or payment)
type SOATransaction struct {
	Date        time.Time `json:"date"`
	Reference   string    `json:"reference"`
	Type        string    `json:"type"` // "invoice" | "payment"
	Description string    `json:"description"`
	Debit       float64   `json:"debit"`
	Credit      float64   `json:"credit"`
	Balance     float64   `json:"balance"`
}

// GetStatementOfAccount — GET /api/customers/:id/statement?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
func GetStatementOfAccount() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		customerIDStr := c.Param("id")
		customerObjID, err := primitive.ObjectIDFromHex(customerIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid customer ID"})
			return
		}

		// Default date range: current month
		now := time.Now()
		startDate := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		endDate := startDate.AddDate(0, 1, 0).AddDate(0, 0, -1)

		if s := c.Query("startDate"); s != "" {
			if t, err := time.Parse("2006-01-02", s); err == nil {
				startDate = t
			}
		}
		if e := c.Query("endDate"); e != "" {
			if t, err := time.Parse("2006-01-02", e); err == nil {
				endDate = t
			}
		}

		startStr := startDate.Format("2006-01-02")
		endStr := endDate.Format("2006-01-02")

		// ── 1. Customer info ────────────────────────────────────────────────
		var customer bson.M
		custCol := config.GetCollection(config.DB, "customers")
		if err := custCol.FindOne(ctx, bson.M{"_id": customerObjID, "orgId": orgID}).Decode(&customer); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}

		invoiceCol    := config.GetCollection(config.DB, "invoices")
		paymentCol    := config.GetCollection(config.DB, "payments")
		creditNoteCol := config.GetCollection(config.DB, "credit_notes")

		var transactions []SOATransaction

		// ── 2. Invoices in range (exclude voided) ───────────────────────────
		invCursor, err := invoiceCol.Find(ctx, bson.M{
			"orgId":      orgID,
			"customerId": customerIDStr,
			"issueDate":  bson.M{"$gte": startStr, "$lte": endStr},
			"status":     bson.M{"$nin": []string{"void", "draft"}},
		})
		if err == nil {
			defer invCursor.Close(ctx)
			var invoices []bson.M
			invCursor.All(ctx, &invoices)
			for _, inv := range invoices {
				grandTotal := soaInvoiceTotal(inv)
				invNum, _ := inv["invoiceNumber"].(string)
				status, _ := inv["status"].(string)
				transactions = append(transactions, SOATransaction{
					Date:        soaParseDateStr(inv["issueDate"]),
					Reference:   invNum,
					Type:        "invoice",
					Description: "Invoice - " + status,
					Debit:       grandTotal,
				})
			}
		}

		// ── 3. Payments in range ────────────────────────────────────────────
		payCursor, err := paymentCol.Find(ctx, bson.M{
			"orgId":      orgID,
			"customerId": customerIDStr,
			"date":       bson.M{"$gte": startStr, "$lte": endStr},
		})
		if err == nil {
			defer payCursor.Close(ctx)
			var payments []bson.M
			payCursor.All(ctx, &payments)
			for _, pay := range payments {
				amount, _ := pay["amount"].(float64)
				payNum, _ := pay["paymentNumber"].(string)
				mode, _ := pay["paymentMode"].(string)
				if mode == "" {
					mode = "payment"
				}
				desc := "Payment received"
				if ref, _ := pay["reference"].(string); ref != "" {
					desc += " - Ref: " + ref
				}
				transactions = append(transactions, SOATransaction{
					Date:        soaParseDateStr(pay["date"]),
					Reference:   payNum,
					Type:        "payment",
					Description: desc + " (" + mode + ")",
					Credit:      amount,
				})
				// Refund reverses part/all of the payment — shown as a debit (increases balance)
				if refunded, _ := pay["refundedAmount"].(float64); refunded > 0 {
					transactions = append(transactions, SOATransaction{
						Date:        soaParseDateStr(pay["date"]),
						Reference:   payNum,
						Type:        "refund",
						Description: "Payment refunded - " + payNum,
						Debit:       refunded,
					})
				}
			}
		}

		// ── 4. Applied credit notes in range ───────────────────────────────
		// Credit notes reduce the customer's balance but don't create payment
		// records, so they must be included separately as credit entries.
		cnCursor, err := creditNoteCol.Find(ctx, bson.M{
			"orgId":        orgID,
			"customerId":   customerIDStr,
			"date":         bson.M{"$gte": startStr, "$lte": endStr},
			"status":       bson.M{"$in": []string{"applied", "closed"}},
			"appliedAmount": bson.M{"$gt": 0},
		})
		if err == nil {
			defer cnCursor.Close(ctx)
			var cns []bson.M
			cnCursor.All(ctx, &cns)
			for _, cn := range cns {
				cnAmount := soaCNTotal(cn)
				cnNum, _ := cn["creditNoteNumber"].(string)
				srcNum, _ := cn["sourceDocNumber"].(string)
				desc := "Credit Note applied"
				if srcNum != "" {
					desc += " against " + srcNum
				}
				transactions = append(transactions, SOATransaction{
					Date:        soaParseDateStr(cn["date"]),
					Reference:   cnNum,
					Type:        "credit_note",
					Description: desc,
					Credit:      cnAmount,
				})
			}
		}

		// ── 5. Opening balance: invoices - payments - credit notes before startDate
		var openingBalance float64

		invBeforeCursor, _ := invoiceCol.Find(ctx, bson.M{
			"orgId":      orgID,
			"customerId": customerIDStr,
			"issueDate":  bson.M{"$lt": startStr},
			"status":     bson.M{"$nin": []string{"void", "draft"}},
		})
		if invBeforeCursor != nil {
			defer invBeforeCursor.Close(ctx)
			var prevInvoices []bson.M
			invBeforeCursor.All(ctx, &prevInvoices)
			for _, inv := range prevInvoices {
				openingBalance += soaInvoiceTotal(inv)
			}
		}

		payBeforeCursor, _ := paymentCol.Find(ctx, bson.M{
			"orgId":      orgID,
			"customerId": customerIDStr,
			"date":       bson.M{"$lt": startStr},
		})
		if payBeforeCursor != nil {
			defer payBeforeCursor.Close(ctx)
			var prevPayments []bson.M
			payBeforeCursor.All(ctx, &prevPayments)
			for _, pay := range prevPayments {
				amt, _ := pay["amount"].(float64)
				openingBalance -= amt
				// Refund adds the amount back to the customer's balance
				if refunded, _ := pay["refundedAmount"].(float64); refunded > 0 {
					openingBalance += refunded
				}
			}
		}

		cnBeforeCursor, _ := creditNoteCol.Find(ctx, bson.M{
			"orgId":        orgID,
			"customerId":   customerIDStr,
			"date":         bson.M{"$lt": startStr},
			"status":       bson.M{"$in": []string{"applied", "closed"}},
			"appliedAmount": bson.M{"$gt": 0},
		})
		if cnBeforeCursor != nil {
			defer cnBeforeCursor.Close(ctx)
			var prevCNs []bson.M
			cnBeforeCursor.All(ctx, &prevCNs)
			for _, cn := range prevCNs {
				openingBalance -= soaCNTotal(cn)
			}
		}

		// ── 5. Sort by date, compute running balance ────────────────────────
		sort.Slice(transactions, func(i, j int) bool {
			return transactions[i].Date.Before(transactions[j].Date)
		})

		runningBalance := openingBalance
		for i := range transactions {
			runningBalance += transactions[i].Debit - transactions[i].Credit
			transactions[i].Balance = runningBalance
		}

		if transactions == nil {
			transactions = []SOATransaction{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Statement of account retrieved successfully",
			"data": gin.H{
				"customer": gin.H{
					"id":          customerIDStr,
					"name":        customer["customerDisplayName"],
					"companyName": customer["companyName"],
					"email":       customer["customerEmail"],
					"phone":       customer["customerPhone"],
					"address":     customer["streetAddress"],
					"city":        customer["city"],
					"country":     customer["country"],
					"code":        customer["customerCode"],
				},
				"period": gin.H{
					"startDate": startStr,
					"endDate":   endStr,
				},
				"openingBalance": openingBalance,
				"closingBalance": runningBalance,
				"transactions":   transactions,
			},
		})
	}
}

// soaCNTotal returns the amount actually applied from a credit note.
// Uses appliedAmount (total applied across invoices) rather than grandTotal.
func soaCNTotal(cn bson.M) float64 {
	if v, ok := cn["appliedAmount"].(float64); ok && v > 0 {
		return v
	}
	// fallback: full grand total for legacy records without appliedAmount
	if totals, ok := cn["totals"].(bson.M); ok {
		if gt, ok := totals["grandTotal"].(float64); ok {
			return gt
		}
	}
	return 0
}

// soaInvoiceTotal reads grandTotal from invoices.totals.grandTotal
func soaInvoiceTotal(inv bson.M) float64 {
	if totals, ok := inv["totals"].(bson.M); ok {
		if gt, ok := totals["grandTotal"].(float64); ok {
			return gt
		}
	}
	return 0
}

// soaParseDateStr parses a "YYYY-MM-DD" string value from a bson.M field
func soaParseDateStr(v interface{}) time.Time {
	if s, ok := v.(string); ok {
		if t, err := time.Parse("2006-01-02", s); err == nil {
			return t
		}
	}
	// fallback for legacy records that stored a DateTime
	switch t := v.(type) {
	case primitive.DateTime:
		return t.Time()
	case time.Time:
		return t
	}
	return time.Now()
}
