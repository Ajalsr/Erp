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

type Enquiry struct {
	ID             primitive.ObjectID `json:"_id,omitempty"    bson:"_id,omitempty"`
	EnquiryNumber  string             `json:"enquiryNumber"    bson:"enquiryNumber"`
	Date           string             `json:"date"             bson:"date"`
	CustomerName   string             `json:"customerName"     bson:"customerName"`
	Email          string             `json:"email"            bson:"email"`
	Phone          string             `json:"phone"            bson:"phone"`
	Company        string             `json:"company"          bson:"company"`
	CustomerID     string             `json:"customerId,omitempty" bson:"customerId,omitempty"`
	Source         string             `json:"source"           bson:"source"`
	Subject        string             `json:"subject"          bson:"subject"`
	Description    string             `json:"description"      bson:"description"`
	EstimatedValue float64            `json:"estimatedValue"   bson:"estimatedValue"`
	LineItems      []EnquiryLineItem  `json:"lineItems,omitempty" bson:"lineItems,omitempty"`
	Priority       string             `json:"priority"         bson:"priority"`
	Status         string             `json:"status"           bson:"status"`
	AssignedTo     string             `json:"assignedTo"       bson:"assignedTo"`
	FollowUpDate   string             `json:"followUpDate"     bson:"followUpDate"`
	// FollowUpReminderDate is the day a follow-up reminder was last pushed (YYYY-MM-DD),
	// so the daily scheduler fires at most once per follow-up date.
	FollowUpReminderDate string       `json:"followUpReminderDate,omitempty" bson:"followUpReminderDate,omitempty"`
	Notes          string             `json:"notes"            bson:"notes"`
	OrgID          string             `json:"orgId,omitempty"  bson:"orgId,omitempty"`
	CreatedBy      string             `json:"createdBy"        bson:"createdBy"`
	CreatedAt      time.Time          `json:"createdAt"        bson:"createdAt"`
	UpdatedAt      time.Time          `json:"updatedAt"        bson:"updatedAt"`
}
