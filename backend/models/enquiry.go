package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type EnquiryLineItem struct {
	ItemId    string  `json:"itemId,omitempty" bson:"itemId,omitempty"`
	ItemName  string  `json:"itemName"         bson:"itemName"`
	Qty       float64 `json:"qty"              bson:"qty"`
	UnitPrice float64 `json:"unitPrice"        bson:"unitPrice"`
	Total     float64 `json:"total"            bson:"total"`
}

// FollowUpEntry is one dated, commented follow-up on an enquiry. The list is
// append-and-edit: a new call/visit adds an entry, and a past entry's date/comment
// can still be corrected afterward. Has its own ID so a specific entry is addressable.
type FollowUpEntry struct {
	ID        primitive.ObjectID `json:"id"        bson:"id"`
	Date      string             `json:"date"      bson:"date"` // YYYY-MM-DD
	Comment   string             `json:"comment"   bson:"comment"`
	CreatedBy string             `json:"createdBy,omitempty" bson:"createdBy,omitempty"`
	CreatedAt time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time          `json:"updatedAt" bson:"updatedAt"`
}

type Enquiry struct {
	ID             primitive.ObjectID `json:"_id,omitempty"    bson:"_id,omitempty"`
	EnquiryNumber  string             `json:"enquiryNumber"    bson:"enquiryNumber"`
	Date           string             `json:"date"             bson:"date"`
	CustomerName   string             `json:"customerName"     bson:"customerName"`
	ProjectName    string             `json:"projectName"      bson:"projectName"`
	Supplier       string             `json:"supplier"         bson:"supplier"`
	ContactPerson  string             `json:"contactPerson"    bson:"contactPerson"`
	ContactEmail   string             `json:"contactEmail"     bson:"contactEmail"`
	ContactPhone   string             `json:"contactPhone"     bson:"contactPhone"`
	Email          string             `json:"email"            bson:"email"`
	Phone          string             `json:"phone"            bson:"phone"`
	CustomerID     string             `json:"customerId,omitempty" bson:"customerId,omitempty"`
	Source         string             `json:"source"           bson:"source"`
	Subject        string             `json:"subject"          bson:"subject"`
	Description    string             `json:"description"      bson:"description"`
	EstimatedValue float64            `json:"estimatedValue"   bson:"estimatedValue"`
	LineItems      []EnquiryLineItem  `json:"lineItems,omitempty" bson:"lineItems,omitempty"`
	Priority       string             `json:"priority"         bson:"priority"`
	Status         string             `json:"status"           bson:"status"`
	AssignedTo     string             `json:"assignedTo"       bson:"assignedTo"`
	// FollowUpDate is DERIVED, not hand-edited: the nearest upcoming date in FollowUps,
	// or (if none upcoming) the most recent overdue one. Recomputed by the follow-up
	// add/update endpoints. Kept as a plain scalar so the scheduler, dashboard widget,
	// and list quick-filters/sorting below don't need to know about the list at all.
	FollowUpDate string          `json:"followUpDate"     bson:"followUpDate"`
	FollowUps    []FollowUpEntry `json:"followUps,omitempty" bson:"followUps,omitempty"`
	// FollowUpReminderDate is the day a follow-up reminder was last pushed (YYYY-MM-DD),
	// so the daily scheduler fires at most once per follow-up date.
	FollowUpReminderDate string       `json:"followUpReminderDate,omitempty" bson:"followUpReminderDate,omitempty"`
	Notes          string             `json:"notes"            bson:"notes"`
	OrgID          string             `json:"orgId,omitempty"  bson:"orgId,omitempty"`
	CreatedBy      string             `json:"createdBy"        bson:"createdBy"`
	CreatedAt      time.Time          `json:"createdAt"        bson:"createdAt"`
	UpdatedAt      time.Time          `json:"updatedAt"        bson:"updatedAt"`
}
