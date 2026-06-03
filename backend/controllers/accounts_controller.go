package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var accountCollection *mongo.Collection = config.GetCollection(config.DB, "accounts")

func CreateAccount() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var a models.Account
		if err := c.ShouldBindJSON(&a); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if a.AccountCode == "" || a.AccountName == "" || a.AccountType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "accountCode, accountName, and accountType are required"})
			return
		}

		// Ensure code is unique within the org
		existing := accountCollection.FindOne(ctx, bson.M{"orgId": orgIDStr, "accountCode": a.AccountCode})
		if existing.Err() == nil {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "Account code already exists"})
			return
		}

		a.ID = primitive.NewObjectID()
		a.OrgID = orgIDStr
		a.CreatedAt = time.Now()
		a.UpdatedAt = time.Now()
		if userID != nil {
			a.CreatedBy = userID.(string)
		}
		if a.Status == "" {
			a.Status = "active"
		}

		if _, err := accountCollection.InsertOne(ctx, a); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create account", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Account created successfully",
			"data":    gin.H{"id": a.ID.Hex(), "accountCode": a.AccountCode},
		})
	}
}

func GetAllAccounts() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if accountType := c.Query("type"); accountType != "" {
			filter["accountType"] = accountType
		}
		if search := c.Query("search"); search != "" {
			filter["$or"] = []bson.M{
				{"accountCode": bson.M{"$regex": search, "$options": "i"}},
				{"accountName": bson.M{"$regex": search, "$options": "i"}},
			}
		}

		total, _ := accountCollection.CountDocuments(ctx, filter)

		limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "200"), 10, 64)
		if limit < 1 || limit > 500 {
			limit = 200
		}
		page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
		if page < 1 {
			page = 1
		}
		skip := (page - 1) * limit

		opts := options.Find().
			SetSort(bson.D{{Key: "accountCode", Value: 1}}).
			SetSkip(skip).
			SetLimit(limit)

		cursor, err := accountCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch accounts"})
			return
		}
		defer cursor.Close(ctx)

		var accounts []models.Account
		if err := cursor.All(ctx, &accounts); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode accounts"})
			return
		}
		if accounts == nil {
			accounts = []models.Account{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Accounts retrieved successfully",
			"data":    gin.H{"accounts": accounts, "total": total, "page": page, "limit": limit},
		})
	}
}

func GetAccountByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid account ID"})
			return
		}

		var a models.Account
		err = accountCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&a)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Account not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve account"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Account retrieved", "data": a})
	}
}

func UpdateAccount() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid account ID"})
			return
		}

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}
		delete(updates, "_id")
		delete(updates, "orgId")
		delete(updates, "createdAt")
		delete(updates, "createdBy")
		updates["updatedAt"] = time.Now()

		result, err := accountCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": updates},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Account not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Account updated successfully"})
	}
}

func DeleteAccount() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid account ID"})
			return
		}

		// Block deletion of system accounts
		var existing models.Account
		if err := accountCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&existing); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Account not found"})
			return
		}
		if existing.IsSystem {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "System accounts cannot be deleted"})
			return
		}

		result, err := accountCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr})
		if err != nil || result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Account not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Account deleted successfully"})
	}
}

func GetAccountStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgIDStr}}},
			{{Key: "$group", Value: bson.M{
				"_id":   "$accountType",
				"count": bson.M{"$sum": 1},
			}}},
		}

		cursor, err := accountCollection.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Stats failed"})
			return
		}
		defer cursor.Close(ctx)

		var results []bson.M
		cursor.All(ctx, &results)

		byType := map[string]int64{}
		total := int64(0)
		for _, r := range results {
			t, _ := r["_id"].(string)
			cnt, _ := r["count"].(int32)
			byType[t] = int64(cnt)
			total += int64(cnt)
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data":   gin.H{"byType": byType, "total": total},
		})
	}
}

type seedDef struct {
	Code          string
	Name          string
	Type          string
	SubType       string
	NormalBalance string
	IsSystem      bool
	IsBankAccount bool
}

var defaultAccountSeeds = []seedDef{
	{"1001", "Cash on Hand",           "asset",     "current_asset",     "debit",  true,  true},
	{"1002", "Bank Account",           "asset",     "current_asset",     "debit",  true,  true},
	{"1100", "Accounts Receivable",    "asset",     "current_asset",     "debit",  true,  false},
	{"1200", "Inventory",              "asset",     "current_asset",     "debit",  true,  false},
	{"1300", "Prepaid Expenses",       "asset",     "current_asset",     "debit",  false, false},
	{"1500", "Fixed Assets",           "asset",     "fixed_asset",       "debit",  false, false},
	{"2000", "Accounts Payable",       "liability", "current_liability", "credit", true,  false},
	{"2100", "VAT Payable",            "liability", "current_liability", "credit", true,  false},
	{"2200", "Accrued Liabilities",    "liability", "current_liability", "credit", false, false},
	{"2300", "Short-term Loans",       "liability", "current_liability", "credit", false, false},
	{"2400", "Customer Advances",      "liability", "current_liability", "credit", true,  false},
	{"3000", "Owner's Equity",         "equity",    "equity",            "credit", true,  false},
	{"3100", "Retained Earnings",      "equity",    "equity",            "credit", true,  false},
	{"4000", "Sales Revenue",          "income",    "operating_revenue", "credit", true,  false},
	{"4100", "Other Income",           "income",    "other_income",      "credit", false, false},
	{"4200", "Discount Received",      "income",    "other_income",      "credit", false, false},
	{"5000", "Cost of Goods Sold",     "expense",   "direct_expense",    "debit",  true,  false},
	{"5100", "Salaries & Wages",       "expense",   "operating_expense", "debit",  false, false},
	{"5200", "Rent Expense",           "expense",   "operating_expense", "debit",  false, false},
	{"5300", "Utilities",              "expense",   "operating_expense", "debit",  false, false},
	{"5400", "Marketing & Advertising","expense",   "operating_expense", "debit",  false, false},
	{"5500", "VAT Input",              "expense",   "direct_expense",    "debit",  true,  false},
	{"5600", "Bank Charges",           "expense",   "operating_expense", "debit",  false, false},
	{"5700", "Discount Given",         "expense",   "operating_expense", "debit",  false, false},
}

// seedDefaultAccountsForOrg is the reusable core — called on org creation and from the HTTP handler.
func seedDefaultAccountsForOrg(ctx context.Context, orgID, createdBy string) (seeded, skipped int) {
	for _, d := range defaultAccountSeeds {
		existing := accountCollection.FindOne(ctx, bson.M{"orgId": orgID, "accountCode": d.Code})
		if existing.Err() == nil {
			skipped++
			continue
		}
		a := models.Account{
			ID:            primitive.NewObjectID(),
			OrgID:         orgID,
			AccountCode:   d.Code,
			AccountName:   d.Name,
			AccountType:   d.Type,
			SubType:       d.SubType,
			NormalBalance: d.NormalBalance,
			IsSystem:      d.IsSystem,
			IsBankAccount: d.IsBankAccount,
			Status:        "active",
			CreatedBy:     createdBy,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		if _, err := accountCollection.InsertOne(ctx, a); err == nil {
			seeded++
		}
	}
	return
}

// SeedDefaultAccounts HTTP handler — idempotent, skips existing codes.
func SeedDefaultAccounts() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")
		seeded, skipped := seedDefaultAccountsForOrg(ctx, fmt.Sprintf("%v", orgID), fmt.Sprintf("%v", userID))

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": fmt.Sprintf("Seeded %d accounts, skipped %d existing", seeded, skipped),
			"data":    gin.H{"seeded": seeded, "skipped": skipped},
		})
	}
}

// GetAccountLedger returns all journal entry lines for a given account.
func GetAccountLedger() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid account ID"})
			return
		}

		var acc models.Account
		if err := accountCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&acc); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Account not found"})
			return
		}

		startDate := c.Query("startDate")
		endDate := c.Query("endDate")
		matchFilter := bson.M{"orgId": orgIDStr, "lines.accountId": id}
		if startDate != "" || endDate != "" {
			dateFilter := bson.M{}
			if startDate != "" { dateFilter["$gte"] = startDate }
			if endDate != ""   { dateFilter["$lte"] = endDate }
			matchFilter["date"] = dateFilter
		}

		jeCol := config.GetCollection(config.DB, "journal_entries")
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: matchFilter}},
			{{Key: "$unwind", Value: "$lines"}},
			{{Key: "$match", Value: bson.M{"lines.accountId": id}}},
			{{Key: "$sort", Value: bson.D{{Key: "date", Value: 1}, {Key: "createdAt", Value: 1}}}},
			{{Key: "$project", Value: bson.M{
				"date":        1,
				"reference":   1,
				"refType":     1,
				"description": "$lines.description",
				"debit":       "$lines.debit",
				"credit":      "$lines.credit",
				"entryNumber": 1,
			}}},
		}

		cursor, err := jeCol.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Ledger query failed"})
			return
		}
		defer cursor.Close(ctx)

		var rows []bson.M
		cursor.All(ctx, &rows)
		if rows == nil {
			rows = []bson.M{}
		}

		// Compute running balance
		runningBalance := 0.0
		isDebitNormal := acc.NormalBalance == "debit"
		for i := range rows {
			debit, _ := rows[i]["debit"].(float64)
			credit, _ := rows[i]["credit"].(float64)
			if isDebitNormal {
				runningBalance += debit - credit
			} else {
				runningBalance += credit - debit
			}
			rows[i]["runningBalance"] = runningBalance
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"account": gin.H{
					"id":            id,
					"code":          acc.AccountCode,
					"name":          acc.AccountName,
					"type":          acc.AccountType,
					"normalBalance": acc.NormalBalance,
				},
				"rows":    rows,
				"balance": runningBalance,
			},
		})
	}
}

// GetTrialBalance computes debit/credit totals per account from journal entries.
func GetTrialBalance() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		startDate := c.Query("startDate")
		endDate := c.Query("endDate")

		matchFilter := bson.M{"orgId": orgIDStr}
		if startDate != "" || endDate != "" {
			dateFilter := bson.M{}
			if startDate != "" { dateFilter["$gte"] = startDate }
			if endDate != ""   { dateFilter["$lte"] = endDate }
			matchFilter["date"] = dateFilter
		}

		jeCol := config.GetCollection(config.DB, "journal_entries")
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: matchFilter}},
			{{Key: "$unwind", Value: "$lines"}},
			{{Key: "$group", Value: bson.M{
				"_id":         "$lines.accountId",
				"accountCode": bson.M{"$first": "$lines.accountCode"},
				"accountName": bson.M{"$first": "$lines.accountName"},
				"totalDebit":  bson.M{"$sum": "$lines.debit"},
				"totalCredit": bson.M{"$sum": "$lines.credit"},
			}}},
			{{Key: "$sort", Value: bson.D{{Key: "accountCode", Value: 1}}}},
		}

		cursor, err := jeCol.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Trial balance query failed"})
			return
		}
		defer cursor.Close(ctx)

		var rows []bson.M
		cursor.All(ctx, &rows)
		if rows == nil {
			rows = []bson.M{}
		}

		// Enrich rows with account type from accounts collection
		for i := range rows {
			aid, _ := rows[i]["_id"].(string)
			if aid == "" { continue }
			var acc models.Account
			if objID, err2 := primitive.ObjectIDFromHex(aid); err2 == nil {
				accountCollection.FindOne(ctx, bson.M{"_id": objID}).Decode(&acc)
				rows[i]["accountType"]   = acc.AccountType
				rows[i]["normalBalance"] = acc.NormalBalance
				debit, _  := rows[i]["totalDebit"].(float64)
				credit, _ := rows[i]["totalCredit"].(float64)
				if acc.NormalBalance == "debit" {
					rows[i]["balance"] = debit - credit
				} else {
					rows[i]["balance"] = credit - debit
				}
			}
		}

		// Grand totals
		var grandDebit, grandCredit float64
		for _, r := range rows {
			d, _ := r["totalDebit"].(float64)
			cr, _ := r["totalCredit"].(float64)
			grandDebit += d
			grandCredit += cr
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"rows":        rows,
				"grandDebit":  grandDebit,
				"grandCredit": grandCredit,
				"period":      gin.H{"startDate": startDate, "endDate": endDate},
			},
		})
	}
}
