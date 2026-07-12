package models

import "time"

// Letter is a free-form company letter (warranty, bank details, reference,
// NOC, or custom) — letterhead + title + free text body, optionally addressed
// to a customer on file. No approval/status workflow — issue and done.
type Letter struct {
	ID           string    `json:"id,omitempty"           bson:"_id,omitempty"`
	OrgID        string    `json:"orgId,omitempty"        bson:"orgId,omitempty"`
	LetterNumber string    `json:"letterNumber"           bson:"letterNumber"`
	Type         string    `json:"type"                   bson:"type"` // warranty | bank_details | reference | noc | custom
	Title        string    `json:"title"                  bson:"title"`
	Body         string    `json:"body"                   bson:"body"` // free text, line breaks preserved in the PDF
	Watermark    string    `json:"watermark,omitempty"    bson:"watermark,omitempty"` // optional diagonal text (e.g. "DRAFT") stamped across every PDF page

	// Optional addressee — snapshotted at creation so the letter reads the
	// same later even if the customer record changes.
	CustomerID      string `json:"customerId,omitempty"      bson:"customerId,omitempty"`
	CustomerName    string `json:"customerName,omitempty"    bson:"customerName,omitempty"`
	CustomerAddress string `json:"customerAddress,omitempty" bson:"customerAddress,omitempty"`
	CustomerEmail   string `json:"customerEmail,omitempty"    bson:"customerEmail,omitempty"`

	IssueDate time.Time `json:"issueDate" bson:"issueDate"`

	CreatedBy string    `json:"createdBy,omitempty" bson:"createdBy,omitempty"`
	CreatedAt time.Time `json:"createdAt"           bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"           bson:"updatedAt"`
}
