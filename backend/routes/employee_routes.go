package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

// EmployeeRoutes — HR directory CRUD. Org Chart is a separate route (own module key).
func EmployeeRoutes(router *gin.Engine) {
	empRoutes := router.Group("/api/employees")
	empRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("employees"), middlewares.RequireModule("employees"))
	{
		empRoutes.POST("/", controllers.CreateEmployee())
		empRoutes.GET("/", controllers.GetAllEmployees())
		empRoutes.GET("/:id", controllers.GetEmployeeByID())
		empRoutes.PUT("/:id", controllers.UpdateEmployee())
		empRoutes.DELETE("/:id", controllers.DeleteEmployee())
	}
}

// OrgChartRoutes — independently grantable via its own "org_chart" module.
func OrgChartRoutes(router *gin.Engine) {
	router.GET("/api/employees/orgchart", middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("org_chart"), middlewares.RequireModule("org_chart"), controllers.GetOrgChart())
}
