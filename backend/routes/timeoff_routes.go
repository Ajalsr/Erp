package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

// TimeOffRoutes — leave types, balances, and leave requests. Approve/Reject
// authorization is enforced inside the handlers (caller must be the current
// chain step's approver, or owner/admin) — RequireModule's verb-derived
// capability isn't fine-grained enough to express "must be this employee's
// manager," so it's not relied on for that check, only for base module access.
func TimeOffRoutes(router *gin.Engine) {
	toRoutes := router.Group("/api/timeoff")
	toRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("timeoff"), middlewares.RequireModule("timeoff"))
	{
		toRoutes.POST("/leave-types", controllers.CreateLeaveType())
		toRoutes.GET("/leave-types", controllers.GetAllLeaveTypes())
		toRoutes.GET("/leave-types/:id", controllers.GetLeaveTypeByID())
		toRoutes.PUT("/leave-types/:id", controllers.UpdateLeaveType())
		toRoutes.DELETE("/leave-types/:id", controllers.DeleteLeaveType())

		toRoutes.GET("/balances", controllers.GetLeaveBalances())
		toRoutes.PUT("/balances/:id", controllers.AdjustLeaveBalance())

		toRoutes.POST("/requests", controllers.CreateLeaveRequest())
		toRoutes.GET("/requests", controllers.GetAllLeaveRequests())
		toRoutes.GET("/requests/:id", controllers.GetLeaveRequestByID())
		toRoutes.POST("/requests/:id/approve", controllers.ApproveLeaveRequest())
		toRoutes.POST("/requests/:id/reject", controllers.RejectLeaveRequest())
		toRoutes.POST("/requests/:id/cancel", controllers.CancelLeaveRequest())
	}
}
