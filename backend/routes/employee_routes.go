package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

// EmployeeRoutes — HR directory CRUD plus the derived org-chart read.
// Org Chart has no separate module key; it's gated by "employees" view.
func EmployeeRoutes(router *gin.Engine) {
	empRoutes := router.Group("/api/employees")
	empRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("employees"), middlewares.RequireModule("employees"))
	{
		empRoutes.POST("/", controllers.CreateEmployee())
		empRoutes.GET("/", controllers.GetAllEmployees())
		empRoutes.GET("/orgchart", controllers.GetOrgChart())
		empRoutes.GET("/:id", controllers.GetEmployeeByID())
		empRoutes.PUT("/:id", controllers.UpdateEmployee())
		empRoutes.DELETE("/:id", controllers.DeleteEmployee())
	}
}
