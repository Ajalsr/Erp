package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// LicenseKey is a standalone entitlement a customer buys once: it caps how many
// Organizations can be created under it (MaxOrganizations) and which modules
// those orgs may draw from (AllowedModules). Each Organization created under a
// key picks its own ModulesEnabled subset (must be ⊆ AllowedModules) at
// creation time — see CreateOrganization. Distinct from Organization.License
// (already shipped): that field is still the thing middlewares.RequireLicenseModule
// actually enforces on every request; this is where its value comes from when a
// key is used instead of an admin manually setting it.
//
// Status lifecycle: "pending" (self-serve request, awaiting admin review, no
// Code assigned yet) → "active" (approved, Code generated + emailed) →
// "revoked" (admin pull) or naturally stale once ExpiresAt passes. "rejected"
// is terminal, set instead of active on admin reject. "fulfilled" is the
// terminal state for an UpgradeForCode row once approved (see below) — it
// never gets its own Code, so it can't become "active" the normal way.
//
// UpgradeForCode + AdditionalOrganizations: an existing customer asking for
// more org slots on a key they already hold submits one of these instead of
// a fresh key request (RequestLicense) — UpgradeForCode holds the code of the
// key they want bumped, AdditionalOrganizations how many more slots. On
// approval (AdminApproveLicense) the target key's MaxOrganizations is
// incremented directly; this row itself never gets a Code and is never used
// to create an org — it only exists as the pending-review record for that
// one bump. Empty UpgradeForCode = ordinary new-key request (the original
// flow), unaffected.
//
// ActivatedMachines records the fingerprint of the desktop machine that used
// this key to create each org — one entry per org created (bounded by
// MaxOrganizations same as org count), append-only audit trail. Not an
// enforcement mechanism by itself (a revoked/expired key is already blocked
// at every check regardless of which machine created what); it exists so a
// support/audit view can answer "which machines used this key". Never
// serialized to any client response (see json:"-").
// MaxUsersPerOrg is the seat-count ceiling for this key — the plan-tier
// equivalent of AllowedModules, and enforced the same way: each Organization
// created under the key picks its own Organization.MaxUsers (≤ this ceiling)
// at creation time, and InviteMember enforces that per-org number, not this
// one directly. 0 = unlimited (Enterprise tier). RequestedMaxUsers/PlanTier
// are what the customer asked for on RequestLicense, before admin approval
// sets the real MaxUsersPerOrg (defaults to the request if not overridden).
// Seat counting is "Option B": the owner counts as one of the seats, same as
// every invited member — a solo owner with no invites is already using 1/N.
type LicenseKey struct {
	ID                      primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Code                    string             `bson:"code,omitempty" json:"code,omitempty"` // SPF-XXXX-XXXX-XXXX, unique, empty until approved
	CustomerName            string             `bson:"customerName" json:"customerName"`
	CustomerEmail           string             `bson:"customerEmail" json:"customerEmail"`
	PlanName                string             `bson:"planName" json:"planName"`
	PlanTier                string             `bson:"planTier,omitempty" json:"planTier,omitempty"` // starter | growth | enterprise — informational, admin isn't restricted to these
	MaxOrganizations        int                `bson:"maxOrganizations" json:"maxOrganizations"`
	MaxUsersPerOrg          int                `bson:"maxUsersPerOrg" json:"maxUsersPerOrg"`
	RequestedMaxUsers       int                `bson:"requestedMaxUsers,omitempty" json:"requestedMaxUsers,omitempty"`
	AllowedModules          []string           `bson:"allowedModules" json:"allowedModules"`
	RequestedModules        []string           `bson:"requestedModules,omitempty" json:"requestedModules,omitempty"` // what the customer asked for, before admin approval trims/grants it
	UpgradeForCode          string             `bson:"upgradeForCode,omitempty" json:"upgradeForCode,omitempty"`
	AdditionalOrganizations int                `bson:"additionalOrganizations,omitempty" json:"additionalOrganizations,omitempty"`
	ActivatedMachines       []string           `bson:"activatedMachines,omitempty" json:"-"`
	ExpiresAt               *time.Time         `bson:"expiresAt,omitempty" json:"expiresAt,omitempty"`
	Status                  string             `bson:"status" json:"status"` // pending | active | rejected | expired | revoked | fulfilled
	CreatedAt               time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt               time.Time          `bson:"updatedAt" json:"updatedAt"`
}
