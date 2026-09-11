package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

// ExportRoutes — GET /api/export/types, GET /api/export/preview-count,
// POST /api/export/transactions. Independently grantable via its own
// "export_transactions" module.
func ExportRoutes(router *gin.Engine) {
	exportRoutes := router.Group("/api/export")
	exportRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("export_transactions"), middlewares.RequireModule("export_transactions"))
	{
		exportRoutes.GET("/types", controllers.GetExportTypes())
		exportRoutes.GET("/preview-count", controllers.PreviewExportCount())
		exportRoutes.POST("/transactions", controllers.ExportTransactions())
	}
}
