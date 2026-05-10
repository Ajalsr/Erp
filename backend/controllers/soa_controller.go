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
	Debit       float64   `json:"debit"`   // invoice amount
	Credit      float64   `json:"credit"`  // payment amount
	Balance     float64   `json:"balance"` // running balance
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

		// Parse date range (default: current month)
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		endOfMonth := startOfMonth.AddDate(0, 1, 0).Add(-time.Second)

		startDate := startOfMonth
		endDate := endOfMonth
		if s := c.Query("startDate"); s != "" {
			if t, err := time.Parse("2006-01-02", s); err == nil {
				startDate = t
			}
		}
		if e := c.Query("endDate"); e != "" {
			if t, err := time.Parse("2006-01-02", e); err == nil {
				endDate = t.Add(24*time.Hour - time.Second)
			}
		}

		// ── 1. Get customer info ────────────────────────────────────────────
		var customer bson.M
		custCol := config.GetCollection(config.DB, "customers")
		if err := custCol.FindOne(ctx, bson.M{"_id": customerObjID, "orgId": orgID}).Decode(&customer); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
			return
		}

		// ── 2. Get invoices for this customer in range ─────────────────────
		invoiceCol := config.GetCollection(config.DB, "invoices")
		invCursor, err := invoiceCol.Find(ctx, bson.M{
			"orgId":      orgID,
			"customerId": customerIDStr,
			"createdAt":  bson.M{"$gte": startDate, "$lte": endDate},
		})

		var transactions []SOATransaction
		if err == nil {
			defer invCursor.Close(ctx)
			var invoices []bson.M
			invCursor.All(ctx, &invoices)
			for _, inv := range invoices {
				grandTotal, _ := inv["grandTotal"].(float64)
				if grandTotal == 0 {
					if totals, ok := inv["totals"].(bson.M); ok {
						grandTotal, _ = totals["grandTotal"].(float64)
					}
				}
				invNum, _ := inv["invoiceNumber"].(string)
				status, _ := inv["status"].(string)
				t := extractTimeFromSOA(inv, "createdAt")
				transactions = append(transactions, SOATransaction{
					Date:        t,
					Reference:   invNum,
					Type:        "invoice",
					Description: "Invoice - " + status,
					Debit:       grandTotal,
					Credit:      0,
				})
			}
		}

		// ── 3. Get payments for this customer in range ─────────────────────
		paymentCol := config.GetCollection(config.DB, "payments")
		payCursor, err := paymentCol.Find(ctx, bson.M{
			"orgId":      orgID,
			"customerId": customerIDStr,
			"createdAt":  bson.M{"$gte": startDate, "$lte": endDate},
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
				ref, _ := pay["reference"].(string)
				desc := "Payment received"
				if ref != "" {
					desc += " - Ref: " + ref
				}
				t := extractTimeFromSOA(pay, "createdAt")
				transactions = append(transactions, SOATransaction{
					Date:        t,
					Reference:   payNum,
					Type:        "payment",
					Description: desc + " (" + mode + ")",
					Debit:       0,
					Credit:      amount,
				})
			}
		}

		// ── 4. Calculate opening balance (invoices - payments before startDate) ──
		var openingBalance float64
		invBeforeCursor, _ := invoiceCol.Find(ctx, bson.M{
			"orgId": orgID, "customerId": customerIDStr,
			"createdAt": bson.M{"$lt": startDate},
		})
		if invBeforeCursor != nil {
			defer invBeforeCursor.Close(ctx)
			var prevInvoices []bson.M
			invBeforeCursor.All(ctx, &prevInvoices)
			for _, inv := range prevInvoices {
				gt, _ := inv["grandTotal"].(float64)
				if gt == 0 {
					if totals, ok := inv["totals"].(bson.M); ok {
						gt, _ = totals["grandTotal"].(float64)
					}
				}
				openingBalance += gt
			}
		}
		payBeforeCursor, _ := paymentCol.Find(ctx, bson.M{
			"orgId": orgID, "customerId": customerIDStr,
			"createdAt": bson.M{"$lt": startDate},
		})
		if payBeforeCursor != nil {
			defer payBeforeCursor.Close(ctx)
			var prevPayments []bson.M
			payBeforeCursor.All(ctx, &prevPayments)
			for _, pay := range prevPayments {
				amt, _ := pay["amount"].(float64)
				openingBalance -= amt
			}
		}

		// ── 5. Sort by date, compute running balance ───────────────────────
		sort.Slice(transactions, func(i, j int) bool {
			return transactions[i].Date.Before(transactions[j].Date)
		})

		runningBalance := openingBalance
		for i := range transactions {
			runningBalance += transactions[i].Debit - transactions[i].Credit
			transactions[i].Balance = runningBalance
		}

		closingBalance := runningBalance

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
					"startDate": startDate.Format("2006-01-02"),
					"endDate":   endDate.Format("2006-01-02"),
				},
				"openingBalance": openingBalance,
				"closingBalance": closingBalance,
				"transactions":   transactions,
			},
		})
	}
}

func extractTimeFromSOA(doc bson.M, key string) time.Time {
	if v, ok := doc[key]; ok {
		switch t := v.(type) {
		case time.Time:
			return t
		case primitive.DateTime:
			return t.Time()
		}
	}
	return time.Now()
}
