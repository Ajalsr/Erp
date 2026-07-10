package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

// ExportRoutes — GET /api/export/types, GET /api/export/preview-count,
// POST /api/export/transactions. Gated on the "reports" module, same permission
// that already governs the Reports pages — this is a reporting/export function,
// not a system-admin one.
func ExportRoutes(router *gin.Engine) {
	exportRoutes := router.Group("/api/export")
	exportRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("reports"))
	{
		exportRoutes.GET("/types", controllers.GetExportTypes())
		exportRoutes.GET("/preview-count", controllers.PreviewExportCount())
		exportRoutes.POST("/transactions", controllers.ExportTransactions())
	}
}
