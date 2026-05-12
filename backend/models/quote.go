package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type QuoteLineItem struct {
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

type QuoteTotals struct {
	Subtotal      float64 `json:"subtotal"      bson:"subtotal"`
	DiscountTotal float64 `json:"discountTotal" bson:"discountTotal"`
	TaxTotal      float64 `json:"taxTotal"      bson:"taxTotal"`
	GrandTotal    float64 `json:"grandTotal"    bson:"grandTotal"`
}

type QuoteParty struct {
	Name    string `json:"name"    bson:"name"`
	Address string `json:"address" bson:"address"`
	TRN     string `json:"trn"     bson:"trn"`
}

type QuoteNotes struct {
	Customer string `json:"customer" bson:"customer"`
	Internal string `json:"internal" bson:"internal"`
}

type Quote struct {
	ID            primitive.ObjectID `json:"_id,omitempty"    bson:"_id,omitempty"`
	QuoteNumber   string             `json:"quoteNumber"      bson:"quoteNumber"`
	QuoteDate     string             `json:"quoteDate"        bson:"quoteDate"`
	ValidUntil    string             `json:"validUntil"       bson:"validUntil"`
	Currency      string             `json:"currency"         bson:"currency"`
	PaymentTerms  string             `json:"paymentTerms"     bson:"paymentTerms"`
	CustomerID    string             `json:"customerId"       bson:"customerId"`
	CustomerName  string             `json:"customerName"     bson:"customerName"`
	CustomerEmail string             `json:"customerEmail"    bson:"customerEmail"`
	BillTo        QuoteParty         `json:"billTo"           bson:"billTo"`
	LineItems     []QuoteLineItem    `json:"lineItems"        bson:"lineItems"`
	Totals        QuoteTotals        `json:"totals"           bson:"totals"`
	Notes         QuoteNotes         `json:"notes"            bson:"notes"`
	// draft | sent | accepted | declined | expired | converted
	Status      string    `json:"status"                 bson:"status"`
	ConvertedTo string    `json:"convertedTo,omitempty"  bson:"convertedTo,omitempty"` // invoice ID
	OrgID       string    `json:"orgId,omitempty"        bson:"orgId,omitempty"`
	CreatedBy   string    `json:"createdBy"              bson:"createdBy"`
	CreatedAt   time.Time `json:"createdAt"              bson:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"              bson:"updatedAt"`
}
