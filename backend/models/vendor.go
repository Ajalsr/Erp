package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Vendor struct {
	ID          primitive.ObjectID `json:"_id,omitempty"      bson:"_id,omitempty"`
	VendorCode  string             `json:"vendorCode"         bson:"vendorCode"`
	VendorType  string             `json:"vendorType"         bson:"vendorType"` // individual | business
	DisplayName string             `json:"displayName"        bson:"displayName"`
	CompanyName string             `json:"companyName"        bson:"companyName"`
	Email       string             `json:"email"              bson:"email"`
	Phone       string             `json:"phone"              bson:"phone"`
	Mobile      string             `json:"mobile"             bson:"mobile"`
	TRN                string `json:"trn"                bson:"trn"`                // Tax Registration Number (mandatory)
	Origin             string `json:"origin"             bson:"origin"`             // free_zone | mainland | overseas
	TradeLicenseNumber string `json:"tradeLicenseNumber" bson:"tradeLicenseNumber"` // Trade license no.

	// Address
	StreetAddress string `json:"streetAddress" bson:"streetAddress"`
	City          string `json:"city"          bson:"city"`
	Country       string `json:"country"       bson:"country"`

	// Finance
	Currency            string  `json:"currency"            bson:"currency"`
	PaymentTerms        string  `json:"paymentTerms"        bson:"paymentTerms"`
	CreditLimit         float64 `json:"creditLimit"         bson:"creditLimit"`
	OutstandingPayable  float64 `json:"outstandingPayable"  bson:"outstandingPayable"`

	// Banking
	BankName      string `json:"bankName"      bson:"bankName"`
	AccountNumber string `json:"accountNumber" bson:"accountNumber"`
	IBAN          string `json:"iban"          bson:"iban"`

	// Extras
	Notes  string `json:"notes"  bson:"notes"`
	Status string `json:"status" bson:"status"` // active | inactive

	// Org + Audit
	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`

	// History entries (same shape as customers)
	History []HistoryEntry `json:"history,omitempty" bson:"history,omitempty"`
}
