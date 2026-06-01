package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type JournalLine struct {
	AccountID   string  `json:"accountId"   bson:"accountId"`
	AccountCode string  `json:"accountCode" bson:"accountCode"`
	AccountName string  `json:"accountName" bson:"accountName"`
	Debit       float64 `json:"debit"       bson:"debit"`
	Credit      float64 `json:"credit"      bson:"credit"`
	Description string  `json:"description" bson:"description"`
}

type JournalEntry struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	OrgID       string             `json:"orgId"         bson:"orgId"`
	EntryNumber string             `json:"entryNumber"   bson:"entryNumber"`
	Date        string             `json:"date"          bson:"date"`
	Reference   string             `json:"reference"     bson:"reference"` // invoice/bill/payment number
	RefType     string             `json:"refType"       bson:"refType"`   // invoice | bill | payment | vendor_payment | manual
	RefID       string             `json:"refId"         bson:"refId"`     // source document _id
	Description string             `json:"description"   bson:"description"`
	Lines       []JournalLine      `json:"lines"         bson:"lines"`
	TotalDebit  float64            `json:"totalDebit"    bson:"totalDebit"`
	TotalCredit float64            `json:"totalCredit"   bson:"totalCredit"`
	IsReversed  bool               `json:"isReversed"    bson:"isReversed"`
	ReversedBy  string             `json:"reversedBy,omitempty" bson:"reversedBy,omitempty"`
	CreatedBy   string             `json:"createdBy"     bson:"createdBy"`
	CreatedAt   time.Time          `json:"createdAt"     bson:"createdAt"`
	UpdatedAt   time.Time          `json:"updatedAt"     bson:"updatedAt"`
}
