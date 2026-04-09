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
	Rate         float64            `json:"rate"             bson:"rate"`
	Discount     float64            `json:"discount"         bson:"discount"`
	DiscountType string             `json:"discountType"     bson:"discountType"` // "percentage" | "fixed"
	BaseAmount   float64            `json:"baseAmount"       bson:"baseAmount"`   // qty × rate − discount
	TaxRate      float64            `json:"taxRate"          bson:"taxRate"`      // 5
	TaxAmount    float64            `json:"taxAmount"        bson:"taxAmount"`    // baseAmount × 5%
	Amount       float64            `json:"amount"           bson:"amount"`       // baseAmount + taxAmount
	Unit         string             `json:"unit"             bson:"unit"`
}

type PurchaseOrder struct {
	ID                   primitive.ObjectID  `json:"_id,omitempty"           bson:"_id,omitempty"`
	OrderNumber          string              `json:"orderNumber"             bson:"orderNumber"`
	VendorID             string              `json:"vendorId"                bson:"vendorId"`
	VendorName           string              `json:"vendorName"              bson:"vendorName"`
	VendorCode           string              `json:"vendorCode"              bson:"vendorCode"`
	OrderDate            time.Time           `json:"orderDate"               bson:"orderDate"`
	ExpectedDeliveryDate *time.Time          `json:"expectedDeliveryDate"    bson:"expectedDeliveryDate"`
	PaymentTerms         string              `json:"paymentTerms"            bson:"paymentTerms"`
	DeliveryAddress      string              `json:"deliveryAddress"         bson:"deliveryAddress"`
	ShipmentPreference   string              `json:"shipmentPreference"      bson:"shipmentPreference"`
	ReferenceNo          string              `json:"referenceNo"             bson:"referenceNo"`
	Items                []PurchaseOrderItem `json:"items"                   bson:"items"`

	// ── Calculated totals ───────────────────────────────────────────────
	SubTotal        float64    `json:"subTotal"        bson:"subTotal"`  // sum of baseAmounts
	TaxGroups       []TaxGroup `json:"taxGroups"       bson:"taxGroups"` // grouped VAT breakdown
	TotalTax        float64    `json:"totalTax"        bson:"totalTax"`  // sum of all taxAmounts
	ShippingCharges float64    `json:"shippingCharges" bson:"shippingCharges"`
	Adjustment      float64    `json:"adjustment"      bson:"adjustment"`
	Total           float64    `json:"total"           bson:"total"` // subTotal + totalTax + shipping + adjustment

	CustomerNotes      string `json:"customerNotes"      bson:"customerNotes"`
	TermsAndConditions string `json:"termsAndConditions" bson:"termsAndConditions"`
	Status             string `json:"status"             bson:"status"`

	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" bson:"updatedAt"`
	CreatedBy string    `json:"createdBy" bson:"createdBy"`
}
