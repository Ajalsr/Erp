package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// LeaveType is an org-defined category of leave (Annual, Sick, Unpaid, ...).
type LeaveType struct {
	ID                  primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Name                string             `json:"name" bson:"name"`
	Code                string             `json:"code" bson:"code"`
	AccrualDaysPerYear  float64            `json:"accrualDaysPerYear" bson:"accrualDaysPerYear"` // 0 = not accrual-based (e.g. unpaid leave)
	Paid                bool               `json:"paid" bson:"paid"`
	CarryForwardMaxDays float64            `json:"carryForwardMaxDays,omitempty" bson:"carryForwardMaxDays,omitempty"`
	RequiresApproval    bool               `json:"requiresApproval" bson:"requiresApproval"`
	Color               string             `json:"color,omitempty" bson:"color,omitempty"` // UI chip
	Status              string             `json:"status" bson:"status"`                   // active | inactive

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" bson:"updatedAt"`
	CreatedBy string    `json:"createdBy" bson:"createdBy"`
}

// LeaveBalance is one employee's entitlement/usage for one leave type in one
// calendar year.
type LeaveBalance struct {
	ID             primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	EmployeeID     string             `json:"employeeId"  bson:"employeeId"`
	LeaveTypeID    string             `json:"leaveTypeId" bson:"leaveTypeId"`
	Year           int                `json:"year"         bson:"year"`
	Entitled       float64            `json:"entitled"       bson:"entitled"`
	CarriedForward float64            `json:"carriedForward,omitempty" bson:"carriedForward,omitempty"`
	Used           float64            `json:"used"           bson:"used"`
	Adjusted       float64            `json:"adjusted,omitempty" bson:"adjusted,omitempty"` // manual HR correction, +/-
	Remaining      float64            `json:"remaining"      bson:"remaining"`               // entitled+carriedForward+adjusted-used

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" bson:"updatedAt"`
}

// LeaveApprovalStep is a snapshot of one approver, resolved from the org chart
// at submission time so later reportsTo edits never retroactively change a
// request already in flight.
type LeaveApprovalStep struct {
	ApproverEmployeeID string     `json:"approverEmployeeId" bson:"approverEmployeeId"`
	ApproverUserID     string     `json:"approverUserId,omitempty" bson:"approverUserId,omitempty"`
	ApproverName       string     `json:"approverName" bson:"approverName"`
	Status             string     `json:"status" bson:"status"` // pending | approved | rejected
	DecidedAt          *time.Time `json:"decidedAt,omitempty" bson:"decidedAt,omitempty"`
	Reason             string     `json:"reason,omitempty" bson:"reason,omitempty"`
}

// LeaveRequest routes through a bespoke chain (resolved from Employee.ReportsTo),
// not the generic ApprovalPolicy engine — see plan notes: the generic engine
// routes by org-wide role, not by "this employee's manager."
type LeaveRequest struct {
	ID            primitive.ObjectID  `json:"_id,omitempty" bson:"_id,omitempty"`
	RequestNumber string              `json:"requestNumber" bson:"requestNumber"` // LR-0001, auto
	EmployeeID    string              `json:"employeeId"     bson:"employeeId"`
	EmployeeName  string              `json:"employeeName"   bson:"employeeName"` // snapshot
	LeaveTypeID   string              `json:"leaveTypeId"    bson:"leaveTypeId"`
	LeaveTypeName string              `json:"leaveTypeName"  bson:"leaveTypeName"` // snapshot
	StartDate     string              `json:"startDate" bson:"startDate"`
	EndDate       string              `json:"endDate"   bson:"endDate"`
	Days          float64             `json:"days" bson:"days"` // calendar-day count, computed on submit
	Reason        string              `json:"reason,omitempty" bson:"reason,omitempty"`
	Status        string              `json:"status" bson:"status"` // pending_approval | approved | rejected | cancelled
	ApproverChain []LeaveApprovalStep `json:"approverChain,omitempty" bson:"approverChain,omitempty"`
	CurrentStep   int                 `json:"currentStep" bson:"currentStep"`
	DecidedBy     string              `json:"decidedBy,omitempty" bson:"decidedBy,omitempty"`
	DecidedAt     *time.Time          `json:"decidedAt,omitempty" bson:"decidedAt,omitempty"`

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" bson:"updatedAt"`
	CreatedBy string    `json:"createdBy" bson:"createdBy"`
}
