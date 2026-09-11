package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

// BackupRoutes — GET /api/backups, POST /api/backups/run, GET /api/backups/:slot,
// GET /api/backups/:slot/download (Excel), POST /api/backups/:slot/restore.
// Owner/admin always have full access (RequireModule's usual bypass). Any other role
// needs an EXPLICIT grant via the permissions matrix — defaultModuleCaps special-cases
// "backups" to never fall back to a default, since these endpoints read/restore the
// caller's entire org across every collection.
func BackupRoutes(router *gin.Engine) {
	backupRoutes := router.Group("/api/backups")
	backupRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("backups"), middlewares.RequireModule("backups"))
	{
		backupRoutes.GET("/", controllers.GetBackups())
		backupRoutes.POST("/run", controllers.TriggerBackup())
		backupRoutes.GET("/:slot", controllers.GetBackupDetail())
		backupRoutes.GET("/:slot/download", controllers.DownloadBackupExcel())
		backupRoutes.POST("/:slot/restore", controllers.RestoreBackup())
	}
}
