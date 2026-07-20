package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PayrollSchedule is a recurring-run config the scheduler uses to auto-create
// PayRun documents on a cadence (weekly/biweekly/monthly/yearly) — same shape as
// RecurringInvoice. It only ever creates the PayRun in "draft" and, if
// AutoGeneratePayslips is set, also generates its draft payslips. Approve /
// mark-paid (the steps that post GL entries and move money) always stay a manual
// human action — the schedule never advances a run past draft on its own.
type PayrollSchedule struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	ProfileName string             `json:"profileName"   bson:"profileName"` // e.g. "Monthly payroll"
	Status      string             `json:"status"        bson:"status"`      // active | paused | completed

	// Schedule
	Frequency string `json:"frequency" bson:"frequency"` // weekly | biweekly | monthly | yearly
	Interval  int    `json:"interval"  bson:"interval"`  // every N periods (>=1)
	StartDate string `json:"startDate" bson:"startDate"` // YYYY-MM-DD — first period's start
	EndDate   string `json:"endDate"   bson:"endDate"`   // YYYY-MM-DD or "" (no end)
	MaxCount  int    `json:"maxCount"  bson:"maxCount"`  // cap on pay runs generated; 0 = unlimited

	// Runtime bookkeeping
	NextRunDate     string     `json:"nextRunDate"     bson:"nextRunDate"` // YYYY-MM-DD — next period's start date
	GeneratedCount  int        `json:"generatedCount"  bson:"generatedCount"`
	LastGeneratedAt *time.Time `json:"lastGeneratedAt,omitempty" bson:"lastGeneratedAt,omitempty"`
	LastRunNumber   string     `json:"lastRunNumber,omitempty"   bson:"lastRunNumber,omitempty"`

	// Pay run shaping
	PayDateOffsetDays   int      `json:"payDateOffsetDays"   bson:"payDateOffsetDays"` // payDate = periodEnd + N days
	EmployeeIDs         []string `json:"employeeIds,omitempty" bson:"employeeIds,omitempty"` // empty = all active employees at run time
	AutoGeneratePayslips bool    `json:"autoGeneratePayslips" bson:"autoGeneratePayslips"`   // also run payslip generation right after creating the draft run

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
}
