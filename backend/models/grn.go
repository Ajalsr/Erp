package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type GRNItem struct {
	ID              primitive.ObjectID `json:"_id,omitempty"          bson:"_id,omitempty"`
	ItemID          string             `json:"itemId"                 bson:"itemId"`
	Details         string             `json:"details"                bson:"details"`
	ItemCode        string             `json:"itemCode"               bson:"itemCode"`
	OrderedQty      float64            `json:"orderedQty"             bson:"orderedQty"`
	ReceivedQty     float64            `json:"receivedQty"            bson:"receivedQty"`
	RejectedQty     float64            `json:"rejectedQty"            bson:"rejectedQty"`
	RejectionReason string             `json:"rejectionReason,omitempty" bson:"rejectionReason,omitempty"`
	QualityStatus   string             `json:"qualityStatus,omitempty"   bson:"qualityStatus,omitempty"` // pass | fail | pending
	BatchNumber     string             `json:"batchNumber,omitempty"     bson:"batchNumber,omitempty"`
	ExpiryDate      string             `json:"expiryDate,omitempty"      bson:"expiryDate,omitempty"`
	Unit            string             `json:"unit"                   bson:"unit"`
	Rate            float64            `json:"rate"                   bson:"rate"`
	BaseAmount      float64            `json:"baseAmount"             bson:"baseAmount"`
	TaxAmount       float64            `json:"taxAmount"              bson:"taxAmount"`
	LineTotal       float64            `json:"lineTotal"              bson:"lineTotal"`
	// Per-item freight carried from the PO — taxed at its own rate, prorated to received qty.
	Freight          float64 `json:"freight,omitempty"          bson:"freight,omitempty"`
	FreightTaxRate   float64 `json:"freightTaxRate,omitempty"   bson:"freightTaxRate,omitempty"`
	FreightTaxAmount float64 `json:"freightTaxAmount,omitempty" bson:"freightTaxAmount,omitempty"`
}

// GRNCharge is a landed-cost line added at goods receipt: customs duty, clearing,
// freight, insurance, etc. Each carries its own optional tax and an optional payee.
//   - PayeeVendorID empty  → charge belongs to the main vendor; folded into the main bill.
//   - PayeeVendorID set     → charge is billed separately to that payee (e.g. customs
//                             authority) as its own bill, created already-paid.
type GRNCharge struct {
	ID              primitive.ObjectID `json:"_id,omitempty"          bson:"_id,omitempty"`
	Type            string             `json:"type"                   bson:"type"`    // customs_duty | clearing | freight | insurance | other
	Label           string             `json:"label"                  bson:"label"`
	Amount          float64            `json:"amount"                 bson:"amount"`
	TaxRate         float64            `json:"taxRate"                bson:"taxRate"` // percent; 0 = no tax
	TaxAmount       float64            `json:"taxAmount"              bson:"taxAmount"`
	Total           float64            `json:"total"                  bson:"total"`
	PayeeVendorID   string             `json:"payeeVendorId,omitempty"   bson:"payeeVendorId,omitempty"`
	PayeeVendorName string             `json:"payeeVendorName,omitempty" bson:"payeeVendorName,omitempty"`
	// Capitalise true → adds to landed cost of stock (Inventory 1200); false → expense.
	Capitalise bool `json:"capitalise" bson:"capitalise"`
	// PaymentAccount: cash/bank account code the separate payee bill is paid from
	// (it's created already paid). Empty → defaults to Bank (1002).
	PaymentAccount string `json:"paymentAccount,omitempty" bson:"paymentAccount,omitempty"`
	// BillID is set once this charge has been billed (separate payee bill).
	BillID string `json:"billId,omitempty" bson:"billId,omitempty"`
}

type GRN struct {
	ID                 primitive.ObjectID `json:"_id,omitempty"          bson:"_id,omitempty"`
	GRNNumber          string             `json:"grnNumber"              bson:"grnNumber"`
	PurchaseOrderID    string             `json:"purchaseOrderId"        bson:"purchaseOrderId"`
	PONumber           string             `json:"poNumber"               bson:"poNumber"`
	VendorID           string             `json:"vendorId"               bson:"vendorId"`
	VendorName         string             `json:"vendorName"             bson:"vendorName"`
	VendorOrigin       string             `json:"vendorOrigin,omitempty" bson:"vendorOrigin,omitempty"` // mainland | free_zone | overseas
	WarehouseID        string             `json:"warehouseId,omitempty"   bson:"warehouseId,omitempty"`   // receiving warehouse
	WarehouseName      string             `json:"warehouseName,omitempty" bson:"warehouseName,omitempty"`
	ReceiptDate        time.Time          `json:"receiptDate"            bson:"receiptDate"`
	DeliveryNoteNumber string             `json:"deliveryNoteNumber,omitempty" bson:"deliveryNoteNumber,omitempty"`
	ReceivedBy         string             `json:"receivedBy,omitempty"   bson:"receivedBy,omitempty"`
	Items              []GRNItem          `json:"items"                  bson:"items"`
	Notes              string             `json:"notes,omitempty"        bson:"notes,omitempty"`
	RequiresApproval   bool               `json:"requiresApproval"       bson:"requiresApproval"`
	SubTotal           float64            `json:"subTotal"               bson:"subTotal"`
	TotalTax           float64            `json:"totalTax"               bson:"totalTax"`
	ShippingCharges    float64            `json:"shippingCharges"        bson:"shippingCharges"`
	Charges            []GRNCharge        `json:"charges,omitempty"      bson:"charges,omitempty"`      // landed-cost / other charges
	ChargesTotal       float64            `json:"chargesTotal"           bson:"chargesTotal"`           // sum of all charge totals
	Adjustment         float64            `json:"adjustment"             bson:"adjustment"`
	Total              float64            `json:"total"                  bson:"total"`
	Status             string             `json:"status"                 bson:"status"` // draft | confirmed | rejected | billed
	HasRejections      bool               `json:"hasRejections"          bson:"hasRejections"` // any line failed QC (partial accept)
	OrgID              string             `json:"orgId,omitempty"        bson:"orgId,omitempty"`
	CreatedAt          time.Time          `json:"createdAt"              bson:"createdAt"`
	UpdatedAt          time.Time          `json:"updatedAt"              bson:"updatedAt"`
	CreatedBy          string             `json:"createdBy"              bson:"createdBy"`
}
