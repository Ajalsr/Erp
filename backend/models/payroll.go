package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// SalaryComponent is one earning or deduction line, flat amount (no
// percent-of-basic formula engine in v1 — see plan decisions).
type SalaryComponent struct {
	Name   string  `json:"name"   bson:"name"`   // "Housing Allowance", "Loan Installment"
	Type   string  `json:"type"   bson:"type"`   // earning | deduction
	Amount float64 `json:"amount" bson:"amount"` // flat monthly amount
}

// SalaryStructure is versioned per employee — a new row is inserted (never
// edited in place) whenever pay changes, so history survives for audit and
// for recomputing past payslips.
type SalaryStructure struct {
	ID            primitive.ObjectID `json:"_id,omitempty"   bson:"_id,omitempty"`
	EmployeeID    string             `json:"employeeId"      bson:"employeeId"`
	EffectiveFrom string             `json:"effectiveFrom"   bson:"effectiveFrom"` // YYYY-MM-DD
	Currency      string             `json:"currency"        bson:"currency"`      // defaults org.BaseCurrency
	BasicSalary   float64            `json:"basicSalary"     bson:"basicSalary"`
	Allowances    []SalaryComponent  `json:"allowances,omitempty" bson:"allowances,omitempty"` // type="earning"
	Deductions    []SalaryComponent  `json:"deductions,omitempty" bson:"deductions,omitempty"` // type="deduction", recurring (e.g. loan installment)
	GrossMonthly  float64            `json:"grossMonthly"    bson:"grossMonthly"`               // computed = basic + sum(allowances)
	Status        string             `json:"status"          bson:"status"`                     // active | superseded

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}

// PayRun is one payroll cycle covering a set of employees.
type PayRun struct {
	ID              primitive.ObjectID `json:"_id,omitempty"    bson:"_id,omitempty"`
	RunNumber       string             `json:"runNumber"        bson:"runNumber"` // PYR-2026-0001, auto
	PeriodStart     string             `json:"periodStart"      bson:"periodStart"`
	PeriodEnd       string             `json:"periodEnd"        bson:"periodEnd"`
	PayDate         string             `json:"payDate"          bson:"payDate"`
	Status          string             `json:"status"           bson:"status"` // draft | approved | paid | cancelled
	EmployeeIDs     []string           `json:"employeeIds"      bson:"employeeIds"`
	TotalGross      float64            `json:"totalGross"       bson:"totalGross"`
	TotalDeductions float64            `json:"totalDeductions"  bson:"totalDeductions"`
	TotalNet        float64            `json:"totalNet"         bson:"totalNet"`
	Notes           string             `json:"notes,omitempty"  bson:"notes,omitempty"`
	ApprovedBy      string             `json:"approvedBy,omitempty" bson:"approvedBy,omitempty"`
	ApprovedAt      *time.Time         `json:"approvedAt,omitempty" bson:"approvedAt,omitempty"`
	PaidAt          *time.Time         `json:"paidAt,omitempty"     bson:"paidAt,omitempty"`

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}

// Payslip is one employee's computed pay for one PayRun — generated, not
// hand-entered, and it snapshots employee/salary data so later edits to
// Employee/SalaryStructure never retroactively change an already-generated
// payslip.
type Payslip struct {
	ID              primitive.ObjectID `json:"_id,omitempty"    bson:"_id,omitempty"`
	PayslipNumber   string             `json:"payslipNumber"    bson:"payslipNumber"` // PS-2026-0001, auto
	PayRunID        string             `json:"payRunId"         bson:"payRunId"`
	EmployeeID      string             `json:"employeeId"       bson:"employeeId"`
	EmployeeCode    string             `json:"employeeCode"     bson:"employeeCode"` // snapshot
	EmployeeName    string             `json:"employeeName"     bson:"employeeName"` // snapshot
	JobTitle        string             `json:"jobTitle"         bson:"jobTitle"`     // snapshot
	PeriodStart     string             `json:"periodStart"      bson:"periodStart"`
	PeriodEnd       string             `json:"periodEnd"        bson:"periodEnd"`
	PayDate         string             `json:"payDate"          bson:"payDate"`
	Currency        string             `json:"currency"         bson:"currency"`
	BasicSalary     float64            `json:"basicSalary"      bson:"basicSalary"`
	Earnings        []SalaryComponent  `json:"earnings"         bson:"earnings"`
	Deductions      []SalaryComponent  `json:"deductions"       bson:"deductions"`
	GrossPay        float64            `json:"grossPay"         bson:"grossPay"`
	TotalDeductions float64            `json:"totalDeductions"  bson:"totalDeductions"`
	NetPay          float64            `json:"netPay"           bson:"netPay"`
	// Unpaid leave (approved LeaveRequests against a LeaveType with paid=false,
	// overlapping this run's period) reduces GrossPay directly — see
	// generatePayslipsForRun. Daily rate = BasicSalary / 30 (flat, no formula
	// engine — same convention as SalaryComponent amounts).
	UnpaidLeaveDays      float64 `json:"unpaidLeaveDays,omitempty"      bson:"unpaidLeaveDays,omitempty"`
	UnpaidLeaveDeduction float64 `json:"unpaidLeaveDeduction,omitempty" bson:"unpaidLeaveDeduction,omitempty"`
	Status               string  `json:"status"           bson:"status"` // draft | final | paid

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
}
