package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

// ProjectRoutes — CRUD for the Projects module. Gated on auth + org membership
// only (no per-module license/permission gate), so it's available to every org
// without a licensing migration.
func ProjectRoutes(router *gin.Engine) {
	projectRoutes := router.Group("/api/projects")
	projectRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		projectRoutes.GET("/", controllers.GetAllProjects())
		projectRoutes.POST("/", controllers.CreateProject())
		projectRoutes.GET("/:id", controllers.GetProjectByID())
		projectRoutes.PUT("/:id", controllers.UpdateProject())
		projectRoutes.DELETE("/:id", controllers.DeleteProject())
	}
}
