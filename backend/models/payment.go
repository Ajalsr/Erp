package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Payment struct {
	ID            primitive.ObjectID `json:"_id,omitempty"          bson:"_id,omitempty"`
	PaymentNumber string             `json:"paymentNumber"          bson:"paymentNumber"`
	Date          string             `json:"date"                   bson:"date"`
	CustomerID    string             `json:"customerId"             bson:"customerId"`
	CustomerName  string             `json:"customerName"           bson:"customerName"`
	InvoiceID     string             `json:"invoiceId,omitempty"    bson:"invoiceId,omitempty"`
	InvoiceNumber string             `json:"invoiceNumber,omitempty" bson:"invoiceNumber,omitempty"`
	Amount        float64            `json:"amount"                 bson:"amount"`
	PaymentMode   string             `json:"paymentMode"            bson:"paymentMode"` // cash|bank|cheque|card
	Reference     string             `json:"reference,omitempty"    bson:"reference,omitempty"`
	Notes         string             `json:"notes,omitempty"        bson:"notes,omitempty"`
	OrgID         string             `json:"orgId,omitempty"        bson:"orgId,omitempty"`
	CreatedAt     time.Time          `json:"createdAt"              bson:"createdAt"`
	UpdatedAt     time.Time          `json:"updatedAt"              bson:"updatedAt"`
	CreatedBy     string             `json:"createdBy,omitempty"    bson:"createdBy,omitempty"`
}
