package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type VendorCreditLineItem struct {
	ID          primitive.ObjectID `json:"_id,omitempty"      bson:"_id,omitempty"`
	ItemID      string             `json:"itemId,omitempty"   bson:"itemId,omitempty"`
	ItemCode    string             `json:"itemCode,omitempty" bson:"itemCode,omitempty"`
	Description string             `json:"description"        bson:"description"`
	Unit        string             `json:"unit,omitempty"     bson:"unit,omitempty"`
	Qty         float64            `json:"qty"                bson:"qty"`
	UnitPrice   float64            `json:"unitPrice"          bson:"unitPrice"`
	Discount    float64            `json:"discount"           bson:"discount"`    // %
	DiscountAmt float64            `json:"discountAmt"        bson:"discountAmt"`
	TaxRate     float64            `json:"taxRate"            bson:"taxRate"`
	TaxAmt      float64            `json:"taxAmt"             bson:"taxAmt"`
	Total       float64            `json:"total"              bson:"total"`
}

type VendorCreditTotals struct {
	Subtotal      float64 `json:"subtotal"      bson:"subtotal"`
	DiscountTotal float64 `json:"discountTotal" bson:"discountTotal"`
	TaxTotal      float64 `json:"taxTotal"      bson:"taxTotal"`
	GrandTotal    float64 `json:"grandTotal"    bson:"grandTotal"`
}

type VendorCredit struct {
	ID           primitive.ObjectID `json:"_id,omitempty"  bson:"_id,omitempty"`
	CreditNumber string             `json:"creditNumber"   bson:"creditNumber"`
	Date         string             `json:"date"           bson:"date"`

	// Vendor
	VendorID   string `json:"vendorId"             bson:"vendorId"`
	VendorName string `json:"vendorName"           bson:"vendorName"`
	VendorTRN  string `json:"vendorTrn,omitempty"  bson:"vendorTrn,omitempty"`

	// Linked bill (optional)
	BillID     string `json:"billId,omitempty"     bson:"billId,omitempty"`
	BillNumber string `json:"billNumber,omitempty" bson:"billNumber,omitempty"`

	Reason    string                 `json:"reason"    bson:"reason"`
	LineItems []VendorCreditLineItem `json:"lineItems" bson:"lineItems"`
	Totals    VendorCreditTotals     `json:"totals"    bson:"totals"`

	// Status: draft | open | applied | void
	Status string `json:"status" bson:"status"`

	Notes string `json:"notes,omitempty" bson:"notes,omitempty"`

	// Org + Audit
	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
