package models

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson/bsontype"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/x/bsonx/bsoncore"
)

// ─── FlexFloat ────────────────────────────────────────────────────────────────
// Custom type that accepts BOTH numeric (double/int) AND string BSON values.
// This fixes the "Failed to decode sales orders" error caused by old MongoDB
// documents that stored the discount field as a string ("15" or "15%").
type FlexFloat float64

func (f FlexFloat) MarshalJSON() ([]byte, error) {
	return []byte(strconv.FormatFloat(float64(f), 'f', -1, 64)), nil
}

func (f *FlexFloat) UnmarshalJSON(b []byte) error {
	s := strings.TrimSpace(string(b))
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		s = s[1 : len(s)-1]
	}
	s = strings.TrimSuffix(strings.TrimSpace(s), "%")
	if s == "" || s == "null" {
		*f = 0
		return nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return err
	}
	*f = FlexFloat(v)
	return nil
}

func (f *FlexFloat) UnmarshalBSONValue(t bsontype.Type, raw []byte) error {
	switch t {
	case bsontype.Double:
		v, _, ok := bsoncore.ReadDouble(raw)
		if !ok {
			return fmt.Errorf("FlexFloat: failed to read double")
		}
		*f = FlexFloat(v)
	case bsontype.Int32:
		v, _, ok := bsoncore.ReadInt32(raw)
		if !ok {
			return fmt.Errorf("FlexFloat: failed to read int32")
		}
		*f = FlexFloat(float64(v))
	case bsontype.Int64:
		v, _, ok := bsoncore.ReadInt64(raw)
		if !ok {
			return fmt.Errorf("FlexFloat: failed to read int64")
		}
		*f = FlexFloat(float64(v))
	case bsontype.String:
		// Legacy documents stored discount as "15" or "15%"
		v, _, ok := bsoncore.ReadString(raw)
		if !ok {
			return fmt.Errorf("FlexFloat: failed to read string")
		}
		v = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(v), "%"))
		if v == "" {
			*f = 0
			return nil
		}
		parsed, err := strconv.ParseFloat(v, 64)
		if err != nil {
			*f = 0 // non-numeric string → treat as 0 rather than crashing
			return nil
		}
		*f = FlexFloat(parsed)
	case bsontype.Null, bsontype.Undefined:
		*f = 0
	default:
		// Unknown BSON type — treat as zero rather than crashing
		*f = 0
	}
	return nil
}

func (f FlexFloat) MarshalBSONValue() (bsontype.Type, []byte, error) {
	// Store as BSON double
	return bsontype.Double, bsoncore.AppendDouble(nil, float64(f)), nil
}

// Float64 returns the underlying float64 value — use this in arithmetic.
func (f FlexFloat) Float64() float64 { return float64(f) }

// ─── Models ───────────────────────────────────────────────────────────────────

type SalesOrder struct {
	ID                   primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	OrderNumber          string             `json:"orderNumber" bson:"orderNumber" binding:"required"`
	CustomerID           string             `json:"customerId" bson:"customerId" binding:"required"`
	CustomerName         string             `json:"customerName" bson:"customerName"`
	CustomerCode         string             `json:"customerCode" bson:"customerCode"`
	SalesType            string             `json:"salesType" bson:"salesType" binding:"required,oneof=SO MOA MOA_COLLECT FREE_DELIVERY"`
	OrderDate            time.Time          `json:"orderDate" bson:"orderDate" binding:"required"`
	LpoNumber            string             `json:"lpoNumber" bson:"lpoNumber"`
	LpoDate              *time.Time         `json:"lpoDate,omitempty" bson:"lpoDate,omitempty"`
	LpoValue             float64            `json:"lpoValue" bson:"lpoValue"`
	ExpectedShipmentDate *time.Time         `json:"expectedShipmentDate,omitempty" bson:"expectedShipmentDate,omitempty"`
	PaymentTerms         string             `json:"paymentTerms" bson:"paymentTerms" binding:"required"`
	Salesperson          string             `json:"salesperson" bson:"salesperson"`
	Items                []SalesOrderItem   `json:"items" bson:"items" binding:"required,min=1,dive"`
	SubTotal             float64            `json:"subTotal" bson:"subTotal"`
	ShippingCharges      float64            `json:"shippingCharges" bson:"shippingCharges"`
	Adjustment           float64            `json:"adjustment" bson:"adjustment"`
	VAT                  float64            `json:"vat" bson:"vat"`
	Total                float64            `json:"total" bson:"total"`
	CustomerNotes        string             `json:"customerNotes,omitempty" bson:"customerNotes,omitempty"`
	TermsAndConditions   string             `json:"termsAndConditions,omitempty" bson:"termsAndConditions,omitempty"`
	Status               string             `json:"status" bson:"status"`
	CancelReason         string             `json:"cancelReason,omitempty" bson:"cancelReason,omitempty"`
	CancelRequestedBy    string             `json:"cancelRequestedBy,omitempty" bson:"cancelRequestedBy,omitempty"`
	Attachments          []Attachment       `json:"attachments,omitempty" bson:"attachments,omitempty"`
	OrgID                string             `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt            time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt            time.Time          `json:"updatedAt" bson:"updatedAt"`
	CreatedBy            string             `json:"createdBy,omitempty" bson:"createdBy,omitempty"`
	UpdatedBy            string             `json:"updatedBy,omitempty" bson:"updatedBy,omitempty"`
	SourceQuoteID        string             `json:"sourceQuoteId,omitempty"     bson:"sourceQuoteId,omitempty"`
	SourceQuoteNumber    string             `json:"sourceQuoteNumber,omitempty" bson:"sourceQuoteNumber,omitempty"`
	FulfillmentStatus    string             `json:"fulfillmentStatus,omitempty" bson:"fulfillmentStatus,omitempty"`
}

// SalesOrderItem — one line in an order.
//
// Discount + DiscountAED use FlexFloat so old documents that stored discount as
// a string ("15" or "15%") are decoded without a type-mismatch error.
type SalesOrderItem struct {
	ID           primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	ItemID       string             `json:"itemId" bson:"itemId" binding:"required"`
	Details      string             `json:"details" bson:"details"`
	Quantity     float64            `json:"quantity" bson:"quantity" binding:"required,min=1"`
	Rate         float64            `json:"rate" bson:"rate"`
	Discount     FlexFloat          `json:"discount" bson:"discount"`
	DiscountType string             `json:"discountType" bson:"discountType"`
	DiscountUnit string             `json:"discountUnit" bson:"discountUnit"`
	DiscountAED  FlexFloat          `json:"discountAed" bson:"discountAed"`
	Amount       float64            `json:"amount" bson:"amount"`
	Unit         string             `json:"unit" bson:"unit"`
	FulfilledQty float64            `json:"fulfilledQty" bson:"fulfilledQty"`
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
	LpoNumber            string           `json:"lpoNumber"`
	LpoDate              *time.Time       `json:"lpoDate,omitempty"`
	LpoValue             float64          `json:"lpoValue"`
	ExpectedShipmentDate *time.Time       `json:"expectedShipmentDate,omitempty"`
	PaymentTerms         string           `json:"paymentTerms" binding:"required"`
	Salesperson          string           `json:"salesperson"`
	Items                []SalesOrderItem `json:"items" binding:"required,min=1,dive"`
	ShippingCharges      float64          `json:"shippingCharges"`
	Adjustment           float64          `json:"adjustment"`
	CustomerNotes        string           `json:"customerNotes,omitempty"`
	TermsAndConditions   string           `json:"termsAndConditions,omitempty"`
}

// SalesOrderItemRequest — what the frontend sends per line item
type SalesOrderItemRequest struct {
	ItemID       string    `json:"itemId" binding:"required"`
	Quantity     float64   `json:"quantity" binding:"required,min=1"`
	Rate         float64   `json:"rate"`
	Discount     FlexFloat `json:"discount"`     // number (not "15%")
	DiscountType string    `json:"discountType"` // "percentage" or "fixed"
	DiscountUnit string    `json:"discountUnit"` // "%" or "AED"
	DiscountAED  FlexFloat `json:"discountAed"`  // pre-computed AED deduction
	Amount       float64   `json:"amount"`       // pre-computed final line amount
}

type UpdateSalesOrderRequest struct {
	// Status-only updates (used by approval flow)
	Status *string `json:"status,omitempty"`

	// Full draft edit — all order header fields
	CustomerID           *string          `json:"customerId,omitempty"`
	SalesType            *string          `json:"salesType,omitempty"`
	OrderDate            *time.Time       `json:"orderDate,omitempty"`
	LpoNumber            *string          `json:"lpoNumber,omitempty"`
	LpoDate              *time.Time       `json:"lpoDate,omitempty"`
	LpoValue             *float64         `json:"lpoValue,omitempty"`
	ExpectedShipmentDate *time.Time       `json:"expectedShipmentDate,omitempty"`
	PaymentTerms         *string          `json:"paymentTerms,omitempty"`
	Salesperson          *string          `json:"salesperson,omitempty"`
	Items                []SalesOrderItem `json:"items,omitempty"`

	// Financials
	ShippingCharges *float64 `json:"shippingCharges,omitempty"`
	Adjustment      *float64 `json:"adjustment,omitempty"`

	// Notes
	CustomerNotes      *string `json:"customerNotes,omitempty"`
	TermsAndConditions *string `json:"termsAndConditions,omitempty"`
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
	CancelReason         string           `json:"cancelReason,omitempty"`
	CancelRequestedBy    string           `json:"cancelRequestedBy,omitempty"`
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
	TodayRevenue    float64       `json:"todayRevenue"`
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
