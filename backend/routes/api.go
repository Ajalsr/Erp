package routes

import (
	"github.com/backend/controllers"
	"github.com/gin-gonic/gin"
)

func StockRoutes(router *gin.Engine) {

	stockRoutes := router.Group("/api/stocks")
	{
		stockRoutes.GET("/getitem", controllers.GetAllStocks())
		stockRoutes.POST("/additem", controllers.AddItem())
	}
}

func AuthRoutes(router *gin.Engine) {

	authRoutes := router.Group("/api/auth")
	{
		authRoutes.POST("/signup", controllers.SignUp())
		authRoutes.POST("/signin", controllers.SignIn())
	}
}

func CustomerRoutes(router *gin.Engine) {

	authRoutes := router.Group("/api/customers")
	{
		authRoutes.POST("/addcustomers", controllers.AddCustomers())
		authRoutes.GET("/getcustomers", controllers.GetAllCustomers())
		authRoutes.GET("/search", controllers.SearchCustomers())
		authRoutes.GET("/suggestions", controllers.GetCustomerSuggestions())
		authRoutes.GET("/status/:status", controllers.GetCustomersByStatus())
		authRoutes.GET("/stats", controllers.GetCustomerStats())
		authRoutes.GET("/:id", controllers.GetCustomerByID())
		authRoutes.PUT("/:id", controllers.UpdateCustomer())
		authRoutes.DELETE("/:id", controllers.DeleteCustomer())
		authRoutes.GET("/export/csv", controllers.ExportCustomersCSV())
		authRoutes.GET("/:id/transactions", controllers.GetCustomerTransactions())
		authRoutes.GET("/:id/history", controllers.GetCustomerHistory())
	}
}

// func DashboardRoutes(router *gin.Engine) {
// 	authRoutes := router.Group("/api/dashboard")
// 	{
// 		authRoutes.GET("/dashboard/stats", controllers.GetDashboardStats())
// 	}
// }
