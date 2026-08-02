package controllers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/backend/utils"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var orgCollection *mongo.Collection = config.GetCollection(config.DB, "organizations")
var orgMemberCollection *mongo.Collection = config.GetCollection(config.DB, "org_members")
var invitationCollection *mongo.Collection = config.GetCollection(config.DB, "invitations")
var usersCollection *mongo.Collection = config.GetCollection(config.DB, "users")

// getMemberRole returns the role of a user in an org, and whether they are a member
func getMemberRole(ctx context.Context, orgID primitive.ObjectID, userID string) (string, bool) {
	var member models.OrgMember
	err := orgMemberCollection.FindOne(ctx, bson.M{
		"orgId":  orgID,
		"userId": userID,
		"status": "active",
	}).Decode(&member)
	if err != nil {
		return "", false
	}
	return member.Role, true
}

func isAdminOrOwner(role string) bool {
	return role == "owner" || role == "admin"
}

// canManageSettings reports whether a user may open/edit org Settings.
// Owner + admin always; other roles only if granted the Settings flag.
func canManageSettings(ctx context.Context, orgID primitive.ObjectID, userID string) bool {
	role, isMember := getMemberRole(ctx, orgID, userID)
	if !isMember {
		return false
	}
	if role == "owner" || role == "admin" {
		return true
	}
	var org models.Organization
	if orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&org) == nil {
		if rp, ok := org.RolePermissions[role]; ok {
			return rp.Settings
		}
	}
	return false
}

// effectiveCustomRoles returns the org's assignable non-admin roles, defaulting to
// member/viewer for legacy orgs that never customised them.
func effectiveCustomRoles(org models.Organization) []string {
	if len(org.CustomRoles) > 0 {
		return org.CustomRoles
	}
	return []string{"member", "viewer"}
}

// scopeForModule returns "all" | "own" record visibility for a role on a module.
// owner/admin always "all"; absent config defaults to "all".
// scopeForModule resolves record visibility ("all"|"own") for a role on a module for a
// specific action ("view"|"edit"|"delete"). Per-action Scopes win; legacy module-wide
// Scope is the fallback. owner/admin always "all".
func scopeForModule(ctx context.Context, orgID primitive.ObjectID, role, module, action string) string {
	if role == "owner" || role == "admin" {
		return "all"
	}
	var org models.Organization
	if orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&org) == nil {
		if rp, ok := org.RolePermissions[role]; ok {
			if s, ok := rp.Scopes[module]; ok {
				var v string
				switch action {
				case "edit":
					v = s.Edit
				case "delete":
					v = s.Delete
				default:
					v = s.View
				}
				if v == "own" {
					return "own"
				}
				if v == "all" {
					return "all"
				}
				// v empty → fall through to legacy below
			}
			if rp.Scope[module] == "own" {
				return "own"
			}
		}
	}
	return "all"
}

// recordScope resolves the caller's role and whether they are restricted to their
// own records for the module. Reads orgId/userId from the gin context (set by
// Authenticate + RequireOrg). ownOnly is always false for owner/admin.
func recordScope(c *gin.Context, module, action string) (userID, role string, ownOnly bool) {
	uid, _ := c.Get("userId")
	userID, _ = uid.(string)
	oid, _ := c.Get("orgId")
	orgIDStr, _ := oid.(string)
	orgID, err := primitive.ObjectIDFromHex(orgIDStr)
	if err != nil {
		return userID, "", false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	role, ok := getMemberRole(ctx, orgID, userID)
	if !ok {
		return userID, "", false
	}
	if role == "owner" || role == "admin" {
		return userID, role, false
	}
	return userID, role, scopeForModule(ctx, orgID, role, module, action) == "own"
}

// canModifyRecord reports whether the caller may edit/delete a record created by
// createdBy. owner/admin always may; otherwise only the original creator.
func canModifyRecord(role, userID, createdBy string) bool {
	if role == "owner" || role == "admin" {
		return true
	}
	return createdBy != "" && createdBy == userID
}

// isAssignableRole reports whether role can be assigned to a member (admin + custom roles).
func isAssignableRole(org models.Organization, role string) bool {
	if role == "admin" {
		return true
	}
	for _, r := range effectiveCustomRoles(org) {
		if r == role {
			return true
		}
	}
	return false
}

// POST /api/organizations
func CreateOrganization() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		userIDStr := userID.(string)

		var input struct {
			Name           string   `json:"name" binding:"required"`
			Description    string   `json:"description"`
			LicenseKey     string   `json:"licenseKey" binding:"required"`
			ModulesEnabled []string `json:"modulesEnabled" binding:"required"`
			MaxUsers       int      `json:"maxUsers"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "error", "error": err.Error()})
			return
		}

		// A license key is required to create an organization at all — otherwise
		// anyone who downloads the app can spin up unlimited orgs for free. See
		// models.LicenseKey / VerifyLicenseKey for how a customer gets a key.
		var key models.LicenseKey
		if err := licenseCollection.FindOne(ctx, bson.M{"code": strings.TrimSpace(input.LicenseKey)}).Decode(&key); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid license key"})
			return
		}
		if key.Status != "active" {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "This license key is " + key.Status})
			return
		}
		if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "This license key has expired"})
			return
		}

		// Cap check — same CountDocuments-then-reject shape as the one-org-per-user
		// check above, just keyed on the license instead of the user.
		orgsUsed, _ := orgCollection.CountDocuments(ctx, bson.M{"licenseKeyId": key.ID.Hex()})
		if int(orgsUsed) >= key.MaxOrganizations {
			c.JSON(http.StatusForbidden, gin.H{
				"status":  http.StatusForbidden,
				"message": fmt.Sprintf("This license key's organization limit (%d) has been reached", key.MaxOrganizations),
			})
			return
		}

		// Modules chosen at creation must be a subset of what the key allows.
		allowed := make(map[string]bool, len(key.AllowedModules))
		for _, m := range key.AllowedModules {
			allowed[m] = true
		}
		var invalidModules []string
		for _, m := range input.ModulesEnabled {
			if !allowed[m] {
				invalidModules = append(invalidModules, m)
			}
		}
		if len(input.ModulesEnabled) == 0 || len(invalidModules) > 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Select at least one module your license includes",
				"invalid": invalidModules,
			})
			return
		}

		// Seat cap for this org: like modules, must be ≤ the key's ceiling
		// (0 on the key = unlimited, no ceiling to enforce). Unset/invalid
		// input falls back to the key's ceiling — matches ModulesEnabled
		// defaulting behavior nowhere, but mirrors AdminApproveLicense's
		// "fall back to the request's own value" pattern.
		maxUsers := input.MaxUsers
		if key.MaxUsersPerOrg > 0 && (maxUsers <= 0 || maxUsers > key.MaxUsersPerOrg) {
			maxUsers = key.MaxUsersPerOrg
		}

		// This backend always runs as the Tauri sidecar ON the customer's own
		// machine, so its own network interfaces genuinely identify that device.
		var fingerprint string
		if fp, fpErr := utils.MachineFingerprint(); fpErr == nil {
			fingerprint = fp
		} else {
			log.Printf("[org] machine fingerprint unavailable: %v", fpErr)
		}

		org := models.Organization{
			ID:          primitive.NewObjectID(),
			Name:        input.Name,
			Description: input.Description,
			// Built-in assignable roles: owner + admin (implicit) plus Sales Rep.
			CustomRoles:        []string{"sales_rep"},
			LicenseKeyID:       key.ID.Hex(),
			License:            models.OrgLicense{Modules: input.ModulesEnabled, ExpiresAt: key.ExpiresAt},
			MaxUsers:           maxUsers,
			MachineFingerprint: fingerprint,
			CreatedBy:          userIDStr,
			CreatedAt:          time.Now(),
			UpdatedAt:          time.Now(),
		}

		_, err := orgCollection.InsertOne(ctx, org)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create organization"})
			return
		}

		if fingerprint != "" {
			// Best-effort audit trail — org creation already succeeded above, so a
			// failure here shouldn't fail the request, just the "which machines
			// used this key" audit view stays incomplete for this one row.
			if _, err := licenseCollection.UpdateOne(ctx, bson.M{"_id": key.ID}, bson.M{"$addToSet": bson.M{"activatedMachines": fingerprint}}); err != nil {
				log.Printf("[org] failed to record machine fingerprint on license %s: %v", key.ID.Hex(), err)
			}
		}

		// Creator becomes owner
		member := models.OrgMember{
			ID:        primitive.NewObjectID(),
			OrgID:     org.ID,
			UserID:    userIDStr,
			Role:      "owner",
			Status:    "active",
			JoinedAt:  time.Now(),
			CreatedAt: time.Now(),
		}
		_, err = orgMemberCollection.InsertOne(ctx, member)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to add owner member"})
			return
		}
		go syncEmployeeFromMember(org.ID, member.UserID, member.Role, member.JoinedAt)

		// Stamp the user's primary orgId so signin can return it
		usersCollection.UpdateOne(ctx,
			bson.M{"userId": userIDStr},
			bson.M{"$set": bson.M{"orgId": org.ID}},
		)

		// Auto-seed default chart of accounts for the new org
		go func() {
			seedCtx, seedCancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer seedCancel()
			seedDefaultAccountsForOrg(seedCtx, org.ID.Hex(), userIDStr)
		}()

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Organization created successfully",
			"data":    org,
		})
	}
}

// GET /api/organizations — returns all orgs the authenticated user belongs to
// buildUserOrganizations returns the active orgs a user belongs to, each tagged with
// the user's role. Shared by the signin response and GetUserOrganizations so the
// shape stays identical (heavy letterhead/stamp blobs excluded). Returns an empty
// (non-nil) slice on any error so callers can embed it safely.
func buildUserOrganizations(ctx context.Context, userIDStr string) []gin.H {
	out := []gin.H{}

	cursor, err := orgMemberCollection.Find(ctx, bson.M{"userId": userIDStr, "status": "active"})
	if err != nil {
		return out
	}
	defer cursor.Close(ctx)

	var members []models.OrgMember
	if err := cursor.All(ctx, &members); err != nil || len(members) == 0 {
		return out
	}

	orgIDs := make([]primitive.ObjectID, 0, len(members))
	roleMap := make(map[primitive.ObjectID]string)
	for _, m := range members {
		orgIDs = append(orgIDs, m.OrgID)
		roleMap[m.OrgID] = m.Role
	}

	// Exclude the heavy blobs: letterhead/stamp images AND docSettings (the latter
	// is ~2MB per org). None are needed for the org list / perms, and pulling them
	// over a slow Atlas link was the ~20s post-login stall.
	orgCursor, err := orgCollection.Find(ctx,
		bson.M{"_id": bson.M{"$in": orgIDs}},
		options.Find().SetProjection(bson.M{"letterheadImage": 0, "stampImage": 0, "docSettings": 0}),
	)
	if err != nil {
		return out
	}
	defer orgCursor.Close(ctx)

	var orgs []models.Organization
	if err := orgCursor.All(ctx, &orgs); err != nil {
		return out
	}

	for _, org := range orgs {
		out = append(out, gin.H{
			"_id":              org.ID,
			"name":             org.Name,
			"description":      org.Description,
			"role":             roleMap[org.ID],
			"rolePermissions":  org.RolePermissions,
			"approvalSettings": org.ApprovalSettings,
			"customRoles":      effectiveCustomRoles(org),
			"license":          org.License,
		})
	}
	return out
}

func GetUserOrganizations() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 30s (was 10s): on a slow/flaky Atlas link the org lookup could exceed 10s and
		// 500, dropping the user to "No Organization Yet" despite a valid membership.
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		userIDStr := userID.(string)

		cursor, err := orgMemberCollection.Find(ctx, bson.M{
			"userId": userIDStr,
			"status": "active",
		})
		if err != nil {
			log.Printf("GetUserOrganizations: member find failed for %q: %v", userIDStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var members []models.OrgMember
		if err := cursor.All(ctx, &members); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error", "error": err.Error()})
			return
		}

		if len(members) == 0 {
			c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": []interface{}{}})
			return
		}

		orgIDs := make([]primitive.ObjectID, 0, len(members))
		roleMap := make(map[primitive.ObjectID]string)
		for _, m := range members {
			orgIDs = append(orgIDs, m.OrgID)
			roleMap[m.OrgID] = m.Role
		}

		// Exclude the heavy base64 letterhead/stamp blobs — the org list/switcher never
		// needs them, and pulling 50KB+ per org can blow the request timeout on a slow
		// link (caused "No Organization Yet" for orgs that have a letterhead).
		orgCursor, err := orgCollection.Find(ctx,
			bson.M{"_id": bson.M{"$in": orgIDs}},
			options.Find().SetProjection(bson.M{"letterheadImage": 0, "stampImage": 0, "docSettings": 0}),
		)
		if err != nil {
			log.Printf("GetUserOrganizations: org find failed for %q: %v", userIDStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error", "error": err.Error()})
			return
		}
		defer orgCursor.Close(ctx)

		var orgs []models.Organization
		if err := orgCursor.All(ctx, &orgs); err != nil {
			log.Printf("GetUserOrganizations: org decode failed for %q: %v", userIDStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error", "error": err.Error()})
			return
		}

		type OrgWithRole struct {
			models.Organization
			Role string `json:"role"`
		}
		result := make([]OrgWithRole, 0, len(orgs))
		for _, org := range orgs {
			result = append(result, OrgWithRole{org, roleMap[org.ID]})
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": result})
	}
}

// GET /api/organizations/:id
// By default the heavy base64 letterhead/stamp blobs are excluded — this endpoint is
// hit on every page by the permissions loader, and pulling 50KB+ over a slow link was
// timing out → 404 → permissions failed to load → every module returned 403. Pass
// ?withImages=true (Organization Settings) to include them.
func GetOrganization() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Access denied"})
			return
		}

		// docSettings (~2MB) is never part of this endpoint's response, so always
		// exclude it. Images are excluded too except when explicitly requested.
		findOpts := options.FindOne()
		proj := bson.M{"docSettings": 0}
		if c.Query("withImages") != "true" {
			proj["letterheadImage"] = 0
			proj["stampImage"] = 0
		}
		findOpts.SetProjection(proj)
		var org models.Organization
		if err = orgCollection.FindOne(ctx, bson.M{"_id": orgID}, findOpts).Decode(&org); err != nil {
			log.Printf("GetOrganization: fetch failed for org %s (user %q): %v", orgID.Hex(), userID, err)
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Organization not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": gin.H{
			"_id":                 org.ID,
			"name":                org.Name,
			"description":         org.Description,
			"address":             org.Address,
			"baseCurrency":        org.BaseCurrency,
			"letterheadImage":     org.LetterheadImage,
			"letterheadTopPad":    org.LetterheadTopPad,
			"letterheadBottomPad": org.LetterheadBottomPad,
			"stampImage":          org.StampImage,
			"rolePermissions":     org.RolePermissions,
			"approvalSettings":    org.ApprovalSettings,
			"approvalPolicies":    org.ApprovalPolicies,
			"customRoles":         effectiveCustomRoles(org),
			"license":             org.License,
			"createdBy":           org.CreatedBy,
			"createdAt":           org.CreatedAt,
			"role":                role,
		}})
	}
}

// PUT /api/organizations/:id
func UpdateOrganization() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		if !canManageSettings(ctx, orgID, userID.(string)) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You don't have access to organization settings"})
			return
		}

		var input struct {
			Name         string `json:"name"`
			Description  string `json:"description"`
			Address      string `json:"address"`
			BaseCurrency string `json:"baseCurrency"`
		}
		c.ShouldBindJSON(&input)

		set := bson.M{
			"name":        input.Name,
			"description": input.Description,
			"address":     strings.TrimSpace(input.Address),
			"updatedAt":   time.Now(),
		}
		// Only touch baseCurrency when supplied, so name/description-only saves don't
		// wipe a previously configured currency.
		if bc := strings.ToUpper(strings.TrimSpace(input.BaseCurrency)); bc != "" {
			set["baseCurrency"] = bc
		}

		_, err = orgCollection.UpdateOne(ctx, bson.M{"_id": orgID}, bson.M{"$set": set})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update organization"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Organization updated"})
	}
}

// DELETE /api/organizations/:id — owner only
func DeleteOrganization() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || role != "owner" {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only the owner can delete an organization"})
			return
		}

		orgCollection.DeleteOne(ctx, bson.M{"_id": orgID})
		orgMemberCollection.DeleteMany(ctx, bson.M{"orgId": orgID})
		invitationCollection.DeleteMany(ctx, bson.M{"orgId": orgID})

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Organization deleted"})
	}
}

// GET /api/organizations/:id/members
func GetOrgMembers() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		_, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Access denied"})
			return
		}

		cursor, err := orgMemberCollection.Find(ctx, bson.M{"orgId": orgID, "status": "active"})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error"})
			return
		}
		defer cursor.Close(ctx)

		var members []models.OrgMember
		cursor.All(ctx, &members)

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": members})
	}
}

// POST /api/organizations/:id/invite
// emailIsActiveMemberInOrg reports whether any active member of orgID has the given
// email (compared lowercased; signup stores emails lowercased), excluding excludeUserID.
func emailIsActiveMemberInOrg(ctx context.Context, orgID primitive.ObjectID, email, excludeUserID string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return false
	}
	cur, err := userCollection.Find(ctx, bson.M{"email": email}, options.Find().SetProjection(bson.M{"userId": 1}))
	if err != nil {
		return false
	}
	var us []bson.M
	_ = cur.All(ctx, &us)
	ids := []string{}
	for _, u := range us {
		if id, _ := u["userId"].(string); id != "" && id != excludeUserID {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return false
	}
	n, _ := orgMemberCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "userId": bson.M{"$in": ids}, "status": "active"})
	return n > 0
}

func InviteMember() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || !isAdminOrOwner(role) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only admins and owners can invite members"})
			return
		}

		var input struct {
			UserId string `json:"userId" binding:"required"`
			Role   string `json:"role" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "error", "error": err.Error()})
			return
		}
		// Invites are keyed by email (lowercased).
		input.UserId = strings.ToLower(strings.TrimSpace(input.UserId))
		if !strings.Contains(input.UserId, "@") {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Enter a valid email"})
			return
		}

		var invOrg models.Organization
		orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&invOrg)
		if !isAssignableRole(invOrg, input.Role) {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid role for this organization"})
			return
		}

		// Already a pending invite to this email in this org? (case-insensitive)
		pendingCount, _ := invitationCollection.CountDocuments(ctx, bson.M{
			"orgId":  orgID,
			"userId": bson.M{"$regex": "^" + regexp.QuoteMeta(input.UserId) + "$", "$options": "i"},
			"status": "pending",
		})
		if pendingCount > 0 {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "An invitation has already been sent to this email"})
			return
		}

		// Already an active member with this email (they accepted earlier)?
		if emailIsActiveMemberInOrg(ctx, orgID, input.UserId, "") {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "This email is already a member of the organization"})
			return
		}

		var org models.Organization
		orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&org)

		// Seat cap — "Option B": the owner occupies one seat like everyone else,
		// so activeMembers already includes them. Pending invites count too,
		// otherwise sending 10 invites on a 5-seat plan would let all 10 land
		// the moment they're accepted instead of being blocked up front.
		if org.MaxUsers > 0 {
			activeMembers, _ := orgMemberCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "active"})
			pendingInvites, _ := invitationCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "pending"})
			seatsUsed := int(activeMembers) + int(pendingInvites)
			if seatsUsed >= org.MaxUsers {
				c.JSON(http.StatusForbidden, gin.H{
					"status":  http.StatusForbidden,
					"message": fmt.Sprintf("Seat limit reached (%d/%d) — upgrade your plan for more seats", seatsUsed, org.MaxUsers),
				})
				return
			}
		}

		// Generate unique token
		tokenBytes := make([]byte, 16)
		rand.Read(tokenBytes)
		token := hex.EncodeToString(tokenBytes)

		invitation := models.Invitation{
			ID:        primitive.NewObjectID(),
			OrgID:     orgID,
			OrgName:   org.Name,
			UserID:    input.UserId,
			Role:      input.Role,
			Token:     token,
			InvitedBy: userID.(string),
			ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
			Status:    "pending",
			CreatedAt: time.Now(),
		}

		_, err = invitationCollection.InsertOne(ctx, invitation)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create invitation"})
			return
		}

		// In-app notification — the invitee logs in by userId, so reach them directly.
		go pushNotification(
			input.UserId, "invite",
			"You've been invited",
			userID.(string)+" invited you to join "+org.Name+" as "+input.Role,
			orgID.Hex(), org.Name,
		)

		// If the userId is email-shaped, also send the invite link by email.
		if strings.Contains(input.UserId, "@") {
			go func() {
				if emailErr := utils.SendInvitationEmail(
					input.UserId, "", org.Name, userID.(string), input.Role, token,
				); emailErr != nil {
					log.Printf("invite email to %s failed: %v", input.UserId, emailErr)
				}
			}()
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Invitation sent to " + input.UserId,
			"data": gin.H{
				"token":  token,
				"userId": input.UserId,
				"role":   input.Role,
			},
		})
	}
}

// PUT /api/organizations/:id/members/:userId/role
func UpdateMemberRole() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}
		targetUserID := c.Param("userId")

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || !isAdminOrOwner(role) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only admins and owners can change roles"})
			return
		}

		var input struct {
			Role string `json:"role" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "error", "error": err.Error()})
			return
		}

		var valOrg models.Organization
		orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&valOrg)
		if !isAssignableRole(valOrg, input.Role) {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid role for this organization"})
			return
		}

		targetRole, targetExists := getMemberRole(ctx, orgID, targetUserID)
		if !targetExists {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Member not found"})
			return
		}
		if targetRole == "owner" {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Cannot change the owner's role"})
			return
		}

		_, err = orgMemberCollection.UpdateOne(ctx,
			bson.M{"orgId": orgID, "userId": targetUserID},
			bson.M{"$set": bson.M{"role": input.Role}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update role"})
			return
		}

		var roleOrg models.Organization
		orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&roleOrg)
		go pushNotification(
			targetUserID, "role_changed",
			"Your role was updated",
			"Your role in "+roleOrg.Name+" was changed to "+input.Role+" by "+userID.(string),
			orgID.Hex(), roleOrg.Name,
		)

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Role updated"})
	}
}

// DELETE /api/organizations/:id/members/:userId
func RemoveMember() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}
		targetUserID := c.Param("userId")

		callerRole, isMember := getMemberRole(ctx, orgID, userID.(string))
		isSelf := userID.(string) == targetUserID
		if !isMember || (!isAdminOrOwner(callerRole) && !isSelf) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only admins and owners can remove members"})
			return
		}

		targetRole, targetExists := getMemberRole(ctx, orgID, targetUserID)
		if !targetExists {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Member not found"})
			return
		}
		if targetRole == "owner" {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Cannot remove the organization owner"})
			return
		}

		_, err = orgMemberCollection.DeleteOne(ctx, bson.M{"orgId": orgID, "userId": targetUserID})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to remove member"})
			return
		}

		var removeOrg models.Organization
		orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&removeOrg)
		go pushNotification(
			targetUserID, "removed",
			"Removed from organization",
			"You were removed from "+removeOrg.Name+" by "+userID.(string),
			orgID.Hex(), removeOrg.Name,
		)

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Member removed"})
	}
}

// POST /api/invitations/accept
func AcceptInvitation() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")

		var input struct {
			Token string `json:"token" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "error", "error": err.Error()})
			return
		}

		var invitation models.Invitation
		err := invitationCollection.FindOne(ctx, bson.M{
			"token":  input.Token,
			"status": "pending",
		}).Decode(&invitation)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Invitation not found or already used"})
			return
		}

		if time.Now().After(invitation.ExpiresAt) {
			invitationCollection.UpdateOne(ctx, bson.M{"_id": invitation.ID}, bson.M{"$set": bson.M{"status": "expired"}})
			c.JSON(http.StatusGone, gin.H{"status": http.StatusGone, "message": "Invitation has expired"})
			return
		}

		// The invite is bound to the invited email. The accepting account must own that
		// email (its login userId may differ). Fall back to userId match for legacy invites.
		invTarget := strings.TrimSpace(invitation.UserID)
		loginID := strings.TrimSpace(fmt.Sprintf("%v", userID))
		var acct models.Users
		_ = usersCollection.FindOne(ctx, bson.M{"userId": loginID}).Decode(&acct)
		emailMatch := acct.Email != "" && strings.EqualFold(invTarget, strings.TrimSpace(acct.Email))
		idMatch := strings.EqualFold(invTarget, loginID)
		if !emailMatch && !idMatch {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "This invitation was sent to " + invitation.UserID + ". Sign in with that email to accept it."})
			return
		}

		// Check if logged-in user is already a member of this org
		alreadyMember, _ := orgMemberCollection.CountDocuments(ctx, bson.M{
			"orgId":  invitation.OrgID,
			"userId": userID.(string),
			"status": "active",
		})
		if alreadyMember > 0 {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "You are already a member of this organization"})
			return
		}

		// Per-org email uniqueness: another account with this email already accepted.
		if emailIsActiveMemberInOrg(ctx, invitation.OrgID, acct.Email, loginID) {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "This email has already accepted an invitation to this organization"})
			return
		}

		member := models.OrgMember{
			ID:        primitive.NewObjectID(),
			OrgID:     invitation.OrgID,
			UserID:    userID.(string),
			Role:      invitation.Role,
			Status:    "active",
			InvitedBy: invitation.InvitedBy,
			JoinedAt:  time.Now(),
			CreatedAt: time.Now(),
		}
		orgMemberCollection.InsertOne(ctx, member)
		go syncEmployeeFromMember(member.OrgID, member.UserID, member.Role, member.JoinedAt)
		// Record which user accepted and mark as accepted
		invitationCollection.UpdateOne(ctx, bson.M{"_id": invitation.ID}, bson.M{"$set": bson.M{
			"status": "accepted",
			"userId": userID.(string),
		}})
		// Stamp the user's primary orgId so signin can return it
		usersCollection.UpdateOne(ctx,
			bson.M{"userId": userID.(string)},
			bson.M{"$set": bson.M{"orgId": invitation.OrgID}},
		)

		// Notify inviter that their invitation was accepted
		go pushNotification(
			invitation.InvitedBy, "accepted",
			"Invitation accepted",
			userID.(string)+" accepted your invitation and joined "+invitation.OrgName,
			invitation.OrgID.Hex(), invitation.OrgName,
		)

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Invitation accepted",
			"data": gin.H{
				"orgId":   invitation.OrgID,
				"orgName": invitation.OrgName,
				"role":    invitation.Role,
			},
		})
	}
}

// GET /api/invitations/:token — public, for showing invite details before accepting
func GetInvitationByToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		token := c.Param("token")
		var invitation models.Invitation
		err := invitationCollection.FindOne(ctx, bson.M{"token": token}).Decode(&invitation)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Invitation not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"orgName":   invitation.OrgName,
				"userId":    invitation.UserID,
				"role":      invitation.Role,
				"status":    invitation.Status,
				"expiresAt": invitation.ExpiresAt,
				"invitedBy": invitation.InvitedBy,
			},
		})
	}
}

// GET /api/organizations/:id/invitations — pending invites for an org (admin/owner only)
func GetOrgInvitations() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || !isAdminOrOwner(role) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Access denied"})
			return
		}

		cursor, err := invitationCollection.Find(ctx, bson.M{"orgId": orgID, "status": "pending"})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error"})
			return
		}
		defer cursor.Close(ctx)

		var invitations []models.Invitation
		cursor.All(ctx, &invitations)

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": invitations})
	}
}

// GET /api/users/invitations — current user's pending invitations
func GetUserInvitations() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")

		cursor, err := invitationCollection.Find(ctx, bson.M{
			"userId": userID.(string),
			"status": "pending",
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error"})
			return
		}
		defer cursor.Close(ctx)

		var invitations []models.Invitation
		cursor.All(ctx, &invitations)

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": invitations})
	}
}

// DELETE /api/organizations/:id/invitations/:invitationId — cancel a pending invite
func CancelInvitation() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || !isAdminOrOwner(role) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Access denied"})
			return
		}

		invitationID, err := primitive.ObjectIDFromHex(c.Param("invitationId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid invitation ID"})
			return
		}

		invitationCollection.DeleteOne(ctx, bson.M{"_id": invitationID, "orgId": orgID})
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Invitation cancelled"})
	}
}

// storeOrgImage offloads an org image to Cloudinary instead of MongoDB.
//   - empty string        → returns "" (clears the field)
//   - already an https URL → returned unchanged (already hosted)
//   - base64 data-URL      → uploaded to Cloudinary; the secure URL is returned
//
// publicID is deterministic per org+kind so re-uploads OVERWRITE the same asset
// (no orphan accumulation), and only a short URL is persisted in the org doc.
func storeOrgImage(ctx context.Context, img, orgHex, kind string) (string, error) {
	img = strings.TrimSpace(img)
	if img == "" || strings.HasPrefix(img, "http://") || strings.HasPrefix(img, "https://") {
		return img, nil // nothing to upload (cleared or already hosted)
	}
	if !strings.HasPrefix(img, "data:") {
		return img, nil // not a data-URL we recognise — store as-is
	}
	if config.CloudinaryClient == nil {
		return "", fmt.Errorf("cloudinary not configured")
	}
	overwrite, invalidate := true, true
	res, err := config.CloudinaryClient.Upload.Upload(ctx, img, uploader.UploadParams{
		PublicID:     fmt.Sprintf("erp/org/%s/%s", orgHex, kind),
		Overwrite:    &overwrite,
		Invalidate:   &invalidate,
		ResourceType: "image",
	})
	if err != nil {
		return "", err
	}
	return res.SecureURL, nil
}

// PATCH /api/organizations/:id/letterhead
func UpdateLetterhead() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		if !canManageSettings(ctx, orgID, userID.(string)) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You don't have access to organization settings"})
			return
		}

		var input struct {
			LetterheadImage     string `json:"letterheadImage"`
			LetterheadTopPad    int    `json:"letterheadTopPad"`
			LetterheadBottomPad int    `json:"letterheadBottomPad"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}

		// Offload the image to Cloudinary; persist only the URL (keeps the org doc small).
		url, upErr := storeOrgImage(ctx, input.LetterheadImage, orgID.Hex(), "letterhead")
		if upErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to upload letterhead image", "error": upErr.Error()})
			return
		}

		_, err = orgCollection.UpdateOne(ctx, bson.M{"_id": orgID}, bson.M{"$set": bson.M{
			"letterheadImage":     url,
			"letterheadTopPad":    input.LetterheadTopPad,
			"letterheadBottomPad": input.LetterheadBottomPad,
			"updatedAt":           time.Now(),
		}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update letterhead"})
			return
		}

		// Drop the cached letterhead so PDFs pick up the change immediately.
		lhCache.Delete(orgID.Hex())

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Letterhead updated", "letterheadImage": url})
	}
}

// PATCH /api/organizations/:id/stamp
func UpdateStamp() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || !isAdminOrOwner(role) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only admins and owners can update the stamp"})
			return
		}

		var input struct {
			StampImage string `json:"stampImage"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}

		// Offload the stamp to Cloudinary; persist only the URL (keeps the org doc small).
		url, upErr := storeOrgImage(ctx, input.StampImage, orgID.Hex(), "stamp")
		if upErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to upload stamp image", "error": upErr.Error()})
			return
		}

		_, err = orgCollection.UpdateOne(ctx, bson.M{"_id": orgID}, bson.M{"$set": bson.M{
			"stampImage": url,
			"updatedAt":  time.Now(),
		}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update stamp"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Stamp updated", "stampImage": url})
	}
}

// PATCH /api/organizations/:id/role-permissions — set per-role module access + approvals
func UpdateRolePermissions() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || role != "owner" {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only the owner can manage permissions"})
			return
		}

		var input struct {
			RolePermissions map[string]models.RolePerm `json:"rolePermissions"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}

		_, err = orgCollection.UpdateOne(ctx, bson.M{"_id": orgID}, bson.M{"$set": bson.M{
			"rolePermissions": input.RolePermissions,
			"updatedAt":       time.Now(),
		}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update permissions"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Permissions updated", "data": input.RolePermissions})
	}
}

// PATCH /api/organizations/:id/approval-settings — set which doc types require approval.
func UpdateApprovalSettings() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}
		if !canManageSettings(ctx, orgID, userID.(string)) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You don't have access to organization settings"})
			return
		}

		var input struct {
			ApprovalSettings map[string]bool `json:"approvalSettings"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}

		_, err = orgCollection.UpdateOne(ctx, bson.M{"_id": orgID}, bson.M{"$set": bson.M{
			"approvalSettings": input.ApprovalSettings,
			"updatedAt":        time.Now(),
		}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update approval settings"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Approval settings updated", "data": input.ApprovalSettings})
	}
}

// PATCH /api/organizations/:id/approval-policies — save per-module approval workflows.
func UpdateApprovalPolicies() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}
		if !canManageSettings(ctx, orgID, userID.(string)) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You don't have access to organization settings"})
			return
		}

		var input struct {
			ApprovalPolicies map[string]models.ApprovalPolicy `json:"approvalPolicies"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}

		_, err = orgCollection.UpdateOne(ctx, bson.M{"_id": orgID}, bson.M{"$set": bson.M{
			"approvalPolicies": input.ApprovalPolicies,
			"updatedAt":        time.Now(),
		}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update approval policies"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Approval workflows saved", "data": input.ApprovalPolicies})
	}
}

// PATCH /api/organizations/:id/roles — define the org's assignable custom roles
func UpdateCustomRoles() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || role != "owner" {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only the owner can manage roles"})
			return
		}

		var input struct {
			Roles []string `json:"roles"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}

		// Normalise: trim, lowercase, dedupe, drop reserved/empty.
		seen := map[string]bool{}
		clean := []string{}
		for _, r := range input.Roles {
			r = strings.ToLower(strings.TrimSpace(r))
			if r == "" || r == "owner" || r == "admin" || seen[r] {
				continue
			}
			seen[r] = true
			clean = append(clean, r)
		}
		if len(clean) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "At least one custom role is required"})
			return
		}

		_, err = orgCollection.UpdateOne(ctx, bson.M{"_id": orgID}, bson.M{"$set": bson.M{
			"customRoles": clean,
			"updatedAt":   time.Now(),
		}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update roles"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Roles updated", "data": clean})
	}
}

// ── Permission resolution (server-side enforcement helpers) ───────────────────

// salesRepEditModules — modules a Sales Rep can create/edit in by default.
var salesRepEditModules = map[string]bool{"enquiries": true, "quotes": true, "sales_orders": true}

// defaultModuleCaps returns the fallback capabilities for a role when nothing is stored.
func defaultModuleCaps(role, module string) []string {
	switch role {
	case "owner", "admin", "member":
		return []string{"view", "add", "edit"}
	case "sales_rep":
		if salesRepEditModules[module] {
			return []string{"view", "add", "edit"}
		}
		return []string{"view"}
	case "viewer":
		return []string{"view"}
	default:
		return []string{}
	}
}

// resolveModuleCaps returns the effective capability list for a user on a module.
func resolveModuleCaps(ctx context.Context, orgID primitive.ObjectID, userID, module string) []string {
	role, isMember := getMemberRole(ctx, orgID, userID)
	if !isMember {
		return []string{}
	}
	if isAdminOrOwner(role) {
		return []string{"view", "add", "edit"} // owners/admins always full
	}
	var org models.Organization
	if orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&org) == nil {
		if rp, ok := org.RolePermissions[role]; ok {
			if caps, ok2 := rp.Modules[module]; ok2 {
				return caps // stored (may be empty = no access)
			}
		}
	}
	return defaultModuleCaps(role, module)
}

func hasCap(caps []string, action string) bool {
	for _, c := range caps {
		if c == action {
			return true
		}
	}
	return false
}

// resolveApproval reports whether a user's role may perform an approval action.
func resolveApproval(ctx context.Context, orgID primitive.ObjectID, userID, key string) bool {
	role, isMember := getMemberRole(ctx, orgID, userID)
	if !isMember {
		return false
	}
	if isAdminOrOwner(role) {
		return true
	}
	var org models.Organization
	if orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&org) == nil {
		if rp, ok := org.RolePermissions[role]; ok {
			return rp.Approvals[key]
		}
	}
	return false
}

// RequireModule is gin middleware enforcing module access. level = "view" | "edit".
// orgId comes from the RequireOrg middleware (c.Get("orgId")).
func RequireModule(module, level string) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		orgIDVal, _ := c.Get("orgId")
		userIDVal, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(fmt.Sprintf("%v", orgIDVal))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"status": 403, "message": "No organization context"})
			return
		}
		caps := resolveModuleCaps(ctx, orgID, fmt.Sprintf("%v", userIDVal), module)
		if !hasCap(caps, level) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"status": 403, "message": "You don't have permission for this action", "code": "NO_PERMISSION"})
			return
		}
		c.Next()
	}
}

// RequireApproval is gin middleware enforcing an approval right (e.g. "po", "bill").
func RequireApproval(key string) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		orgIDVal, _ := c.Get("orgId")
		userIDVal, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(fmt.Sprintf("%v", orgIDVal))
		if err != nil || !resolveApproval(ctx, orgID, fmt.Sprintf("%v", userIDVal), key) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"status": 403, "message": "You don't have approval permission", "code": "NO_APPROVAL"})
			return
		}
		c.Next()
	}
}

// ── Org Settings (salutations and other org-level config) ──────────────────

var orgSettingsCollection *mongo.Collection = config.GetCollection(config.DB, "org_settings")

// GetOrgSettings returns the settings for the current org.
func GetOrgSettings() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgIDStr, _ := c.Get("orgId")
		var settings bson.M
		err := orgSettingsCollection.FindOne(ctx, bson.M{"orgId": fmt.Sprintf("%v", orgIDStr)}).Decode(&settings)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"status": http.StatusOK,
				"data":   gin.H{"salutations": []string{"Mr.", "Mrs.", "Ms.", "Miss", "Dr."}},
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": settings})
	}
}

// UpdateOrgSettings saves org-level configuration (salutations list, etc.).
func UpdateOrgSettings() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgIDStr := fmt.Sprintf("%v", func() interface{} { v, _ := c.Get("orgId"); return v }())

		var body bson.M
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		body["orgId"] = orgIDStr
		body["updatedAt"] = time.Now()

		opts := options.Update().SetUpsert(true)
		orgSettingsCollection.UpdateOne(ctx,
			bson.M{"orgId": orgIDStr},
			bson.M{"$set": body},
			opts,
		)
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Settings updated"})
	}
}
