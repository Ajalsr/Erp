package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CreditNote is raised against a previously issued invoice to reduce the
// customer's balance — e.g. for returns, pricing errors, or goodwill adjustments.
// Status flow: draft → issued → applied | void
type CreditNote struct {
	ID               primitive.ObjectID `json:"_id,omitempty"          bson:"_id,omitempty"`
	CreditNoteNumber string             `json:"creditNoteNumber"       bson:"creditNoteNumber"`
	InvoiceID        string             `json:"invoiceId,omitempty"    bson:"invoiceId,omitempty"`
	InvoiceNumber    string             `json:"invoiceNumber,omitempty" bson:"invoiceNumber,omitempty"`
	CustomerID       string             `json:"customerId"             bson:"customerId"`
	CustomerName     string             `json:"customerName"           bson:"customerName"`
	Date             string             `json:"date"                   bson:"date"`
	Reason           string             `json:"reason"                 bson:"reason"`
	LineItems        []InvoiceLineItem  `json:"lineItems"              bson:"lineItems"`
	Totals           InvoiceTotals      `json:"totals"                 bson:"totals"`
	Status           string             `json:"status"                 bson:"status"` // draft | issued | applied | void
	OrgID            string             `json:"orgId,omitempty"        bson:"orgId,omitempty"`
	CreatedAt        time.Time          `json:"createdAt"              bson:"createdAt"`
	UpdatedAt        time.Time          `json:"updatedAt"              bson:"updatedAt"`
	CreatedBy        string             `json:"createdBy"              bson:"createdBy"`
}
