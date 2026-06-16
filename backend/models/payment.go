package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PaymentAllocation links part of one received payment to a single invoice. A payment
// may settle several invoices at once (one bank receipt → many invoices).
type PaymentAllocation struct {
	InvoiceID     string  `json:"invoiceId"     bson:"invoiceId"`
	InvoiceNumber string  `json:"invoiceNumber" bson:"invoiceNumber"`
	Amount        float64 `json:"amount"        bson:"amount"` // applied to this invoice (txn currency)
}

type Payment struct {
	ID            primitive.ObjectID `json:"_id,omitempty"          bson:"_id,omitempty"`
	PaymentNumber string             `json:"paymentNumber"          bson:"paymentNumber"`
	Date          string             `json:"date"                   bson:"date"`
	CustomerID    string             `json:"customerId"             bson:"customerId"`
	CustomerName  string             `json:"customerName"           bson:"customerName"`
	// InvoiceID/InvoiceNumber: single-invoice payments (legacy + simple case). For a
	// multi-invoice receipt these stay empty and Allocations holds the split.
	InvoiceID     string             `json:"invoiceId,omitempty"    bson:"invoiceId,omitempty"`
	InvoiceNumber string             `json:"invoiceNumber,omitempty" bson:"invoiceNumber,omitempty"`
	// Allocations: per-invoice split when one payment settles several invoices.
	Allocations   []PaymentAllocation `json:"allocations,omitempty" bson:"allocations,omitempty"`
	// ExcessCredit: amount received beyond all allocated invoices, moved to the
	// customer's credit wallet (and posted to Customer Advances).
	ExcessCredit  float64            `json:"excessCredit,omitempty" bson:"excessCredit,omitempty"`
	Amount        float64            `json:"amount"                 bson:"amount"` // total received
	PaymentMode   string             `json:"paymentMode"            bson:"paymentMode"` // cash|bank|cheque|card
	// DepositAccount: the cash/bank GL account the money was deposited to (account _id
	// or code). Empty → defaults to 1001 Cash on Hand. Resolved to a code for the JE.
	DepositAccount string            `json:"depositAccount,omitempty" bson:"depositAccount,omitempty"`
	Reference     string             `json:"reference,omitempty"    bson:"reference,omitempty"`
	// ReceiptNumber: mandatory receipt no. captured when recording the payment.
	ReceiptNumber string             `json:"receiptNumber,omitempty" bson:"receiptNumber,omitempty"`
	Notes         string             `json:"notes,omitempty"        bson:"notes,omitempty"`
	OrgID          string             `json:"orgId,omitempty"         bson:"orgId,omitempty"`
	IsRefunded     bool               `json:"isRefunded,omitempty"    bson:"isRefunded,omitempty"`
	RefundedAmount float64            `json:"refundedAmount,omitempty" bson:"refundedAmount,omitempty"`
	RefundedAt     time.Time          `json:"refundedAt,omitempty"    bson:"refundedAt,omitempty"`
	RefundReason   string             `json:"refundReason,omitempty"  bson:"refundReason,omitempty"`
	CreatedAt      time.Time          `json:"createdAt"               bson:"createdAt"`
	UpdatedAt      time.Time          `json:"updatedAt"               bson:"updatedAt"`
	CreatedBy      string             `json:"createdBy,omitempty"     bson:"createdBy,omitempty"`
}
