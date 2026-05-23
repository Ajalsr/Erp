package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type VendorPayment struct {
	ID            primitive.ObjectID `json:"_id,omitempty"          bson:"_id,omitempty"`
	PaymentNumber string             `json:"paymentNumber"          bson:"paymentNumber"`
	Date          string             `json:"date"                   bson:"date"`

	// Vendor
	VendorID   string `json:"vendorId"   bson:"vendorId"`
	VendorName string `json:"vendorName" bson:"vendorName"`

	// Linked bill (optional)
	BillID     string `json:"billId,omitempty"     bson:"billId,omitempty"`
	BillNumber string `json:"billNumber,omitempty" bson:"billNumber,omitempty"`

	Amount      float64 `json:"amount"               bson:"amount"`
	PaymentMode string  `json:"paymentMode"          bson:"paymentMode"` // Cash | Bank Transfer | Cheque | Card | Other
	Reference   string  `json:"reference,omitempty"  bson:"reference,omitempty"`
	Notes       string  `json:"notes,omitempty"      bson:"notes,omitempty"`

	// Reversal
	IsReversed    bool   `json:"isReversed,omitempty"    bson:"isReversed,omitempty"`
	ReversedAt    string `json:"reversedAt,omitempty"    bson:"reversedAt,omitempty"`
	ReversalNotes string `json:"reversalNotes,omitempty" bson:"reversalNotes,omitempty"`

	// Org + Audit
	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
