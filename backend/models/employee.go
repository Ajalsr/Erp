package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Employee is the HR directory record for a person working at the org. It is
// deliberately standalone from Users/OrgMember — most employees never log into
// the app. UserID is an OPTIONAL link to an existing OrgMember/Users login
// (validated on write, not a DB-enforced ref) for the subset of employees who
// also have app access.
//
// Compensation lives in SalaryStructure, not here, so a role can be granted
// employee-directory access without ever seeing pay data.
type Employee struct {
	ID           primitive.ObjectID `json:"_id,omitempty"  bson:"_id,omitempty"`
	EmployeeCode string             `json:"employeeCode"   bson:"employeeCode"` // EMP-0001, auto

	// ── Identity ─────────────────────────────────────────────
	FirstName     string `json:"firstName"                bson:"firstName"`
	LastName      string `json:"lastName"                 bson:"lastName"`
	DisplayName   string `json:"displayName"               bson:"displayName"` // defaults FirstName+" "+LastName
	Photo         string `json:"photo,omitempty"           bson:"photo,omitempty"` // base64 data-URL
	Gender        string `json:"gender,omitempty"          bson:"gender,omitempty"`
	DateOfBirth   string `json:"dateOfBirth,omitempty"      bson:"dateOfBirth,omitempty"` // YYYY-MM-DD
	Nationality   string `json:"nationality,omitempty"      bson:"nationality,omitempty"`
	MaritalStatus string `json:"maritalStatus,omitempty"    bson:"maritalStatus,omitempty"`

	// ── Contact ──────────────────────────────────────────────
	Email                 string `json:"email"                           bson:"email"`
	Phone                 string `json:"phone,omitempty"                 bson:"phone,omitempty"`
	Address               string `json:"address,omitempty"               bson:"address,omitempty"`
	EmergencyContactName  string `json:"emergencyContactName,omitempty"  bson:"emergencyContactName,omitempty"`
	EmergencyContactPhone string `json:"emergencyContactPhone,omitempty" bson:"emergencyContactPhone,omitempty"`

	// ── Employment ───────────────────────────────────────────
	JobTitle        string `json:"jobTitle"                  bson:"jobTitle"`
	Department      string `json:"department,omitempty"      bson:"department,omitempty"`
	Location        string `json:"location,omitempty"        bson:"location,omitempty"` // office/branch
	EmploymentType  string `json:"employmentType"            bson:"employmentType"`      // full_time | part_time | contract | intern
	Status          string `json:"status"                    bson:"status"`              // active | on_leave | suspended | terminated | resigned
	HireDate        string `json:"hireDate"                  bson:"hireDate"`             // YYYY-MM-DD
	TerminationDate string `json:"terminationDate,omitempty" bson:"terminationDate,omitempty"`
	// ReportsTo is the manager's Employee._id hex. Empty = a root of the org chart.
	ReportsTo string `json:"reportsTo,omitempty" bson:"reportsTo,omitempty"`

	// UserID optionally links this employee to an existing login account
	// (Users.UserID / OrgMember.UserID for this org). Empty = directory-only,
	// no app access.
	UserID string `json:"userId,omitempty" bson:"userId,omitempty"`

	// ── Compliance (UAE-oriented, all optional) ───────────────
	EmiratesID       string `json:"emiratesId,omitempty"       bson:"emiratesId,omitempty"`
	EmiratesIDExpiry string `json:"emiratesIdExpiry,omitempty" bson:"emiratesIdExpiry,omitempty"`
	PassportNumber   string `json:"passportNumber,omitempty"   bson:"passportNumber,omitempty"`
	PassportExpiry   string `json:"passportExpiry,omitempty"   bson:"passportExpiry,omitempty"`
	VisaNumber       string `json:"visaNumber,omitempty"       bson:"visaNumber,omitempty"`
	VisaExpiry       string `json:"visaExpiry,omitempty"       bson:"visaExpiry,omitempty"`
	LaborCardNumber  string `json:"laborCardNumber,omitempty"  bson:"laborCardNumber,omitempty"`

	// ── Bank (payroll disbursement reference only — no bank integration) ──
	BankName          string `json:"bankName,omitempty"          bson:"bankName,omitempty"`
	BankAccountNumber string `json:"bankAccountNumber,omitempty" bson:"bankAccountNumber,omitempty"`
	BankIBAN          string `json:"bankIban,omitempty"          bson:"bankIban,omitempty"`

	Notes string `json:"notes,omitempty" bson:"notes,omitempty"`

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
