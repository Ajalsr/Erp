package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type StockAdjustment struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	ItemID      string             `json:"itemId"        bson:"itemId"`
	ItemName    string             `json:"itemName"      bson:"itemName"`
	ItemCode    string             `json:"itemCode"      bson:"itemCode"`
	Type        string             `json:"type"          bson:"type"`        // "increase" | "decrease"
	Quantity    float64            `json:"quantity"      bson:"quantity"`
	PreviousQty float64            `json:"previousQty"   bson:"previousQty"`
	NewQty      float64            `json:"newQty"        bson:"newQty"`
	Reason      string             `json:"reason"        bson:"reason"`      // damaged | expired | found | correction | return | other
	Notes       string             `json:"notes"         bson:"notes"`
	Reference   string             `json:"reference"     bson:"reference"`
	AdjustedAt  time.Time          `json:"adjustedAt"    bson:"adjustedAt"`

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
