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
		stockRoutes.GET("/:id/availability", controllers.GetItemStockAvailability())
		stockRoutes.PATCH("/:id/reduce", controllers.ReduceStock())
		stockRoutes.PATCH("/:id/increase", controllers.IncreaseStock())
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
	custRoutes.GET("/:id/credit-status", controllers.GetCustomerCreditStatus())
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
		salesOrderRoutes.POST("/:id/revert", controllers.RevertSalesOrder())
	}
}

func InvoiceRoutes(router *gin.Engine) {
	// Public — no auth (shareable link for customers)
	router.GET("/api/invoices/public/:token", controllers.GetPublicInvoice())

	invRoutes := router.Group("/api/invoices")
	invRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		invRoutes.POST("", controllers.CreateInvoice())
		invRoutes.GET("", controllers.GetAllInvoices())
		invRoutes.GET("/stats", controllers.GetInvoiceStats())
		invRoutes.GET("/:id", controllers.GetInvoiceByID())
		invRoutes.PUT("/:id", controllers.UpdateInvoice())
		invRoutes.PATCH("/:id/status", controllers.UpdateInvoiceStatus())
		invRoutes.PATCH("/:id/void", controllers.VoidInvoice())
		invRoutes.POST("/:id/send", controllers.SendInvoice())
		invRoutes.POST("/:id/send-reminder", controllers.SendInvoiceReminder())
	}
}

func QuoteRoutes(router *gin.Engine) {
	qRoutes := router.Group("/api/quotes")
	qRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		qRoutes.POST("/", controllers.CreateQuote())
		qRoutes.GET("/", controllers.GetAllQuotes())
		qRoutes.GET("/stats", controllers.GetQuoteStats())
		qRoutes.GET("/:id", controllers.GetQuoteByID())
		qRoutes.PUT("/:id", controllers.UpdateQuote())
		qRoutes.PATCH("/:id/status", controllers.UpdateQuoteStatus())
		qRoutes.POST("/:id/convert", controllers.ConvertQuoteToInvoice())
		qRoutes.DELETE("/:id", controllers.DeleteQuote())
	}
}

func CreditNoteRoutes(router *gin.Engine) {
	cnRoutes := router.Group("/api/credit-notes")
	cnRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		cnRoutes.POST("", controllers.CreateCreditNote())
		cnRoutes.GET("", controllers.GetAllCreditNotes())
		cnRoutes.GET("/stats", controllers.GetCreditNoteStats())
		cnRoutes.GET("/by-invoice/:invoiceId", controllers.GetCreditNotesByInvoice())
		cnRoutes.GET("/:id", controllers.GetCreditNoteByID())
		cnRoutes.PATCH("/:id/submit", controllers.SubmitCreditNote())
		cnRoutes.PATCH("/:id/approve", controllers.ApproveCreditNote())
		cnRoutes.PATCH("/:id/apply", controllers.ApplyCreditNote())
		cnRoutes.PATCH("/:id/close", controllers.CloseCreditNote())
		cnRoutes.PATCH("/:id/void", controllers.VoidCreditNote())
	}
}

func DebitNoteRoutes(router *gin.Engine) {
	dnRoutes := router.Group("/api/debit-notes")
	dnRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		dnRoutes.POST("", controllers.CreateDebitNote())
		dnRoutes.GET("", controllers.GetAllDebitNotes())
		dnRoutes.GET("/:id", controllers.GetDebitNoteByID())
		dnRoutes.PATCH("/:id/submit", controllers.SubmitDebitNote())
		dnRoutes.PATCH("/:id/approve", controllers.ApproveDebitNote())
		dnRoutes.PATCH("/:id/apply", controllers.ApplyDebitNote())
		dnRoutes.PATCH("/:id/close", controllers.CloseDebitNote())
		dnRoutes.PATCH("/:id/void", controllers.VoidDebitNote())
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
		poRoutes.GET("/:id", controllers.GetPurchaseOrderByID())
		poRoutes.PATCH("/:id/status", controllers.UpdatePurchaseOrderStatus())
	}
}

func GRNRoutes(router *gin.Engine) {
	grnRoutes := router.Group("/api/grns")
	grnRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		grnRoutes.POST("/", controllers.CreateGRN())
		grnRoutes.GET("/", controllers.GetAllGRNs())
		grnRoutes.GET("/stats", controllers.GetGRNStats())
		grnRoutes.GET("/:id", controllers.GetGRNByID())
		grnRoutes.PATCH("/:id", controllers.UpdateGRN())
	}
}

func PaymentRoutes(router *gin.Engine) {
	pmtRoutes := router.Group("/api/payments")
	pmtRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		pmtRoutes.POST("/", controllers.CreatePayment())
		pmtRoutes.GET("/", controllers.GetAllPayments())
		pmtRoutes.GET("/stats", controllers.GetPaymentStats())
		pmtRoutes.GET("/:id", controllers.GetPaymentByID())
	}
}

func VendorRoutes(router *gin.Engine) {
	vendorRoutes := router.Group("/api/vendors")
	vendorRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		vendorRoutes.POST("/", controllers.CreateVendor())
		vendorRoutes.GET("/", controllers.GetAllVendors())
		vendorRoutes.GET("/stats", controllers.GetVendorStats())
		vendorRoutes.GET("/search", controllers.SearchVendors())
		vendorRoutes.GET("/:id", controllers.GetVendorByID())
		vendorRoutes.GET("/:id/transactions", controllers.GetVendorTransactions())
		vendorRoutes.PUT("/:id", controllers.UpdateVendor())
		vendorRoutes.DELETE("/:id", controllers.DeleteVendor())
	}
}

func BillRoutes(router *gin.Engine) {
	billRoutes := router.Group("/api/bills")
	billRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		billRoutes.POST("/", controllers.CreateBill())
		billRoutes.GET("/", controllers.GetAllBills())
		billRoutes.GET("/stats", controllers.GetBillStats())
		billRoutes.GET("/:id", controllers.GetBillByID())
		billRoutes.PATCH("/:id/status", controllers.UpdateBillStatus())
	}
}

func VendorPaymentRoutes(router *gin.Engine) {
	vpRoutes := router.Group("/api/vendor-payments")
	vpRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		vpRoutes.POST("/", controllers.CreateVendorPayment())
		vpRoutes.GET("/", controllers.GetAllVendorPayments())
		vpRoutes.GET("/stats", controllers.GetVendorPaymentStats())
		vpRoutes.GET("/:id", controllers.GetVendorPaymentByID())
	}
}

func WarehouseRoutes(router *gin.Engine) {
	wRoutes := router.Group("/api/warehouses")
	wRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		wRoutes.POST("/", controllers.CreateWarehouse())
		wRoutes.GET("/", controllers.GetAllWarehouses())
		wRoutes.GET("/:id", controllers.GetWarehouseByID())
		wRoutes.PUT("/:id", controllers.UpdateWarehouse())
		wRoutes.DELETE("/:id", controllers.DeleteWarehouse())
	}
}

func AdjustmentRoutes(router *gin.Engine) {
	adjRoutes := router.Group("/api/inventory/adjustments")
	adjRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		adjRoutes.POST("/", controllers.CreateAdjustment())
		adjRoutes.GET("/", controllers.GetAllAdjustments())
	}
}

func ItemGroupRoutes(router *gin.Engine) {
	igRoutes := router.Group("/api/item-groups")
	igRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		igRoutes.POST("/", controllers.CreateItemGroup())
		igRoutes.GET("/", controllers.GetAllItemGroups())
		igRoutes.GET("/:id", controllers.GetItemGroupByID())
		igRoutes.PUT("/:id", controllers.UpdateItemGroup())
		igRoutes.DELETE("/:id", controllers.DeleteItemGroup())
	}
}

func PriceListRoutes(router *gin.Engine) {
	plRoutes := router.Group("/api/price-lists")
	plRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		plRoutes.POST("/", controllers.CreatePriceList())
		plRoutes.GET("/", controllers.GetAllPriceLists())
		plRoutes.GET("/:id", controllers.GetPriceListByID())
		plRoutes.PUT("/:id", controllers.UpdatePriceList())
		plRoutes.DELETE("/:id", controllers.DeletePriceList())
	}
}

func AccountRoutes(router *gin.Engine) {
	accRoutes := router.Group("/api/accounts")
	accRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		accRoutes.POST("/", controllers.CreateAccount())
		accRoutes.GET("/", controllers.GetAllAccounts())
		accRoutes.GET("/stats", controllers.GetAccountStats())
		accRoutes.GET("/:id", controllers.GetAccountByID())
		accRoutes.PUT("/:id", controllers.UpdateAccount())
		accRoutes.DELETE("/:id", controllers.DeleteAccount())
	}
}

func VendorCreditRoutes(router *gin.Engine) {
	vcRoutes := router.Group("/api/vendor-credits")
	vcRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		vcRoutes.POST("/", controllers.CreateVendorCredit())
		vcRoutes.GET("/", controllers.GetAllVendorCredits())
		vcRoutes.GET("/stats", controllers.GetVendorCreditStats())
		vcRoutes.GET("/:id", controllers.GetVendorCreditByID())
		vcRoutes.POST("/:id/apply", controllers.ApplyVendorCredit())
		vcRoutes.PATCH("/:id/void", controllers.VoidVendorCredit())
	}
}

func DeliveryNoteRoutes(router *gin.Engine) {
	dnRoutes := router.Group("/api/delivery-notes")
	dnRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		dnRoutes.POST("/", controllers.CreateDeliveryNote())
		dnRoutes.GET("/", controllers.GetAllDeliveryNotes())
		dnRoutes.GET("/stats", controllers.GetDeliveryNoteStats())
		dnRoutes.GET("/:id", controllers.GetDeliveryNoteByID())
		dnRoutes.PATCH("/:id/status", controllers.UpdateDeliveryNoteStatus())
		dnRoutes.PATCH("/:id/invoice", controllers.MarkDeliveryNoteInvoiced())
	}
}

func EnquiryRoutes(router *gin.Engine) {
	enqRoutes := router.Group("/api/enquiries")
	enqRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		enqRoutes.POST("/", controllers.CreateEnquiry())
		enqRoutes.GET("/", controllers.GetAllEnquiries())
		enqRoutes.GET("/stats", controllers.GetEnquiryStats())
		enqRoutes.GET("/:id", controllers.GetEnquiryByID())
		enqRoutes.PATCH("/:id/status", controllers.UpdateEnquiryStatus())
		enqRoutes.PUT("/:id", controllers.UpdateEnquiry())
	}
}
