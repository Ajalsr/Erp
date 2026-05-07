package middlewares

import (
	"context"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RequireOrg reads X-Org-ID header, verifies the logged-in user is an active
// member of that org, then stores orgId in the gin context for controllers.
// Must be placed AFTER middlewares.Authenticate.
func RequireOrg(c *gin.Context) {
	orgIDStr := c.GetHeader("X-Org-ID")
	if orgIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Org-ID header is required"})
		c.Abort()
		return
	}

	orgID, err := primitive.ObjectIDFromHex(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
		c.Abort()
		return
	}

	userID, _ := c.Get("userId")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	orgMemberCol := config.GetCollection(config.DB, "org_members")
	count, _ := orgMemberCol.CountDocuments(ctx, bson.M{
		"orgId":  orgID,
		"userId": userID.(string),
		"status": "active",
	})

	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not a member of this organization"})
		c.Abort()
		return
	}

	c.Set("orgId", orgIDStr)
	c.Next()
}
