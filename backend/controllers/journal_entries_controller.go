package controllers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var jeCollection *mongo.Collection = config.GetCollection(config.DB, "journal_entries")

func generateJENumber(orgID string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	return nextNumber(ctx, orgID, "journal_entry", jeCollection, "entryNumber")
}

// jeLineInput is the simplified input for autoJE callers — pass code + debit/credit.
type jeLineInput struct {
	AccountCode string
	Debit       float64
	Credit      float64
	Description string
}

// getSysAccount looks up an account by orgId + accountCode. Returns zero-value if not found.
func getSysAccount(ctx context.Context, orgID, code string) models.Account {
	var a models.Account
	jeCollection.Database().Collection("accounts").FindOne(ctx,
		bson.M{"orgId": orgID, "accountCode": code},
	).Decode(&a)
	return a
}

// autoJE creates a journal entry automatically (fire-and-forget from transaction controllers).
// Silently skips if accounts not found or amount is zero — never fails the parent tx.
func autoJE(orgID, refType, refID, reference, date, description string, lines []jeLineInput) {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	var jeLines []models.JournalLine
	var totalDebit, totalCredit float64

	for _, l := range lines {
		if l.Debit == 0 && l.Credit == 0 {
			continue
		}
		acc := getSysAccount(ctx, orgID, l.AccountCode)
		// Account code not found → posting this line would create an orphan
		// pointing at the zero ObjectID, silently corrupting the ledger
		// (unbalanced once aggregated). Abort the whole entry instead.
		if acc.ID.IsZero() {
			log.Printf("autoJE: skipped %s entry for org %s — account code %q not found; no journal posted",
				refType, orgID, l.AccountCode)
			return
		}
		jeLines = append(jeLines, models.JournalLine{
			AccountID:   acc.ID.Hex(),
			AccountCode: acc.AccountCode,
			AccountName: acc.AccountName,
			Debit:       l.Debit,
			Credit:      l.Credit,
			Description: l.Description,
		})
		totalDebit += l.Debit
		totalCredit += l.Credit
	}

	if len(jeLines) == 0 || totalDebit == 0 {
		return
	}

	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	je := models.JournalEntry{
		ID:          primitive.NewObjectID(),
		OrgID:       orgID,
		EntryNumber: generateJENumber(orgID),
		Date:        date,
		Reference:   reference,
		RefType:     refType,
		RefID:       refID,
		Description: description,
		Lines:       jeLines,
		TotalDebit:  totalDebit,
		TotalCredit: totalCredit,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	jeCollection.InsertOne(ctx, je)
}

// ── HTTP handlers ────────────────────────────────────────────────────────────

func CreateManualJournalEntry() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var je models.JournalEntry
		if err := c.ShouldBindJSON(&je); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body", "error": err.Error()})
			return
		}
		if len(je.Lines) < 2 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Journal entry requires at least 2 lines"})
			return
		}

		var totalDebit, totalCredit float64
		for _, l := range je.Lines {
			totalDebit += l.Debit
			totalCredit += l.Credit
		}
		if fmt.Sprintf("%.2f", totalDebit) != fmt.Sprintf("%.2f", totalCredit) {
			c.JSON(http.StatusBadRequest, gin.H{"message": fmt.Sprintf("Entry must balance: debit %.2f ≠ credit %.2f", totalDebit, totalCredit)})
			return
		}

		je.ID = primitive.NewObjectID()
		je.OrgID = orgIDStr
		je.EntryNumber = generateJENumber(orgIDStr)
		je.RefType = "manual"
		je.TotalDebit = totalDebit
		je.TotalCredit = totalCredit
		je.CreatedBy = fmt.Sprintf("%v", userID)
		je.CreatedAt = time.Now()
		je.UpdatedAt = time.Now()
		if je.Date == "" {
			je.Date = time.Now().Format("2006-01-02")
		}

		if _, err := jeCollection.InsertOne(ctx, je); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create journal entry", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Journal entry created",
			"data":    gin.H{"id": je.ID.Hex(), "entryNumber": je.EntryNumber},
		})
	}
}

func GetJournalEntries() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if refType := c.Query("refType"); refType != "" {
			filter["refType"] = refType
		}
		if refID := c.Query("refId"); refID != "" {
			filter["refId"] = refID
		}
		if startDate := c.Query("startDate"); startDate != "" {
			if filter["date"] == nil {
				filter["date"] = bson.M{}
			}
			filter["date"].(bson.M)["$gte"] = startDate
		}
		if endDate := c.Query("endDate"); endDate != "" {
			if filter["date"] == nil {
				filter["date"] = bson.M{}
			}
			filter["date"].(bson.M)["$lte"] = endDate
		}

		total, _ := jeCollection.CountDocuments(ctx, filter)
		opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}, {Key: "createdAt", Value: -1}}).SetLimit(200)
		cursor, err := jeCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch journal entries"})
			return
		}
		defer cursor.Close(ctx)

		var entries []models.JournalEntry
		cursor.All(ctx, &entries)
		if entries == nil {
			entries = []models.JournalEntry{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data":   gin.H{"entries": entries, "total": total},
		})
	}
}

func GetJournalEntryByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid ID"})
			return
		}

		var je models.JournalEntry
		if err := jeCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&je); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Journal entry not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": je})
	}
}

// reverseJournalEntries creates reversal entries (DR↔CR swapped) for all JEs
// linked to refID. Called as a goroutine from VoidInvoice and similar voids.
func reverseJournalEntries(orgID, refID, reversedBy string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := jeCollection.Find(ctx, bson.M{
		"orgId":      orgID,
		"refId":      refID,
		"isReversed": bson.M{"$ne": true},
	})
	if err != nil {
		return
	}
	var entries []models.JournalEntry
	cursor.All(ctx, &entries)
	cursor.Close(ctx)

	for _, je := range entries {
		// Mark original as reversed
		jeCollection.UpdateOne(ctx, bson.M{"_id": je.ID}, bson.M{"$set": bson.M{
			"isReversed": true,
			"reversedBy": reversedBy,
			"updatedAt":  time.Now(),
		}})

		// Build reversal lines (swap debit ↔ credit)
		reversed := make([]models.JournalLine, len(je.Lines))
		for i, l := range je.Lines {
			reversed[i] = models.JournalLine{
				AccountID:   l.AccountID,
				AccountCode: l.AccountCode,
				AccountName: l.AccountName,
				Debit:       l.Credit,
				Credit:      l.Debit,
				Description: "Reversal: " + l.Description,
			}
		}

		reversal := models.JournalEntry{
			ID:          primitive.NewObjectID(),
			OrgID:       orgID,
			EntryNumber: generateJENumber(orgID),
			Date:        time.Now().Format("2006-01-02"),
			Reference:   "REV-" + je.Reference,
			RefType:     "reversal",
			RefID:       refID,
			Description: "Reversal of " + je.EntryNumber,
			Lines:       reversed,
			TotalDebit:  je.TotalCredit,
			TotalCredit: je.TotalDebit,
			CreatedBy:   reversedBy,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
		jeCollection.InsertOne(ctx, reversal)
	}
}
