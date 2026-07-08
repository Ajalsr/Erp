package routes

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// requireOwnerOrAdmin gates the backup endpoints — they read/restore the
// caller's entire org (every collection that org has data in), so only an
// owner/admin of the active org may use them. Must run after Authenticate + RequireOrg.
func requireOwnerOrAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		userID, _ := c.Get("userId")
		orgID, _ := c.Get("orgId")
		orgObjID, err := primitive.ObjectIDFromHex(fmt.Sprintf("%v", orgID))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid organization ID"})
			return
		}
		role, ok := middlewares.MemberRole(ctx, orgObjID, fmt.Sprintf("%v", userID))
		if !ok || (role != "owner" && role != "admin") {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only owners/admins can manage backups"})
			return
		}
		c.Next()
	}
}

// BackupRoutes — GET /api/backups, POST /api/backups/run, GET /api/backups/:slot,
// GET /api/backups/:slot/download (Excel), POST /api/backups/:slot/restore.
func BackupRoutes(router *gin.Engine) {
	backupRoutes := router.Group("/api/backups")
	backupRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, requireOwnerOrAdmin())
	{
		backupRoutes.GET("/", controllers.GetBackups())
		backupRoutes.POST("/run", controllers.TriggerBackup())
		backupRoutes.GET("/:slot", controllers.GetBackupDetail())
		backupRoutes.GET("/:slot/download", controllers.DownloadBackupExcel())
		backupRoutes.POST("/:slot/restore", controllers.RestoreBackup())
	}
}
