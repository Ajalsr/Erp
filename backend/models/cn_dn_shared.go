package models

import "go.mongodb.org/mongo-driver/bson/primitive"

// CNLineItem is shared by CreditNote and DebitNote.
type CNLineItem struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Description string             `json:"description"   bson:"description"`
	Qty         float64            `json:"qty"           bson:"qty"`
	UnitPrice   float64            `json:"unitPrice"     bson:"unitPrice"`
	TaxRate     float64            `json:"taxRate"       bson:"taxRate"`
	TaxAmt      float64            `json:"taxAmt"        bson:"taxAmt"`
	Total       float64            `json:"total"         bson:"total"`
}

// CNTotals is shared by CreditNote and DebitNote.
type CNTotals struct {
	Subtotal   float64 `json:"subtotal"   bson:"subtotal"`
	VATTotal   float64 `json:"vatTotal"   bson:"vatTotal"`
	GrandTotal float64 `json:"grandTotal" bson:"grandTotal"`
}

// VATLine groups VAT by rate — one entry per tax rate on the document.
type VATLine struct {
	Rate          float64 `json:"rate"          bson:"rate"`
	TaxableAmount float64 `json:"taxableAmount" bson:"taxableAmount"`
	VATAmount     float64 `json:"vatAmount"     bson:"vatAmount"`
}
