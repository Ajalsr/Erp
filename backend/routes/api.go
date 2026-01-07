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

	custRoutes := router.Group("/api/customers")
	// custRoutes.Use(middlewares.Authenticate)

	custRoutes.POST("/addcustomers", controllers.AddCustomers())
	custRoutes.GET("/getcustomers", controllers.GetAllCustomers())
	custRoutes.GET("/search", controllers.SearchCustomers())
	custRoutes.GET("/suggestions", controllers.GetCustomerSuggestions())
	custRoutes.GET("/status/:status", controllers.GetCustomersByStatus())
	custRoutes.GET("/stats", controllers.GetCustomerStats())
	custRoutes.GET("/:id", controllers.GetCustomerByID())
	custRoutes.PUT("/:id", controllers.UpdateCustomer())
	custRoutes.DELETE("/:id", controllers.DeleteCustomer())
	custRoutes.GET("/export/csv", controllers.ExportCustomersCSV())
	custRoutes.GET("/:id/transactions", controllers.GetCustomerTransactions())
	custRoutes.GET("/:id/history", controllers.GetCustomerHistory())

}

func SaleOrderRoutes(router *gin.Engine) {
	salesOrderRoutes := router.Group("/api/sales-orders")
	{
		salesOrderRoutes.POST("/", controllers.CreateSalesOrder())
		salesOrderRoutes.GET("/getsaleorder", controllers.GetAllSalesOrders())
		salesOrderRoutes.GET("/search", controllers.SearchSalesOrders())
		salesOrderRoutes.GET("/stats", controllers.GetSalesOrderStats())
		salesOrderRoutes.GET("/:id", controllers.GetSalesOrderByID())
		salesOrderRoutes.PUT("/:id", controllers.UpdateSalesOrder())
		salesOrderRoutes.PATCH("/:id/status", controllers.UpdateSalesOrderStatus())
		salesOrderRoutes.DELETE("/:id", controllers.DeleteSalesOrder())
	}
}

// func DashboardRoutes(router *gin.Engine) {
// 	authRoutes := router.Group("/api/dashboard")
// 	{
// 		authRoutes.GET("/dashboard/stats", controllers.GetDashboardStats())
// 	}
// }
