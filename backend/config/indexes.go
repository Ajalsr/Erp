package config

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// EnsureIndexes creates all necessary MongoDB indexes for the ERP application.
// Call this once at startup from main.go before starting the HTTP server.
// Indexes are created with "background: true" so they don't block serving.
//
// Without these indexes every query scans the full collection.
// At 10k+ documents this causes noticeable slowdowns.
func EnsureIndexes(client *mongo.Client) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	db := client.Database("ERP")

	type indexDef struct {
		collection string
		keys       bson.D
		unique     bool
		sparse     bool
		name       string
	}

	indexes := []indexDef{
		// Sales Orders
		{collection: "sales_orders", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "createdAt", Value: -1}}, name: "orgId_createdAt"},
		{collection: "sales_orders", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},
		{collection: "sales_orders", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "orderNumber", Value: 1}}, name: "orgId_orderNumber"},

		// Purchase Orders
		{collection: "purchase_orders", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "createdAt", Value: -1}}, name: "orgId_createdAt"},
		{collection: "purchase_orders", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},

		// Customers
		{collection: "customers", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "customerCode", Value: 1}}, name: "orgId_customerCode"},
		{collection: "customers", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},
		{collection: "customers", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "created_at", Value: -1}}, name: "orgId_created_at"},

		// Stocks / Items
		{collection: "stocks", keys: bson.D{{Key: "orgId", Value: 1}}, name: "orgId"},

		// Invoices
		{collection: "invoices", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},
		{collection: "invoices", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "createdAt", Value: -1}}, name: "orgId_createdAt"},

		// Bills
		{collection: "bills", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},
		{collection: "bills", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "createdAt", Value: -1}}, name: "orgId_createdAt"},

		// Vendors
		{collection: "vendors", keys: bson.D{{Key: "orgId", Value: 1}}, name: "orgId"},

		// Payments received — summed on the dashboard (all-time + this-month).
		{collection: "payments", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "createdAt", Value: -1}}, name: "orgId_createdAt"},

		// Vendor payments — summed on the dashboard (all-time + this-month).
		{collection: "vendor_payments", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "createdAt", Value: -1}}, name: "orgId_createdAt"},

		// Quotes — grouped/summed on the dashboard.
		{collection: "quotes", keys: bson.D{{Key: "orgId", Value: 1}}, name: "orgId"},

		// GRNs
		{collection: "grns", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "createdAt", Value: -1}}, name: "orgId_createdAt"},

		// Credit Notes
		{collection: "credit_notes", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "createdAt", Value: -1}}, name: "orgId_createdAt"},
		{collection: "credit_notes", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},
		{collection: "credit_notes", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "creditNoteNumber", Value: -1}}, name: "orgId_creditNoteNumber"},
		{collection: "credit_notes", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "sourceDocId", Value: 1}}, name: "orgId_sourceDocId"},

		// Debit Notes
		{collection: "debit_notes", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "createdAt", Value: -1}}, name: "orgId_createdAt"},
		{collection: "debit_notes", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},
		{collection: "debit_notes", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "debitNoteNumber", Value: -1}}, name: "orgId_debitNoteNumber"},
		{collection: "debit_notes", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "sourceDocId", Value: 1}}, name: "orgId_sourceDocId"},

		// Org members (used on every authenticated request by RequireOrg middleware)
		{collection: "org_members", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "userId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_userId_status"},
		// Lookup by user — signin and GetUserOrganizations list a user's orgs by
		// userId (+status). The compound index above is orgId-first so it can't serve
		// a userId-first query; without this index that lookup is a full collection
		// scan (was the ~10s signin / post-login stall).
		{collection: "org_members", keys: bson.D{{Key: "userId", Value: 1}, {Key: "status", Value: 1}}, name: "userId_status"},

		// Employees
		{collection: "employees", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "employeeCode", Value: 1}}, name: "orgId_employeeCode"},
		{collection: "employees", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},
		{collection: "employees", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "reportsTo", Value: 1}}, name: "orgId_reportsTo"},

		// Payroll
		{collection: "salary_structures", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "employeeId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_employeeId_status"},
		{collection: "pay_runs", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},
		{collection: "payslips", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "payRunId", Value: 1}}, name: "orgId_payRunId"},
		{collection: "payslips", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "employeeId", Value: 1}}, name: "orgId_employeeId"},
		{collection: "payroll_schedules", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},
		{collection: "payroll_schedules", keys: bson.D{{Key: "status", Value: 1}, {Key: "nextRunDate", Value: 1}}, name: "status_nextRunDate"},

		// License keys — sparse because a pending self-serve request has no Code
		// yet (RequestLicense); without sparse, a plain unique index treats every
		// codeless doc as the same "null" value and the second pending request
		// ever submitted fails insert with a duplicate-key error.
		{collection: "licenses", keys: bson.D{{Key: "code", Value: 1}}, unique: true, sparse: true, name: "code_unique"},
		{collection: "organizations", keys: bson.D{{Key: "licenseKeyId", Value: 1}}, name: "licenseKeyId"},

		// Time-off
		{collection: "leave_types", keys: bson.D{{Key: "orgId", Value: 1}}, name: "orgId"},
		{collection: "leave_balances", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "employeeId", Value: 1}, {Key: "year", Value: 1}}, name: "orgId_employeeId_year"},
		{collection: "leave_requests", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "employeeId", Value: 1}}, name: "orgId_employeeId"},
		{collection: "leave_requests", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},
	}

	for _, idx := range indexes {
		col := db.Collection(idx.collection)
		model := mongo.IndexModel{
			Keys: idx.keys,
			Options: options.Index().
				SetName(idx.name).
				SetBackground(true).
				SetUnique(idx.unique).
				SetSparse(idx.sparse),
		}
		name, err := col.Indexes().CreateOne(ctx, model)
		if err != nil {
			// Log but don't fatal — existing indexes cause an error if options differ
			log.Printf("Index warning on %s.%s: %v", idx.collection, idx.name, err)
		} else {
			log.Printf("Index ensured: %s → %s", idx.collection, name)
		}
	}
}
