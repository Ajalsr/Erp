package controllers

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/backend/models"
	"github.com/backend/utils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// StartInvoiceScheduler runs due-date checks once at startup then every 24 hours.
func StartInvoiceScheduler() {
	go func() {
		runDueDateChecks()
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			runDueDateChecks()
		}
	}()
}

func runDueDateChecks() {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	now := time.Now()
	todayStr := now.Format("2006-01-02")
	threeDaysStr := now.AddDate(0, 0, 3).Format("2006-01-02")

	// Invoices due in exactly 3 days — "due soon" alert
	processDueSoon(ctx, threeDaysStr)

	// Invoices past due date — mark overdue + escalating reminders
	processOverdue(ctx, todayStr, now)

	// Expire quotes whose validUntil date has passed
	processExpiredQuotes(ctx, todayStr)

	// Generate invoices for recurring profiles whose next run date has arrived
	processRecurringInvoices(ctx, todayStr)

	// Enquiries whose follow-up date is today — remind the team
	processEnquiryFollowUps(ctx, todayStr)
}

// processEnquiryFollowUps notifies org admins/owners about enquiries due for follow-up
// today (or overdue and not yet reminded). Fires at most once per follow-up date.
func processEnquiryFollowUps(ctx context.Context, todayStr string) {
	cursor, err := enquiryCollection.Find(ctx, bson.M{
		"followUpDate": bson.M{"$lte": todayStr, "$gt": ""},
		"status":       bson.M{"$nin": []string{"converted", "won", "lost", "closed", "cancelled"}},
		"followUpReminderDate": bson.M{"$ne": todayStr},
	})
	if err != nil {
		log.Printf("[scheduler] enquiry follow-up query error: %v", err)
		return
	}
	defer cursor.Close(ctx)

	var enquiries []models.Enquiry
	cursor.All(ctx, &enquiries)

	for _, e := range enquiries {
		overdue := e.FollowUpDate < todayStr
		title := "Enquiry follow-up due today"
		if overdue {
			title = "Enquiry follow-up overdue"
		}
		who := e.CustomerName
		if e.ProjectName != "" {
			who = e.CustomerName + " (" + e.ProjectName + ")"
		}
		msg := fmt.Sprintf("%s — %s. Follow-up was %s", e.EnquiryNumber, who, e.FollowUpDate)
		if e.AssignedTo != "" {
			msg += " · assigned to " + e.AssignedTo
		}
		notifyOrgAdmins(ctx, e.OrgID, "enquiry_followup", title, msg,
			map[string]string{"enquiryId": e.ID.Hex(), "enquiryNumber": e.EnquiryNumber})

		enquiryCollection.UpdateOne(ctx, bson.M{"_id": e.ID},
			bson.M{"$set": bson.M{"followUpReminderDate": todayStr}})
	}
}

func processDueSoon(ctx context.Context, threeDaysStr string) {
	cursor, err := invoiceCollection.Find(ctx, bson.M{
		"dueDate":          threeDaysStr,
		"status":           bson.M{"$in": []string{"unpaid", "partial"}},
		"dueSoonAlertSent": bson.M{"$ne": true},
		"type":             bson.M{"$ne": "proforma"},
	})
	if err != nil {
		log.Printf("[scheduler] due-soon query error: %v", err)
		return
	}
	defer cursor.Close(ctx)

	var invoices []models.Invoice
	cursor.All(ctx, &invoices)

	for _, inv := range invoices {
		// Send email to customer
		toEmail := fetchCustomerEmail(ctx, inv.CustomerID)
		if toEmail != "" {
			msg := fmt.Sprintf("Your invoice %s is due in 3 days on %s. Please arrange payment of %s %.2f.",
				inv.InvoiceNumber, inv.DueDate, inv.Currency, inv.BalanceDue)
			if err := utils.SendInvoiceEmail(toEmail, inv, msg, false); err != nil {
				log.Printf("[scheduler] due-soon email failed for %s: %v", inv.InvoiceNumber, err)
			}
		}

		// Push in-app notification to org admins/owners
		notifyOrgAdmins(ctx, inv.OrgID,
			"invoice_due_soon",
			fmt.Sprintf("Invoice %s Due in 3 Days", inv.InvoiceNumber),
			fmt.Sprintf("%s owes %s %.2f — due on %s", inv.BillTo.Name, inv.Currency, inv.BalanceDue, inv.DueDate),
			map[string]string{"invoiceId": inv.ID.Hex(), "invoiceNumber": inv.InvoiceNumber},
		)

		// Mark alert sent
		invoiceCollection.UpdateOne(ctx,
			bson.M{"_id": inv.ID},
			bson.M{"$set": bson.M{"dueSoonAlertSent": true}},
		)
	}
}

func processOverdue(ctx context.Context, todayStr string, now time.Time) {
	sevenDaysAgo := now.AddDate(0, 0, -7)

	// Match invoices that are overdue and haven't been reminded in the last 7 days
	cursor, err := invoiceCollection.Find(ctx, bson.M{
		"dueDate": bson.M{"$lt": todayStr, "$gt": ""},
		"status":  bson.M{"$in": []string{"unpaid", "partial", "overdue"}},
		"type":    bson.M{"$ne": "proforma"},
		"$or": []bson.M{
			{"lastOverdueReminderAt": bson.M{"$exists": false}},
			{"lastOverdueReminderAt": nil},
			{"lastOverdueReminderAt": bson.M{"$lt": sevenDaysAgo}},
		},
	})
	if err != nil {
		log.Printf("[scheduler] overdue query error: %v", err)
		return
	}
	defer cursor.Close(ctx)

	var invoices []models.Invoice
	cursor.All(ctx, &invoices)

	for _, inv := range invoices {
		daysOverdue := 0
		if due, perr := time.Parse("2006-01-02", inv.DueDate); perr == nil {
			daysOverdue = int(now.Sub(due).Hours() / 24)
		}

		invoiceCollection.UpdateOne(ctx,
			bson.M{"_id": inv.ID},
			bson.M{"$set": bson.M{
				"status":                "overdue",
				"overdueAlertSent":      true,
				"lastOverdueReminderAt": now,
				"updatedAt":             now,
			}},
		)

		toEmail := fetchCustomerEmail(ctx, inv.CustomerID)
		if toEmail != "" {
			// Escalating dunning message based on how long overdue
			var msg string
			switch {
			case daysOverdue >= 30:
				msg = fmt.Sprintf("URGENT: Invoice %s is %d days overdue. Amount %.2f %s. Please contact us immediately to avoid further action.", inv.InvoiceNumber, daysOverdue, inv.BalanceDue, inv.Currency)
			case daysOverdue >= 14:
				msg = fmt.Sprintf("Second reminder: Invoice %s is now %d days past due. Outstanding balance: %.2f %s.", inv.InvoiceNumber, daysOverdue, inv.BalanceDue, inv.Currency)
			default:
				msg = fmt.Sprintf("Invoice %s is overdue. Outstanding balance: %.2f %s. Due date was %s.", inv.InvoiceNumber, inv.BalanceDue, inv.Currency, inv.DueDate)
			}
			if err := utils.SendInvoiceEmail(toEmail, inv, msg, true); err != nil {
				log.Printf("[scheduler] overdue email failed for %s: %v", inv.InvoiceNumber, err)
			}
		}

		if !inv.OverdueAlertSent {
			notifyOrgAdmins(ctx, inv.OrgID,
				"invoice_overdue",
				fmt.Sprintf("Invoice %s is Overdue", inv.InvoiceNumber),
				fmt.Sprintf("%s — %s %.2f overdue since %s", inv.BillTo.Name, inv.Currency, inv.BalanceDue, inv.DueDate),
				map[string]string{"invoiceId": inv.ID.Hex(), "invoiceNumber": inv.InvoiceNumber},
			)
		}
	}
}

func fetchCustomerEmail(ctx context.Context, customerID string) string {
	if customerID == "" {
		return ""
	}
	custObjID, err := primitive.ObjectIDFromHex(customerID)
	if err != nil {
		return ""
	}
	var cust models.Customer
	if err := customersCollection.FindOne(ctx, bson.M{"_id": custObjID}).Decode(&cust); err != nil {
		return ""
	}
	return cust.CustomerEmail
}

// processExpiredQuotes sets status="expired" on quotes whose validUntil date has passed.
func processExpiredQuotes(ctx context.Context, todayStr string) {
	result, err := quoteCollection.UpdateMany(ctx,
		bson.M{
			"validUntil": bson.M{"$lt": todayStr, "$gt": ""},
			"status":     bson.M{"$in": []string{"draft", "sent"}},
		},
		bson.M{"$set": bson.M{"status": "expired", "updatedAt": time.Now()}},
	)
	if err != nil {
		log.Printf("[scheduler] expire-quotes error: %v", err)
		return
	}
	if result.ModifiedCount > 0 {
		log.Printf("[scheduler] expired %d quotes", result.ModifiedCount)
	}
}

func notifyOrgAdmins(ctx context.Context, orgID, notifType, title, message string, metadata map[string]string) {
	if orgID == "" {
		return
	}
	cursor, err := orgMemberCollection.Find(ctx, bson.M{
		"orgId":  orgID,
		"status": "active",
		"role":   bson.M{"$in": []string{"owner", "admin"}},
	})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	var members []models.OrgMember
	cursor.All(ctx, &members)
	for _, m := range members {
		go pushNotificationWithMeta(m.UserID, notifType, title, message, orgID, "", metadata)
	}
}
