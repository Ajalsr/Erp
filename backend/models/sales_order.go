package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type SalesOrder struct {
	ID                   primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	OrderNumber          string             `json:"orderNumber" bson:"orderNumber" binding:"required"`
	CustomerID           string             `json:"customerId" bson:"customerId" binding:"required"`
	CustomerName         string             `json:"customerName" bson:"customerName"`
	CustomerCode         string             `json:"customerCode" bson:"customerCode"`
	SalesType            string             `json:"salesType" bson:"salesType" binding:"required,oneof=SO MOA MOA_COLLECT FREE_DELIVERY"`
	OrderDate            time.Time          `json:"orderDate" bson:"orderDate" binding:"required"`
	LpoNumber            string             `json:"lpoNumber" bson:"lpoNumber" binding:"required"`
	LpoDate              *time.Time         `json:"lpoDate,omitempty" bson:"lpoDate,omitempty"`
	LpoValue             float64            `json:"lpoValue" bson:"lpoValue" binding:"required,min=0"`
	ExpectedShipmentDate *time.Time         `json:"expectedShipmentDate,omitempty" bson:"expectedShipmentDate,omitempty"`
	PaymentTerms         string             `json:"paymentTerms" bson:"paymentTerms" binding:"required"`
	Salesperson          string             `json:"salesperson" bson:"salesperson" binding:"required"`
	Items                []SalesOrderItem   `json:"items" bson:"items" binding:"required,min=1,dive"`
	SubTotal             float64            `json:"subTotal" bson:"subTotal"`
	ShippingCharges      float64            `json:"shippingCharges" bson:"shippingCharges"`
	Adjustment           float64            `json:"adjustment" bson:"adjustment"`
	VAT                  float64            `json:"vat" bson:"vat"`
	Total                float64            `json:"total" bson:"total"`
	CustomerNotes        string             `json:"customerNotes,omitempty" bson:"customerNotes,omitempty"`
	TermsAndConditions   string             `json:"termsAndConditions,omitempty" bson:"termsAndConditions,omitempty"`
	Status               string             `json:"status" bson:"status"`
	Attachments          []Attachment       `json:"attachments,omitempty" bson:"attachments,omitempty"`
	CreatedAt            time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt            time.Time          `json:"updatedAt" bson:"updatedAt"`
	CreatedBy            string             `json:"createdBy,omitempty" bson:"createdBy,omitempty"`
	UpdatedBy            string             `json:"updatedBy,omitempty" bson:"updatedBy,omitempty"`
}

type SalesOrderItem struct {
	ID      primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	ItemID  string             `json:"itemId" bson:"itemId" binding:"required"`
	Details string             `json:"details" bson:"details"`
	//SKU      string             `json:"sku" bson:"sku"`
	Quantity     float64 `json:"quantity" bson:"quantity" binding:"required,min=1"`
	Rate         float64 `json:"rate" bson:"rate" binding:"required,min=0"`
	Discount     string  `json:"discount" bson:"discount"`
	DiscountType string  `json:"discountType" bson:"discountType"`
	DiscountUnit string  `json:"discountUnit" bson:"discountUnit"`
	Amount       float64 `json:"amount" bson:"amount"`
	Unit         string  `json:"unit" bson:"unit"`
}

type Attachment struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	FileName    string             `json:"fileName" bson:"fileName"`
	FileURL     string             `json:"fileUrl" bson:"fileUrl"`
	FileSize    int64              `json:"fileSize" bson:"fileSize"`
	ContentType string             `json:"contentType" bson:"contentType"`
	UploadedAt  time.Time          `json:"uploadedAt" bson:"uploadedAt"`
	UploadedBy  string             `json:"uploadedBy" bson:"uploadedBy"`
}

type CreateSalesOrderRequest struct {
	OrderNumber          string           `json:"orderNumber" binding:"required"`
	CustomerID           string           `json:"customerId" binding:"required"`
	SalesType            string           `json:"salesType" binding:"required,oneof=SO MOA MOA_COLLECT FREE_DELIVERY"`
	OrderDate            time.Time        `json:"orderDate" binding:"required"`
	LpoNumber            string           `json:"lpoNumber" binding:"required"`
	LpoDate              *time.Time       `json:"lpoDate,omitempty"`
	LpoValue             float64          `json:"lpoValue" binding:"required,min=0"`
	ExpectedShipmentDate *time.Time       `json:"expectedShipmentDate,omitempty"`
	PaymentTerms         string           `json:"paymentTerms" binding:"required"`
	Salesperson          string           `json:"salesperson"`
	Items                []SalesOrderItem `json:"items" binding:"required,min=1,dive"`
	ShippingCharges      float64          `json:"shippingCharges"`
	Adjustment           float64          `json:"adjustment"`
	CustomerNotes        string           `json:"customerNotes,omitempty"`
	TermsAndConditions   string           `json:"termsAndConditions,omitempty"`
}

type SalesOrderItemRequest struct {
	ItemID   string  `json:"itemId" binding:"required"`
	Quantity float64 `json:"quantity" binding:"required,min=1"`
	Discount string  `json:"discount"`
}

type UpdateSalesOrderRequest struct {
	Status             *string  `json:"status,omitempty"`
	ShippingCharges    *float64 `json:"shippingCharges,omitempty"`
	Adjustment         *float64 `json:"adjustment,omitempty"`
	CustomerNotes      *string  `json:"customerNotes,omitempty"`
	TermsAndConditions *string  `json:"termsAndConditions,omitempty"`
}

type SalesOrderResponse struct {
	ID                   string           `json:"id"`
	OrderNumber          string           `json:"orderNumber"`
	CustomerID           string           `json:"customerId"`
	CustomerName         string           `json:"customerName"`
	CustomerCode         string           `json:"customerCode"`
	SalesType            string           `json:"salesType"`
	OrderDate            time.Time        `json:"orderDate"`
	LpoNumber            string           `json:"lpoNumber"`
	LpoDate              *time.Time       `json:"lpoDate,omitempty"`
	LpoValue             float64          `json:"lpoValue"`
	ExpectedShipmentDate *time.Time       `json:"expectedShipmentDate,omitempty"`
	PaymentTerms         string           `json:"paymentTerms"`
	Salesperson          string           `json:"salesperson"`
	Items                []SalesOrderItem `json:"items"`
	SubTotal             float64          `json:"subTotal"`
	ShippingCharges      float64          `json:"shippingCharges"`
	Adjustment           float64          `json:"adjustment"`
	VAT                  float64          `json:"vat"`
	Total                float64          `json:"total"`
	CustomerNotes        string           `json:"customerNotes,omitempty"`
	TermsAndConditions   string           `json:"termsAndConditions,omitempty"`
	Status               string           `json:"status"`
	CreatedAt            time.Time        `json:"createdAt"`
	UpdatedAt            time.Time        `json:"updatedAt"`
}

type SalesOrderListResponse struct {
	Total       int64                `json:"total"`
	Page        int                  `json:"page"`
	Limit       int                  `json:"limit"`
	TotalPages  int                  `json:"totalPages"`
	SalesOrders []SalesOrderResponse `json:"salesOrders"`
}

type SalesOrderStats struct {
	TotalOrders     int64         `json:"totalOrders"`
	TotalAmount     float64       `json:"totalAmount"`
	PendingOrders   int64         `json:"pendingOrders"`
	ApprovedOrders  int64         `json:"approvedOrders"`
	ShippedOrders   int64         `json:"shippedOrders"`
	CompletedOrders int64         `json:"completedOrders"`
	CancelledOrders int64         `json:"cancelledOrders"`
	TodayOrders     int64         `json:"todayOrders"`
	ThisWeekOrders  int64         `json:"thisWeekOrders"`
	ThisMonthOrders int64         `json:"thisMonthOrders"`
	TopCustomers    []TopCustomer `json:"topCustomers"`
}

type TopCustomer struct {
	CustomerID   string  `json:"customerId"`
	CustomerName string  `json:"customerName"`
	OrderCount   int64   `json:"orderCount"`
	TotalAmount  float64 `json:"totalAmount"`
}
