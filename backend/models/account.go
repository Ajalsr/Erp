package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Account struct {
	ID            primitive.ObjectID `json:"_id,omitempty"    bson:"_id,omitempty"`
	AccountCode   string             `json:"accountCode"      bson:"accountCode"`
	AccountName   string             `json:"accountName"      bson:"accountName"`
	AccountType   string             `json:"accountType"      bson:"accountType"`   // asset | liability | equity | income | expense
	SubType       string             `json:"subType"          bson:"subType"`       // current_asset | fixed_asset | current_liability | etc.
	Description   string             `json:"description"      bson:"description"`
	Balance       float64            `json:"balance"          bson:"balance"`       // computed, not stored
	NormalBalance string             `json:"normalBalance"    bson:"normalBalance"` // debit | credit
	Status        string             `json:"status"           bson:"status"`        // active | inactive
	IsSystem      bool               `json:"isSystem"         bson:"isSystem"`      // seeded defaults — cannot be deleted
	IsBankAccount bool               `json:"isBankAccount"    bson:"isBankAccount"` // cash/bank accounts for payments
	ParentID      string             `json:"parentId,omitempty" bson:"parentId,omitempty"` // hierarchy

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
