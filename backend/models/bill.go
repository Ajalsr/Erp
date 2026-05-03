package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type BillLineItem struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Description string             `json:"description"   bson:"description"`
	Qty         float64            `json:"qty"           bson:"qty"`
	UnitPrice   float64            `json:"unitPrice"     bson:"unitPrice"`
	TaxRate     float64            `json:"taxRate"       bson:"taxRate"`
	Discount    float64            `json:"discount"      bson:"discount"`
	DiscountAmt float64            `json:"discountAmt"   bson:"discountAmt"`
	TaxAmt      float64            `json:"taxAmt"        bson:"taxAmt"`
	Subtotal    float64            `json:"subtotal"      bson:"subtotal"`
	Total       float64            `json:"total"         bson:"total"`
}

type BillTotals struct {
	Subtotal      float64 `json:"subtotal"      bson:"subtotal"`
	DiscountTotal float64 `json:"discountTotal" bson:"discountTotal"`
	TaxTotal      float64 `json:"taxTotal"      bson:"taxTotal"`
	GrandTotal    float64 `json:"grandTotal"    bson:"grandTotal"`
}

type Bill struct {
	ID         primitive.ObjectID `json:"_id,omitempty"   bson:"_id,omitempty"`
	BillNumber string             `json:"billNumber"      bson:"billNumber"`
	BillDate   string             `json:"billDate"        bson:"billDate"`
	DueDate    string             `json:"dueDate"         bson:"dueDate"`

	// Vendor
	VendorID   string `json:"vendorId"   bson:"vendorId"`
	VendorName string `json:"vendorName" bson:"vendorName"`

	// Linked PO (optional)
	PurchaseOrderID string `json:"purchaseOrderId,omitempty" bson:"purchaseOrderId,omitempty"`
	PONumber        string `json:"poNumber,omitempty"        bson:"poNumber,omitempty"`

	// Linked GRN (optional)
	GRNID     string `json:"grnId,omitempty"     bson:"grnId,omitempty"`
	GRNNumber string `json:"grnNumber,omitempty" bson:"grnNumber,omitempty"`

	// Line items & totals
	LineItems []BillLineItem `json:"lineItems" bson:"lineItems"`
	Totals    BillTotals     `json:"totals"    bson:"totals"`

	// Payment tracking
	AmountPaid float64 `json:"amountPaid" bson:"amountPaid"`
	BalanceDue float64 `json:"balanceDue" bson:"balanceDue"`

	PaymentTerms string `json:"paymentTerms,omitempty" bson:"paymentTerms,omitempty"`

	// Status: draft | open | partial | paid | overdue | void
	Status string `json:"status" bson:"status"`

	Notes string `json:"notes,omitempty" bson:"notes,omitempty"`

	// Org + Audit
	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
