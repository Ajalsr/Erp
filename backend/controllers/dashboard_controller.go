package controllers

import (
	"context"
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/backend/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// GetDashboardSummary collapses what used to be ~18 separate dashboard requests into
// a single endpoint. Every section runs concurrently (goroutines) close to the DB,
// so the client pays one round-trip instead of queueing 18 over ~3 browser-connection
// waves. The response shape mirrors the frontend's DEFAULT_STATS exactly, so the
// dashboard hook can merge it with zero per-field parsing.
//
// Gated by RequireModule("dashboard"): the summary aggregates figures across modules,
// so access is governed by the dashboard permission rather than each module's.
func GetDashboardSummary() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		orgVal, _ := c.Get("orgId")
		orgID, _ := orgVal.(string)

		// Date boundaries (server local time, matching the old client-side logic).
		now := time.Now()
		todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		tomorrow := todayStart.Add(24 * time.Hour)
		monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		in30 := todayStart.AddDate(0, 0, 30)

		// ── Result fields, each written by exactly one goroutine ───────────────
		var (
			// customers
			totalCustomers, activeCustomers, pendingCustomers       int64
			todayNewCustomers, thisMonthNewCustomers                int64
			inactiveCustomers, businessCustomers, individualCustomers int64
			activeCustomersList                                     = []models.Customer{}

			// sales orders
			pendingOrders, totalOrders, completedOrders, todayNewOrders int64
			todayRevenue                                                float64
			recentOrders                                                = []models.SalesOrder{}

			// stock
			totalItems    int
			lowStockItems = []gin.H{}
			inventoryValue float64

			// invoices
			invoicesByStatus                              = gin.H{}
			pendingInvoicesCount                          int64
			pendingInvoicesAmount                         float64
			overdueInvoicesCount                          int64
			overdueInvoicesAmount                         float64
			arAging                                       = gin.H{"current": 0.0, "d30": 0.0, "d60": 0.0, "d90": 0.0, "d90p": 0.0}
			cashflowIn                                    float64

			// payments received
			totalRevenue, thisMonthRevenue float64
			paymentsCount                  int64

			// bills
			totalPayable                                          float64
			totalBillsCount                                       int64
			openBillsCount, partialBillsCount, overdueBillsCount  int64
			recentBills                                           = []models.Bill{}
			apAging                                               = gin.H{"current": 0.0, "d30": 0.0, "d60": 0.0, "d90": 0.0, "d90p": 0.0}
			cashflowOut                                           float64

			// purchase orders
			totalPOs, pendingPOs, orderedPOs, receivedPOs int64
			totalPOValue                                  float64
			recentPOs                                     = []models.PurchaseOrder{}

			// vendors
			totalVendors, activeVendors int64

			// vendor payments
			totalPaid, thisMonthPaid float64
			vendorPaymentsCount      int64

			// quotes
			quotesCount  int64
			quotesAmount float64
		)

		var wg sync.WaitGroup
		run := func(fn func()) { wg.Add(1); go func() { defer wg.Done(); fn() }() }

		notDeleted := bson.M{"$ne": "deleted"}

		// ── Customers (counts) ─────────────────────────────────────────────────
		run(func() {
			totalCustomers, _ = customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": notDeleted})
			activeCustomers, _ = customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "active"})
			pendingCustomers, _ = customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "pending"})
			inactiveCustomers, _ = customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "inactive"})
			individualCustomers, _ = customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "customerType": "individual", "status": notDeleted})
			businessCustomers, _ = customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "customerType": "business", "status": notDeleted})
			todayNewCustomers, _ = customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "created_at": bson.M{"$gte": todayStart, "$lt": tomorrow}, "status": notDeleted})
			thisMonthNewCustomers, _ = customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "created_at": bson.M{"$gte": monthStart}, "status": notDeleted})
		})

		// ── Recent customers (for activity feed) ───────────────────────────────
		run(func() {
			cur, err := customersCollection.Find(ctx,
				bson.M{"orgId": orgID, "status": notDeleted},
				options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(5))
			if err == nil {
				cur.All(ctx, &activeCustomersList)
			}
		})

		// ── Sales orders (stats + recent) ──────────────────────────────────────
		run(func() {
			totalOrders, _ = salesOrdersCollection.CountDocuments(ctx, bson.M{"orgId": orgID})
			todayNewOrders, _ = salesOrdersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "createdAt": bson.M{"$gte": todayStart}})

			cur, err := salesOrdersCollection.Aggregate(ctx, []bson.M{
				{"$match": bson.M{"orgId": orgID}},
				{"$group": bson.M{"_id": "$status", "count": bson.M{"$sum": 1}}},
			})
			if err == nil {
				var rows []bson.M
				cur.All(ctx, &rows)
				for _, r := range rows {
					st, _ := r["_id"].(string)
					cnt := toInt64(r["count"])
					switch st {
					case "pending", "open", "draft":
						pendingOrders += cnt
					case "completed":
						completedOrders += cnt
					}
				}
			}

			rc, err := salesOrdersCollection.Aggregate(ctx, []bson.M{
				{"$match": bson.M{"orgId": orgID, "createdAt": bson.M{"$gte": todayStart}}},
				{"$group": bson.M{"_id": nil, "total": bson.M{"$sum": "$total"}}},
			})
			if err == nil {
				var rows []bson.M
				rc.All(ctx, &rows)
				if len(rows) > 0 {
					todayRevenue = toFloat(rows[0]["total"])
				}
			}
		})
		run(func() {
			cur, err := salesOrdersCollection.Find(ctx, bson.M{"orgId": orgID},
				options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(10))
			if err == nil {
				cur.All(ctx, &recentOrders)
			}
		})

		// ── Stock (totals, low-stock, inventory value) ─────────────────────────
		run(func() {
			cur, err := stockCollection.Find(ctx, bson.M{"orgId": orgID})
			if err != nil {
				return
			}
			var items []models.Stock
			if cur.All(ctx, &items) != nil {
				return
			}
			totalItems = len(items)
			for _, it := range items {
				qty := parseNum(it.Quantity)
				reorder := parseNum(it.ReorderPoint)
				cost := parseNum(it.CostPrice)
				inventoryValue += qty * cost
				if reorder > 0 && qty <= reorder {
					sev := "warning"
					if qty <= reorder/2 {
						sev = "critical"
					}
					lowStockItems = append(lowStockItems, gin.H{
						"id": it.ID, "name": it.Name, "code": it.ItemCode,
						"cur": qty, "min": reorder, "s": sev,
					})
				}
			}
		})

		// ── Invoices: byStatus + outstanding (aggregation) ─────────────────────
		run(func() {
			cur, err := invoiceCollection.Aggregate(ctx, []bson.M{
				{"$match": bson.M{"orgId": orgID, "type": bson.M{"$ne": "proforma"}}},
				{"$group": bson.M{
					"_id":   "$status",
					"count": bson.M{"$sum": 1},
					"total": bson.M{"$sum": "$totals.grandTotal"},
					"paid":  bson.M{"$sum": "$amountPaid"},
				}},
			})
			if err != nil {
				return
			}
			var rows []bson.M
			cur.All(ctx, &rows)
			for _, r := range rows {
				st, _ := r["_id"].(string)
				cnt := toInt64(r["count"])
				tot := toFloat(r["total"])
				paid := toFloat(r["paid"])
				bal := tot - paid
				invoicesByStatus[st] = gin.H{"count": cnt, "total": tot, "paid": paid, "balance": bal}
				switch st {
				case "unpaid", "partial", "overdue":
					pendingInvoicesAmount += bal
					pendingInvoicesCount += cnt
				}
			}
		})

		// ── Invoices: AR aging + overdue + cashflow-in (projected scan) ────────
		run(func() {
			cur, err := invoiceCollection.Find(ctx,
				bson.M{"orgId": orgID, "status": bson.M{"$nin": []string{"paid", "void", "draft"}}, "type": bson.M{"$ne": "proforma"}},
				options.Find().SetProjection(bson.M{"status": 1, "dueDate": 1, "balanceDue": 1, "totals.grandTotal": 1}))
			if err != nil {
				return
			}
			var docs []models.Invoice
			if cur.All(ctx, &docs) != nil {
				return
			}
			for _, inv := range docs {
				bal := inv.BalanceDue
				if bal == 0 {
					bal = inv.Totals.GrandTotal
				}
				if inv.Status == "overdue" {
					overdueInvoicesCount++
					overdueInvoicesAmount += bal
				}
				due, hasDue := parseDueDate(inv.DueDate)
				if hasDue && !due.Before(todayStart) && !due.After(in30) {
					cashflowIn += bal
				}
				bucketAdd(arAging, todayStart, due, hasDue, bal)
			}
		})

		// ── Payments received ──────────────────────────────────────────────────
		run(func() {
			totalRevenue, paymentsCount = sumAmountCount(ctx, paymentCollection, bson.M{"orgId": orgID})
			thisMonthRevenue, _ = sumAmountCount(ctx, paymentCollection, bson.M{"orgId": orgID, "createdAt": bson.M{"$gte": monthStart}})
		})

		// ── Bills: byStatus + recent ───────────────────────────────────────────
		run(func() {
			cur, err := billCollection.Aggregate(ctx, []bson.M{
				{"$match": bson.M{"orgId": orgID}},
				{"$group": bson.M{
					"_id":        "$status",
					"count":      bson.M{"$sum": 1},
					"balanceDue": bson.M{"$sum": "$balanceDue"},
				}},
			})
			if err == nil {
				var rows []bson.M
				cur.All(ctx, &rows)
				for _, r := range rows {
					st, _ := r["_id"].(string)
					cnt := toInt64(r["count"])
					bal := toFloat(r["balanceDue"])
					totalBillsCount += cnt
					if st != "void" && st != "paid" {
						totalPayable += bal
					}
					switch st {
					case "open":
						openBillsCount += cnt
					case "partial":
						partialBillsCount += cnt
					case "overdue":
						overdueBillsCount += cnt
					}
				}
			}
		})
		run(func() {
			cur, err := billCollection.Find(ctx, bson.M{"orgId": orgID},
				options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(5))
			if err == nil {
				cur.All(ctx, &recentBills)
			}
		})

		// ── Bills: AP aging + cashflow-out (projected scan) ────────────────────
		run(func() {
			cur, err := billCollection.Find(ctx,
				bson.M{"orgId": orgID, "status": bson.M{"$ne": "paid"}},
				options.Find().SetProjection(bson.M{"status": 1, "dueDate": 1, "balanceDue": 1, "amountPaid": 1, "totals.grandTotal": 1}))
			if err != nil {
				return
			}
			var docs []models.Bill
			if cur.All(ctx, &docs) != nil {
				return
			}
			for _, b := range docs {
				bal := b.BalanceDue
				if bal == 0 {
					bal = b.Totals.GrandTotal - b.AmountPaid
				}
				due, hasDue := parseDueDate(b.DueDate)
				if hasDue && !due.Before(todayStart) && !due.After(in30) {
					cashflowOut += bal
				}
				bucketAdd(apAging, todayStart, due, hasDue, bal)
			}
		})

		// ── Purchase orders (stats + recent) ───────────────────────────────────
		run(func() {
			totalPOs, _ = purchaseOrderCollection.CountDocuments(ctx, bson.M{"orgId": orgID})
			pendingPOs, _ = purchaseOrderCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "pending_approval"})
			orderedPOs, _ = purchaseOrderCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "issued"})
			receivedPOs, _ = purchaseOrderCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "received"})
			cur, err := purchaseOrderCollection.Aggregate(ctx, []bson.M{
				{"$match": bson.M{"orgId": orgID}},
				{"$group": bson.M{"_id": nil, "totalAmount": bson.M{"$sum": "$total"}}},
			})
			if err == nil {
				var rows []bson.M
				cur.All(ctx, &rows)
				if len(rows) > 0 {
					totalPOValue = toFloat(rows[0]["totalAmount"])
				}
			}
		})
		run(func() {
			cur, err := purchaseOrderCollection.Find(ctx, bson.M{"orgId": orgID},
				options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(5))
			if err == nil {
				cur.All(ctx, &recentPOs)
			}
		})

		// ── Vendors ────────────────────────────────────────────────────────────
		run(func() {
			totalVendors, _ = vendorCollection.CountDocuments(ctx, bson.M{"orgId": orgID})
			activeVendors, _ = vendorCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "active"})
		})

		// ── Vendor payments ────────────────────────────────────────────────────
		run(func() {
			totalPaid, vendorPaymentsCount = sumAmountCount(ctx, vendorPaymentCollection, bson.M{"orgId": orgID})
			thisMonthPaid, _ = sumAmountCount(ctx, vendorPaymentCollection, bson.M{"orgId": orgID, "createdAt": bson.M{"$gte": monthStart}})
		})

		// ── Quotes ─────────────────────────────────────────────────────────────
		run(func() {
			cur, err := quoteCollection.Aggregate(ctx, []bson.M{
				{"$match": bson.M{"orgId": orgID}},
				{"$group": bson.M{"_id": nil, "count": bson.M{"$sum": 1}, "total": bson.M{"$sum": "$totals.grandTotal"}}},
			})
			if err == nil {
				var rows []bson.M
				cur.All(ctx, &rows)
				if len(rows) > 0 {
					quotesCount = toInt64(rows[0]["count"])
					quotesAmount = toFloat(rows[0]["total"])
				}
			}
		})

		wg.Wait()

		growthRate := 0.0
		if totalCustomers > 0 {
			growthRate = 12.5
		}
		todayOrdersPct := pct(float64(todayNewOrders), 20)
		revenuePct := pct(todayRevenue, 50000)
		pendingActionsPct := pct(float64(pendingOrders), 20)

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"totalCustomers": totalCustomers, "activeCustomers": activeCustomers,
				"pendingCustomers": pendingCustomers, "todayNewCustomers": todayNewCustomers,
				"thisMonthNewCustomers": thisMonthNewCustomers, "growthRate": growthRate,
				"activeCustomersList": activeCustomersList, "inactiveCustomers": inactiveCustomers,
				"businessCustomers": businessCustomers, "individualCustomers": individualCustomers,

				"pendingOrders": pendingOrders, "totalOrders": totalOrders,
				"completedOrders": completedOrders, "todayNewOrders": todayNewOrders,
				"todayRevenue": todayRevenue, "recentOrders": recentOrders,

				"totalItems": totalItems, "lowStockCount": len(lowStockItems),
				"lowStockItems": lowStockItems, "inventoryValue": inventoryValue,

				"pendingInvoicesCount": pendingInvoicesCount, "pendingInvoicesAmount": pendingInvoicesAmount,
				"overdueInvoicesCount": overdueInvoicesCount, "overdueInvoicesAmount": overdueInvoicesAmount,
				"invoicesByStatus": invoicesByStatus,

				"totalRevenue": totalRevenue, "thisMonthRevenue": thisMonthRevenue, "paymentsCount": paymentsCount,

				"totalPayable": totalPayable, "totalBillsCount": totalBillsCount,
				"openBillsCount": openBillsCount, "partialBillsCount": partialBillsCount,
				"overdueBillsCount": overdueBillsCount, "recentBills": recentBills,

				"totalPOs": totalPOs, "pendingPOs": pendingPOs, "orderedPOs": orderedPOs,
				"receivedPOs": receivedPOs, "totalPOValue": totalPOValue, "recentPOs": recentPOs,

				"totalVendors": totalVendors, "activeVendors": activeVendors,

				"totalPaid": totalPaid, "thisMonthPaid": thisMonthPaid, "vendorPaymentsCount": vendorPaymentsCount,

				"quotesCount": quotesCount, "quotesAmount": quotesAmount,

				"todayOrdersPct": todayOrdersPct, "revenuePct": revenuePct, "pendingActionsPct": pendingActionsPct,

				"arAging": arAging, "apAging": apAging,
				"cashflowIn": cashflowIn, "cashflowOut": cashflowOut, "cashflowNet": cashflowIn - cashflowOut,
			},
		})
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

// sumAmountCount sums the "amount" field and counts docs matching filter.
func sumAmountCount(ctx context.Context, col *mongo.Collection, filter bson.M) (float64, int64) {
	cur, err := col.Aggregate(ctx, []bson.M{
		{"$match": filter},
		{"$group": bson.M{"_id": nil, "total": bson.M{"$sum": "$amount"}, "count": bson.M{"$sum": 1}}},
	})
	if err != nil {
		return 0, 0
	}
	var rows []bson.M
	if cur.All(ctx, &rows) != nil || len(rows) == 0 {
		return 0, 0
	}
	return toFloat(rows[0]["total"]), toInt64(rows[0]["count"])
}

func toFloat(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case float32:
		return float64(n)
	case int32:
		return float64(n)
	case int64:
		return float64(n)
	case int:
		return float64(n)
	}
	return 0
}

func toInt64(v interface{}) int64 {
	switch n := v.(type) {
	case int32:
		return int64(n)
	case int64:
		return n
	case int:
		return int64(n)
	case float64:
		return int64(n)
	}
	return 0
}

func parseNum(s string) float64 {
	if s == "" {
		return 0
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return f
}

var dueDateLayouts = []string{
	time.RFC3339,
	"2006-01-02T15:04:05Z07:00",
	"2006-01-02T15:04:05",
	"2006-01-02",
}

func parseDueDate(s string) (time.Time, bool) {
	if s == "" {
		return time.Time{}, false
	}
	for _, l := range dueDateLayouts {
		if t, err := time.Parse(l, s); err == nil {
			y, m, d := t.Date()
			return time.Date(y, m, d, 0, 0, 0, 0, time.Local), true
		}
	}
	return time.Time{}, false
}

// bucketAdd places bal into the right aging bucket, mirroring the old client logic.
func bucketAdd(aging gin.H, todayStart time.Time, due time.Time, hasDue bool, bal float64) {
	if !hasDue || !due.Before(todayStart) {
		aging["current"] = aging["current"].(float64) + bal
		return
	}
	days := int(todayStart.Sub(due).Hours() / 24)
	switch {
	case days <= 30:
		aging["d30"] = aging["d30"].(float64) + bal
	case days <= 60:
		aging["d60"] = aging["d60"].(float64) + bal
	case days <= 90:
		aging["d90"] = aging["d90"].(float64) + bal
	default:
		aging["d90p"] = aging["d90p"].(float64) + bal
	}
}

func pct(val, target float64) int {
	if target == 0 {
		return 0
	}
	p := int(math.Round(val / target * 100))
	if p > 100 {
		return 100
	}
	if p < 0 {
		return 0
	}
	return p
}

// GetSalesRepSummary returns a focused, sales-only dashboard scoped to the calling
// user's OWN records for the current calendar year. Used by the limited dashboard
// shown to non owner/admin roles. Because it only ever reads the caller's own
// quotes/sales, it is safe regardless of which role hits it.
func GetSalesRepSummary() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgVal, _ := c.Get("orgId")
		orgID, _ := orgVal.(string)
		userVal, _ := c.Get("userId")
		userID, _ := userVal.(string)

		now := time.Now()
		yearStart := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())

		// Own records, this year. createdAt is the shared time field on both models.
		base := bson.M{"orgId": orgID, "createdBy": userID, "createdAt": bson.M{"$gte": yearStart}}
		withMatch := func(extra bson.M) bson.M {
			m := bson.M{}
			for k, v := range base {
				m[k] = v
			}
			for k, v := range extra {
				m[k] = v
			}
			return m
		}

		var (
			quotationMade, quotationAchieved int64
			salesMade, salesConverted        int64
			salesAchieved                    float64
		)

		quotationMade, _ = quoteCollection.CountDocuments(ctx, base)
		quotationAchieved, _ = quoteCollection.CountDocuments(ctx,
			withMatch(bson.M{"status": bson.M{"$in": []string{"accepted", "converted"}}}))

		salesMade, _ = salesOrdersCollection.CountDocuments(ctx, base)
		salesConverted, _ = salesOrdersCollection.CountDocuments(ctx,
			withMatch(bson.M{"sourceQuoteId": bson.M{"$exists": true, "$nin": []interface{}{"", nil}}}))

		// salesAchieved = total amount of this rep's sales orders this year.
		if cur, err := salesOrdersCollection.Aggregate(ctx, []bson.M{
			{"$match": base},
			{"$group": bson.M{"_id": nil, "total": bson.M{"$sum": "$total"}}},
		}); err == nil {
			var rows []bson.M
			cur.All(ctx, &rows)
			if len(rows) > 0 {
				salesAchieved = toFloat(rows[0]["total"])
			}
		}

		// Single org-wide yearly target, stored on the org settings doc.
		var yearlyTarget float64
		var settings bson.M
		if err := orgSettingsCollection.FindOne(ctx, bson.M{"orgId": orgID}).Decode(&settings); err == nil {
			yearlyTarget = toFloat(settings["yearlySalesTarget"])
		}

		// ── Monthly breakdown (Jan..Dec of current year) for the trend charts ──
		// One bucket per month, indexed 1..12. Two aggregations ($month on createdAt):
		// one over sales orders, one over quotes.
		type monthBucket struct {
			SalesAchieved     float64 `json:"salesAchieved"`
			SalesMade         int64   `json:"salesMade"`
			SalesConverted    int64   `json:"salesConverted"`
			QuotationMade     int64   `json:"quotationMade"`
			QuotationAchieved int64   `json:"quotationAchieved"`
		}
		buckets := make([]monthBucket, 13) // index 0 unused; months 1..12

		// Sales orders per month.
		if cur, err := salesOrdersCollection.Aggregate(ctx, []bson.M{
			{"$match": base},
			{"$group": bson.M{
				"_id":            bson.M{"$month": "$createdAt"},
				"salesMade":      bson.M{"$sum": 1},
				"salesAchieved":  bson.M{"$sum": "$total"},
				"salesConverted": bson.M{"$sum": bson.M{"$cond": []interface{}{
					bson.M{"$and": []interface{}{
						bson.M{"$ne": []interface{}{"$sourceQuoteId", nil}},
						bson.M{"$ne": []interface{}{"$sourceQuoteId", ""}},
					}}, 1, 0}}},
			}},
		}); err == nil {
			var rows []bson.M
			cur.All(ctx, &rows)
			for _, r := range rows {
				m := int(toInt64(r["_id"]))
				if m >= 1 && m <= 12 {
					buckets[m].SalesMade = toInt64(r["salesMade"])
					buckets[m].SalesAchieved = toFloat(r["salesAchieved"])
					buckets[m].SalesConverted = toInt64(r["salesConverted"])
				}
			}
		}

		// Quotes per month.
		if cur, err := quoteCollection.Aggregate(ctx, []bson.M{
			{"$match": base},
			{"$group": bson.M{
				"_id":           bson.M{"$month": "$createdAt"},
				"quotationMade": bson.M{"$sum": 1},
				"quotationAchieved": bson.M{"$sum": bson.M{"$cond": []interface{}{
					bson.M{"$in": []interface{}{"$status", []string{"accepted", "converted"}}}, 1, 0}}},
			}},
		}); err == nil {
			var rows []bson.M
			cur.All(ctx, &rows)
			for _, r := range rows {
				m := int(toInt64(r["_id"]))
				if m >= 1 && m <= 12 {
					buckets[m].QuotationMade = toInt64(r["quotationMade"])
					buckets[m].QuotationAchieved = toInt64(r["quotationAchieved"])
				}
			}
		}

		monthLabels := []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}
		monthly := make([]gin.H, 0, 12)
		for m := 1; m <= 12; m++ {
			b := buckets[m]
			monthly = append(monthly, gin.H{
				"month":             m,
				"label":             monthLabels[m-1],
				"salesAchieved":     b.SalesAchieved,
				"salesMade":         b.SalesMade,
				"salesConverted":    b.SalesConverted,
				"quotationMade":     b.QuotationMade,
				"quotationAchieved": b.QuotationAchieved,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"year":              now.Year(),
				"yearlyTarget":      yearlyTarget,
				"salesAchieved":     salesAchieved,
				"achievedPct":       pct(salesAchieved, yearlyTarget),
				"quotationMade":     quotationMade,
				"quotationAchieved": quotationAchieved,
				"salesMade":         salesMade,
				"salesConverted":    salesConverted,
				"monthly":           monthly,
			},
		})
	}
}
