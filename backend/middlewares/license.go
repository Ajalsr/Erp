package middlewares

import (
	"context"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// licenseIncludesModule reports whether orgID's license allows module. Projects
// only license.modules + licenseKeyId (same cheap-field trick as roleCapsForModule
// in permission.go) — this runs on every request to a licensable route. Nil/empty
// Modules means unrestricted: every org before this feature shipped, and any
// org an admin hasn't explicitly licensed yet, keeps full access.
//
// Also live-checks the underlying LicenseKey's status: org.License.Modules is a
// snapshot copied onto the org at creation time (CreateOrganization), so without
// this an admin revoking a key would have zero effect on orgs already created
// under it. This re-query is what makes revoke/expiry actually propagate.
func licenseIncludesModule(ctx context.Context, orgID primitive.ObjectID, module string) bool {
	orgCol := config.GetCollection(config.DB, "organizations")
	var org struct {
		License struct {
			Modules []string `bson:"modules"`
		} `bson:"license"`
		LicenseKeyID string `bson:"licenseKeyId"`
	}
	opts := options.FindOne().SetProjection(bson.M{"license.modules": 1, "licenseKeyId": 1})
	if err := orgCol.FindOne(ctx, bson.M{"_id": orgID}, opts).Decode(&org); err != nil {
		// Org fetch failed here — RequireOrg/RequireModule already validate the
		// org exists elsewhere in the chain; treat as unrestricted rather than
		// masking whatever the real error is with a confusing license 403.
		return true
	}

	if org.LicenseKeyID != "" {
		keyID, err := primitive.ObjectIDFromHex(org.LicenseKeyID)
		if err == nil {
			licenseCol := config.GetCollection(config.DB, "licenses")
			var key struct {
				Status    string     `bson:"status"`
				ExpiresAt *time.Time `bson:"expiresAt"`
			}
			kOpts := options.FindOne().SetProjection(bson.M{"status": 1, "expiresAt": 1})
			if err := licenseCol.FindOne(ctx, bson.M{"_id": keyID}, kOpts).Decode(&key); err == nil {
				if key.Status != "active" {
					return false
				}
				if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
					return false
				}
			}
			// Key fetch error (e.g. deleted) falls through to the module check below
			// rather than hard-blocking — matches the org-fetch-failure fallback above.
		}
	}

	if len(org.License.Modules) == 0 {
		return true
	}
	for _, m := range org.License.Modules {
		if m == module {
			return true
		}
	}
	return false
}

// RequireLicenseModule enforces that the caller's ORG has module in its license
// at all — independent of role (even the owner doesn't get an unlicensed
// module). Must run AFTER Authenticate + RequireOrg (needs orgId in context),
// and BEFORE RequireModule in the chain — no point checking role capability
// for a module the org never licensed.
func RequireLicenseModule(module string) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgIDVal, _ := c.Get("orgId")
		orgIDStr, _ := orgIDVal.(string)
		orgID, err := primitive.ObjectIDFromHex(orgIDStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid organization ID"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if !licenseIncludesModule(ctx, orgID, module) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"status":  http.StatusForbidden,
				"message": "Your plan doesn't include " + humanizeModule(module),
			})
			return
		}
		c.Next()
	}
}
