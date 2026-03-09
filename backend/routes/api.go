package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

// Public routes — no auth required
func AuthRoutes(router *gin.Engine) {
	authRoutes := router.Group("/api/auth")
	{
		authRoutes.POST("/signup", controllers.SignUp())
		authRoutes.POST("/signin", controllers.SignIn())
	}
}

// All routes below are protected — require valid JWT

func StockRoutes(router *gin.Engine) {
	stockRoutes := router.Group("/api/stocks")
	stockRoutes.Use(middlewares.Authenticate) // ✅ protected
	{
		stockRoutes.GET("/getitem", controllers.GetAllStocks())
		stockRoutes.POST("/additem", controllers.AddItem())
	}
}

func CustomerRoutes(router *gin.Engine) {
	custRoutes := router.Group("/api/customers")
	custRoutes.Use(middlewares.Authenticate) // ✅ protected

	custRoutes.POST("/addcustomers", controllers.AddCustomers())
	custRoutes.GET("/getcustomers", controllers.GetAllCustomers())
	custRoutes.GET("/search", controllers.SearchCustomers())
	custRoutes.GET("/suggestions", controllers.GetCustomerSuggestions())
	custRoutes.GET("/stats", controllers.GetCustomerStats())
	custRoutes.GET("/export/csv", controllers.ExportCustomersCSV())
	// NOTE: static sub-paths must come BEFORE /:id to avoid conflicts
	custRoutes.GET("/status/:status", controllers.GetCustomersByStatus())
	custRoutes.GET("/:id", controllers.GetCustomerByID())
	custRoutes.PUT("/:id", controllers.UpdateCustomer())
	custRoutes.DELETE("/:id", controllers.DeleteCustomer())
	custRoutes.GET("/:id/transactions", controllers.GetCustomerTransactions())
	custRoutes.GET("/:id/history", controllers.GetCustomerHistory())
}

func SaleOrderRoutes(router *gin.Engine) {
	salesOrderRoutes := router.Group("/api/sales-orders")
	salesOrderRoutes.Use(middlewares.Authenticate) // ✅ protected
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
