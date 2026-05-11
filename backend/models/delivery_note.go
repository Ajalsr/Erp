package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type DeliveryNote struct {
	ID               primitive.ObjectID `json:"_id,omitempty"           bson:"_id,omitempty"`
	DNNumber         string             `json:"dnNumber"                bson:"dnNumber"`
	Date             string             `json:"date"                    bson:"date"`
	CustomerName     string             `json:"customerName"            bson:"customerName"`
	CustomerID       string             `json:"customerId,omitempty"    bson:"customerId,omitempty"`
	CustomerCode     string             `json:"customerCode,omitempty"  bson:"customerCode,omitempty"`
	CustomerPhone    string             `json:"customerPhone,omitempty" bson:"customerPhone,omitempty"`
	CustomerEmail    string             `json:"customerEmail,omitempty" bson:"customerEmail,omitempty"`
	CustomerAddress  string             `json:"customerAddress,omitempty" bson:"customerAddress,omitempty"`
	CustPoNo         string             `json:"custPoNo,omitempty"      bson:"custPoNo,omitempty"`
	CustPoDate       string             `json:"custPoDate,omitempty"    bson:"custPoDate,omitempty"`
	Salesperson      string             `json:"salesperson,omitempty"   bson:"salesperson,omitempty"`
	DeliveryLocation string             `json:"deliveryLocation,omitempty" bson:"deliveryLocation,omitempty"`
	OrderNumber      string             `json:"orderNumber"             bson:"orderNumber"`
	SalesOrderIDs    []string           `json:"salesOrderIds"           bson:"salesOrderIds"`
	Items            []DNItem           `json:"items"                   bson:"items"`
	Note             string             `json:"note,omitempty"          bson:"note,omitempty"`
	InvoiceID        string             `json:"invoiceId,omitempty"     bson:"invoiceId,omitempty"`
	InvoiceNumber    string             `json:"invoiceNumber,omitempty" bson:"invoiceNumber,omitempty"`
	// draft → confirmed → dispatched → delivered
	Status           string             `json:"status"                  bson:"status"`
	SubTotal         float64            `json:"subTotal"                bson:"subTotal"`
	TotalDiscount    float64            `json:"totalDiscount"           bson:"totalDiscount"`
	TotalTax         float64            `json:"totalTax"                bson:"totalTax"`
	GrandTotal       float64            `json:"grandTotal"              bson:"grandTotal"`
	OrgID            string             `json:"orgId"                   bson:"orgId"`
	CreatedBy        string             `json:"createdBy,omitempty"     bson:"createdBy,omitempty"`
	CreatedAt        time.Time          `json:"createdAt"               bson:"createdAt"`
	UpdatedAt        time.Time          `json:"updatedAt"               bson:"updatedAt"`
}

type DNItem struct {
	ItemID           string  `json:"itemId"           bson:"itemId"`
	Name             string  `json:"name"             bson:"name"`
	ItemCode         string  `json:"itemCode"         bson:"itemCode"`
	Unit             string  `json:"unit"             bson:"unit"`
	OutboundQuantity float64 `json:"outboundQuantity" bson:"outboundQuantity"`
	Rate             float64 `json:"rate"             bson:"rate"`
	SellingPrice     float64 `json:"sellingPrice"     bson:"sellingPrice"`
	Discount         float64 `json:"discount"         bson:"discount"`
	SalesOrderID     string  `json:"salesOrderId"     bson:"salesOrderId"`
	SalesOrderNumber string  `json:"salesOrderNumber" bson:"salesOrderNumber"`
}
