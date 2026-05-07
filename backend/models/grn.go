package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type GRNItem struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	ItemID      string             `json:"itemId"        bson:"itemId"`
	Details     string             `json:"details"       bson:"details"`
	ItemCode    string             `json:"itemCode"      bson:"itemCode"`
	OrderedQty  float64            `json:"orderedQty"    bson:"orderedQty"`
	ReceivedQty float64            `json:"receivedQty"   bson:"receivedQty"`
	Unit        string             `json:"unit"          bson:"unit"`
	Rate        float64            `json:"rate"          bson:"rate"`
	BaseAmount  float64            `json:"baseAmount"    bson:"baseAmount"`
	TaxAmount   float64            `json:"taxAmount"     bson:"taxAmount"`
	LineTotal   float64            `json:"lineTotal"     bson:"lineTotal"`
}

type GRN struct {
	ID               primitive.ObjectID `json:"_id,omitempty"       bson:"_id,omitempty"`
	GRNNumber        string             `json:"grnNumber"           bson:"grnNumber"`
	PurchaseOrderID  string             `json:"purchaseOrderId"     bson:"purchaseOrderId"`
	PONumber         string             `json:"poNumber"            bson:"poNumber"`
	VendorID         string             `json:"vendorId"            bson:"vendorId"`
	VendorName       string             `json:"vendorName"          bson:"vendorName"`
	ReceiptDate      time.Time          `json:"receiptDate"         bson:"receiptDate"`
	Items            []GRNItem          `json:"items"               bson:"items"`
	Notes            string             `json:"notes,omitempty"     bson:"notes,omitempty"`
	RequiresApproval bool               `json:"requiresApproval"    bson:"requiresApproval"`
	SubTotal         float64            `json:"subTotal"            bson:"subTotal"`
	TotalTax         float64            `json:"totalTax"            bson:"totalTax"`
	Total            float64            `json:"total"               bson:"total"`
	Status           string             `json:"status"              bson:"status"` // draft | confirmed
	OrgID            string             `json:"orgId,omitempty"     bson:"orgId,omitempty"`
	CreatedAt        time.Time          `json:"createdAt"           bson:"createdAt"`
	UpdatedAt        time.Time          `json:"updatedAt"           bson:"updatedAt"`
	CreatedBy        string             `json:"createdBy"           bson:"createdBy"`
}
