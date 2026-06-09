package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ExchangeRate is one manually-entered (or synced) FX quote for an org:
// 1 unit of FromCurrency = Rate units of ToCurrency, effective on AsOfDate.
// ToCurrency is normally the org base currency. The FX helper picks the latest
// quote with AsOfDate <= the transaction date.
type ExchangeRate struct {
	ID           primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	OrgID        string             `json:"orgId"         bson:"orgId"`
	FromCurrency string             `json:"fromCurrency"  bson:"fromCurrency"` // ISO 4217, e.g. "USD"
	ToCurrency   string             `json:"toCurrency"    bson:"toCurrency"`   // ISO 4217, e.g. "AED"
	Rate         float64            `json:"rate"          bson:"rate"`         // 1 From = Rate To
	AsOfDate     string             `json:"asOfDate"      bson:"asOfDate"`     // YYYY-MM-DD
	CreatedBy    string             `json:"createdBy"     bson:"createdBy"`
	CreatedAt    time.Time          `json:"createdAt"     bson:"createdAt"`
}
