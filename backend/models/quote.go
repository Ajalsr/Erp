package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type QuoteLineItem struct {
	ID          primitive.ObjectID `json:"_id,omitempty"   bson:"_id,omitempty"`
	PartNumber  string             `json:"partNumber"      bson:"partNumber"`
	Desc        string             `json:"desc"            bson:"desc"`
	Qty         float64            `json:"qty"             bson:"qty"`
	Unit        string             `json:"unit"            bson:"unit"`
	UnitPrice   float64            `json:"unitPrice"       bson:"unitPrice"`
	Discount    float64            `json:"discount"        bson:"discount"`
	DiscountType string            `json:"discountType"    bson:"discountType"`
	TaxRate     float64            `json:"taxRate"         bson:"taxRate"`
	Subtotal    float64            `json:"subtotal"        bson:"subtotal"`
	DiscAmt     float64            `json:"discAmt"         bson:"discAmt"`
	TaxAmt      float64            `json:"taxAmt"          bson:"taxAmt"`
	Total       float64            `json:"total"           bson:"total"`
}

type QuoteTotals struct {
	Subtotal      float64 `json:"subtotal"      bson:"subtotal"`
	DiscountTotal float64 `json:"discountTotal" bson:"discountTotal"`
	TaxTotal      float64 `json:"taxTotal"      bson:"taxTotal"`
	GrandTotal    float64 `json:"grandTotal"    bson:"grandTotal"`
}

type QuoteParty struct {
	Name    string `json:"name"    bson:"name"`
	Address string `json:"address" bson:"address"`
	TRN     string `json:"trn"     bson:"trn"`
}

type QuoteCompany struct {
	Name    string `json:"name"    bson:"name"`
	Address string `json:"address" bson:"address"`
	TRN     string `json:"trn"     bson:"trn"`
	Phone   string `json:"phone"   bson:"phone"`
	Email   string `json:"email"   bson:"email"`
	Website string `json:"website" bson:"website"`
}

type QuoteSignatory struct {
	Name  string `json:"name"  bson:"name"`
	Title string `json:"title" bson:"title"`
}

type QuoteNotes struct {
	Customer string `json:"customer" bson:"customer"`
	Internal string `json:"internal" bson:"internal"`
}

type Quote struct {
	ID            primitive.ObjectID `json:"_id,omitempty"    bson:"_id,omitempty"`
	QuoteNumber   string             `json:"quoteNumber"      bson:"quoteNumber"`
	QuoteDate     string             `json:"quoteDate"        bson:"quoteDate"`
	ValidUntil    string             `json:"validUntil"       bson:"validUntil"`
	Currency      string             `json:"currency"         bson:"currency"`
	PaymentTerms  string             `json:"paymentTerms"     bson:"paymentTerms"`
	CustomerID    string             `json:"customerId"       bson:"customerId"`
	CustomerName  string             `json:"customerName"     bson:"customerName"`
	CustomerEmail string             `json:"customerEmail"    bson:"customerEmail"`
	BillTo        QuoteParty         `json:"billTo"           bson:"billTo"`

	// Salesperson (rep userId) — carried from the source enquiry so a Sales Order
	// converted from this quote can auto-fill it.
	Salesperson string `json:"salesperson,omitempty" bson:"salesperson,omitempty"`

	// Reference / document fields
	AttentionTo string `json:"attentionTo"  bson:"attentionTo"`
	Subject     string `json:"subject"      bson:"subject"`
	ProjectName string `json:"projectName"  bson:"projectName"`
	IntroText   string `json:"introText"    bson:"introText"`

	// Sender company details (for PDF header)
	Company   QuoteCompany   `json:"company"   bson:"company"`
	Signatory QuoteSignatory `json:"signatory" bson:"signatory"`

	// Terms & Conditions list
	TermsAndConditions []string `json:"termsAndConditions" bson:"termsAndConditions"`

	LineItems []QuoteLineItem `json:"lineItems" bson:"lineItems"`
	Totals    QuoteTotals     `json:"totals"    bson:"totals"`
	Notes     QuoteNotes      `json:"notes"     bson:"notes"`

	// Status: draft | sent | accepted | declined | expired | converted
	Status              string `json:"status"                        bson:"status"`
	ConvertedTo         string `json:"convertedTo,omitempty"         bson:"convertedTo,omitempty"`
	ConvertedToSO       string `json:"convertedToSO,omitempty"       bson:"convertedToSO,omitempty"`
	ConvertedToSONumber string `json:"convertedToSONumber,omitempty" bson:"convertedToSONumber,omitempty"`
	SourceEnquiryId     string `json:"sourceEnquiryId,omitempty"     bson:"sourceEnquiryId,omitempty"`
	SourceEnquiryNumber string `json:"sourceEnquiryNumber,omitempty" bson:"sourceEnquiryNumber,omitempty"`

	// Email-on-send: who to mail and the cover note. Carried in the create payload so
	// the email also fires after an approval hold is replayed (see CreateQuote).
	Recipients  []string `json:"recipients,omitempty"  bson:"recipients,omitempty"`
	SendMessage string   `json:"sendMessage,omitempty" bson:"sendMessage,omitempty"`

	// PublicToken powers the unauthenticated "view online" link emailed to the
	// customer — generated the first time the quote is sent (see SendQuote).
	PublicToken string `json:"publicToken,omitempty" bson:"publicToken,omitempty"`

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
}
