package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// BankReconciliation is a saved, completed reconciliation snapshot for a bank
// account against a bank statement on a given date.
type BankReconciliation struct {
	ID                primitive.ObjectID `json:"_id,omitempty"      bson:"_id,omitempty"`
	OrgID             string             `json:"orgId"              bson:"orgId"`
	AccountID         string             `json:"accountId"          bson:"accountId"`
	AccountName       string             `json:"accountName"        bson:"accountName"`
	StatementDate     string             `json:"statementDate"      bson:"statementDate"`     // YYYY-MM-DD
	StatementBalance  float64            `json:"statementBalance"   bson:"statementBalance"`  // ending balance per the bank
	ClearedBalance    float64            `json:"clearedBalance"     bson:"clearedBalance"`    // sum of cleared book txns
	Difference        float64            `json:"difference"         bson:"difference"`        // statement - cleared (0 when reconciled)
	ClearedCount      int                `json:"clearedCount"       bson:"clearedCount"`
	Status            string             `json:"status"             bson:"status"`            // reconciled
	CreatedBy         string             `json:"createdBy"          bson:"createdBy"`
	CreatedAt         time.Time          `json:"createdAt"          bson:"createdAt"`
}

// BankClearing marks one journal entry (touching a bank account) as cleared on
// the bank statement. Persisted as the user ticks transactions, so progress
// survives across sessions and feeds the next reconciliation's opening balance.
type BankClearing struct {
	ID        primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	OrgID     string             `json:"orgId"         bson:"orgId"`
	AccountID string             `json:"accountId"     bson:"accountId"`
	JeID      string             `json:"jeId"          bson:"jeId"` // journal entry _id (hex)
	ClearedAt time.Time          `json:"clearedAt"     bson:"clearedAt"`
	ClearedBy string             `json:"clearedBy"     bson:"clearedBy"`
}
