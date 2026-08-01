package models

import "time"

// Contact is a reusable party block — a company/party plus its point of
// contact. Sub-contractors and consultants each have many of these; the client
// has one. Role labels the consultant kind ("Design", "MEP", "LEED", …) and is
// left empty for sub-contractors and the client.
type Contact struct {
	Name          string `json:"name,omitempty"          bson:"name,omitempty"`
	Role          string `json:"role,omitempty"          bson:"role,omitempty"`
	ContactPerson string `json:"contactPerson,omitempty" bson:"contactPerson,omitempty"`
	Position      string `json:"position,omitempty"      bson:"position,omitempty"`
	ContactNumber string `json:"contactNumber,omitempty" bson:"contactNumber,omitempty"`
}

// Project captures a construction/supply project's stakeholders — mirrors the
// "Project Details" sheet: header fields plus multiple sub-contractors and
// consultants, one client, one main contractor.
type Project struct {
	ID    string `json:"id,omitempty"    bson:"_id,omitempty"`
	OrgID string `json:"orgId,omitempty" bson:"orgId,omitempty"`

	ProjectNo     string `json:"projectNo"     bson:"projectNo"`     // user-entered, not auto
	ProjectName   string `json:"projectName"   bson:"projectName"`
	Emirates      string `json:"emirates"      bson:"emirates"`
	Location      string `json:"location"      bson:"location"`      // location with land mark
	TypeOfProject string `json:"typeOfProject" bson:"typeOfProject"`
	ItemsProposed string `json:"itemsProposed" bson:"itemsProposed"`

	MainContractor string    `json:"mainContractor" bson:"mainContractor"`
	SubContractors []Contact `json:"subContractors" bson:"subContractors"`
	Consultants    []Contact `json:"consultants"    bson:"consultants"`
	Client         Contact   `json:"client"         bson:"client"`

	CreatedBy string    `json:"createdBy,omitempty" bson:"createdBy,omitempty"`
	CreatedAt time.Time `json:"createdAt"           bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"           bson:"updatedAt"`
}
