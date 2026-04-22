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
	stockRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		stockRoutes.GET("/getitem", controllers.GetAllStocks())
		stockRoutes.POST("/additem", controllers.AddItem())
		stockRoutes.PATCH("/:id/reduce", controllers.ReduceStock())
	}
}

func CustomerRoutes(router *gin.Engine) {
	custRoutes := router.Group("/api/customers")
	custRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)

	custRoutes.POST("/addcustomers", controllers.AddCustomers())
	custRoutes.GET("/getcustomers", controllers.GetAllCustomers())
	custRoutes.GET("/search", controllers.SearchCustomers())
	custRoutes.GET("/suggestions", controllers.GetCustomerSuggestions())
	custRoutes.GET("/stats", controllers.GetCustomerStats())
	custRoutes.GET("/export/csv", controllers.ExportCustomersCSV())
	custRoutes.GET("/dashboard", controllers.GetDashboardStats)
	custRoutes.GET("/status/:status", controllers.GetCustomersByStatus())
	custRoutes.GET("/:id", controllers.GetCustomerByID())
	custRoutes.PUT("/:id", controllers.UpdateCustomer())
	custRoutes.DELETE("/:id", controllers.DeleteCustomer())
	custRoutes.GET("/:id/transactions", controllers.GetCustomerTransactions())
	custRoutes.GET("/:id/history", controllers.GetCustomerHistory())
	custRoutes.POST("/:id/history", controllers.AddCustomerHistory())
	custRoutes.POST("/migrate-codes", controllers.MigrateCustomerOrgAndCodes())
}

func SaleOrderRoutes(router *gin.Engine) {
	salesOrderRoutes := router.Group("/api/sales-orders")
	salesOrderRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
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

func InvoiceRoutes(router *gin.Engine) {
	invRoutes := router.Group("/api/invoices")
	invRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		invRoutes.POST("", controllers.CreateInvoice())
		invRoutes.GET("", controllers.GetAllInvoices())
		invRoutes.GET("/:id", controllers.GetInvoiceByID())
		invRoutes.PATCH("/:id/status", controllers.UpdateInvoiceStatus())
	}
}

func DashboardRoutes(router *gin.Engine) {
	dashRoutes := router.Group("/api/dashboard")
	dashRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		dashRoutes.GET("/activity-feed", controllers.GetActivityFeed())
	}
}

func PurchaseOrderRoutes(router *gin.Engine) {
	poRoutes := router.Group("/api/purchase-orders")
	poRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		poRoutes.POST("/", controllers.CreatePurchaseOrder())
		poRoutes.GET("/getorders", controllers.GetAllPurchaseOrders())
		poRoutes.GET("/stats", controllers.GetPurchaseOrderStats())
	}
}
