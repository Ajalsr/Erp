package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Expense is a fast, single-amount spend record (salary, petrol, rent, etc.) paid
// immediately out of a cash/bank account. Unlike a vendor Bill it needs no vendor,
// no line items, and no payment-tracking — it posts a one-shot journal entry:
//
//	Dr  Expense account   (net)
//	Dr  VAT Input (5500)   (recoverable tax, if any)
//	Cr  Paid-through account (cash/bank, total)
//
// It flows into Profit & Loss / Trial Balance through that journal entry, exactly
// like a non-GRN expense bill.
type Expense struct {
	ID            primitive.ObjectID `json:"_id,omitempty"  bson:"_id,omitempty"`
	ExpenseNumber string             `json:"expenseNumber"  bson:"expenseNumber"`
	Date          string             `json:"date"           bson:"date"`

	// ExpenseAccount: GL account the spend is booked to (id from the dropdown or a
	// raw account code). Resolved to a code at posting time. Required.
	ExpenseAccount     string `json:"expenseAccount"     bson:"expenseAccount"`
	ExpenseAccountName string `json:"expenseAccountName" bson:"expenseAccountName"`

	// Paid: true → settled immediately from a cash/bank account (Cr Paid-through).
	// false → unpaid/accrued; credits Accounts Payable (2000) instead.
	Paid bool `json:"paid" bson:"paid"`

	// PaidThrough: the cash/bank GL account the money left from (id or code).
	// Required only when Paid is true; ignored for unpaid expenses.
	PaidThrough     string `json:"paidThrough"     bson:"paidThrough"`
	PaidThroughName string `json:"paidThroughName" bson:"paidThroughName"`

	// Optional free-text payee (e.g. "ENOC", "Driver salary - May"). Not a vendor.
	Payee     string `json:"payee,omitempty"     bson:"payee,omitempty"`
	Reference string `json:"reference,omitempty" bson:"reference,omitempty"` // receipt / cheque no.

	// Money: Amount is the net (pre-VAT) spend. TaxAmount derived from TaxRate.
	Amount    float64 `json:"amount"    bson:"amount"`
	TaxRate   float64 `json:"taxRate"   bson:"taxRate"`
	TaxAmount float64 `json:"taxAmount" bson:"taxAmount"`
	Total     float64 `json:"total"     bson:"total"`

	Notes string `json:"notes,omitempty" bson:"notes,omitempty"`

	// Status: recorded | void
	Status string `json:"status" bson:"status"`

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
