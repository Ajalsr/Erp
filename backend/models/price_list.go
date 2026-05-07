package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PriceListItem struct {
	ItemID    string  `json:"itemId"    bson:"itemId"`
	ItemName  string  `json:"itemName"  bson:"itemName"`
	ItemCode  string  `json:"itemCode"  bson:"itemCode"`
	BasePrice float64 `json:"basePrice" bson:"basePrice"`
	Price     float64 `json:"price"     bson:"price"` // final override price
}

type PriceList struct {
	ID             primitive.ObjectID `json:"_id,omitempty"        bson:"_id,omitempty"`
	Name           string             `json:"name"                 bson:"name"`
	Description    string             `json:"description"          bson:"description"`
	Currency       string             `json:"currency"             bson:"currency"` // AED | USD | EUR
	AdjustmentType string             `json:"adjustmentType"       bson:"adjustmentType"` // "percentage" | "fixed"
	Adjustment     float64            `json:"adjustment"           bson:"adjustment"`     // % or flat amount above base
	Items          []PriceListItem    `json:"items,omitempty"      bson:"items,omitempty"`
	ValidFrom      *time.Time         `json:"validFrom,omitempty"  bson:"validFrom,omitempty"`
	ValidTo        *time.Time         `json:"validTo,omitempty"    bson:"validTo,omitempty"`
	IsDefault      bool               `json:"isDefault"            bson:"isDefault"`
	Status         string             `json:"status"               bson:"status"` // active | inactive

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
