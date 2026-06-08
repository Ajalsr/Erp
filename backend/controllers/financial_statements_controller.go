package controllers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// acctBalanceRow is one account's totals over a period, enriched with type info.
type acctBalanceRow struct {
	AccountID   string  `json:"accountId"`
	AccountCode string  `json:"accountCode"`
	AccountName string  `json:"accountName"`
	AccountType string  `json:"accountType"`
	SubType     string  `json:"subType"`
	Debit       float64 `json:"debit"`
	Credit      float64 `json:"credit"`
	Balance     float64 `json:"balance"` // signed by normal balance of the account type
}

// loadOrgAccounts returns the org's accounts keyed by hex _id.
func loadOrgAccounts(ctx context.Context, orgIDStr string) map[string]models.Account {
	out := map[string]models.Account{}
	cur, err := accountCollection.Find(ctx, bson.M{"orgId": orgIDStr})
	if err != nil {
		return out
	}
	defer cur.Close(ctx)
	var accs []models.Account
	if cur.All(ctx, &accs) == nil {
		for _, a := range accs {
			out[a.ID.Hex()] = a
		}
	}
	return out
}

// normalBalanceFor returns "debit" or "credit" for an account type.
func normalBalanceFor(accountType string) string {
	switch accountType {
	case "asset", "expense":
		return "debit"
	default: // liability, equity, income
		return "credit"
	}
}

// accountBalances aggregates journal-entry lines per account for the date window
// (inclusive). Empty start/end means unbounded on that side. Balance is signed by
// the account's normal balance so income/liability/equity read positive naturally.
func accountBalances(ctx context.Context, orgIDStr, startDate, endDate string) ([]acctBalanceRow, error) {
	match := bson.M{"orgId": orgIDStr}
	if startDate != "" || endDate != "" {
		df := bson.M{}
		if startDate != "" {
			df["$gte"] = startDate
		}
		if endDate != "" {
			df["$lte"] = endDate
		}
		match["date"] = df
	}

	jeCol := config.GetCollection(config.DB, "journal_entries")
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: match}},
		{{Key: "$unwind", Value: "$lines"}},
		{{Key: "$group", Value: bson.M{
			"_id":         "$lines.accountId",
			"accountCode": bson.M{"$first": "$lines.accountCode"},
			"accountName": bson.M{"$first": "$lines.accountName"},
			"totalDebit":  bson.M{"$sum": "$lines.debit"},
			"totalCredit": bson.M{"$sum": "$lines.credit"},
		}}},
	}
	cursor, err := jeCol.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var raw []bson.M
	if err := cursor.All(ctx, &raw); err != nil {
		return nil, err
	}

	accounts := loadOrgAccounts(ctx, orgIDStr)
	rows := make([]acctBalanceRow, 0, len(raw))
	for _, r := range raw {
		aid, _ := r["_id"].(string)
		debit, _ := r["totalDebit"].(float64)
		credit, _ := r["totalCredit"].(float64)
		acc, ok := accounts[aid]
		row := acctBalanceRow{
			AccountID:   aid,
			AccountCode: fmt.Sprintf("%v", r["accountCode"]),
			AccountName: fmt.Sprintf("%v", r["accountName"]),
			Debit:       debit,
			Credit:      credit,
		}
		if ok {
			row.AccountType = acc.AccountType
			row.SubType = acc.SubType
			if acc.AccountCode != "" {
				row.AccountCode = acc.AccountCode
			}
			if acc.AccountName != "" {
				row.AccountName = acc.AccountName
			}
		}
		if normalBalanceFor(row.AccountType) == "debit" {
			row.Balance = debit - credit
		} else {
			row.Balance = credit - debit
		}
		rows = append(rows, row)
	}
	return rows, nil
}

// section groups rows under a labelled subtotal.
type section struct {
	Rows  []acctBalanceRow `json:"rows"`
	Total float64          `json:"total"`
}

func newSection() section { return section{Rows: []acctBalanceRow{}} }

func (s *section) add(r acctBalanceRow) {
	s.Rows = append(s.Rows, r)
	s.Total += r.Balance
}

// GET /api/reports/profit-loss?startDate=&endDate=
// Income statement: revenue and expenses over a period, with net profit.
func GetProfitAndLoss() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgIDStr := fmt.Sprintf("%v", mustGet(c, "orgId"))
		now := time.Now()
		startDate := c.DefaultQuery("startDate", fmt.Sprintf("%04d-%02d-01", now.Year(), int(now.Month())))
		endDate := c.DefaultQuery("endDate", now.Format("2006-01-02"))

		rows, err := accountBalances(ctx, orgIDStr, startDate, endDate)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Profit & loss query failed"})
			return
		}

		income, expense := newSection(), newSection()
		for _, r := range rows {
			switch r.AccountType {
			case "income":
				if r.Balance != 0 {
					income.add(r)
				}
			case "expense":
				if r.Balance != 0 {
					expense.add(r)
				}
			}
		}
		netProfit := income.Total - expense.Total

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"income":       income,
				"expense":      expense,
				"totalIncome":  income.Total,
				"totalExpense": expense.Total,
				"netProfit":    netProfit,
				"period":       gin.H{"startDate": startDate, "endDate": endDate},
			},
		})
	}
}

// GET /api/reports/balance-sheet?asOf=YYYY-MM-DD
// Assets = Liabilities + Equity, as of a date. Net income to date folds into
// equity as "Current Period Earnings" so the statement balances.
func GetBalanceSheet() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgIDStr := fmt.Sprintf("%v", mustGet(c, "orgId"))
		asOf := c.DefaultQuery("asOf", time.Now().Format("2006-01-02"))

		rows, err := accountBalances(ctx, orgIDStr, "", asOf)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Balance sheet query failed"})
			return
		}

		assets, liabilities, equity := newSection(), newSection(), newSection()
		var totalIncome, totalExpense float64
		for _, r := range rows {
			switch r.AccountType {
			case "asset":
				if r.Balance != 0 {
					assets.add(r)
				}
			case "liability":
				if r.Balance != 0 {
					liabilities.add(r)
				}
			case "equity":
				if r.Balance != 0 {
					equity.add(r)
				}
			case "income":
				totalIncome += r.Balance
			case "expense":
				totalExpense += r.Balance
			}
		}

		// Net income to date is unrealised in equity until period close — surface it
		// explicitly so the sheet balances.
		currentEarnings := totalIncome - totalExpense
		if currentEarnings != 0 {
			equity.add(acctBalanceRow{
				AccountCode: "—",
				AccountName: "Current Period Earnings",
				AccountType: "equity",
				SubType:     "retained_earnings",
				Balance:     currentEarnings,
			})
		}

		totalLiabEquity := liabilities.Total + equity.Total
		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"assets":           assets,
				"liabilities":      liabilities,
				"equity":           equity,
				"totalAssets":      assets.Total,
				"totalLiabilities": liabilities.Total,
				"totalEquity":      equity.Total,
				"totalLiabEquity":  totalLiabEquity,
				"currentEarnings":  currentEarnings,
				"balanced":         (assets.Total-totalLiabEquity) < 0.01 && (assets.Total-totalLiabEquity) > -0.01,
				"asOf":             asOf,
			},
		})
	}
}

// GET /api/reports/cash-flow?startDate=&endDate=
// Cash movement over a period via bank/cash accounts, categorised into
// operating / investing / financing by the counterpart account type of each
// entry. Approximate (direct method on cash accounts), labelled as such in UI.
func GetCashFlow() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgIDStr := fmt.Sprintf("%v", mustGet(c, "orgId"))
		now := time.Now()
		startDate := c.DefaultQuery("startDate", fmt.Sprintf("%04d-%02d-01", now.Year(), int(now.Month())))
		endDate := c.DefaultQuery("endDate", now.Format("2006-01-02"))

		accounts := loadOrgAccounts(ctx, orgIDStr)
		bank := map[string]bool{} // hex accountId → is cash/bank
		for id, a := range accounts {
			if a.IsBankAccount {
				bank[id] = true
			}
		}

		// Opening cash = cumulative bank balance strictly before startDate.
		opening := 0.0
		if pre, err := accountBalances(ctx, orgIDStr, "", dayBefore(startDate)); err == nil {
			for _, r := range pre {
				if bank[r.AccountID] {
					opening += r.Balance // asset normal: debit - credit
				}
			}
		}

		// Pull period entries to categorise cash movement by counterpart.
		jeCol := config.GetCollection(config.DB, "journal_entries")
		match := bson.M{"orgId": orgIDStr, "date": bson.M{"$gte": startDate, "$lte": endDate}}
		cur, err := jeCol.Find(ctx, match)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Cash flow query failed"})
			return
		}
		defer cur.Close(ctx)
		var entries []models.JournalEntry
		cur.All(ctx, &entries)

		var operating, investing, financing float64
		for _, e := range entries {
			cashDelta := 0.0
			counterpartType := ""
			for _, ln := range e.Lines {
				if bank[ln.AccountID] {
					cashDelta += ln.Debit - ln.Credit
				} else if acc, ok := accounts[ln.AccountID]; ok && counterpartType == "" {
					counterpartType = acc.AccountType
					if acc.SubType == "fixed_asset" {
						counterpartType = "fixed_asset"
					}
				}
			}
			if cashDelta == 0 {
				continue
			}
			switch counterpartType {
			case "fixed_asset":
				investing += cashDelta
			case "equity", "liability":
				financing += cashDelta
			default: // income, expense, current asset/liability → operating
				operating += cashDelta
			}
		}

		netChange := operating + investing + financing
		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"opening":   opening,
				"operating": operating,
				"investing": investing,
				"financing": financing,
				"netChange": netChange,
				"closing":   opening + netChange,
				"period":    gin.H{"startDate": startDate, "endDate": endDate},
			},
		})
	}
}

// mustGet pulls a gin context value, returning "" if absent.
func mustGet(c *gin.Context, key string) interface{} {
	v, _ := c.Get(key)
	return v
}

// dayBefore returns the calendar day before an ISO date string, or "" on parse error.
func dayBefore(date string) string {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return ""
	}
	return t.AddDate(0, 0, -1).Format("2006-01-02")
}
