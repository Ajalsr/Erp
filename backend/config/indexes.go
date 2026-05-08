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

		// Stocks / Items
		{collection: "stocks", keys: bson.D{{Key: "orgId", Value: 1}}, name: "orgId"},

		// Invoices
		{collection: "invoices", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},
		{collection: "invoices", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "createdAt", Value: -1}}, name: "orgId_createdAt"},

		// Bills
		{collection: "bills", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_status"},

		// Vendors
		{collection: "vendors", keys: bson.D{{Key: "orgId", Value: 1}}, name: "orgId"},

		// GRNs
		{collection: "grns", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "createdAt", Value: -1}}, name: "orgId_createdAt"},

		// Org members (used on every authenticated request by RequireOrg middleware)
		{collection: "org_members", keys: bson.D{{Key: "orgId", Value: 1}, {Key: "userId", Value: 1}, {Key: "status", Value: 1}}, name: "orgId_userId_status"},
	}

	for _, idx := range indexes {
		col := db.Collection(idx.collection)
		model := mongo.IndexModel{
			Keys: idx.keys,
			Options: options.Index().
				SetName(idx.name).
				SetBackground(true).
				SetUnique(idx.unique),
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
