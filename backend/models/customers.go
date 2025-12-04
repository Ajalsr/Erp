package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Customer struct {
	ID                  primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	CustomerType        string             `json:"customer_type" bson:"customer_type"`
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
	SalesAccount        string             `json:"sales_account,omitempty" bson:"sales_account,omitempty"`
	SalesDescription    string             `json:"sales_description,omitempty" bson:"sales_description,omitempty"`
	CostPrice           string             `json:"cost_price,omitempty" bson:"cost_price,omitempty"`
	CostAccount         string             `json:"cost_account,omitempty" bson:"cost_account,omitempty"`
	CostDescription     string             `json:"cost_description,omitempty" bson:"cost_description,omitempty"`
	PreferredVendor     string             `json:"preferred_vendor,omitempty" bson:"preferred_vendor,omitempty"`
	InventoryAccount    string             `json:"inventory_account,omitempty" bson:"inventory_account,omitempty"`
	OpeningStock        string             `json:"opening_stock,omitempty" bson:"opening_stock,omitempty"`
	OpeningStockRate    string             `json:"opening_stock_rate,omitempty" bson:"opening_stock_rate,omitempty"`
	ReorderPoint        string             `json:"reorder_point,omitempty" bson:"reorder_point,omitempty"`
	Quantity            string             `json:"quantity,omitempty" bson:"quantity,omitempty"`
	Currency            string             `json:"currency,omitempty" bson:"currency,omitempty"`
	PaymentTerms        string             `json:"payment_terms,omitempty" bson:"payment_terms,omitempty"`
	Remarks             string             `json:"remarks,omitempty" bson:"remarks,omitempty"`
	ReportingTags       []string           `json:"reporting_tags,omitempty" bson:"reporting_tags,omitempty"`
	CustomFields        string             `json:"custom_fields,omitempty" bson:"custom_fields,omitempty"`
	Documents           []string           `json:"documents,omitempty" bson:"documents,omitempty"`
	Status              string             `json:"status,omitempty" bson:"status,omitempty"` // e.g., "active", "inactive"
	CreatedAt           time.Time          `json:"created_at,omitempty" bson:"created_at,omitempty"`
	UpdatedAt           time.Time          `json:"updated_at,omitempty" bson:"updated_at,omitempty"`
	CreatedBy           string             `json:"created_by,omitempty" bson:"created_by,omitempty"`
	UpdatedBy           string             `json:"updated_by,omitempty" bson:"updated_by,omitempty"`
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
