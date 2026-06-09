package controllers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/backend/utils"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var recurringInvoiceCollection *mongo.Collection = config.GetCollection(config.DB, "recurring_invoices")

const dateLayout = "2006-01-02"

// advanceDate returns date advanced by interval periods of the given frequency.
func advanceDate(date string, frequency string, interval int) string {
	t, err := time.Parse(dateLayout, date)
	if err != nil {
		return date
	}
	if interval < 1 {
		interval = 1
	}
	switch frequency {
	case "weekly":
		t = t.AddDate(0, 0, 7*interval)
	case "monthly":
		t = t.AddDate(0, interval, 0)
	case "quarterly":
		t = t.AddDate(0, 3*interval, 0)
	case "yearly":
		t = t.AddDate(interval, 0, 0)
	default:
		t = t.AddDate(0, interval, 0)
	}
	return t.Format(dateLayout)
}

// validFrequency guards the allowed cadences.
func validFrequency(f string) bool {
	switch f {
	case "weekly", "monthly", "quarterly", "yearly":
		return true
	}
	return false
}

// CreateRecurringInvoice stores a new template + schedule. NextRunDate seeds to
// StartDate so the first generation happens on/after the start.
func CreateRecurringInvoice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var p models.RecurringInvoice
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}

		if !validFrequency(p.Frequency) {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "frequency must be weekly, monthly, quarterly, or yearly"})
			return
		}
		if _, err := time.Parse(dateLayout, p.StartDate); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "startDate must be YYYY-MM-DD"})
			return
		}
		if p.Interval < 1 {
			p.Interval = 1
		}
		if p.NumberPrefix == "" {
			p.NumberPrefix = fmt.Sprintf("INV-%d", time.Now().Year())
		}

		p.ID = primitive.NewObjectID()
		p.OrgID = orgID.(string)
		if userID != nil {
			p.CreatedBy = userID.(string)
		}
		p.Status = "active"
		p.NextRunDate = p.StartDate
		p.GeneratedCount = 0
		p.LastGeneratedAt = nil
		p.LastInvoiceNumber = ""
		p.CreatedAt = time.Now()
		p.UpdatedAt = time.Now()

		if _, err := recurringInvoiceCollection.InsertOne(ctx, p); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create recurring invoice", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Recurring invoice created", "data": gin.H{"id": p.ID.Hex()}})
	}
}

func GetAllRecurringInvoices() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		filter := bson.M{"orgId": orgID}
		if status := c.Query("status"); status != "" && status != "all" {
			filter["status"] = status
		}

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := recurringInvoiceCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch recurring invoices", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var profiles []models.RecurringInvoice
		if err := cursor.All(ctx, &profiles); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode", "error": err.Error()})
			return
		}
		if profiles == nil {
			profiles = []models.RecurringInvoice{}
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": profiles})
	}
}

func GetRecurringInvoiceByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		oid, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}

		var p models.RecurringInvoice
		err = recurringInvoiceCollection.FindOne(ctx, bson.M{"_id": oid, "orgId": orgID}).Decode(&p)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Recurring invoice not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed", "error": err.Error()})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": p})
	}
}

// UpdateRecurringInvoice edits the schedule/template fields. Runtime counters
// (generatedCount, lastInvoiceNumber, etc.) are never overwritten from the client.
// If the schedule changes and the profile is still active, NextRunDate is rebased
// off StartDate when no invoice has generated yet.
func UpdateRecurringInvoice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		oid, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}

		var existing models.RecurringInvoice
		if err := recurringInvoiceCollection.FindOne(ctx, bson.M{"_id": oid, "orgId": orgID}).Decode(&existing); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Recurring invoice not found"})
			return
		}

		var p models.RecurringInvoice
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if !validFrequency(p.Frequency) {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "frequency must be weekly, monthly, quarterly, or yearly"})
			return
		}
		if p.Interval < 1 {
			p.Interval = 1
		}

		set := bson.M{
			"profileName":  p.ProfileName,
			"frequency":    p.Frequency,
			"interval":     p.Interval,
			"startDate":    p.StartDate,
			"endDate":      p.EndDate,
			"maxCount":     p.MaxCount,
			"numberPrefix": p.NumberPrefix,
			"dueDays":      p.DueDays,
			"autoSend":     p.AutoSend,
			"customerId":   p.CustomerID,
			"currency":     p.Currency,
			"paymentTerms": p.PaymentTerms,
			"from":         p.From,
			"billTo":       p.BillTo,
			"lineItems":    p.LineItems,
			"totals":       p.Totals,
			"notes":        p.Notes,
			"updatedAt":    time.Now(),
		}
		// Nothing generated yet → keep NextRunDate aligned to (possibly new) StartDate.
		if existing.GeneratedCount == 0 && p.StartDate != "" {
			set["nextRunDate"] = p.StartDate
		}

		if _, err := recurringInvoiceCollection.UpdateOne(ctx, bson.M{"_id": oid, "orgId": orgID}, bson.M{"$set": set}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Recurring invoice updated"})
	}
}

// UpdateRecurringInvoiceStatus toggles active/paused (cannot move to completed manually).
func UpdateRecurringInvoiceStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		oid, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}

		var body struct {
			Status string `json:"status"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || (body.Status != "active" && body.Status != "paused") {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "status must be active or paused"})
			return
		}

		res, err := recurringInvoiceCollection.UpdateOne(ctx,
			bson.M{"_id": oid, "orgId": orgID, "status": bson.M{"$ne": "completed"}},
			bson.M{"$set": bson.M{"status": body.Status, "updatedAt": time.Now()}},
		)
		if err != nil || res.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Recurring invoice not found or already completed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Status updated"})
	}
}

func DeleteRecurringInvoice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		oid, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}
		res, err := recurringInvoiceCollection.DeleteOne(ctx, bson.M{"_id": oid, "orgId": orgID})
		if err != nil || res.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Recurring invoice not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Recurring invoice deleted"})
	}
}

// RunRecurringInvoiceNow generates one invoice immediately (issue date = today),
// independent of the schedule. The schedule's NextRunDate is left untouched so the
// regular cadence is unaffected — useful for an ad-hoc early bill.
func RunRecurringInvoiceNow() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		oid, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}

		var p models.RecurringInvoice
		if err := recurringInvoiceCollection.FindOne(ctx, bson.M{"_id": oid, "orgId": orgID}).Decode(&p); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Recurring invoice not found"})
			return
		}

		inv, err := generateInvoiceFromProfile(ctx, &p, time.Now().Format(dateLayout), false)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to generate invoice", "error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Invoice generated", "data": gin.H{"id": inv.ID.Hex(), "invoiceNumber": inv.InvoiceNumber}})
	}
}

// generateInvoiceFromProfile builds and persists one real Invoice from a template.
// When advanceSchedule is true the profile's NextRunDate/counters advance (scheduler
// path); when false only the generated counters bump (manual "run now"). Returns the
// created invoice.
func generateInvoiceFromProfile(ctx context.Context, p *models.RecurringInvoice, issueDate string, advanceSchedule bool) (models.Invoice, error) {
	number := fmt.Sprintf("%s-%04d", p.NumberPrefix, p.GeneratedCount+1)

	dueDate := issueDate
	if p.DueDays > 0 {
		if t, err := time.Parse(dateLayout, issueDate); err == nil {
			dueDate = t.AddDate(0, 0, p.DueDays).Format(dateLayout)
		}
	}

	inv := models.Invoice{
		ID:            primitive.NewObjectID(),
		InvoiceNumber: number,
		IssueDate:     issueDate,
		DueDate:       dueDate,
		Currency:      p.Currency,
		PaymentTerms:  p.PaymentTerms,
		From:          p.From,
		BillTo:        p.BillTo,
		CustomerID:    p.CustomerID,
		LineItems:     p.LineItems,
		Totals:        p.Totals,
		Notes:         p.Notes,
		Status:        "unpaid",
		Type:          "invoice",
		AmountPaid:    0,
		BalanceDue:    p.Totals.GrandTotal,
		PublicToken:   generatePublicToken(),
		OrgID:         p.OrgID,
		CreatedBy:     p.CreatedBy,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	for i := range inv.LineItems {
		inv.LineItems[i].ID = primitive.NewObjectID()
	}
	inv.StockDeducted = invoiceShouldDeductStock(inv)

	// Multi-currency: freeze rate + base totals so GL posts in base currency.
	fxRate := applyInvoiceFX(ctx, &inv)

	if _, err := invoiceCollection.InsertOne(ctx, inv); err != nil {
		return models.Invoice{}, err
	}

	// Mirror CreateInvoice side effects: GL posting, stock, history.
	if inv.Totals.GrandTotal > 0 {
		lines := scaleJELines(buildInvoiceJELines(inv), fxRate)
		go autoJE(inv.OrgID, "invoice", inv.ID.Hex(), inv.InvoiceNumber, inv.IssueDate,
			"Invoice raised (recurring) - "+inv.InvoiceNumber, lines)
	}
	if invoiceShouldDeductStock(inv) {
		deductInvoiceStock(ctx, inv)
	}
	pushInvoiceHistory(ctx, inv.ID, "Invoice created (recurring)", inv.CreatedBy, "From recurring profile: "+p.ProfileName)

	// Optionally email the customer.
	if p.AutoSend {
		if toEmail := fetchCustomerEmail(ctx, inv.CustomerID); toEmail != "" {
			msg := fmt.Sprintf("Please find your invoice %s for %s %.2f, due %s.", inv.InvoiceNumber, inv.Currency, inv.Totals.GrandTotal, inv.DueDate)
			go func() { _ = utils.SendInvoiceEmail(toEmail, inv, msg, false) }()
		}
	}

	// Advance the profile bookkeeping.
	now := time.Now()
	newCount := p.GeneratedCount + 1
	update := bson.M{
		"generatedCount":    newCount,
		"lastGeneratedAt":   now,
		"lastInvoiceNumber": number,
		"updatedAt":         now,
	}
	if advanceSchedule {
		next := advanceDate(p.NextRunDate, p.Frequency, p.Interval)
		update["nextRunDate"] = next
		// Complete the profile when the cap or end date is reached.
		if (p.MaxCount > 0 && newCount >= p.MaxCount) ||
			(p.EndDate != "" && next > p.EndDate) {
			update["status"] = "completed"
		}
		p.NextRunDate = next
	} else {
		// Manual run still respects the cap.
		if p.MaxCount > 0 && newCount >= p.MaxCount {
			update["status"] = "completed"
		}
	}
	p.GeneratedCount = newCount

	_, _ = recurringInvoiceCollection.UpdateOne(ctx, bson.M{"_id": p.ID}, bson.M{"$set": update})

	notifyOrgAdmins(ctx, p.OrgID,
		"recurring_invoice_generated",
		"Recurring invoice "+number+" generated",
		fmt.Sprintf("%s — %s %.2f", inv.BillTo.Name, inv.Currency, inv.Totals.GrandTotal),
		map[string]string{"invoiceId": inv.ID.Hex(), "invoiceNumber": number},
	)

	return inv, nil
}

// processRecurringInvoices is called by the daily scheduler. It generates every due
// run for each active profile whose NextRunDate has arrived, catching up on any
// missed cycles (bounded to avoid runaway loops if a profile is badly configured).
func processRecurringInvoices(ctx context.Context, todayStr string) {
	cursor, err := recurringInvoiceCollection.Find(ctx, bson.M{
		"status":      "active",
		"nextRunDate": bson.M{"$lte": todayStr, "$gt": ""},
	})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	var profiles []models.RecurringInvoice
	if err := cursor.All(ctx, &profiles); err != nil {
		return
	}

	for i := range profiles {
		p := profiles[i]
		// Generate each cycle that is due up to today (cap iterations defensively).
		for guard := 0; guard < 60; guard++ {
			if p.Status != "active" || p.NextRunDate == "" || p.NextRunDate > todayStr {
				break
			}
			if _, gerr := generateInvoiceFromProfile(ctx, &p, p.NextRunDate, true); gerr != nil {
				break
			}
			// generateInvoiceFromProfile may have marked it completed via the DB; reflect
			// that locally by re-reading status when the cap/end was hit.
			if (p.MaxCount > 0 && p.GeneratedCount >= p.MaxCount) ||
				(p.EndDate != "" && p.NextRunDate > p.EndDate) {
				p.Status = "completed"
			}
		}
	}
}
