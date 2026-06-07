package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RolePerm holds one role's access config:
//   Modules:   moduleKey → "none" | "view" | "edit"   (absent = inherit default)
//   Approvals: approvalKey → bool                       (e.g. po, grn, bill, payment)
type RolePerm struct {
	// Modules: moduleKey → capability list, any of "view" | "add" | "edit".
	// Empty/absent list = no access. Capabilities are independent (add ≠ edit).
	Modules   map[string][]string `bson:"modules,omitempty"   json:"modules,omitempty"`
	Approvals map[string]bool     `bson:"approvals,omitempty" json:"approvals,omitempty"`
	Settings  bool                `bson:"settings,omitempty"  json:"settings,omitempty"` // may open org Settings
}

// Organization represents a workspace/team that users belong to
type Organization struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Name             string             `bson:"name" json:"name" binding:"required"`
	Description      string             `bson:"description,omitempty" json:"description,omitempty"`
	LetterheadImage     string             `bson:"letterheadImage,omitempty" json:"letterheadImage,omitempty"`       // base64 data-URL
	LetterheadTopPad    int                `bson:"letterheadTopPad,omitempty" json:"letterheadTopPad,omitempty"`     // px to skip letterhead header
	LetterheadBottomPad int                `bson:"letterheadBottomPad,omitempty" json:"letterheadBottomPad,omitempty"` // px to skip letterhead footer
	// Per-role access matrix: role → permissions. Owner/admin always full (not stored).
	RolePermissions map[string]RolePerm `bson:"rolePermissions,omitempty" json:"rolePermissions,omitempty"`
	// CustomRoles: org-defined assignable roles (besides built-in owner/admin).
	// Empty on legacy orgs → falls back to ["member","viewer"].
	CustomRoles []string `bson:"customRoles,omitempty" json:"customRoles,omitempty"`
	CreatedBy        string             `bson:"createdBy" json:"createdBy"`
	CreatedAt        time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt        time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// OrgMember links a user to an organization with a role
// Roles: owner | admin | member | viewer
type OrgMember struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	OrgID     primitive.ObjectID `bson:"orgId" json:"orgId"`
	UserID    string             `bson:"userId" json:"userId"`
	Role      string             `bson:"role" json:"role"`
	Status    string             `bson:"status" json:"status"` // active | invited
	InvitedBy string             `bson:"invitedBy,omitempty" json:"invitedBy,omitempty"`
	JoinedAt  time.Time          `bson:"joinedAt,omitempty" json:"joinedAt,omitempty"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
}

// Invitation represents a pending invite sent via email link.
// The token is the only secret — whoever clicks the link and logs in gets added.
type Invitation struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	OrgID     primitive.ObjectID `bson:"orgId" json:"orgId"`
	OrgName   string             `bson:"orgName" json:"orgName"`
	Email     string             `bson:"email" json:"email"`                     // the email the invite was sent to
	UserID    string             `bson:"userId,omitempty" json:"userId,omitempty"` // set after accepted
	Role      string             `bson:"role" json:"role"`
	Token     string             `bson:"token" json:"token"`
	InvitedBy string             `bson:"invitedBy" json:"invitedBy"`
	ExpiresAt time.Time          `bson:"expiresAt" json:"expiresAt"`
	Status    string             `bson:"status" json:"status"` // pending | accepted | expired
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
}
