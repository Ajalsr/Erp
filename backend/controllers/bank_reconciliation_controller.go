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
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var bankReconCollection = config.GetCollection(config.DB, "bank_reconciliations")
var bankClearingCollection = config.GetCollection(config.DB, "bank_clearings")

// bankTxn is one book transaction (a journal entry touching the bank account),
// with its net effect on that account and whether it's been cleared.
type bankTxn struct {
	ID          string  `json:"id"`          // journal entry _id
	Date        string  `json:"date"`
	Description string  `json:"description"`
	Reference   string  `json:"reference"`
	RefType     string  `json:"refType"`
	Amount      float64 `json:"amount"` // +in / -out, net on the bank account
	Cleared     bool    `json:"cleared"`
}

// clearedSet returns the set of cleared journal-entry IDs for an account.
func clearedSet(ctx context.Context, orgID, accountID string) map[string]bool {
	out := map[string]bool{}
	cur, err := bankClearingCollection.Find(ctx, bson.M{"orgId": orgID, "accountId": accountID})
	if err != nil {
		return out
	}
	defer cur.Close(ctx)
	var rows []models.BankClearing
	if cur.All(ctx, &rows) == nil {
		for _, r := range rows {
			out[r.JeID] = true
		}
	}
	return out
}

// bankTransactions pulls every JE touching the account up to endDate, reducing
// each to its net amount on that account, tagged with cleared state.
func bankTransactions(ctx context.Context, orgID, accountID, endDate string) ([]bankTxn, error) {
	match := bson.M{"orgId": orgID, "lines.accountId": accountID}
	if endDate != "" {
		match["date"] = bson.M{"$lte": endDate}
	}
	opts := options.Find().SetSort(bson.D{{Key: "date", Value: 1}, {Key: "createdAt", Value: 1}})
	cur, err := config.GetCollection(config.DB, "journal_entries").Find(ctx, match, opts)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var entries []models.JournalEntry
	if err := cur.All(ctx, &entries); err != nil {
		return nil, err
	}

	cleared := clearedSet(ctx, orgID, accountID)
	txns := make([]bankTxn, 0, len(entries))
	for _, e := range entries {
		var amt float64
		for _, ln := range e.Lines {
			if ln.AccountID == accountID {
				amt += ln.Debit - ln.Credit
			}
		}
		if amt == 0 {
			continue
		}
		txns = append(txns, bankTxn{
			ID: e.ID.Hex(), Date: e.Date, Description: e.Description,
			Reference: e.Reference, RefType: e.RefType, Amount: amt,
			Cleared: cleared[e.ID.Hex()],
		})
	}
	return txns, nil
}

// GET /api/bank-reconciliation/transactions?accountId=&endDate=
// Returns book transactions for the account plus running book/cleared balances.
func GetBankTransactions() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))
		accountID := c.Query("accountId")
		if accountID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "accountId is required"})
			return
		}
		endDate := c.DefaultQuery("endDate", time.Now().Format("2006-01-02"))

		txns, err := bankTransactions(ctx, orgID, accountID, endDate)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to load transactions"})
			return
		}

		var bookBalance, clearedBalance float64
		for _, t := range txns {
			bookBalance += t.Amount
			if t.Cleared {
				clearedBalance += t.Amount
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"transactions":   txns,
				"bookBalance":    bookBalance,
				"clearedBalance": clearedBalance,
			},
		})
	}
}

// POST /api/bank-reconciliation/toggle  { accountId, jeId, cleared }
// Persists a single transaction's cleared state as the user ticks it.
func ToggleBankClearing() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))
		userID := fmt.Sprintf("%v", mustGet(c, "userId"))

		var req struct {
			AccountID string `json:"accountId"`
			JeID      string `json:"jeId"`
			Cleared   bool   `json:"cleared"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.AccountID == "" || req.JeID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "accountId and jeId are required"})
			return
		}

		filter := bson.M{"orgId": orgID, "accountId": req.AccountID, "jeId": req.JeID}
		if req.Cleared {
			_, err := bankClearingCollection.UpdateOne(ctx, filter,
				bson.M{"$set": bson.M{"clearedAt": time.Now(), "clearedBy": userID}, "$setOnInsert": filter},
				options.Update().SetUpsert(true))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update"})
				return
			}
		} else {
			bankClearingCollection.DeleteOne(ctx, filter)
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Updated"})
	}
}

// POST /api/bank-reconciliation  { accountId, statementDate, statementBalance }
// Finalises a reconciliation: requires cleared balance to equal the statement
// ending balance (difference must be zero), then saves a snapshot.
func CreateBankReconciliation() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))
		userID := fmt.Sprintf("%v", mustGet(c, "userId"))

		var req struct {
			AccountID        string  `json:"accountId"`
			StatementDate    string  `json:"statementDate"`
			StatementBalance float64 `json:"statementBalance"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.AccountID == "" || req.StatementDate == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "accountId and statementDate are required"})
			return
		}

		txns, err := bankTransactions(ctx, orgID, req.AccountID, req.StatementDate)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to compute reconciliation"})
			return
		}
		var clearedBalance float64
		clearedCount := 0
		for _, t := range txns {
			if t.Cleared {
				clearedBalance += t.Amount
				clearedCount++
			}
		}
		difference := req.StatementBalance - clearedBalance
		if difference > 0.005 || difference < -0.005 {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"status":  http.StatusUnprocessableEntity,
				"message": fmt.Sprintf("Not balanced — cleared %.2f vs statement %.2f (off by %.2f). Tick transactions until the difference is zero.", clearedBalance, req.StatementBalance, difference),
			})
			return
		}

		var acc models.Account
		accName := ""
		if objID, e := primitive.ObjectIDFromHex(req.AccountID); e == nil {
			if accountCollection.FindOne(ctx, bson.M{"_id": objID}).Decode(&acc) == nil {
				accName = acc.AccountName
			}
		}

		rec := models.BankReconciliation{
			OrgID:            orgID,
			AccountID:        req.AccountID,
			AccountName:      accName,
			StatementDate:    req.StatementDate,
			StatementBalance: req.StatementBalance,
			ClearedBalance:   clearedBalance,
			Difference:       0,
			ClearedCount:     clearedCount,
			Status:           "reconciled",
			CreatedBy:        userID,
			CreatedAt:        time.Now(),
		}
		res, err := bankReconCollection.InsertOne(ctx, rec)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to save reconciliation"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": fmt.Sprintf("Reconciled %d transactions to %.2f", clearedCount, req.StatementBalance),
			"data":    gin.H{"id": res.InsertedID, "clearedBalance": clearedBalance, "clearedCount": clearedCount},
		})
	}
}

// GET /api/bank-reconciliation?accountId= — past reconciliations (newest first).
func GetBankReconciliations() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))
		filter := bson.M{"orgId": orgID}
		if accID := c.Query("accountId"); accID != "" {
			filter["accountId"] = accID
		}
		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(100)
		cur, err := bankReconCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch"})
			return
		}
		defer cur.Close(ctx)
		var recs []models.BankReconciliation
		cur.All(ctx, &recs)
		if recs == nil {
			recs = []models.BankReconciliation{}
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": recs})
	}
}
