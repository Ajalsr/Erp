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

	// Invoices past due date — mark overdue + send reminder
	processOverdue(ctx, todayStr)
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

func processOverdue(ctx context.Context, todayStr string) {
	sevenDaysAgo := time.Now().AddDate(0, 0, -7)

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

	now := time.Now()
	for _, inv := range invoices {
		// Mark overdue status + record reminder timestamp
		invoiceCollection.UpdateOne(ctx,
			bson.M{"_id": inv.ID},
			bson.M{"$set": bson.M{
				"status":                "overdue",
				"overdueAlertSent":      true,
				"lastOverdueReminderAt": now,
				"updatedAt":             now,
			}},
		)

		// Send overdue reminder email to customer
		toEmail := fetchCustomerEmail(ctx, inv.CustomerID)
		if toEmail != "" {
			if err := utils.SendInvoiceEmail(toEmail, inv, "", true); err != nil {
				log.Printf("[scheduler] overdue email failed for %s: %v", inv.InvoiceNumber, err)
			}
		}

		// Push in-app notification to org admins/owners (first time only)
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
