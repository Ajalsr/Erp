package models

import "time"

// Letter is a free-form company letter (warranty, bank details, reference,
// NOC, HR letters like offer/warning, or custom) — letterhead + title + free
// text body, optionally addressed to a customer OR employee on file. No
// approval/status workflow — issue and done.
type Letter struct {
	ID           string `json:"id,omitempty"           bson:"_id,omitempty"`
	OrgID        string `json:"orgId,omitempty"        bson:"orgId,omitempty"`
	LetterNumber string `json:"letterNumber"           bson:"letterNumber"`
	Type         string `json:"type"                   bson:"type"` // warranty | bank_details | reference | noc | offer_letter | appointment_letter | warning_letter | experience_letter | relieving_letter | salary_certificate | promotion_letter | termination_letter | custom
	Title        string `json:"title"                  bson:"title"`
	Body         string `json:"body"                   bson:"body"`                // free text, line breaks preserved in the PDF
	Watermark    string `json:"watermark,omitempty"    bson:"watermark,omitempty"` // optional diagonal text (e.g. "DRAFT") stamped across every PDF page

	// Optional addressee — snapshotted at creation so the letter reads the
	// same later even if the customer/employee record changes. A letter is
	// addressed to at most one of customer or employee.
	CustomerID      string `json:"customerId,omitempty"      bson:"customerId,omitempty"`
	CustomerName    string `json:"customerName,omitempty"    bson:"customerName,omitempty"`
	CustomerAddress string `json:"customerAddress,omitempty" bson:"customerAddress,omitempty"`
	CustomerEmail   string `json:"customerEmail,omitempty"    bson:"customerEmail,omitempty"`

	EmployeeID    string `json:"employeeId,omitempty"    bson:"employeeId,omitempty"`
	EmployeeName  string `json:"employeeName,omitempty"  bson:"employeeName,omitempty"`
	EmployeeCode  string `json:"employeeCode,omitempty"  bson:"employeeCode,omitempty"`
	EmployeeEmail string `json:"employeeEmail,omitempty" bson:"employeeEmail,omitempty"`

	IssueDate time.Time `json:"issueDate" bson:"issueDate"`

	// PublicToken powers the unauthenticated "view online" link emailed with the
	// letter — generated the first time it's sent (see SendLetterEmail).
	PublicToken string `json:"publicToken,omitempty" bson:"publicToken,omitempty"`

	CreatedBy string    `json:"createdBy,omitempty" bson:"createdBy,omitempty"`
	CreatedAt time.Time `json:"createdAt"           bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"           bson:"updatedAt"`
}
