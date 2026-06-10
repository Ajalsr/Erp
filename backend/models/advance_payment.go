package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AdvanceAllocation records each time an advance is applied to an invoice.
type AdvanceAllocation struct {
	InvoiceID     string    `json:"invoiceId"     bson:"invoiceId"`
	InvoiceNumber string    `json:"invoiceNumber" bson:"invoiceNumber"`
	Amount        float64   `json:"amount"        bson:"amount"`
	Date          string    `json:"date"          bson:"date"`
	AppliedAt     time.Time `json:"appliedAt"     bson:"appliedAt"`
}

// AdvancePayment — money received from a customer before an invoice exists.
// Posted to a liability account (Customer Advances), NOT Accounts Receivable.
type AdvancePayment struct {
	ID              primitive.ObjectID  `json:"_id,omitempty"     bson:"_id,omitempty"`
	AdvanceNumber   string              `json:"advanceNumber"     bson:"advanceNumber"`
	Date            string              `json:"date"              bson:"date"`
	CustomerID      string              `json:"customerId"        bson:"customerId"`
	CustomerName    string              `json:"customerName"      bson:"customerName"`
	SalesOrderID    string              `json:"salesOrderId,omitempty"     bson:"salesOrderId,omitempty"`
	SalesOrderNumber string             `json:"salesOrderNumber,omitempty" bson:"salesOrderNumber,omitempty"`
	Amount          float64             `json:"amount"            bson:"amount"`
	AllocatedAmount float64             `json:"allocatedAmount"   bson:"allocatedAmount"`
	RemainingAmount float64             `json:"remainingAmount"   bson:"remainingAmount"`
	PaymentMode     string              `json:"paymentMode"       bson:"paymentMode"`
	// DepositAccount: cash/bank GL account (id or code) the advance was deposited to.
	// Empty → falls back to the mode-derived account (bankAccountCode).
	DepositAccount  string              `json:"depositAccount,omitempty" bson:"depositAccount,omitempty"`
	Reference       string              `json:"reference,omitempty" bson:"reference,omitempty"`
	Notes           string              `json:"notes,omitempty"   bson:"notes,omitempty"`
	Status          string              `json:"status"            bson:"status"` // unallocated | partial | applied
	Allocations     []AdvanceAllocation `json:"allocations,omitempty" bson:"allocations,omitempty"`
	OrgID           string              `json:"orgId,omitempty"   bson:"orgId,omitempty"`
	CreatedBy       string              `json:"createdBy,omitempty" bson:"createdBy,omitempty"`
	CreatedAt       time.Time           `json:"createdAt"         bson:"createdAt"`
	UpdatedAt       time.Time           `json:"updatedAt"         bson:"updatedAt"`
}
