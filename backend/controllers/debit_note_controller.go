package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
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

var debitNoteCollection *mongo.Collection = config.GetCollection(config.DB, "debit_notes")

func nextDNNumber(ctx context.Context, orgID string) string {
	opts := options.FindOne().SetSort(bson.D{{Key: "debitNoteNumber", Value: -1}})
	var last bson.M
	next := 1
	if err := debitNoteCollection.FindOne(ctx, bson.M{"orgId": orgID}, opts).Decode(&last); err == nil {
		if num, ok := last["debitNoteNumber"].(string); ok {
			seqStr := strings.TrimPrefix(num, "DN-")
			if seq, err := strconv.Atoi(seqStr); err == nil {
				next = seq + 1
			}
		}
	}
	return fmt.Sprintf("DN-%04d", next)
}

// POST /api/debit-notes
func CreateDebitNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var body models.DebitNote
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid body", "error": err.Error()})
			return
		}
		if body.VendorID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "vendorId is required"})
			return
		}
		if body.Reason == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "reason is required"})
			return
		}
		if len(body.LineItems) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "at least one line item is required"})
			return
		}

		for i := range body.LineItems {
			if body.LineItems[i].ID.IsZero() {
				body.LineItems[i].ID = primitive.NewObjectID()
			}
		}

		body.Totals = calcCNTotals(body.LineItems)
		body.VATBreakdown = calcVATBreakdown(body.LineItems)

		// Validate against source bill balance
		if body.SourceDocID != "" {
			srcID, err := primitive.ObjectIDFromHex(body.SourceDocID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid sourceDocId"})
				return
			}
			var bill models.Bill
			if err = billCollection.FindOne(ctx, bson.M{"_id": srcID, "orgId": orgID}).Decode(&bill); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "source bill not found"})
				return
			}
			if body.Totals.GrandTotal > bill.BalanceDue+0.005 {
				c.JSON(http.StatusBadRequest, gin.H{
					"message": fmt.Sprintf("debit note total (%.2f) exceeds bill balance due (%.2f)", body.Totals.GrandTotal, bill.BalanceDue),
				})
				return
			}
		}

		body.DebitNoteNumber = nextDNNumber(ctx, orgID.(string))
		body.OrgID = orgID.(string)
		body.Status = "draft"
		body.CreatedAt = time.Now()
		body.UpdatedAt = time.Now()
		if userID != nil {
			body.CreatedBy = userID.(string)
		}
		if body.Date == "" {
			body.Date = time.Now().Format("2006-01-02")
		}

		oid := primitive.NewObjectID()
		body.ID = oid.Hex()

		doc := bson.M{
			"_id":             oid,
			"debitNoteNumber": body.DebitNoteNumber,
			"sourceDocId":     body.SourceDocID,
			"sourceDocType":   body.SourceDocType,
			"sourceDocNumber": body.SourceDocNumber,
			"vendorId":        body.VendorID,
			"vendorName":      body.VendorName,
			"date":            body.Date,
			"reason":          body.Reason,
			"lineItems":       body.LineItems,
			"totals":          body.Totals,
			"vatBreakdown":    body.VATBreakdown,
			"status":          body.Status,
			"notes":           body.Notes,
			"orgId":           body.OrgID,
			"createdAt":       body.CreatedAt,
			"updatedAt":       body.UpdatedAt,
			"createdBy":       body.CreatedBy,
		}

		if _, err := debitNoteCollection.InsertOne(ctx, doc); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create debit note"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message": "debit note created",
			"data":    gin.H{"id": oid.Hex(), "debitNoteNumber": body.DebitNoteNumber},
		})
	}
}

// GET /api/debit-notes
func GetAllDebitNotes() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		filter := bson.M{"orgId": orgID}
		if s := c.Query("status"); s != "" && s != "all" {
			filter["status"] = s
		}
		if vid := c.Query("vendorId"); vid != "" {
			filter["vendorId"] = vid
		}

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := debitNoteCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to fetch debit notes"})
			return
		}
		defer cursor.Close(ctx)

		var notes []bson.M
		cursor.All(ctx, &notes)
		if notes == nil {
			notes = []bson.M{}
		}
		c.JSON(http.StatusOK, gin.H{"data": notes})
	}
}

// GET /api/debit-notes/:id
func GetDebitNoteByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid id"})
			return
		}
		var dn bson.M
		if err = debitNoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&dn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "debit note not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": dn})
	}
}

// PATCH /api/debit-notes/:id/submit — draft → pending_approval
func SubmitDebitNote() gin.HandlerFunc {
	return dnTransition("draft", "pending_approval", "only draft debit notes can be submitted")
}

// PATCH /api/debit-notes/:id/approve — pending_approval → approved
func ApproveDebitNote() gin.HandlerFunc {
	return dnTransition("pending_approval", "approved", "only pending_approval debit notes can be approved")
}

// PATCH /api/debit-notes/:id/close — applied → closed
func CloseDebitNote() gin.HandlerFunc {
	return dnTransition("applied", "closed", "only applied debit notes can be closed")
}

func dnTransition(from, to, errMsg string) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid id"})
			return
		}
		res, err := debitNoteCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": orgID, "status": from},
			bson.M{"$set": bson.M{"status": to, "updatedAt": time.Now()}},
		)
		if err != nil || res.MatchedCount == 0 {
			c.JSON(http.StatusConflict, gin.H{"message": errMsg})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "status updated to " + to})
	}
}

// PATCH /api/debit-notes/:id/apply — approved → applied, reduces bill AP balance
func ApplyDebitNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid id"})
			return
		}

		var dn bson.M
		if err = debitNoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&dn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "debit note not found"})
			return
		}
		if dn["status"] != "approved" {
			c.JSON(http.StatusConflict, gin.H{"message": "only approved debit notes can be applied"})
			return
		}

		sourceDocID, _ := dn["sourceDocId"].(string)
		if sourceDocID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "no source bill linked — cannot apply"})
			return
		}

		billID, err := primitive.ObjectIDFromHex(sourceDocID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid sourceDocId"})
			return
		}

		var bill models.Bill
		if err = billCollection.FindOne(ctx, bson.M{"_id": billID, "orgId": orgID}).Decode(&bill); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "source bill not found"})
			return
		}

		totals, _ := dn["totals"].(bson.M)
		creditAmount := 0.0
		if totals != nil {
			creditAmount, _ = totals["grandTotal"].(float64)
		}

		newBalance := round2(bill.BalanceDue - creditAmount)
		newPaid := round2(bill.AmountPaid + creditAmount)
		newStatus := bill.Status
		if newBalance <= 0 {
			newBalance = 0
			newStatus = "paid"
		} else {
			newStatus = "partial"
		}

		billCollection.UpdateOne(ctx, bson.M{"_id": billID}, bson.M{"$set": bson.M{
			"balanceDue": newBalance,
			"amountPaid": newPaid,
			"status":     newStatus,
			"updatedAt":  time.Now(),
		}})

		debitNoteCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": bson.M{
			"status":    "applied",
			"updatedAt": time.Now(),
		}})

		c.JSON(http.StatusOK, gin.H{
			"message": "debit note applied",
			"data":    gin.H{"newBillBalance": newBalance, "billStatus": newStatus},
		})
	}
}

// PATCH /api/debit-notes/:id/void — draft | pending_approval | approved → void
func VoidDebitNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid id"})
			return
		}

		var dn bson.M
		if err = debitNoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&dn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "debit note not found"})
			return
		}
		switch dn["status"] {
		case "applied", "closed":
			c.JSON(http.StatusConflict, gin.H{"message": "applied or closed debit notes cannot be voided"})
			return
		}

		debitNoteCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": bson.M{
			"status":    "void",
			"updatedAt": time.Now(),
		}})
		c.JSON(http.StatusOK, gin.H{"message": "debit note voided"})
	}
}
