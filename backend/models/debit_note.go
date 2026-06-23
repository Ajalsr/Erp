package models

import "time"

// DebitNote is raised against a vendor bill to reduce the AP balance.
// Status flow: draft → pending_approval → approved → applied → closed
// (void is allowed from draft/pending_approval/approved)
type DebitNote struct {
	ID              string `json:"_id,omitempty" bson:"_id,omitempty"`
	DebitNoteNumber string `json:"debitNoteNumber" bson:"debitNoteNumber"`

	// Source document (always a bill for a debit note)
	SourceDocID     string `json:"sourceDocId,omitempty"     bson:"sourceDocId,omitempty"`
	SourceDocType   string `json:"sourceDocType,omitempty"   bson:"sourceDocType,omitempty"` // "bill"
	SourceDocNumber string `json:"sourceDocNumber,omitempty" bson:"sourceDocNumber,omitempty"`

	// Vendor / Supplier
	VendorID   string `json:"vendorId"   bson:"vendorId"`
	VendorName string `json:"vendorName" bson:"vendorName"`

	Date         string       `json:"date"         bson:"date"`
	Reason       string       `json:"reason"       bson:"reason"`
	LineItems    []CNLineItem `json:"lineItems"    bson:"lineItems"`
	Totals       CNTotals     `json:"totals"       bson:"totals"`
	VATBreakdown []VATLine    `json:"vatBreakdown" bson:"vatBreakdown"`

	// Status: draft | pending_approval | approved | closed | void
	Status string `json:"status" bson:"status"`

	// Balance tracking (mirrors CN pattern for partial apply)
	RemainingAmount float64 `json:"remainingAmount" bson:"remainingAmount"`
	AppliedAmount   float64 `json:"appliedAmount"   bson:"appliedAmount"`

	// GLPosted guards the return journal entry from double-posting across the
	// create / approve / void transitions.
	GLPosted bool `json:"glPosted" bson:"glPosted"`

	Notes     string    `json:"notes,omitempty" bson:"notes,omitempty"`
	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
