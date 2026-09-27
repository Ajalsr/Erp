package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/bsontype"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ModuleCaps is a role's capability list for one module ("view"/"add"/"edit").
// It tolerates the legacy storage format where a module mapped to a single
// string ("none"|"view"|"edit") instead of an array, so old org documents
// still decode instead of failing the whole query.
type ModuleCaps []string

func (mc *ModuleCaps) UnmarshalBSONValue(t bsontype.Type, data []byte) error {
	switch t {
	case bsontype.Array:
		var arr []string
		if err := bson.UnmarshalValue(t, data, &arr); err != nil {
			return err
		}
		*mc = arr
	case bsontype.String:
		var s string
		if err := bson.UnmarshalValue(t, data, &s); err != nil {
			return err
		}
		// Legacy single-value form → expand to the new capability list.
		switch s {
		case "edit":
			*mc = ModuleCaps{"view", "add", "edit"}
		case "view":
			*mc = ModuleCaps{"view"}
		default: // "none" / "" → no access
			*mc = ModuleCaps{}
		}
	case bsontype.Null, bsontype.Undefined:
		*mc = nil
	default:
		*mc = nil
	}
	return nil
}

// RolePerm holds one role's access config:
//
//	Modules:   moduleKey → capability list (legacy: single string)
//	Approvals: approvalKey → bool                       (e.g. po, grn, bill, payment)
type RolePerm struct {
	// Modules: moduleKey → capability list, any of
	//   "view" | "add" | "edit" | "delete" | "export".
	// Empty/absent list = no access. Capabilities are independent (add ≠ edit).
	// Enforced server-side by middlewares.RequireModule.
	Modules   map[string]ModuleCaps `bson:"modules,omitempty"   json:"modules,omitempty"`
	Approvals map[string]bool       `bson:"approvals,omitempty" json:"approvals,omitempty"`
	Settings  bool                  `bson:"settings,omitempty"  json:"settings,omitempty"` // may open org Settings
	// Scope: LEGACY module-wide record visibility, "all" | "own". Kept for back-compat;
	// per-action Scopes below take precedence. owner/admin always "all".
	Scope map[string]string `bson:"scope,omitempty" json:"scope,omitempty"`
	// Scopes: moduleKey → per-action record visibility. Each of view/edit/delete is
	// "all" | "own" (absent/"" = "all"). Add has no scope (creating a record). This
	// supersedes the legacy Scope map. Enforced per-controller via scopeForModule(action).
	Scopes map[string]ScopeSet `bson:"scopes,omitempty" json:"scopes,omitempty"`
}

// ScopeSet is per-action record visibility for one module.
type ScopeSet struct {
	View   string `bson:"view,omitempty"   json:"view,omitempty"`
	Edit   string `bson:"edit,omitempty"   json:"edit,omitempty"`
	Delete string `bson:"delete,omitempty" json:"delete,omitempty"`
}

// OrgLicense: which modules this org's plan includes. Nil/empty Modules =
// unrestricted (see Organization.License doc comment for the rollout reasoning).
type OrgLicense struct {
	Modules   []string   `bson:"modules,omitempty"   json:"modules,omitempty"`
	ExpiresAt *time.Time `bson:"expiresAt,omitempty" json:"expiresAt,omitempty"`
}

// Organization represents a workspace/team that users belong to
type Organization struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Name        string             `bson:"name" json:"name" binding:"required"`
	Description string             `bson:"description,omitempty" json:"description,omitempty"`
	Address     string             `bson:"address,omitempty" json:"address,omitempty"`
	TRN         string             `bson:"trn,omitempty" json:"trn,omitempty"` // Tax Registration Number, shown on documents (e.g. Purchase Order)
	// BaseCurrency is the org's reporting/ledger currency (ISO 4217, e.g. "AED").
	// Every transaction in a foreign currency is converted to this for GL postings
	// and financial statements. Empty on legacy orgs → treated as "AED".
	BaseCurrency        string `bson:"baseCurrency,omitempty" json:"baseCurrency,omitempty"`
	LetterheadImage     string `bson:"letterheadImage,omitempty" json:"letterheadImage,omitempty"`         // base64 data-URL
	LetterheadTopPad    int    `bson:"letterheadTopPad,omitempty" json:"letterheadTopPad,omitempty"`       // px to skip letterhead header
	LetterheadBottomPad int    `bson:"letterheadBottomPad,omitempty" json:"letterheadBottomPad,omitempty"` // px to skip letterhead footer
	StampImage          string `bson:"stampImage,omitempty" json:"stampImage,omitempty"`                   // base64 data-URL — company seal/stamp
	// Per-role access matrix: role → permissions. Owner/admin always full (not stored).
	RolePermissions map[string]RolePerm `bson:"rolePermissions,omitempty" json:"rolePermissions,omitempty"`
	// ApprovalSettings: legacy per-doc-type on/off toggle (superseded by ApprovalPolicies).
	ApprovalSettings map[string]bool `bson:"approvalSettings,omitempty" json:"approvalSettings,omitempty"`
	// ApprovalPolicies: per-module workflow — enabled + trigger conditions + a chain of
	// approval steps (single role or any-N-of-group, with optional delegate).
	ApprovalPolicies map[string]ApprovalPolicy `bson:"approvalPolicies,omitempty" json:"approvalPolicies,omitempty"`
	// CustomRoles: org-defined assignable roles (besides built-in owner/admin).
	// Empty on legacy orgs → falls back to ["member","viewer"].
	CustomRoles []string `bson:"customRoles,omitempty" json:"customRoles,omitempty"`
	// License: which modules this org's plan includes. Nil/empty Modules =
	// unrestricted — every org before this feature shipped, and any org an
	// admin hasn't explicitly licensed yet, keeps full access. Enforced
	// server-side by middlewares.RequireLicenseModule, mirrored client-side
	// by helper/permissions.js so unlicensed modules don't even render.
	License OrgLicense `bson:"license,omitempty" json:"license,omitempty"`
	// LicenseKeyID: the LicenseKey this org was created under (hex id), if any.
	// Used to enforce that key's MaxOrganizations cap — CountDocuments on this
	// field is how CreateOrganization counts "seats used" for a key.
	LicenseKeyID string `bson:"licenseKeyId,omitempty" json:"licenseKeyId,omitempty"`
	// MaxUsers: this org's own seat cap, chosen at creation time (≤ the
	// license key's MaxUsersPerOrg ceiling — same "key sets the ceiling, org
	// picks its own value within it" pattern as License.Modules vs
	// LicenseKey.AllowedModules). 0 = unlimited. Enforced by InviteMember;
	// "Option B" counting — the owner occupies one seat like everyone else.
	MaxUsers int `bson:"maxUsers" json:"maxUsers"`
	// MachineFingerprint: audit trail of which machine used the license key
	// to create this org.
	MachineFingerprint string    `bson:"machineFingerprint,omitempty" json:"-"`
	CreatedBy          string    `bson:"createdBy" json:"createdBy"`
	CreatedAt          time.Time `bson:"createdAt" json:"createdAt"`
	UpdatedAt          time.Time `bson:"updatedAt" json:"updatedAt"`
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
	UserID    string             `bson:"userId" json:"userId"` // the userId this invite is for (must match login on accept)
	Role      string             `bson:"role" json:"role"`
	Token     string             `bson:"token" json:"token"`
	InvitedBy string             `bson:"invitedBy" json:"invitedBy"`
	ExpiresAt time.Time          `bson:"expiresAt" json:"expiresAt"`
	Status    string             `bson:"status" json:"status"` // pending | accepted | expired
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
}
