package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// VendorPaymentAllocation links part of one payment to a single bill. A payment
// may settle several bills at once (one bank payment → many bills).
type VendorPaymentAllocation struct {
	BillID     string  `json:"billId"     bson:"billId"`
	BillNumber string  `json:"billNumber" bson:"billNumber"`
	Amount     float64 `json:"amount"     bson:"amount"` // applied to this bill (txn currency)
}

type VendorPayment struct {
	ID            primitive.ObjectID `json:"_id,omitempty"          bson:"_id,omitempty"`
	PaymentNumber string             `json:"paymentNumber"          bson:"paymentNumber"`
	Date          string             `json:"date"                   bson:"date"`

	// Vendor
	VendorID   string `json:"vendorId"   bson:"vendorId"`
	VendorName string `json:"vendorName" bson:"vendorName"`

	// Linked bill (optional) — single-bill payments (legacy + simple case). For a
	// multi-bill payment these stay empty and Allocations holds the split.
	BillID     string `json:"billId,omitempty"     bson:"billId,omitempty"`
	BillNumber string `json:"billNumber,omitempty" bson:"billNumber,omitempty"`

	// Allocations: per-bill split when one payment settles several bills.
	Allocations []VendorPaymentAllocation `json:"allocations,omitempty" bson:"allocations,omitempty"`
	// ExcessCredit: amount paid beyond all allocated bills, moved to the vendor's
	// creditAvailable wallet (and posted to Vendor Advances 1350).
	ExcessCredit float64 `json:"excessCredit,omitempty" bson:"excessCredit,omitempty"`

	Amount      float64 `json:"amount"               bson:"amount"`
	PaymentMode string  `json:"paymentMode"          bson:"paymentMode"` // Cash | Bank Transfer | Cheque | Card | Other
	// PaidThroughAccount: the cash/bank GL account the money was paid from (account _id
	// or code). Empty → defaults to 1001 Cash on Hand. Resolved to a code for the JE.
	PaidThroughAccount string `json:"paidThroughAccount,omitempty" bson:"paidThroughAccount,omitempty"`
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
