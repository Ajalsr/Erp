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
	Freight        float64         `json:"freight"        bson:"freight"`
	FreightTaxRate float64         `json:"freightTaxRate" bson:"freightTaxRate"`
	TaxAmt      float64            `json:"taxAmt"        bson:"taxAmt"`
	Subtotal    float64            `json:"subtotal"      bson:"subtotal"`
	Total       float64            `json:"total"         bson:"total"`
}

type BillTotals struct {
	Subtotal      float64 `json:"subtotal"        bson:"subtotal"`
	DiscountTotal float64 `json:"discountTotal"   bson:"discountTotal"`
	TaxTotal      float64 `json:"taxTotal"        bson:"taxTotal"`
	Shipping      float64 `json:"shipping"        bson:"shipping"`
	Adjustment    float64 `json:"adjustment"      bson:"adjustment"`
	GrandTotal    float64 `json:"grandTotal"      bson:"grandTotal"`
}

type Bill struct {
	ID         primitive.ObjectID `json:"_id,omitempty"   bson:"_id,omitempty"`
	BillNumber string             `json:"billNumber"      bson:"billNumber"`
	BillDate   string             `json:"billDate"        bson:"billDate"`
	DueDate    string             `json:"dueDate"         bson:"dueDate"`
	// AccountingDate separates the posting period from the vendor's invoice date
	AccountingDate string `json:"accountingDate,omitempty" bson:"accountingDate,omitempty"`

	// Vendor
	VendorID   string `json:"vendorId"             bson:"vendorId"`
	VendorName string `json:"vendorName"           bson:"vendorName"`
	VendorTRN  string `json:"vendorTrn,omitempty"  bson:"vendorTrn,omitempty"`  // captured at bill time for VAT claim
	VendorRef  string `json:"vendorRef,omitempty"  bson:"vendorRef,omitempty"`  // vendor's own invoice number

	// UAE VAT
	PlaceOfSupply string `json:"placeOfSupply,omitempty" bson:"placeOfSupply,omitempty"` // UAE emirate

	// Reverse Charge Mechanism
	RCMApplicable bool    `json:"rcmApplicable"           bson:"rcmApplicable"`
	RCMType       string  `json:"rcmType,omitempty"       bson:"rcmType,omitempty"`       // import | designated_zone | domestic_rcm
	RCMOutputVAT  float64 `json:"rcmOutputVat,omitempty"  bson:"rcmOutputVat,omitempty"`  // self-assessed output leg (Box 3)
	RCMInputVAT   float64 `json:"rcmInputVat,omitempty"   bson:"rcmInputVat,omitempty"`   // recoverable input leg (Box 10)

	// Linked PO (optional)
	PurchaseOrderID string `json:"purchaseOrderId,omitempty" bson:"purchaseOrderId,omitempty"`
	PONumber        string `json:"poNumber,omitempty"        bson:"poNumber,omitempty"`

	// Linked GRN (optional)
	GRNID     string `json:"grnId,omitempty"     bson:"grnId,omitempty"`
	GRNNumber string `json:"grnNumber,omitempty" bson:"grnNumber,omitempty"`

	// 3-way match: matched | mismatch | pending | na
	ThreeWayMatchStatus string `json:"threeWayMatchStatus,omitempty" bson:"threeWayMatchStatus,omitempty"`

	// Line items & totals
	LineItems []BillLineItem `json:"lineItems" bson:"lineItems"`
	Totals    BillTotals     `json:"totals"    bson:"totals"`

	// Multi-currency: txn currency + rate frozen at posting; BaseTotals is Totals
	// converted to org base currency (what the GL is posted in).
	Currency     string     `json:"currency,omitempty"     bson:"currency,omitempty"`
	ExchangeRate float64    `json:"exchangeRate,omitempty" bson:"exchangeRate,omitempty"`
	BaseCurrency string     `json:"baseCurrency,omitempty" bson:"baseCurrency,omitempty"`
	BaseTotals   BillTotals `json:"baseTotals,omitempty"   bson:"baseTotals,omitempty"`

	// Payment tracking
	AmountPaid float64 `json:"amountPaid" bson:"amountPaid"`
	BalanceDue float64 `json:"balanceDue" bson:"balanceDue"`

	PaymentTerms string `json:"paymentTerms,omitempty" bson:"paymentTerms,omitempty"`

	// ExpenseAccount: GL account (id or code) the goods/services are booked to for a
	// non-GRN expense bill (rent, utilities, services). Empty → 5000 COGS. GRN-linked
	// bills ignore this — their goods capitalise to Inventory (1200).
	ExpenseAccount string `json:"expenseAccount,omitempty" bson:"expenseAccount,omitempty"`

	// Status: draft | open | partial | paid | overdue | void
	Status string `json:"status" bson:"status"`

	Notes string `json:"notes,omitempty" bson:"notes,omitempty"`

	// Org + Audit
	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
