package controllers

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/backend/models"
)

// Helpers for modules whose approval is a status on the document itself (sales orders,
// credit notes, debit notes) rather than a held ApprovalRequest. Whether approval is
// needed, and who can give it, both come from the module's policy in Settings → Approvals.

// policyApproverRoles returns the roles that may approve a module's documents: owner and
// admin always, plus every role (and delegate) in the module's policy chain.
func policyApproverRoles(ctx context.Context, orgID primitive.ObjectID, module string) map[string]bool {
	roles := map[string]bool{"owner": true, "admin": true}
	var org models.Organization
	if orgCollection.FindOne(ctx, bson.M{"_id": orgID},
		options.FindOne().SetProjection(bson.M{"approvalPolicies": 1})).Decode(&org) == nil {
		if p, ok := org.ApprovalPolicies[module]; ok {
			for _, s := range p.Steps {
				for _, r := range s.Roles {
					if r != "" {
						roles[r] = true
					}
				}
				if s.Delegate != "" {
					roles[s.Delegate] = true
				}
			}
		}
	}
	return roles
}

// policyNeedsApproval reports whether submitting a document needs sign-off: the module's
// policy must be on (gating "create") and its conditions must match the payload. Owners,
// admins and anyone who is themselves an approver for the module never need it.
func policyNeedsApproval(ctx context.Context, orgIDStr, userID, module string, payload bson.M) bool {
	orgObjID, err := primitive.ObjectIDFromHex(orgIDStr)
	if err != nil {
		return false
	}
	role, ok := getMemberRole(ctx, orgObjID, userID)
	if !ok || role == "owner" || role == "admin" {
		return false
	}
	policy, ok := loadPolicy(ctx, orgIDStr, module)
	if !ok || !policy.Enabled || !policy.GatesAction("create") {
		return false
	}
	if !evaluateTrigger(policy, module, payload) {
		return false
	}
	return !policyApproverRoles(ctx, orgObjID, module)[role]
}

// canApproveModule reports whether userID may approve documents of the module.
func canApproveModule(ctx context.Context, orgIDStr, userID, module string) bool {
	orgObjID, err := primitive.ObjectIDFromHex(orgIDStr)
	if err != nil {
		return false
	}
	role, ok := getMemberRole(ctx, orgObjID, userID)
	return ok && policyApproverRoles(ctx, orgObjID, module)[role]
}
