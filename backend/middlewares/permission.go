package middlewares

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Module capabilities. Mirror frontend helper/permissions.js PERM_CAPS.
const (
	CapView   = "view"
	CapAdd    = "add"
	CapEdit   = "edit"
	CapDelete = "delete"
	CapExport = "export"
)

// defaultModuleCaps mirrors the frontend fallback (helper/permissions.js defaultCaps)
// so a role with no explicit matrix entry behaves identically client- and server-side.
// owner/admin are handled separately (always full). Default is read-only: every
// mutation (add/edit/delete/export) must be granted explicitly (least privilege).
func defaultModuleCaps(role string) []string {
	switch role {
	case "member", "viewer":
		return []string{CapView}
	default: // custom roles: no access unless granted
		return nil
	}
}

// humanizeModule turns a module key into a readable label, e.g.
// "advance_payments" → "advance payments".
func humanizeModule(module string) string {
	return strings.ReplaceAll(module, "_", " ")
}

func containsCap(caps []string, cap string) bool {
	for _, c := range caps {
		if c == cap {
			return true
		}
	}
	return false
}

// capForRequest derives the required capability from the HTTP method and path.
// GET → view, POST → add, PUT/PATCH → edit, DELETE → delete. Any export/csv/pdf
// path → export, regardless of method.
func capForRequest(c *gin.Context) string {
	p := strings.ToLower(c.FullPath())
	if strings.Contains(p, "export") || strings.Contains(p, "/csv") || strings.Contains(p, "/pdf") {
		return CapExport
	}
	switch c.Request.Method {
	case http.MethodGet:
		return CapView
	case http.MethodPost:
		return CapAdd
	case http.MethodPut, http.MethodPatch:
		return CapEdit
	case http.MethodDelete:
		return CapDelete
	default:
		return CapView
	}
}

// roleCapsForModule returns the effective capability list for a role on a module:
// the explicit matrix entry if present, otherwise the role default.
func roleCapsForModule(ctx context.Context, orgID primitive.ObjectID, role, module string) []string {
	orgCol := config.GetCollection(config.DB, "organizations")
	var org models.Organization
	// Fetch ONLY rolePermissions — never the heavy base64 letterhead/stamp. This runs on
	// every non-owner request; pulling 50KB+ each time overran the timeout on a slow link,
	// the read fell back to defaultModuleCaps (nil for custom roles) → spurious 403s.
	opts := options.FindOne().SetProjection(bson.M{"rolePermissions": 1})
	if err := orgCol.FindOne(ctx, bson.M{"_id": orgID}, opts).Decode(&org); err == nil {
		if rp, ok := org.RolePermissions[role]; ok {
			if caps, ok := rp.Modules[module]; ok {
				return []string(caps)
			}
		}
	}
	return defaultModuleCaps(role)
}

// RequireModule enforces that the caller's role has the capability (derived from the
// request method/path) on the given module. owner/admin always pass. Must run AFTER
// Authenticate + RequireOrg (needs userId + orgId in context).
func RequireModule(module string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userId")
		orgIDVal, _ := c.Get("orgId")
		orgIDStr, _ := orgIDVal.(string)
		orgID, err := primitive.ObjectIDFromHex(orgIDStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid organization ID"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		role, ok := memberRole(ctx, orgID, userID.(string))
		if !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Not a member of this organization"})
			return
		}
		c.Set("orgRole", role)

		// owner/admin always full access.
		if role == "owner" || role == "admin" {
			c.Next()
			return
		}

		cap := capForRequest(c)
		if !containsCap(roleCapsForModule(ctx, orgID, role, module), cap) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"status":  http.StatusForbidden,
				"message": "You don't have permission to " + cap + " " + humanizeModule(module),
			})
			return
		}
		c.Next()
	}
}

// RequireApproval enforces an approval right (e.g. po, grn, bill, invoice, payment).
// owner/admin always pass. Must run AFTER Authenticate + RequireOrg.
func RequireApproval(key string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userId")
		orgIDVal, _ := c.Get("orgId")
		orgIDStr, _ := orgIDVal.(string)
		orgID, err := primitive.ObjectIDFromHex(orgIDStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid organization ID"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		role, ok := memberRole(ctx, orgID, userID.(string))
		if !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Not a member of this organization"})
			return
		}
		c.Set("orgRole", role)

		if role == "owner" || role == "admin" {
			c.Next()
			return
		}

		orgCol := config.GetCollection(config.DB, "organizations")
		var org models.Organization
		if err := orgCol.FindOne(ctx, bson.M{"_id": orgID}).Decode(&org); err == nil {
			if rp, ok := org.RolePermissions[role]; ok && rp.Approvals[key] {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"status":  http.StatusForbidden,
			"message": "You don't have approval rights for " + key,
		})
	}
}

// MemberRole is the exported form of memberRole, for cross-cutting handlers (e.g.
// global search) that need the caller's role without going through RequireModule.
func MemberRole(ctx context.Context, orgID primitive.ObjectID, userID string) (string, bool) {
	return memberRole(ctx, orgID, userID)
}

// RoleCanView reports whether role has the view capability on module. owner/admin
// always pass. Mirrors the gate RequireModule applies for GET requests, so global
// search can skip categories the caller may not read.
func RoleCanView(ctx context.Context, orgID primitive.ObjectID, role, module string) bool {
	if role == "owner" || role == "admin" {
		return true
	}
	return containsCap(roleCapsForModule(ctx, orgID, role, module), CapView)
}

func memberRole(ctx context.Context, orgID primitive.ObjectID, userID string) (string, bool) {
	col := config.GetCollection(config.DB, "org_members")
	var m struct {
		Role string `bson:"role"`
	}
	err := col.FindOne(ctx, bson.M{"orgId": orgID, "userId": userID, "status": "active"}).Decode(&m)
	if err != nil {
		return "", false
	}
	return m.Role, true
}
