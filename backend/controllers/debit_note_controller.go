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
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var debitNoteCollection *mongo.Collection = config.GetCollection(config.DB, "debit_notes")

func nextDNNumber(ctx context.Context, orgID string) string {
	return nextNumber(ctx, orgID, "debit_note", debitNoteCollection, "debitNoteNumber")
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
			"remainingAmount": body.Totals.GrandTotal,
			"appliedAmount":   0.0,
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

// PATCH /api/debit-notes/:id/approve — pending_approval → approved.
// Posts the purchase-return journal entry on success.
func ApproveDebitNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid id"})
			return
		}
		res, err := debitNoteCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": orgIDStr, "status": "pending_approval"},
			bson.M{"$set": bson.M{"status": "approved", "updatedAt": time.Now()}},
		)
		if err != nil || res.MatchedCount == 0 {
			c.JSON(http.StatusConflict, gin.H{"message": "only pending_approval debit notes can be approved"})
			return
		}
		go postDebitNoteGL(context.Background(), orgIDStr, objectID.Hex())
		c.JSON(http.StatusOK, gin.H{"message": "status updated to approved"})
	}
}

// PATCH /api/debit-notes/:id/close — approved → closed
func CloseDebitNote() gin.HandlerFunc {
	return dnTransition("approved", "closed", "only approved debit notes can be closed")
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

// PATCH /api/debit-notes/:id/apply — approved → partial or closed, reduces bill AP balance
// Body: { "billId": "...", "amount": 100.00 }  (billId overrides sourceDocId; amount allows partial)
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

		var body struct {
			BillID string  `json:"billId"`
			Amount float64 `json:"amount"`
		}
		c.ShouldBindJSON(&body)

		var dn bson.M
		if err = debitNoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&dn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "debit note not found"})
			return
		}
		if dn["status"] != "approved" {
			c.JSON(http.StatusConflict, gin.H{"message": "only approved debit notes can be applied"})
			return
		}

		// Resolve bill ID: body overrides sourceDocId
		billIDStr := body.BillID
		if billIDStr == "" {
			billIDStr, _ = dn["sourceDocId"].(string)
		}
		if billIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "no bill linked — provide billId in request body"})
			return
		}
		billObjID, err := primitive.ObjectIDFromHex(billIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid billId"})
			return
		}

		var bill models.Bill
		if err = billCollection.FindOne(ctx, bson.M{"_id": billObjID, "orgId": orgID}).Decode(&bill); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "bill not found"})
			return
		}

		// Determine remaining on debit note
		totals, _ := dn["totals"].(bson.M)
		grandTotal := 0.0
		if totals != nil {
			grandTotal, _ = totals["grandTotal"].(float64)
		}
		remaining, _ := dn["remainingAmount"].(float64)
		if remaining == 0 && grandTotal > 0 {
			remaining = grandTotal // backward-compat for old records
		}

		applyAmt := body.Amount
		if applyAmt <= 0 {
			applyAmt = remaining // default: apply all remaining
		}
		applyAmt = round2(applyAmt)
		if applyAmt > remaining+0.005 {
			c.JSON(http.StatusBadRequest, gin.H{"message": fmt.Sprintf("amount %.2f exceeds remaining debit note balance %.2f", applyAmt, remaining)})
			return
		}
		if applyAmt > bill.BalanceDue+0.005 {
			c.JSON(http.StatusBadRequest, gin.H{"message": fmt.Sprintf("amount %.2f exceeds bill balance due %.2f", applyAmt, bill.BalanceDue)})
			return
		}

		// Update bill
		newPaid := round2(bill.AmountPaid + applyAmt)
		newBalance := round2(bill.BalanceDue - applyAmt)
		if newBalance < 0 {
			newBalance = 0
		}
		newBillStatus := "partial"
		if newBalance <= 0 {
			newBillStatus = "paid"
		}
		billCollection.UpdateOne(ctx, bson.M{"_id": billObjID}, bson.M{"$set": bson.M{
			"balanceDue": newBalance,
			"amountPaid": newPaid,
			"status":     newBillStatus,
			"updatedAt":  time.Now(),
		}})

		// Update debit note remaining
		newRemaining := round2(remaining - applyAmt)
		applied, _ := dn["appliedAmount"].(float64)
		newApplied := round2(applied + applyAmt)
		dnStatus := "approved"
		if newRemaining <= 0 {
			dnStatus = "closed"
		}
		debitNoteCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": bson.M{
			"status":          dnStatus,
			"remainingAmount": newRemaining,
			"appliedAmount":   newApplied,
			"updatedAt":       time.Now(),
		}})

		// Decrement vendor outstanding payable
		vendorID, _ := dn["vendorId"].(string)
		dnNumber, _ := dn["debitNoteNumber"].(string)
		if vendorID != "" {
			vendorFilter := bson.M{"orgId": orgID}
			if vObjID, err := primitive.ObjectIDFromHex(vendorID); err == nil {
				vendorFilter["_id"] = vObjID
			}
			histEntry := bson.M{
				"action":    "debit_note_applied",
				"timestamp": time.Now(),
				"details":   fmt.Sprintf("Debit note %s applied to bill %s. Amount: AED %.2f", dnNumber, bill.BillNumber, applyAmt),
			}
			vendorCollection.UpdateOne(ctx, vendorFilter, bson.M{
				"$inc":  bson.M{"outstandingPayable": -applyAmt},
				"$push": bson.M{"history": histEntry},
				"$set":  bson.M{"updatedAt": time.Now()},
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "debit note applied",
			"data": gin.H{
				"appliedAmount":  applyAmt,
				"remaining":      newRemaining,
				"newBillBalance": newBalance,
				"billStatus":     newBillStatus,
				"dnStatus":       dnStatus,
			},
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

		var dn models.DebitNote
		if err = debitNoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&dn); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "debit note not found"})
			return
		}
		switch dn.Status {
		case "closed":
			c.JSON(http.StatusConflict, gin.H{"message": "closed debit notes cannot be voided"})
			return
		}

		// Back out the purchase-return GL before voiding.
		reverseDebitNoteGL(ctx, fmt.Sprintf("%v", orgID), dn)

		debitNoteCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": bson.M{
			"status":    "void",
			"glPosted":  false,
			"updatedAt": time.Now(),
		}})
		c.JSON(http.StatusOK, gin.H{"message": "debit note voided"})
	}
}
