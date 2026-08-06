package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// TaxGroup holds VAT grouped by unit rate for the breakdown display
type TaxGroup struct {
	Rate       float64 `json:"rate" bson:"rate"`             // unit rate used as group key
	TaxRate    float64 `json:"taxRate" bson:"taxRate"`       // always 5 (percent)
	BaseAmount float64 `json:"baseAmount" bson:"baseAmount"` // sum of taxable bases in this group
	TaxAmount  float64 `json:"taxAmount" bson:"taxAmount"`   // baseAmount × 5%
}

type PurchaseOrderItem struct {
	ID           primitive.ObjectID `json:"_id,omitempty"    bson:"_id,omitempty"`
	ItemID       string             `json:"itemId"           bson:"itemId"`
	Details      string             `json:"details"          bson:"details"`
	Quantity     float64            `json:"quantity"         bson:"quantity"`
	ReceivedQty  float64            `json:"receivedQty"      bson:"receivedQty"` // cumulative accepted qty from confirmed GRNs
	Rate         float64            `json:"rate"             bson:"rate"`
	Discount     float64            `json:"discount"         bson:"discount"`
	DiscountType string             `json:"discountType"     bson:"discountType"` // "percentage" | "fixed"
	BaseAmount   float64            `json:"baseAmount"       bson:"baseAmount"`   // qty × rate − discount
	TaxRate      float64            `json:"taxRate"          bson:"taxRate"`      // 5
	TaxAmount    float64            `json:"taxAmount"        bson:"taxAmount"`    // baseAmount × taxRate%
	Amount       float64            `json:"amount"           bson:"amount"`       // base + tax + freight + freightTax
	Unit         string             `json:"unit"             bson:"unit"`
	// SourceSOItemID links this PO line back to the sales-order line it procures for,
	// so received goods can credit the right SO line's fulfilledQty.
	SourceSOItemID string `json:"sourceSoItemId,omitempty" bson:"sourceSoItemId,omitempty"`
	// Optional per-item freight — taxed at its OWN rate (UAE: local 5%, international 0%),
	// independent of the vendor-origin VAT applied to the goods.
	Freight          float64 `json:"freight,omitempty"          bson:"freight,omitempty"`
	FreightTaxRate   float64 `json:"freightTaxRate,omitempty"   bson:"freightTaxRate,omitempty"`
	FreightTaxAmount float64 `json:"freightTaxAmount,omitempty" bson:"freightTaxAmount,omitempty"`
}

type PurchaseOrder struct {
	ID                   primitive.ObjectID `json:"_id,omitempty"           bson:"_id,omitempty"`
	OrderNumber          string             `json:"orderNumber"             bson:"orderNumber"`
	VendorID             string             `json:"vendorId"                bson:"vendorId"`
	VendorName           string             `json:"vendorName"              bson:"vendorName"`
	VendorCode           string             `json:"vendorCode"              bson:"vendorCode"`
	VendorOrigin         string             `json:"vendorOrigin"            bson:"vendorOrigin"` // free_zone | mainland | overseas
	OrderDate            time.Time          `json:"orderDate"               bson:"orderDate"`
	ExpectedDeliveryDate *time.Time         `json:"expectedDeliveryDate"    bson:"expectedDeliveryDate"`
	PaymentTerms         string             `json:"paymentTerms"            bson:"paymentTerms"`
	DeliveryAddress      string             `json:"deliveryAddress"         bson:"deliveryAddress"` // "organization" | "customer"
	DeliveryAddressLine  string             `json:"deliveryAddressLine,omitempty" bson:"deliveryAddressLine,omitempty"`
	DeliveryPOBox        string             `json:"deliveryPoBox,omitempty"       bson:"deliveryPoBox,omitempty"`
	ShipmentPreference   string             `json:"shipmentPreference"      bson:"shipmentPreference"`
	ReferenceNo          string             `json:"referenceNo"             bson:"referenceNo"`
	Project              string             `json:"project,omitempty"       bson:"project,omitempty"`
	Currency             string             `json:"currency,omitempty"      bson:"currency,omitempty"`
	// Vendor contact snapshot — auto-filled from the vendor record when selected,
	// but editable per-order (e.g. a different contact email for this one PO).
	VendorEmail string `json:"vendorEmail,omitempty" bson:"vendorEmail,omitempty"`
	VendorPhone string `json:"vendorPhone,omitempty" bson:"vendorPhone,omitempty"`
	// AttentionTo / VendorPOBox: no equivalent field on the Vendor record itself
	// (like Quote's AttentionTo), so these are typed fresh per PO.
	AttentionTo   string              `json:"attentionTo,omitempty"   bson:"attentionTo,omitempty"`
	VendorPOBox   string              `json:"vendorPoBox,omitempty"   bson:"vendorPoBox,omitempty"`
	Items         []PurchaseOrderItem `json:"items"                   bson:"items"`

	// ── Calculated totals ───────────────────────────────────────────────
	SubTotal        float64    `json:"subTotal"        bson:"subTotal"`  // sum of baseAmounts
	TaxGroups       []TaxGroup `json:"taxGroups"       bson:"taxGroups"` // grouped VAT breakdown
	TotalTax        float64    `json:"totalTax"        bson:"totalTax"`  // sum of all taxAmounts
	ShippingCharges float64    `json:"shippingCharges" bson:"shippingCharges"`
	Adjustment      float64    `json:"adjustment"      bson:"adjustment"`
	Total           float64    `json:"total"           bson:"total"` // subTotal + totalTax + shipping + adjustment

	CustomerNotes      string `json:"customerNotes"      bson:"customerNotes"`
	TermsAndConditions string `json:"termsAndConditions" bson:"termsAndConditions"`

	// ── Procure-to-order link ─────────────────────────────────────────────
	// Set when this PO was raised to source a customer's sales order (back-to-back).
	SourceSalesOrderID string `json:"sourceSalesOrderId,omitempty" bson:"sourceSalesOrderId,omitempty"`
	SourceSONumber     string `json:"sourceSoNumber,omitempty"     bson:"sourceSoNumber,omitempty"`
	ForCustomerID      string `json:"forCustomerId,omitempty"      bson:"forCustomerId,omitempty"` // who you buy FOR
	ForCustomerName    string `json:"forCustomerName,omitempty"    bson:"forCustomerName,omitempty"`
	// POType: goods = must go through GRN before bill; service = bill directly from PO
	POType string `json:"poType" bson:"poType"` // goods | service
	Status string `json:"status" bson:"status"` // draft | pending_approval | approved | issued | partial | received | cancelled

	// ── LPO / Approval ────────────────────────────────────────────────────
	LPONumber      string     `json:"lpoNumber,omitempty"      bson:"lpoNumber,omitempty"`      // issued only after approval
	ApprovalStatus string     `json:"approvalStatus,omitempty" bson:"approvalStatus,omitempty"` // pending | approved | rejected
	ApprovedBy     string     `json:"approvedBy,omitempty"     bson:"approvedBy,omitempty"`
	ApprovedAt     *time.Time `json:"approvedAt,omitempty"     bson:"approvedAt,omitempty"`

	OrgID string `json:"orgId,omitempty" bson:"orgId,omitempty"`

	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" bson:"updatedAt"`
	CreatedBy string    `json:"createdBy" bson:"createdBy"`
}
