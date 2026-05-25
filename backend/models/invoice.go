package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type InvoiceLineItem struct {
	ID        primitive.ObjectID `json:"_id,omitempty"     bson:"_id,omitempty"`
	StockID   string             `json:"stockId,omitempty" bson:"stockId,omitempty"`
	Desc      string             `json:"desc"      bson:"desc"`
	Qty       float64            `json:"qty"       bson:"qty"`
	UnitPrice float64            `json:"unitPrice" bson:"unitPrice"`
	Discount  float64            `json:"discount"  bson:"discount"`
	TaxRate   float64            `json:"taxRate"   bson:"taxRate"`
	Subtotal  float64            `json:"subtotal"  bson:"subtotal"`
	DiscAmt   float64            `json:"discAmt"   bson:"discAmt"`
	TaxAmt    float64            `json:"taxAmt"    bson:"taxAmt"`
	Total     float64            `json:"total"     bson:"total"`
}

type SalesReturnItem struct {
	StockID   string  `json:"stockId,omitempty" bson:"stockId,omitempty"`
	ItemName  string  `json:"itemName"          bson:"itemName"`
	Qty       float64 `json:"qty"               bson:"qty"`
	UnitPrice float64 `json:"unitPrice"         bson:"unitPrice"`
	TaxRate   float64 `json:"taxRate"           bson:"taxRate"`
	Total     float64 `json:"total"             bson:"total"`
}

type SalesReturn struct {
	ID              primitive.ObjectID `json:"_id,omitempty"             bson:"_id,omitempty"`
	ReturnNumber    string             `json:"returnNumber"              bson:"returnNumber"`
	Date            string             `json:"date"                      bson:"date"`
	Mode            string             `json:"mode"                      bson:"mode"` // "credit" | "refund"
	Items           []SalesReturnItem  `json:"items"                     bson:"items"`
	CreditNoteID    string             `json:"creditNoteId,omitempty"    bson:"creditNoteId,omitempty"`
	CreditNoteNum   string             `json:"creditNoteNum,omitempty"   bson:"creditNoteNum,omitempty"`
	RefundPaymentID string             `json:"refundPaymentId,omitempty" bson:"refundPaymentId,omitempty"`
	RefundAmount    float64            `json:"refundAmount,omitempty"    bson:"refundAmount,omitempty"`
	Notes           string             `json:"notes,omitempty"           bson:"notes,omitempty"`
	CreatedAt       time.Time          `json:"createdAt"                 bson:"createdAt"`
	CreatedBy       string             `json:"createdBy,omitempty"       bson:"createdBy,omitempty"`
}

type InvoiceTotals struct {
	Subtotal      float64 `json:"subtotal"      bson:"subtotal"`
	DiscountTotal float64 `json:"discountTotal" bson:"discountTotal"`
	TaxTotal      float64 `json:"taxTotal"      bson:"taxTotal"`
	GrandTotal    float64 `json:"grandTotal"    bson:"grandTotal"`
}

type InvoiceParty struct {
	Name    string `json:"name"    bson:"name"`
	Address string `json:"address" bson:"address"`
	TRN     string `json:"trn"     bson:"trn"`
}

type InvoiceNotes struct {
	Customer string `json:"customer" bson:"customer"`
	Internal string `json:"internal" bson:"internal"`
}

type Invoice struct {
	ID            primitive.ObjectID `json:"_id,omitempty"    bson:"_id,omitempty"`
	InvoiceNumber string             `json:"invoiceNumber"    bson:"invoiceNumber"`
	IssueDate     string             `json:"issueDate"        bson:"issueDate"`
	DueDate       string             `json:"dueDate"          bson:"dueDate"`
	Currency      string             `json:"currency"         bson:"currency"`
	PaymentTerms  string             `json:"paymentTerms"     bson:"paymentTerms"`
	From          InvoiceParty       `json:"from"             bson:"from"`
	BillTo        InvoiceParty       `json:"billTo"           bson:"billTo"`
	CustomerID    string             `json:"customerId"       bson:"customerId"`
	LineItems     []InvoiceLineItem  `json:"lineItems"        bson:"lineItems"`
	Totals        InvoiceTotals      `json:"totals"           bson:"totals"`
	Notes         InvoiceNotes       `json:"notes"            bson:"notes"`
	Status        string             `json:"status"                    bson:"status"`
	AmountPaid    float64            `json:"amountPaid"                bson:"amountPaid"`
	BalanceDue    float64            `json:"balanceDue"                bson:"balanceDue"`
	PublicToken   string             `json:"publicToken,omitempty"     bson:"publicToken,omitempty"`
	Type                string   `json:"type,omitempty"               bson:"type,omitempty"` // "invoice" | "proforma"
	ProformaConvertedTo       string `json:"proformaConvertedTo,omitempty"       bson:"proformaConvertedTo,omitempty"`
	ProformaConvertedToNumber string `json:"proformaConvertedToNumber,omitempty" bson:"proformaConvertedToNumber,omitempty"`
	LinkedSalesOrderIDs []string `json:"linkedSalesOrderIds,omitempty" bson:"linkedSalesOrderIds,omitempty"`
	LinkedDNID          string   `json:"linkedDnId,omitempty"          bson:"linkedDnId,omitempty"`
	LinkedDNNumber      string   `json:"linkedDnNumber,omitempty"      bson:"linkedDnNumber,omitempty"`
	SalesReturns       []SalesReturn `json:"salesReturns,omitempty"      bson:"salesReturns,omitempty"`
	DueSoonAlertSent      bool       `json:"dueSoonAlertSent,omitempty"      bson:"dueSoonAlertSent,omitempty"`
	OverdueAlertSent      bool       `json:"overdueAlertSent,omitempty"      bson:"overdueAlertSent,omitempty"`
	LastOverdueReminderAt *time.Time `json:"lastOverdueReminderAt,omitempty" bson:"lastOverdueReminderAt,omitempty"`
	VoidReason         string    `json:"voidReason,omitempty"        bson:"voidReason,omitempty"`
	VoidedAt           time.Time `json:"voidedAt,omitempty"          bson:"voidedAt,omitempty"`
	OrgID              string    `json:"orgId,omitempty"             bson:"orgId,omitempty"`
	CreatedAt     time.Time          `json:"createdAt"                 bson:"createdAt"`
	UpdatedAt     time.Time          `json:"updatedAt"                 bson:"updatedAt"`
	CreatedBy     string             `json:"createdBy"                 bson:"createdBy"`
}
