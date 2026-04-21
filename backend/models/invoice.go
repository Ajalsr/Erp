package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type InvoiceLineItem struct {
	ID        primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Desc      string             `json:"desc"      bson:"desc"`
	Qty       float64            `json:"qty"       bson:"qty"`
	UnitPrice float64            `json:"unitPrice" bson:"unitPrice"`
	Discount  float64            `json:"discount"  bson:"discount"`
	TaxRate   float64            `json:"taxRate"   bson:"taxRate"`
	Subtotal  float64            `json:"subtotal"  bson:"subtotal"`
	DiscAmt   float64            `json:"discAmt"   bson:"discAmt"`
	TaxAmt    float64            `json:"taxAmt"    bson:"taxAmt"`
	Total     float64            `json:"total"     bson:"total"`
}

type InvoiceTotals struct {
	Subtotal      float64 `json:"subtotal"      bson:"subtotal"`
	DiscountTotal float64 `json:"discountTotal" bson:"discountTotal"`
	TaxTotal      float64 `json:"taxTotal"      bson:"taxTotal"`
	GrandTotal    float64 `json:"grandTotal"    bson:"grandTotal"`
}

type InvoiceParty struct {
	Name    string `json:"name"    bson:"name"`
	Address string `json:"address" bson:"address"`
	TRN     string `json:"trn"     bson:"trn"`
}

type InvoiceNotes struct {
	Customer string `json:"customer" bson:"customer"`
	Internal string `json:"internal" bson:"internal"`
}

type Invoice struct {
	ID            primitive.ObjectID `json:"_id,omitempty"    bson:"_id,omitempty"`
	InvoiceNumber string             `json:"invoiceNumber"    bson:"invoiceNumber"`
	IssueDate     string             `json:"issueDate"        bson:"issueDate"`
	DueDate       string             `json:"dueDate"          bson:"dueDate"`
	Currency      string             `json:"currency"         bson:"currency"`
	PaymentTerms  string             `json:"paymentTerms"     bson:"paymentTerms"`
	From          InvoiceParty       `json:"from"             bson:"from"`
	BillTo        InvoiceParty       `json:"billTo"           bson:"billTo"`
	CustomerID    string             `json:"customerId"       bson:"customerId"`
	LineItems     []InvoiceLineItem  `json:"lineItems"        bson:"lineItems"`
	Totals        InvoiceTotals      `json:"totals"           bson:"totals"`
	Notes         InvoiceNotes       `json:"notes"            bson:"notes"`
	Status        string             `json:"status"           bson:"status"`
	OrgID         string             `json:"orgId,omitempty"  bson:"orgId,omitempty"`
	CreatedAt     time.Time          `json:"createdAt"        bson:"createdAt"`
	UpdatedAt     time.Time          `json:"updatedAt"        bson:"updatedAt"`
	CreatedBy     string             `json:"createdBy"        bson:"createdBy"`
}
