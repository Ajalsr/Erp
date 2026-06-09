package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RecurringInvoice is a template + schedule that the invoice scheduler uses to mint
// real invoices on a cadence (weekly/monthly/quarterly/yearly). The Template fields
// mirror the parts of Invoice needed to build one; each generated invoice is a normal
// independent Invoice document (so all existing invoice flows — payments, PDF, JE,
// stock — work unchanged).
type RecurringInvoice struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	ProfileName string             `json:"profileName"   bson:"profileName"` // e.g. "Acme — monthly retainer"
	Status      string             `json:"status"        bson:"status"`      // active | paused | completed

	// Schedule
	Frequency string `json:"frequency" bson:"frequency"` // weekly | monthly | quarterly | yearly
	Interval  int    `json:"interval"  bson:"interval"`  // every N periods (>=1)
	StartDate string `json:"startDate" bson:"startDate"` // YYYY-MM-DD — first issue date
	EndDate   string `json:"endDate"   bson:"endDate"`   // YYYY-MM-DD or "" (no end)
	MaxCount  int    `json:"maxCount"  bson:"maxCount"`  // cap on invoices generated; 0 = unlimited

	// Runtime bookkeeping
	NextRunDate       string     `json:"nextRunDate"       bson:"nextRunDate"` // YYYY-MM-DD scheduler matches on
	GeneratedCount    int        `json:"generatedCount"    bson:"generatedCount"`
	LastGeneratedAt   *time.Time `json:"lastGeneratedAt,omitempty"   bson:"lastGeneratedAt,omitempty"`
	LastInvoiceNumber string     `json:"lastInvoiceNumber,omitempty" bson:"lastInvoiceNumber,omitempty"`

	// Invoice shaping
	NumberPrefix string `json:"numberPrefix" bson:"numberPrefix"` // e.g. "INV-2026" → "INV-2026-0001"
	DueDays      int    `json:"dueDays"      bson:"dueDays"`      // dueDate = issueDate + DueDays
	AutoSend     bool   `json:"autoSend"     bson:"autoSend"`     // email customer on generation

	// Template payload (same shapes as Invoice)
	CustomerID   string            `json:"customerId"   bson:"customerId"`
	Currency     string            `json:"currency"     bson:"currency"`
	PaymentTerms string            `json:"paymentTerms" bson:"paymentTerms"`
	From         InvoiceParty      `json:"from"         bson:"from"`
	BillTo       InvoiceParty      `json:"billTo"       bson:"billTo"`
	LineItems    []InvoiceLineItem `json:"lineItems"    bson:"lineItems"`
	Totals       InvoiceTotals     `json:"totals"       bson:"totals"`
	Notes        InvoiceNotes      `json:"notes"        bson:"notes"`

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
}
