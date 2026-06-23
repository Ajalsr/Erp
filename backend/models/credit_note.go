package models

import "time"

// CreditNote is raised against a customer invoice to reduce the AR balance.
// Status flow: draft → pending_approval → approved → applied → closed
// (void is allowed from draft/pending_approval/approved)
type CreditNote struct {
	ID               string `json:"_id,omitempty" bson:"_id,omitempty"`
	CreditNoteNumber string `json:"creditNoteNumber" bson:"creditNoteNumber"`

	// Source document (always an invoice for a credit note)
	SourceDocID     string `json:"sourceDocId,omitempty"     bson:"sourceDocId,omitempty"`
	SourceDocType   string `json:"sourceDocType,omitempty"   bson:"sourceDocType,omitempty"` // "invoice"
	SourceDocNumber string `json:"sourceDocNumber,omitempty" bson:"sourceDocNumber,omitempty"`

	// Customer
	CustomerID   string `json:"customerId"   bson:"customerId"`
	CustomerName string `json:"customerName" bson:"customerName"`

	CnType       string       `json:"cnType,omitempty" bson:"cnType,omitempty"` // return_of_goods | price_adjustment | billing_error | service_not_delivered | courtesy_credit | other
	Date         string       `json:"date"         bson:"date"`
	Reason       string       `json:"reason"       bson:"reason"`
	LineItems    []CNLineItem `json:"lineItems"    bson:"lineItems"`
	Totals       CNTotals     `json:"totals"       bson:"totals"`
	VATBreakdown []VATLine    `json:"vatBreakdown" bson:"vatBreakdown"`

	// Status: draft | pending_approval | approved | closed | void
	Status string `json:"status" bson:"status"`

	// Balance tracking (set on approval, decremented on each partial apply/refund)
	RemainingAmount float64 `json:"remainingAmount" bson:"remainingAmount"`
	AppliedAmount   float64 `json:"appliedAmount"   bson:"appliedAmount"`
	RefundedAmount  float64 `json:"refundedAmount"  bson:"refundedAmount"`

	// GLPosted guards the return journal entry + restock from double-posting across
	// the create / approve / void transitions.
	GLPosted bool `json:"glPosted" bson:"glPosted"`

	Notes     string    `json:"notes,omitempty" bson:"notes,omitempty"`
	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
