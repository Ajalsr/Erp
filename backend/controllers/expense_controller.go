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

var expenseCollection *mongo.Collection = config.GetCollection(config.DB, "expenses")

func generateExpenseNumber(orgID string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	return nextNumber(ctx, orgID, "expense", expenseCollection, "expenseNumber")
}

// expenseJELines builds the posting for an expense:
//
//	Dr Expense account (net)  +  Dr VAT Input 5500 (tax)  =  Cr creditCode (total)
//
// creditCode is the Paid-through cash/bank account when paid immediately, or
// Accounts Payable (2000) when unpaid/accrued. Returns nil if either code is empty
// (caller should refuse to post).
func expenseJELines(expCode, creditCode string, e models.Expense) []jeLineInput {
	if expCode == "" || creditCode == "" {
		return nil
	}
	lines := []jeLineInput{
		{AccountCode: expCode, Debit: round2(e.Amount)},
	}
	if e.TaxAmount > 0 {
		lines = append(lines, jeLineInput{AccountCode: "5500", Debit: round2(e.TaxAmount)})
	}
	lines = append(lines, jeLineInput{AccountCode: creditCode, Credit: round2(e.Total)})
	return lines
}

// expenseCreditCode resolves the credit leg for an expense: the Paid-through cash/bank
// account when paid, otherwise Accounts Payable (2000).
func expenseCreditCode(ctx context.Context, orgID string, e models.Expense) string {
	if e.Paid {
		return resolveAccountCode(ctx, orgID, e.PaidThrough)
	}
	return "2000"
}

// CreateExpense records a fast expense and posts its journal entry.
func CreateExpense() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")
		userIDStr := fmt.Sprintf("%v", userID)

		var e models.Expense
		if err := c.ShouldBindJSON(&e); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if e.ExpenseAccount == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Expense account is required"})
			return
		}
		if e.Paid && e.PaidThrough == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Paid-through account is required"})
			return
		}
		if e.Amount <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Amount must be greater than zero"})
			return
		}

		// Resolve accounts to codes up front so we can reject a bad pick before
		// inserting an orphan record the ledger would never post against. Unpaid
		// expenses credit Accounts Payable (2000) and carry no Paid-through account.
		expCode := resolveAccountCode(ctx, orgIDStr, e.ExpenseAccount)
		if expCode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Expense account not found"})
			return
		}
		if !e.Paid {
			e.PaidThrough = ""
			e.PaidThroughName = ""
		}
		creditCode := expenseCreditCode(ctx, orgIDStr, e)
		if creditCode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Paid-through account not found"})
			return
		}

		// Recompute money server-side — never trust client totals.
		e.Amount = round2(e.Amount)
		e.TaxAmount = round2(e.Amount * (e.TaxRate / 100))
		e.Total = round2(e.Amount + e.TaxAmount)

		e.ID = primitive.NewObjectID()
		e.OrgID = orgIDStr
		e.CreatedBy = userIDStr
		e.Status = "recorded"
		e.CreatedAt = time.Now()
		e.UpdatedAt = time.Now()
		if e.ExpenseNumber == "" {
			e.ExpenseNumber = generateExpenseNumber(orgIDStr)
		}
		if e.Date == "" {
			e.Date = time.Now().Format("2006-01-02")
		}

		if _, err := expenseCollection.InsertOne(ctx, e); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create expense", "error": err.Error()})
			return
		}

		desc := "Expense - " + e.ExpenseNumber
		if e.Payee != "" {
			desc += " (" + e.Payee + ")"
		}
		go autoJE(orgIDStr, "expense", e.ID.Hex(), e.ExpenseNumber, e.Date, desc,
			expenseJELines(expCode, creditCode, e))

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Expense recorded successfully",
			"data":    gin.H{"id": e.ID.Hex(), "expenseNumber": e.ExpenseNumber},
		})
	}
}

func GetAllExpenses() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if acct := c.Query("expenseAccount"); acct != "" {
			filter["expenseAccount"] = acct
		}

		total, _ := expenseCollection.CountDocuments(ctx, filter)

		limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "50"), 10, 64)
		if limit < 1 || limit > 200 {
			limit = 50
		}
		page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
		if page < 1 {
			page = 1
		}
		skip := (page - 1) * limit

		opts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetSkip(skip).
			SetLimit(limit)
		cursor, err := expenseCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch expenses"})
			return
		}
		defer cursor.Close(ctx)

		var expenses []models.Expense
		if err := cursor.All(ctx, &expenses); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode expenses"})
			return
		}
		if expenses == nil {
			expenses = []models.Expense{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Expenses retrieved successfully",
			"data":    gin.H{"expenses": expenses, "total": total},
		})
	}
}

func GetExpenseByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid expense ID"})
			return
		}

		var e models.Expense
		err = expenseCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&e)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Expense not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve expense"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Expense retrieved", "data": e})
	}
}

// PayExpense settles a previously-unpaid expense from a cash/bank account:
//
//	Dr Accounts Payable 2000 (total)  =  Cr Paid-through cash/bank (total)
//
// Flips the expense to paid and stamps the Paid-through account.
func PayExpense() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid expense ID"})
			return
		}

		var body struct {
			PaidThrough string `json:"paidThrough"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.PaidThrough == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Paid-through account is required"})
			return
		}

		var e models.Expense
		if err := expenseCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&e); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Expense not found"})
			return
		}
		if e.Status == "void" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Cannot pay a voided expense"})
			return
		}
		if e.Paid {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Expense is already paid"})
			return
		}

		// Resolve the cash/bank account → code + display name.
		payCode := resolveAccountCode(ctx, orgIDStr, body.PaidThrough)
		if payCode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Paid-through account not found"})
			return
		}
		payName := ""
		if oid, e2 := primitive.ObjectIDFromHex(body.PaidThrough); e2 == nil {
			var a models.Account
			if config.GetCollection(config.DB, "accounts").FindOne(ctx, bson.M{"_id": oid, "orgId": orgIDStr}).Decode(&a) == nil {
				payName = fmt.Sprintf("[%s] %s", a.AccountCode, a.AccountName)
			}
		}

		expenseCollection.UpdateOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": bson.M{
				"paid":            true,
				"paidThrough":     body.PaidThrough,
				"paidThroughName": payName,
				"updatedAt":       time.Now(),
			}},
		)

		// Settle payables: Dr AP 2000, Cr cash/bank.
		go autoJE(orgIDStr, "expense_payment", e.ID.Hex(), e.ExpenseNumber, time.Now().Format("2006-01-02"),
			"Expense paid - "+e.ExpenseNumber,
			[]jeLineInput{
				{AccountCode: "2000", Debit: round2(e.Total)},
				{AccountCode: payCode, Credit: round2(e.Total)},
			})

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Expense paid"})
	}
}

// VoidExpense voids an expense and posts a reversing journal entry (swap debit/credit)
// so Profit & Loss / Trial Balance net back to zero for it.
func VoidExpense() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid expense ID"})
			return
		}

		var e models.Expense
		if err := expenseCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&e); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Expense not found"})
			return
		}
		if e.Status == "void" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Expense is already void"})
			return
		}

		expCode := resolveAccountCode(ctx, orgIDStr, e.ExpenseAccount)
		creditCode := expenseCreditCode(ctx, orgIDStr, e)

		expenseCollection.UpdateOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": bson.M{"status": "void", "updatedAt": time.Now()}},
		)

		// Reverse: flip every leg of the original posting.
		var rev []jeLineInput
		for _, l := range expenseJELines(expCode, creditCode, e) {
			rev = append(rev, jeLineInput{AccountCode: l.AccountCode, Debit: l.Credit, Credit: l.Debit})
		}
		if len(rev) > 0 {
			go autoJE(orgIDStr, "expense_void", e.ID.Hex(), e.ExpenseNumber, time.Now().Format("2006-01-02"),
				"Expense void - "+e.ExpenseNumber, rev)
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Expense voided"})
	}
}
