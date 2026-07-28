package controllers

import (
	"context"
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/backend/utils"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var licenseCollection *mongo.Collection = config.GetCollection(config.DB, "licenses")

// licenseCodeAlphabet excludes 0/O/1/I/L — characters easily confused when a
// customer reads a printed/emailed code back to someone or retypes it by hand.
const licenseCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

func randomLicenseGroup(n int) (string, error) {
	b := make([]byte, n)
	for i := range b {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(licenseCodeAlphabet))))
		if err != nil {
			return "", err
		}
		b[i] = licenseCodeAlphabet[idx.Int64()]
	}
	return string(b), nil
}

// generateLicenseCode returns a fresh SPF-XXXX-XXXX-XXXX code, retrying on the
// (astronomically unlikely) chance of a collision against an existing key —
// same "generate, check, retry" shape used nowhere else verbatim in this
// codebase, but the same spirit as every other unique-code generator here.
func generateLicenseCode(ctx context.Context) (string, error) {
	for attempt := 0; attempt < 5; attempt++ {
		g1, err := randomLicenseGroup(4)
		if err != nil {
			return "", err
		}
		g2, err := randomLicenseGroup(4)
		if err != nil {
			return "", err
		}
		g3, err := randomLicenseGroup(4)
		if err != nil {
			return "", err
		}
		code := "SPF-" + g1 + "-" + g2 + "-" + g3
		count, err := licenseCollection.CountDocuments(ctx, bson.M{"code": code})
		if err == nil && count == 0 {
			return code, nil
		}
	}
	return "", context.DeadlineExceeded
}

// AdminCreateLicense — POST /api/admin/licenses. X-Admin-Secret gated, same
// inline-check pattern as AdminSetLicense/AdminListUsers. Returns the created
// key including its code in full — the ONLY response that ever does; treat
// this response like you would a password.
func AdminCreateLicense() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !adminSecretOK(c) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Forbidden"})
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var input struct {
			CustomerName     string     `json:"customerName" binding:"required"`
			CustomerEmail    string     `json:"customerEmail"`
			PlanName         string     `json:"planName"`
			MaxOrganizations int        `json:"maxOrganizations"`
			MaxUsersPerOrg   int        `json:"maxUsersPerOrg"`
			AllowedModules   []string   `json:"allowedModules"`
			ExpiresAt        *time.Time `json:"expiresAt"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if input.MaxOrganizations <= 0 {
			input.MaxOrganizations = 1
		}

		code, err := generateLicenseCode(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to generate a unique license code"})
			return
		}

		key := models.LicenseKey{
			ID:               primitive.NewObjectID(),
			Code:             code,
			CustomerName:     input.CustomerName,
			CustomerEmail:    input.CustomerEmail,
			PlanName:         input.PlanName,
			MaxOrganizations: input.MaxOrganizations,
			MaxUsersPerOrg:   input.MaxUsersPerOrg,
			AllowedModules:   input.AllowedModules,
			ExpiresAt:        input.ExpiresAt,
			Status:           "active",
			CreatedAt:        time.Now(),
			UpdatedAt:        time.Now(),
		}
		if _, err := licenseCollection.InsertOne(ctx, key); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create license"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "License created", "data": key})
	}
}

// RequestLicense — POST /api/license/request. Public, no auth — the self-serve
// "get a license" form a prospective customer fills before they have any key
// at all. Inserts a status:"pending" row with no Code yet (nothing to leak,
// nothing to type/copy wrong) and RequestedModules recorded for the admin to
// review. Mirrors RequestLicense's "customer describes what they want, admin
// grants the real thing" shape used nowhere else verbatim in this codebase,
// but same spirit as the org-invitation request/accept split.
func RequestLicense() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var input struct {
			CustomerName      string   `json:"customerName" binding:"required"`
			CustomerEmail     string   `json:"customerEmail" binding:"required,email"`
			PlanName          string   `json:"planName"`
			PlanTier          string   `json:"planTier"`
			MaxOrganizations  int      `json:"maxOrganizations"`
			RequestedModules  []string `json:"requestedModules"`
			RequestedMaxUsers int      `json:"requestedMaxUsers"`
			// Upgrade mode — mutually exclusive with a fresh-key request above.
			// When set, RequestedModules/MaxOrganizations are ignored; see
			// models.LicenseKey doc comment for what happens on approval.
			UpgradeForCode          string `json:"upgradeForCode"`
			AdditionalOrganizations int    `json:"additionalOrganizations"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}

		isUpgrade := strings.TrimSpace(input.UpgradeForCode) != ""

		key := models.LicenseKey{
			ID:            primitive.NewObjectID(),
			CustomerName:  strings.TrimSpace(input.CustomerName),
			CustomerEmail: strings.TrimSpace(input.CustomerEmail),
			Status:        "pending",
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}

		if isUpgrade {
			code := strings.TrimSpace(input.UpgradeForCode)
			var target models.LicenseKey
			if err := licenseCollection.FindOne(ctx, bson.M{"code": code}).Decode(&target); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "License code not found"})
				return
			}
			if target.Status != "active" {
				c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "That license is " + target.Status + " — an upgrade only applies to an active key"})
				return
			}
			// One outstanding upgrade request per key at a time — otherwise the
			// same customer could queue up several before an admin reviews any
			// of them, and approving more than one would double/triple-count
			// the same bump.
			pendingCount, err := licenseCollection.CountDocuments(ctx, bson.M{"upgradeForCode": code, "status": "pending"})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Database error"})
				return
			}
			if pendingCount > 0 {
				c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "There's already a pending upgrade request for this license — wait for it to be reviewed before submitting another"})
				return
			}
			// Unlike a fresh-key request, an upgrade doesn't force a default —
			// "just more orgs" and "just a plan bump" are both valid asks on
			// their own; require at least one actual change below.
			if input.AdditionalOrganizations < 0 {
				input.AdditionalOrganizations = 0
			}
			if input.RequestedMaxUsers < 0 {
				input.RequestedMaxUsers = 0
			}
			wantsPlanBump := input.PlanTier != "" || len(input.RequestedModules) > 0 || input.RequestedMaxUsers > 0
			if input.AdditionalOrganizations == 0 && !wantsPlanBump {
				c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Specify what you'd like to increase — organizations, plan, or seats"})
				return
			}
			key.UpgradeForCode = code
			key.AdditionalOrganizations = input.AdditionalOrganizations
			if wantsPlanBump {
				key.PlanTier = strings.TrimSpace(input.PlanTier)
				key.RequestedModules = input.RequestedModules
				key.RequestedMaxUsers = input.RequestedMaxUsers
				key.PlanName = strings.TrimSpace(input.PlanName)
			} else {
				key.PlanName = target.PlanName
			}
		} else {
			if len(input.RequestedModules) == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Select at least one module you need"})
				return
			}
			if input.MaxOrganizations <= 0 {
				input.MaxOrganizations = 1
			}
			// Starter/Growth are single-business SME tiers — multi-org is an
			// Enterprise-only, negotiated-price case (accounting firms/franchise
			// owners running several businesses under one login). No self-serve
			// checkout path for it; this mirrors the frontend's auto-switch-to-
			// Enterprise behavior so the rule holds even if that's bypassed.
			tier := strings.ToLower(strings.TrimSpace(input.PlanTier))
			if input.MaxOrganizations > 1 && tier != "enterprise" {
				c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Starter and Growth support 1 organization — select Enterprise for multiple organizations"})
				return
			}
			if input.RequestedMaxUsers <= 0 {
				input.RequestedMaxUsers = 1
			}
			key.PlanName = strings.TrimSpace(input.PlanName)
			key.PlanTier = strings.TrimSpace(input.PlanTier)
			key.MaxOrganizations = input.MaxOrganizations
			key.RequestedModules = input.RequestedModules
			key.RequestedMaxUsers = input.RequestedMaxUsers
		}

		if _, err := licenseCollection.InsertOne(ctx, key); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to submit request"})
			return
		}

		// Best-effort — the request is already saved either way; a notify
		// failure shouldn't fail the customer's submission, just means the
		// admin finds out from /admin/licenses instead of their inbox.
		notifyModules := key.RequestedModules
		if isUpgrade {
			var lines []string
			if key.AdditionalOrganizations > 0 {
				lines = append(lines, fmt.Sprintf("+%d organizations for %s", key.AdditionalOrganizations, key.UpgradeForCode))
			}
			if key.RequestedMaxUsers > 0 {
				lines = append(lines, fmt.Sprintf("upgrade to %s (%d users/org) for %s", key.PlanName, key.RequestedMaxUsers, key.UpgradeForCode))
			}
			if len(key.RequestedModules) > 0 {
				lines = append(lines, fmt.Sprintf("+modules: %s", strings.Join(key.RequestedModules, ", ")))
			}
			notifyModules = lines
		}
		if err := utils.SendLicenseRequestNotification(key.CustomerName, key.CustomerEmail, key.PlanName, key.MaxOrganizations, notifyModules); err != nil {
			log.Printf("[license] failed to notify admin of new request from %s: %v", key.CustomerEmail, err)
		}

		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Request submitted — you'll hear back once it's reviewed."})
	}
}

// AdminApproveLicense — PATCH /api/admin/licenses/:id/approve. X-Admin-Secret
// gated. Generates the Code (never done at request time — a pending request
// isn't a usable key), sets AllowedModules/MaxOrganizations/ExpiresAt from the
// admin's decision (defaults to what the customer requested if omitted), flips
// status to "active", and emails the code. This is the one place a key becomes
// usable — replaces the old "admin types everything + copies code + pastes into
// an email by hand" flow.
func AdminApproveLicense() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !adminSecretOK(c) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Forbidden"})
			return
		}
		id, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid license id"})
			return
		}
		var input struct {
			PlanName         string     `json:"planName"`
			MaxOrganizations int        `json:"maxOrganizations"`
			MaxUsersPerOrg   int        `json:"maxUsersPerOrg"`
			AllowedModules   []string   `json:"allowedModules"`
			ExpiresAt        *time.Time `json:"expiresAt"`
		}
		_ = c.ShouldBindJSON(&input) // all fields optional — fall back to the request's own values below

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var key models.LicenseKey
		if err := licenseCollection.FindOne(ctx, bson.M{"_id": id}).Decode(&key); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "License request not found"})
			return
		}
		if key.Status != "pending" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Only a pending request can be approved"})
			return
		}

		if key.UpgradeForCode != "" {
			var target models.LicenseKey
			if err := licenseCollection.FindOne(ctx, bson.M{"code": key.UpgradeForCode}).Decode(&target); err != nil {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "The license this upgrade targets no longer exists"})
				return
			}

			// Orgs — admin can override the requested amount via the same field
			// AdminCreateLicense/approve already use for a fresh key. 0 = no
			// change requested, matches RequestLicense leaving it optional here.
			addOrgs := input.MaxOrganizations
			if addOrgs <= 0 {
				addOrgs = key.AdditionalOrganizations
			}
			newMaxOrgs := target.MaxOrganizations + addOrgs

			// Plan/seat bump — merge requested modules into what the key already
			// allows (never remove access it already had), overwrite the seat
			// ceiling to whatever's requested (a plan change sets a new number,
			// it doesn't add to the old one the way org/seat *counts* do).
			newModules := target.AllowedModules
			newMaxUsers := target.MaxUsersPerOrg
			newPlanTier := target.PlanTier
			newPlanName := target.PlanName
			reqModules := input.AllowedModules
			if len(reqModules) == 0 {
				reqModules = key.RequestedModules
			}
			if len(reqModules) > 0 {
				seen := make(map[string]bool, len(target.AllowedModules))
				merged := append([]string{}, target.AllowedModules...)
				for _, m := range target.AllowedModules {
					seen[m] = true
				}
				for _, m := range reqModules {
					if !seen[m] {
						merged = append(merged, m)
						seen[m] = true
					}
				}
				newModules = merged
			}
			reqMaxUsers := input.MaxUsersPerOrg
			if reqMaxUsers <= 0 {
				reqMaxUsers = key.RequestedMaxUsers
			}
			if reqMaxUsers > 0 {
				newMaxUsers = reqMaxUsers
			}
			if key.PlanTier != "" {
				newPlanTier = key.PlanTier
				newPlanName = key.PlanName
			}

			update := bson.M{
				"maxOrganizations": newMaxOrgs,
				"allowedModules":   newModules,
				"maxUsersPerOrg":   newMaxUsers,
				"planTier":         newPlanTier,
				"planName":         newPlanName,
				"updatedAt":        time.Now(),
			}
			if _, err := licenseCollection.UpdateOne(ctx, bson.M{"_id": target.ID}, bson.M{"$set": update}); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to apply the upgrade"})
				return
			}
			if _, err := licenseCollection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"status": "fulfilled", "additionalOrganizations": addOrgs, "updatedAt": time.Now()}}); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to apply the upgrade"})
				return
			}

			// Org.MaxUsers / org.License.Modules are copied from the key at
			// CreateOrganization time and never re-read afterward — without this,
			// bumping the key's ceiling here would only affect orgs created AFTER
			// the upgrade, leaving every org that already exists under this key
			// stuck on its old seat/module snapshot despite the key now allowing
			// more. A plan bump is an explicit ask for more capacity right now,
			// so push it onto every org under the key immediately.
			if len(reqModules) > 0 || reqMaxUsers > 0 {
				orgUpdate := bson.M{"$set": bson.M{"maxUsers": newMaxUsers, "updatedAt": time.Now()}}
				if len(reqModules) > 0 {
					orgUpdate["$addToSet"] = bson.M{"license.modules": bson.M{"$each": reqModules}}
				}
				if _, err := orgCollection.UpdateMany(ctx, bson.M{"licenseKeyId": target.ID.Hex()}, orgUpdate); err != nil {
					log.Printf("[license] failed to propagate plan bump to existing orgs for key %s: %v", target.Code, err)
				}
			}

			summary := fmt.Sprintf("%d organizations, %d users/org", newMaxOrgs, newMaxUsers)
			if key.CustomerEmail != "" {
				if err := utils.SendLicenseUpgradeEmail(key.CustomerEmail, key.CustomerName, target.Code, newMaxOrgs, newMaxUsers); err != nil {
					c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": fmt.Sprintf("Upgrade applied — %s now allows %s — but the confirmation email failed to send", target.Code, summary), "emailError": err.Error()})
					return
				}
			}
			c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": fmt.Sprintf("Upgrade applied — %s now allows %s", target.Code, summary)})
			return
		}

		planName := input.PlanName
		if planName == "" {
			planName = key.PlanName
		}
		maxOrgs := input.MaxOrganizations
		if maxOrgs <= 0 {
			maxOrgs = key.MaxOrganizations
		}
		allowedModules := input.AllowedModules
		if len(allowedModules) == 0 {
			allowedModules = key.RequestedModules
		}
		maxUsers := input.MaxUsersPerOrg
		if maxUsers <= 0 {
			maxUsers = key.RequestedMaxUsers
		}

		code, err := generateLicenseCode(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to generate a unique license code"})
			return
		}

		update := bson.M{
			"code":             code,
			"planName":         planName,
			"maxOrganizations": maxOrgs,
			"maxUsersPerOrg":   maxUsers,
			"allowedModules":   allowedModules,
			"expiresAt":        input.ExpiresAt,
			"status":           "active",
			"updatedAt":        time.Now(),
		}
		if _, err := licenseCollection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": update}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to approve license"})
			return
		}

		if key.CustomerEmail != "" {
			if err := utils.SendLicenseKeyEmail(key.CustomerEmail, key.CustomerName, code, planName, allowedModules); err != nil {
				// Approval already committed — the key is real and listable by the
				// admin either way. Log and tell the caller so they can hand-deliver
				// it, rather than silently leaving the customer with nothing.
				c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "License approved but the email failed to send — share the code manually", "data": gin.H{"code": code}, "emailError": err.Error()})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "License approved and emailed to the customer"})
	}
}

// AdminRejectLicense — PATCH /api/admin/licenses/:id/reject. X-Admin-Secret
// gated. Terminal — a rejected request is never reconsidered; the customer
// submits a fresh request if they still want in.
func AdminRejectLicense() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !adminSecretOK(c) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Forbidden"})
			return
		}
		id, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid license id"})
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		res, err := licenseCollection.UpdateOne(ctx, bson.M{"_id": id, "status": "pending"}, bson.M{"$set": bson.M{"status": "rejected", "updatedAt": time.Now()}})
		if err != nil || res.MatchedCount == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Only a pending request can be rejected"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Request rejected"})
	}
}

// AdminListLicenses — GET /api/admin/licenses?q=. X-Admin-Secret gated, mirrors
// AdminListUsers. activatedMachines is never projected out to any client
// response anywhere (json:"-" on the model already guarantees this even if the
// projection below is ever loosened).
func AdminListLicenses() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !adminSecretOK(c) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Forbidden"})
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		filter := bson.M{}
		if q := strings.TrimSpace(c.Query("q")); q != "" {
			rx := bson.M{"$regex": regexp.QuoteMeta(q), "$options": "i"}
			filter = bson.M{"$or": []bson.M{{"code": rx}, {"customerName": rx}, {"customerEmail": rx}}}
		}
		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(200)
		cursor, err := licenseCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Database error"})
			return
		}
		defer cursor.Close(ctx)
		var keys []models.LicenseKey
		_ = cursor.All(ctx, &keys)

		// Attach orgsUsed per key — same CountDocuments VerifyLicenseKey does,
		// just once per row here. Admin-only, low-traffic list; fine to pay the
		// extra query per key rather than a $lookup aggregation for this size.
		out := make([]gin.H, 0, len(keys))
		for _, k := range keys {
			orgsUsed, _ := orgCollection.CountDocuments(ctx, bson.M{"licenseKeyId": k.ID.Hex()})
			out = append(out, gin.H{
				"_id": k.ID, "code": k.Code, "customerName": k.CustomerName, "customerEmail": k.CustomerEmail,
				"planName": k.PlanName, "planTier": k.PlanTier, "maxOrganizations": k.MaxOrganizations, "allowedModules": k.AllowedModules,
				"maxUsersPerOrg":          k.MaxUsersPerOrg,
				"requestedMaxUsers":       k.RequestedMaxUsers,
				"requestedModules":        k.RequestedModules,
				"upgradeForCode":          k.UpgradeForCode,
				"additionalOrganizations": k.AdditionalOrganizations,
				"expiresAt":               k.ExpiresAt, "status": k.Status, "createdAt": k.CreatedAt, "orgsUsed": orgsUsed,
			})
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": out, "count": len(out)})
	}
}

// VerifyLicenseKey — GET /api/license/verify?key=xxx. Public, no auth — the
// marketing/download site and the Tauri app's first-launch activation screen
// both need to check a key before any account/session exists. Mirrors
// GetInvitationByToken's shape (org_controller.go) exactly: public lookup by
// opaque code, minimal safe fields back. Never returns MachineFingerprint or
// the internal _id.
func VerifyLicenseKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		code := strings.TrimSpace(c.Query("key"))
		if code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "key is required"})
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var key models.LicenseKey
		if err := licenseCollection.FindOne(ctx, bson.M{"code": code}).Decode(&key); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "License key not found"})
			return
		}

		orgsUsed, _ := orgCollection.CountDocuments(ctx, bson.M{"licenseKeyId": key.ID.Hex()})

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": gin.H{
			"customerName":     key.CustomerName,
			"customerEmail":    key.CustomerEmail,
			"planName":         key.PlanName,
			"allowedModules":   key.AllowedModules,
			"maxOrganizations": key.MaxOrganizations,
			"maxUsersPerOrg":   key.MaxUsersPerOrg,
			"orgsUsed":         orgsUsed,
			"expiresAt":        key.ExpiresAt,
			"status":           key.Status,
		}})
	}
}
