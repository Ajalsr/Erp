package controllers

import (
	"context"
	"fmt"
	"math/rand"
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

var creditNoteCollection *mongo.Collection = config.GetCollection(config.DB, "credit_notes")

func genCreditNoteNumber() string {
	now := time.Now()
	return fmt.Sprintf("CN-%d%02d-%04d", now.Year(), now.Month(), rand.Intn(9000)+1000)
}

// POST /api/credit-notes
func CreateCreditNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var cn models.CreditNote
		if err := c.ShouldBindJSON(&cn); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid body", "error": err.Error()})
			return
		}
		if cn.CustomerID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Customer is required"})
			return
		}

		cn.ID = primitive.NewObjectID()
		cn.OrgID = orgID.(string)
		cn.CreatedAt = time.Now()
		cn.UpdatedAt = time.Now()
		if userID != nil {
			cn.CreatedBy = userID.(string)
		}
		if cn.CreditNoteNumber == "" {
			cn.CreditNoteNumber = genCreditNoteNumber()
		}
		if cn.Status == "" {
			cn.Status = "draft"
		}
		if cn.Date == "" {
			cn.Date = time.Now().Format("2006-01-02")
		}
		for i := range cn.LineItems {
			if cn.LineItems[i].ID.IsZero() {
				cn.LineItems[i].ID = primitive.NewObjectID()
			}
		}

		if _, err := creditNoteCollection.InsertOne(ctx, cn); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create credit note"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Credit note created",
			"data":    gin.H{"id": cn.ID.Hex(), "creditNoteNumber": cn.CreditNoteNumber},
		})
	}
}

// GET /api/credit-notes
func GetAllCreditNotes() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		filter := bson.M{"orgId": orgID}
		if s := c.Query("status"); s != "" && s != "all" {
			filter["status"] = s
		}

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := creditNoteCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch credit notes"})
			return
		}
		defer cursor.Close(ctx)

		var notes []models.CreditNote
		cursor.All(ctx, &notes)
		if notes == nil {
			notes = []models.CreditNote{}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": notes})
	}
}

// GET /api/credit-notes/:id
func GetCreditNoteByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}

		var cn models.CreditNote
		if err = creditNoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&cn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Credit note not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": cn})
	}
}

// PATCH /api/credit-notes/:id/issue — draft → issued
func IssueCreditNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}

		var cn models.CreditNote
		if err = creditNoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&cn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Credit note not found"})
			return
		}
		if cn.Status != "draft" {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "Only draft credit notes can be issued"})
			return
		}

		creditNoteCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": bson.M{"status": "issued", "updatedAt": time.Now()}})
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Credit note issued"})
	}
}

// PATCH /api/credit-notes/:id/apply — apply issued credit note to its linked invoice
func ApplyCreditNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}

		var cn models.CreditNote
		if err = creditNoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&cn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Credit note not found"})
			return
		}
		if cn.Status != "issued" {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "Credit note must be in issued status to apply"})
			return
		}
		if cn.InvoiceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "No invoice linked to this credit note"})
			return
		}

		invID, err := primitive.ObjectIDFromHex(cn.InvoiceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid linked invoice ID"})
			return
		}

		var inv models.Invoice
		if err = invoiceCollection.FindOne(ctx, bson.M{"_id": invID, "orgId": orgID}).Decode(&inv); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Linked invoice not found"})
			return
		}

		creditAmount := cn.Totals.GrandTotal
		newBalance := inv.BalanceDue - creditAmount
		newAmountPaid := inv.AmountPaid + creditAmount

		newStatus := inv.Status
		if newBalance <= 0 {
			newBalance = 0
			newStatus = "paid"
		} else {
			newStatus = "partial"
		}

		invoiceCollection.UpdateOne(ctx, bson.M{"_id": invID}, bson.M{"$set": bson.M{
			"balanceDue":  newBalance,
			"amountPaid":  newAmountPaid,
			"status":      newStatus,
			"updatedAt":   time.Now(),
		}})

		creditNoteCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": bson.M{
			"status":    "applied",
			"updatedAt": time.Now(),
		}})

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Credit note applied", "data": gin.H{
			"newBalance": newBalance,
			"invoiceStatus": newStatus,
		}})
	}
}

// PATCH /api/credit-notes/:id/void
func VoidCreditNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}

		var cn models.CreditNote
		if err = creditNoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&cn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Credit note not found"})
			return
		}
		if cn.Status == "applied" {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "Applied credit notes cannot be voided"})
			return
		}

		creditNoteCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": bson.M{"status": "void", "updatedAt": time.Now()}})
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Credit note voided"})
	}
}
