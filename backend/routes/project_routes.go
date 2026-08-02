package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

// ProjectRoutes — CRUD for the Projects module. Now gated the same as every
// other module: license must include "projects" (see MODULE_GROUPS.Project in
// spifora.html's pricing calculator), and the caller's role needs the
// capability for the request (RequireModule → helper/permissions.js
// PERM_MODULES 'projects' entry).
func ProjectRoutes(router *gin.Engine) {
	projectRoutes := router.Group("/api/projects")
	projectRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("projects"), middlewares.RequireModule("projects"))
	{
		projectRoutes.GET("/", controllers.GetAllProjects())
		projectRoutes.POST("/", controllers.CreateProject())
		projectRoutes.GET("/:id", controllers.GetProjectByID())
		projectRoutes.PUT("/:id", controllers.UpdateProject())
		projectRoutes.DELETE("/:id", controllers.DeleteProject())
	}
}
