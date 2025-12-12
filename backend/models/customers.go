package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Customer struct {
	ID                  primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	CustomerCode        string             `json:"customerCode" bson:"customerCode"`
	CustomerType        string             `json:"customerType" bson:"customerType"`
	Salutation          string             `json:"salutation" bson:"salutation"`
	FirstName           string             `json:"firstName" bson:"firstName"`
	LastName            string             `json:"lastName" bson:"lastName"`
	CustomerDisplayName string             `json:"customerDisplayName" bson:"customerDisplayName"`
	CompanyName         string             `json:"companyName" bson:"companyName"`
	CustomerEmail       string             `json:"customerEmail" bson:"customerEmail"`
	CustomerPhone       string             `json:"customerPhone" bson:"customerPhone"`
	WorkPhone           string             `json:"workPhone" bson:"workPhone"`
	Mobile              string             `json:"mobile" bson:"mobile"`
	StreetAddress       string             `json:"streetAddress" bson:"streetAddress"`
	City                string             `json:"city" bson:"city"`
	PostalCode          string             `json:"postalCode" bson:"postalCode"`
	Country             string             `json:"country" bson:"country"`
	ContactPersons      []ContactPerson    `json:"contactPersons" bson:"contactPersons"`

	SellingPrice     float64 `json:"selling_price,omitempty" bson:"selling_price,omitempty"`
	SalesAccount     string  `json:"sales_account,omitempty" bson:"sales_account,omitempty"`
	SalesDescription string  `json:"sales_description,omitempty" bson:"sales_description,omitempty"`
	CostPrice        float64 `json:"cost_price,omitempty" bson:"cost_price,omitempty"`
	CostAccount      string  `json:"cost_account,omitempty" bson:"cost_account,omitempty"`
	CostDescription  string  `json:"cost_description,omitempty" bson:"cost_description,omitempty"`
	PreferredVendor  string  `json:"preferred_vendor,omitempty" bson:"preferred_vendor,omitempty"`
	InventoryAccount string  `json:"inventory_account,omitempty" bson:"inventory_account,omitempty"`
	OpeningStock     float64 `json:"opening_stock,omitempty" bson:"opening_stock,omitempty"`
	OpeningStockRate float64 `json:"opening_stock_rate,omitempty" bson:"opening_stock_rate,omitempty"`
	ReorderPoint     float64 `json:"reorder_point,omitempty" bson:"reorder_point,omitempty"`
	Quantity         float64 `json:"quantity,omitempty" bson:"quantity,omitempty"`
	Currency         string  `json:"currency,omitempty" bson:"currency,omitempty"`
	PaymentTerms     string  `json:"payment_terms,omitempty" bson:"payment_terms,omitempty"`

	Remarks       string                 `json:"remarks,omitempty" bson:"remarks,omitempty"`
	ReportingTags []string               `json:"reporting_tags,omitempty" bson:"reporting_tags,omitempty"`
	CustomFields  map[string]interface{} `json:"custom_fields,omitempty" bson:"custom_fields,omitempty"`
	Documents     []Document             `json:"documents,omitempty" bson:"documents,omitempty"`
	Status        string                 `json:"status,omitempty" bson:"status,omitempty"`

	CreatedAt time.Time `json:"created_at,omitempty" bson:"created_at,omitempty"`
	UpdatedAt time.Time `json:"updated_at,omitempty" bson:"updated_at,omitempty"`
	CreatedBy string    `json:"created_by,omitempty" bson:"created_by,omitempty"`
	UpdatedBy string    `json:"updated_by,omitempty" bson:"updated_by,omitempty"`

	Tags               []string `json:"tags,omitempty" bson:"tags,omitempty"`
	Notes              string   `json:"notes,omitempty" bson:"notes,omitempty"`
	Rating             int      `json:"rating,omitempty" bson:"rating,omitempty"`
	CreditLimit        float64  `json:"credit_limit,omitempty" bson:"credit_limit,omitempty"`
	OutstandingBalance float64  `json:"outstanding_balance,omitempty" bson:"outstanding_balance,omitempty"`
	UnusedCredits      float64  `json:"unused_credits,omitempty" bson:"unused_credits,omitempty"`
}

type ContactPerson struct {
	ID        primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Name      string             `json:"name" bson:"name"`
	Email     string             `json:"email" bson:"email"`
	Phone     string             `json:"phone" bson:"phone"`
	Position  string             `json:"position,omitempty" bson:"position,omitempty"`
	IsPrimary bool               `json:"is_primary,omitempty" bson:"is_primary,omitempty"`
	Notes     string             `json:"notes,omitempty" bson:"notes,omitempty"`
	CreatedAt time.Time          `json:"created_at,omitempty" bson:"created_at,omitempty"`
	UpdatedAt time.Time          `json:"updated_at,omitempty" bson:"updated_at,omitempty"`
}

type Document struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Name        string             `json:"name" bson:"name"`
	Type        string             `json:"type" bson:"type"`
	URL         string             `json:"url" bson:"url"`
	Size        int64              `json:"size,omitempty" bson:"size,omitempty"`
	UploadedAt  time.Time          `json:"uploaded_at,omitempty" bson:"uploaded_at,omitempty"`
	UploadedBy  string             `json:"uploaded_by,omitempty" bson:"uploaded_by,omitempty"`
	Description string             `json:"description,omitempty" bson:"description,omitempty"`
}
