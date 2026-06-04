package controllers

import (
	"context"
	"math"

	"github.com/backend/config"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// defaultWarehouse returns (id, name) of the org's default warehouse — the one flagged
// isDefault, else the first warehouse found. Empty strings if none exist.
func defaultWarehouse(ctx context.Context, orgID string) (string, string) {
	wcol := config.GetCollection(config.DB, "warehouses")
	var w struct {
		ID   primitive.ObjectID `bson:"_id"`
		Name string             `bson:"name"`
	}
	if err := wcol.FindOne(ctx, bson.M{"orgId": orgID, "isDefault": true}).Decode(&w); err == nil {
		return w.ID.Hex(), w.Name
	}
	if err := wcol.FindOne(ctx, bson.M{"orgId": orgID}).Decode(&w); err == nil {
		return w.ID.Hex(), w.Name
	}
	return "", ""
}

// seedWarehouseMap ensures a legacy item (no breakdown yet) starts with its whole
// on-hand total parked in the default warehouse, so the per-warehouse view matches the
// authoritative total. No-op once a breakdown exists.
func seedWarehouseMap(m map[string]float64, total float64, defaultWh string) map[string]float64 {
	if m == nil {
		m = map[string]float64{}
	}
	if len(m) == 0 && total > 0 && defaultWh != "" {
		m[defaultWh] = total
	}
	return m
}

// addToWarehouse credits qty to a warehouse bucket.
func addToWarehouse(m map[string]float64, wh string, qty float64) map[string]float64 {
	if m == nil {
		m = map[string]float64{}
	}
	if wh == "" || qty == 0 {
		return m
	}
	m[wh] += qty
	return m
}

// deductWarehouses removes qty, draining the default warehouse first then the rest.
// Used for outbound (sales/delivery) where no explicit source warehouse is chosen.
func deductWarehouses(m map[string]float64, defaultWh string, qty float64) map[string]float64 {
	if m == nil || qty <= 0 {
		return m
	}
	remaining := qty
	order := []string{}
	if defaultWh != "" {
		order = append(order, defaultWh)
	}
	for k := range m {
		if k != defaultWh {
			order = append(order, k)
		}
	}
	for _, k := range order {
		if remaining <= 0 {
			break
		}
		take := math.Min(m[k], remaining)
		if take > 0 {
			m[k] -= take
			remaining -= take
		}
	}
	return m
}
