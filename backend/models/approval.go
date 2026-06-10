package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ── Policy (configured in Org Settings → Approvals) ──────────────────────────

// ApprovalCondition is one trigger test, e.g. amount >= 10000.
type ApprovalCondition struct {
	ID    string      `json:"id"    bson:"id"`
	Field string      `json:"field" bson:"field"` // key from APPROVAL_FIELDS for the module
	Op    string      `json:"op"    bson:"op"`    // gte|lte|gt|lt|eq|ne|contains|...
	Value interface{} `json:"value" bson:"value"`
}

// ApprovalTrigger decides WHEN approval is required.
type ApprovalTrigger struct {
	Mode       string              `json:"mode"       bson:"mode"`       // always | conditions
	Match      string              `json:"match"      bson:"match"`      // all | any
	Conditions []ApprovalCondition `json:"conditions" bson:"conditions"`
}

// ApprovalStep is one node in the chain: a single role, or any-N-of a group, with an
// optional delegate role that may also act for this step.
type ApprovalStep struct {
	ID       string   `json:"id"       bson:"id"`
	Mode     string   `json:"mode"     bson:"mode"`     // single | quorum
	Roles    []string `json:"roles"    bson:"roles"`
	N        int      `json:"n"        bson:"n"`        // quorum count (single ⇒ 1)
	Delegate string   `json:"delegate" bson:"delegate"` // optional backup role
}

// ApprovalPolicy is the full per-module workflow.
type ApprovalPolicy struct {
	Enabled bool            `json:"enabled" bson:"enabled"`
	Trigger ApprovalTrigger `json:"trigger" bson:"trigger"`
	Steps   []ApprovalStep  `json:"steps"   bson:"steps"`
}

// ── Runtime request (one held document working through its chain) ────────────

// StepApproval records one person clearing a step.
type StepApproval struct {
	UserID string    `json:"userId" bson:"userId"`
	Role   string    `json:"role"   bson:"role"`
	At     time.Time `json:"at"     bson:"at"`
}

// ApprovalStepState is a snapshot of a policy step plus who has signed it so far.
type ApprovalStepState struct {
	Mode      string         `json:"mode"      bson:"mode"`
	Roles     []string       `json:"roles"     bson:"roles"`
	N         int            `json:"n"         bson:"n"`
	Delegate  string         `json:"delegate"  bson:"delegate"`
	Approvals []StepApproval `json:"approvals" bson:"approvals"`
	Done      bool           `json:"done"      bson:"done"`
}

// ApprovalRequest holds a document's create payload while it works through the chain.
// On final approval the Payload is replayed through the doc's normal create path.
type ApprovalRequest struct {
	ID    primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	OrgID string             `json:"orgId"         bson:"orgId"`

	DocType string `json:"docType" bson:"docType"` // bill | invoice | vendor_payment | payment | po | ...
	Action  string `json:"action"  bson:"action"`  // create | update | delete
	DocID   string `json:"docId,omitempty" bson:"docId,omitempty"` // target doc for update/delete
	PermKey string `json:"permKey" bson:"permKey"` // module key (used for legacy permission fallback)

	Title  string  `json:"title"  bson:"title"`
	Amount float64 `json:"amount" bson:"amount"`

	Payload bson.M `json:"payload" bson:"payload"`

	// Chain state.
	Steps       []ApprovalStepState `json:"steps"       bson:"steps"`
	CurrentStep int                 `json:"currentStep" bson:"currentStep"`

	Status string `json:"status" bson:"status"` // pending | approved | rejected

	RequestedBy     string    `json:"requestedBy"     bson:"requestedBy"`
	RequestedByName string    `json:"requestedByName" bson:"requestedByName"`
	RequestedAt     time.Time `json:"requestedAt"     bson:"requestedAt"`

	DecidedBy string    `json:"decidedBy,omitempty" bson:"decidedBy,omitempty"`
	DecidedAt time.Time `json:"decidedAt,omitempty" bson:"decidedAt,omitempty"`
	Reason    string    `json:"reason,omitempty"    bson:"reason,omitempty"`

	ResultDocID     string `json:"resultDocId,omitempty"     bson:"resultDocId,omitempty"`
	ResultDocNumber string `json:"resultDocNumber,omitempty" bson:"resultDocNumber,omitempty"`
}
