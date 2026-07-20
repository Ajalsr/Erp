package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

// PayrollRoutes — salary structures, pay-run lifecycle, payslips (incl. PDF
// download/preview and email). One "payroll" key covers both compensation
// data and run execution (see plan — trivial to split into a separate key
// later by changing this route group's RequireModule string).
func PayrollRoutes(router *gin.Engine) {
	payrollRoutes := router.Group("/api/payroll")
	payrollRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("payroll"))
	{
		payrollRoutes.POST("/salary-structures", controllers.CreateSalaryStructure())
		payrollRoutes.GET("/salary-structures", controllers.GetSalaryStructures())
		payrollRoutes.GET("/salary-structures/:id", controllers.GetSalaryStructureByID())
		payrollRoutes.PUT("/salary-structures/:id", controllers.UpdateSalaryStructure())
		payrollRoutes.DELETE("/salary-structures/:id", controllers.DeleteSalaryStructure())

		payrollRoutes.POST("/pay-runs", controllers.CreatePayRun())
		payrollRoutes.GET("/pay-runs", controllers.GetAllPayRuns())
		payrollRoutes.GET("/pay-runs/:id", controllers.GetPayRunByID())
		payrollRoutes.POST("/pay-runs/:id/generate", controllers.GeneratePayslips())
		payrollRoutes.POST("/pay-runs/:id/approve", controllers.ApprovePayRun())
		payrollRoutes.POST("/pay-runs/:id/mark-paid", controllers.MarkPayRunPaid())
		payrollRoutes.POST("/pay-runs/:id/cancel", controllers.CancelPayRun())
		payrollRoutes.DELETE("/pay-runs/:id", controllers.DeletePayRun())

		payrollRoutes.GET("/payslips", controllers.GetAllPayslips())
		payrollRoutes.GET("/payslips/:id", controllers.GetPayslipByID())
		payrollRoutes.GET("/payslips/:id/pdf", controllers.DownloadPayslipPDF())
		payrollRoutes.GET("/payslips/:id/preview", controllers.PreviewPayslipPDF())
		payrollRoutes.POST("/payslips/:id/send-email", controllers.SendPayslipEmailHandler())

		// Schedules: recurring config the daily scheduler uses to auto-create draft
		// pay runs (see invoice_scheduler.go's processPayrollSchedules). Approve /
		// mark-paid always stay manual — schedules never post GL or move money.
		payrollRoutes.POST("/schedules", controllers.CreatePayrollSchedule())
		payrollRoutes.GET("/schedules", controllers.GetAllPayrollSchedules())
		payrollRoutes.GET("/schedules/:id", controllers.GetPayrollScheduleByID())
		payrollRoutes.PUT("/schedules/:id", controllers.UpdatePayrollSchedule())
		payrollRoutes.PATCH("/schedules/:id/status", controllers.UpdatePayrollScheduleStatus())
		payrollRoutes.POST("/schedules/:id/run-now", controllers.RunPayrollScheduleNow())
		payrollRoutes.DELETE("/schedules/:id", controllers.DeletePayrollSchedule())
	}
}
