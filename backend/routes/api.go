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
	stockRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("items"))
	{
		stockRoutes.GET("/getitem", controllers.GetAllStocks())
		stockRoutes.POST("/additem", controllers.AddItem())
		stockRoutes.POST("/import", controllers.ImportItems())
		stockRoutes.GET("/:id/availability", controllers.GetItemStockAvailability())
		stockRoutes.GET("/:id", controllers.GetItemByID())
		stockRoutes.PUT("/:id", controllers.UpdateItem())
		stockRoutes.PATCH("/:id/reduce", controllers.ReduceStock())
		stockRoutes.PATCH("/:id/increase", controllers.IncreaseStock())
		stockRoutes.POST("/backfill-warehouse", controllers.BackfillWarehouseStock())
	}
}

func CustomerRoutes(router *gin.Engine) {
	custRoutes := router.Group("/api/customers")
	custRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("customers"))

	custRoutes.POST("/addcustomers", controllers.AddCustomers())
	custRoutes.POST("/import", controllers.ImportCustomers())
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
	custRoutes.GET("/:id/statement", controllers.GetStatementOfAccount())
	custRoutes.POST("/:id/history", controllers.AddCustomerHistory())
	custRoutes.GET("/:id/credit-status", controllers.GetCustomerCreditStatus())
	custRoutes.POST("/:id/apply-credit", controllers.ApplyCredit())
	custRoutes.POST("/migrate-codes", controllers.MigrateCustomerOrgAndCodes())
	custRoutes.POST("/:id/documents", controllers.AddCustomerDocument())
	custRoutes.DELETE("/:id/documents/:docId", controllers.DeleteCustomerDocument())
}

func SaleOrderRoutes(router *gin.Engine) {
	salesOrderRoutes := router.Group("/api/sales-orders")
	salesOrderRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("sales_orders"))
	{
		salesOrderRoutes.POST("/", controllers.CreateSalesOrder())
		salesOrderRoutes.GET("/getsaleorder", controllers.GetAllSalesOrders())
		salesOrderRoutes.GET("/search", controllers.SearchSalesOrders())
		salesOrderRoutes.GET("/stats", controllers.GetSalesOrderStats())
		salesOrderRoutes.GET("/:id", controllers.GetSalesOrderByID())
		salesOrderRoutes.GET("/:id/history", controllers.GetSalesOrderHistory())
		salesOrderRoutes.PUT("/:id", controllers.UpdateSalesOrder())
		salesOrderRoutes.PATCH("/:id/status", controllers.UpdateSalesOrderStatus())
		salesOrderRoutes.DELETE("/:id", controllers.DeleteSalesOrder())
		salesOrderRoutes.POST("/:id/revert", controllers.RevertSalesOrder())
		salesOrderRoutes.POST("/:id/create-po", controllers.ConvertSOToPO())
	}
}

func InvoiceRoutes(router *gin.Engine) {
	// Public — no auth (shareable link for customers)
	router.GET("/api/invoices/public/:token", controllers.GetPublicInvoice())

	invRoutes := router.Group("/api/invoices")
	invRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("invoices"))
	{
		invRoutes.POST("", controllers.CreateInvoice())
		invRoutes.POST("/", controllers.CreateInvoice())
		invRoutes.GET("", controllers.GetAllInvoices())
		invRoutes.GET("/", controllers.GetAllInvoices())
		invRoutes.GET("/stats", controllers.GetInvoiceStats())
		invRoutes.GET("/:id", controllers.GetInvoiceByID())
		invRoutes.PUT("/:id", controllers.UpdateInvoice())
		invRoutes.PATCH("/:id/status", controllers.UpdateInvoiceStatus())
		invRoutes.PATCH("/:id/void", controllers.VoidInvoice())
		invRoutes.GET("/aging", controllers.GetInvoiceAging())
		invRoutes.POST("/:id/finalize", controllers.FinalizeProforma())
		invRoutes.POST("/:id/send", controllers.SendInvoice())
		invRoutes.POST("/:id/send-reminder", controllers.SendInvoiceReminder())
		invRoutes.POST("/:id/return", controllers.CreateSalesReturn())
		invRoutes.GET("/:id/history", controllers.GetInvoiceHistory())
		invRoutes.GET("/:id/pdf", controllers.DownloadInvoicePDF())
	}
}

func QuoteRoutes(router *gin.Engine) {
	qRoutes := router.Group("/api/quotes")
	qRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("quotes"))
	{
		qRoutes.POST("/", controllers.CreateQuote())
		qRoutes.GET("/", controllers.GetAllQuotes())
		qRoutes.GET("/stats", controllers.GetQuoteStats())
		qRoutes.GET("/:id", controllers.GetQuoteByID())
		qRoutes.PUT("/:id", controllers.UpdateQuote())
		qRoutes.PATCH("/:id/status", controllers.UpdateQuoteStatus())
		qRoutes.POST("/:id/convert", controllers.ConvertQuoteToInvoice())
		qRoutes.POST("/:id/convert-to-so", controllers.ConvertQuoteToSalesOrder())
		qRoutes.DELETE("/:id", controllers.DeleteQuote())
		qRoutes.GET("/:id/pdf", controllers.DownloadQuotePDF())
	}
}

func CreditNoteRoutes(router *gin.Engine) {
	cnRoutes := router.Group("/api/credit-notes")
	cnRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("credit_notes"))
	{
		cnRoutes.POST("", controllers.CreateCreditNote())
		cnRoutes.GET("", controllers.GetAllCreditNotes())
		cnRoutes.GET("/stats", controllers.GetCreditNoteStats())
		cnRoutes.GET("/by-invoice/:invoiceId", controllers.GetCreditNotesByInvoice())
		cnRoutes.GET("/:id", controllers.GetCreditNoteByID())
		cnRoutes.PATCH("/:id/submit", controllers.SubmitCreditNote())
		cnRoutes.PATCH("/:id/approve", controllers.ApproveCreditNote())
		cnRoutes.PATCH("/:id/apply", controllers.ApplyCreditNote())
		cnRoutes.PATCH("/:id/refund", controllers.RefundCreditNote())
		cnRoutes.PATCH("/:id/close", controllers.CloseCreditNote())
		cnRoutes.PATCH("/:id/void", controllers.VoidCreditNote())
	}
}

func DebitNoteRoutes(router *gin.Engine) {
	dnRoutes := router.Group("/api/debit-notes")
	dnRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("debit_notes"))
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

func DocumentRoutes(router *gin.Engine) {
	// /proxy is unauthenticated — it only relays public Cloudinary URLs (raw/upload type)
	router.GET("/api/documents/proxy", controllers.ProxyDocument())

	docRoutes := router.Group("/api/documents")
	docRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		docRoutes.POST("/upload", controllers.UploadDocument())
	}
}

func DashboardRoutes(router *gin.Engine) {
	dashRoutes := router.Group("/api/dashboard")
	dashRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("dashboard"))
	{
		dashRoutes.GET("/activity-feed", controllers.GetActivityFeed())
		dashRoutes.GET("/summary", controllers.GetDashboardSummary())
	}
}

func PurchaseOrderRoutes(router *gin.Engine) {
	poRoutes := router.Group("/api/purchase-orders")
	poRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("purchase_orders"))
	{
		poRoutes.POST("/", controllers.CreatePurchaseOrder())
		poRoutes.GET("/getorders", controllers.GetAllPurchaseOrders())
		poRoutes.GET("/stats", controllers.GetPurchaseOrderStats())
		poRoutes.GET("/:id", controllers.GetPurchaseOrderByID())
		poRoutes.PATCH("/:id/status", controllers.UpdatePurchaseOrderStatus())
		poRoutes.PATCH("/:id/approve", controllers.ApprovePurchaseOrder())
		poRoutes.PATCH("/:id/cancel", controllers.CancelPurchaseOrder())
		poRoutes.POST("/:id/convert-to-bill", controllers.ConvertPOToBill())
	}
}

func GRNRoutes(router *gin.Engine) {
	grnRoutes := router.Group("/api/grns")
	grnRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("grns"))
	{
		grnRoutes.POST("/", controllers.CreateGRN())
		grnRoutes.GET("/", controllers.GetAllGRNs())
		grnRoutes.GET("/stats", controllers.GetGRNStats())
		grnRoutes.GET("/batches", controllers.GetGRNBatches())
		grnRoutes.GET("/:id", controllers.GetGRNByID())
		grnRoutes.PATCH("/:id", controllers.UpdateGRN())
		grnRoutes.POST("/:id/confirm", controllers.ConfirmGRN())
		grnRoutes.DELETE("/:id", controllers.DiscardDraftGRN())
	}
}

func PaymentRoutes(router *gin.Engine) {
	pmtRoutes := router.Group("/api/payments")
	pmtRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("payments"))
	{
		pmtRoutes.POST("/", controllers.CreatePayment())
		pmtRoutes.GET("/", controllers.GetAllPayments())
		pmtRoutes.GET("/stats", controllers.GetPaymentStats())
		pmtRoutes.GET("/:id", controllers.GetPaymentByID())
		pmtRoutes.POST("/:id/refund", controllers.RefundPayment())
	}
}

func VendorRoutes(router *gin.Engine) {
	vendorRoutes := router.Group("/api/vendors")
	vendorRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("vendors"))
	{
		vendorRoutes.POST("/", controllers.CreateVendor())
		vendorRoutes.POST("/import", controllers.ImportVendors())
		vendorRoutes.GET("/", controllers.GetAllVendors())
		vendorRoutes.GET("/stats", controllers.GetVendorStats())
		vendorRoutes.GET("/search", controllers.SearchVendors())
		vendorRoutes.GET("/:id", controllers.GetVendorByID())
		vendorRoutes.GET("/:id/transactions", controllers.GetVendorTransactions())
		vendorRoutes.POST("/:id/apply-credit", controllers.ApplyVendorCreditWallet())
		vendorRoutes.PUT("/:id", controllers.UpdateVendor())
		vendorRoutes.DELETE("/:id", controllers.DeleteVendor())
	}
}

func BillRoutes(router *gin.Engine) {
	billRoutes := router.Group("/api/bills")
	billRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("bills"))
	{
		billRoutes.POST("/", controllers.CreateBill())
		billRoutes.GET("/", controllers.GetAllBills())
		billRoutes.GET("/stats", controllers.GetBillStats())
		billRoutes.GET("/:id", controllers.GetBillByID())
		billRoutes.PUT("/:id", controllers.UpdateBill())
		billRoutes.PATCH("/:id/status", controllers.UpdateBillStatus())
		billRoutes.PATCH("/:id/void", controllers.VoidBill())
	}
}

func VendorPaymentRoutes(router *gin.Engine) {
	vpRoutes := router.Group("/api/vendor-payments")
	vpRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("vendor_payments"))
	{
		vpRoutes.POST("/", controllers.CreateVendorPayment())
		vpRoutes.GET("/", controllers.GetAllVendorPayments())
		vpRoutes.GET("/stats", controllers.GetVendorPaymentStats())
		vpRoutes.GET("/:id", controllers.GetVendorPaymentByID())
		vpRoutes.POST("/:id/reverse", controllers.ReverseVendorPayment())
	}
}

func ApprovalRoutes(router *gin.Engine) {
	apRoutes := router.Group("/api/approvals")
	apRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		apRoutes.GET("/", controllers.GetApprovalRequests())
		apRoutes.POST("/:id/approve", controllers.ApproveRequest())
		apRoutes.POST("/:id/reject", controllers.RejectRequest())
	}
}

func WarehouseRoutes(router *gin.Engine) {
	wRoutes := router.Group("/api/warehouses")
	wRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("warehouses"))
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
	adjRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("adjustments"))
	{
		adjRoutes.POST("/", controllers.CreateAdjustment())
		adjRoutes.GET("/", controllers.GetAllAdjustments())
	}
}

func ItemGroupRoutes(router *gin.Engine) {
	igRoutes := router.Group("/api/item-groups")
	igRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("item_groups"))
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
	plRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("price_lists"))
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
	accRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("accounts"))
	{
		accRoutes.POST("/", controllers.CreateAccount())
		accRoutes.POST("/seed", controllers.SeedDefaultAccounts())
		accRoutes.GET("/", controllers.GetAllAccounts())
		accRoutes.GET("/stats", controllers.GetAccountStats())
		accRoutes.GET("/trial-balance", controllers.GetTrialBalance())
		accRoutes.GET("/:id", controllers.GetAccountByID())
		accRoutes.GET("/:id/ledger", controllers.GetAccountLedger())
		accRoutes.PUT("/:id", controllers.UpdateAccount())
		accRoutes.DELETE("/:id", controllers.DeleteAccount())
	}
}

func JournalEntryRoutes(router *gin.Engine) {
	jeRoutes := router.Group("/api/journal-entries")
	jeRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("journal_entries"))
	{
		jeRoutes.POST("/", controllers.CreateManualJournalEntry())
		jeRoutes.GET("/", controllers.GetJournalEntries())
		jeRoutes.GET("/:id", controllers.GetJournalEntryByID())
	}
}

func BankReconciliationRoutes(router *gin.Engine) {
	brRoutes := router.Group("/api/bank-reconciliation")
	brRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("accounts"))
	{
		brRoutes.GET("/transactions", controllers.GetBankTransactions())
		brRoutes.POST("/toggle", controllers.ToggleBankClearing())
		brRoutes.POST("/", controllers.CreateBankReconciliation())
		brRoutes.GET("/", controllers.GetBankReconciliations())
	}
}

func AdvancePaymentRoutes(router *gin.Engine) {
	advRoutes := router.Group("/api/advance-payments")
	advRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("advance_payments"))
	{
		advRoutes.POST("/", controllers.CreateAdvancePayment())
		advRoutes.GET("/", controllers.GetAdvancePayments())
		advRoutes.GET("/:id", controllers.GetAdvancePaymentByID())
		advRoutes.POST("/:id/apply", controllers.ApplyAdvanceToInvoice())
	}
}

func VendorCreditRoutes(router *gin.Engine) {
	vcRoutes := router.Group("/api/vendor-credits")
	vcRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("vendor_credits"))
	{
		vcRoutes.POST("/", controllers.CreateVendorCredit())
		vcRoutes.GET("/", controllers.GetAllVendorCredits())
		vcRoutes.GET("/stats", controllers.GetVendorCreditStats())
		vcRoutes.GET("/:id", controllers.GetVendorCreditByID())
		vcRoutes.POST("/:id/apply", controllers.ApplyVendorCredit())
		vcRoutes.POST("/:id/unapply", controllers.UnapplyVendorCredit())
		vcRoutes.PATCH("/:id/void", controllers.VoidVendorCredit())
	}
}

func DeliveryNoteRoutes(router *gin.Engine) {
	dnRoutes := router.Group("/api/delivery-notes")
	dnRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("delivery_notes"))
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
	enqRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("enquiries"))
	{
		enqRoutes.POST("/", controllers.CreateEnquiry())
		enqRoutes.GET("/", controllers.GetAllEnquiries())
		enqRoutes.GET("/stats", controllers.GetEnquiryStats())
		enqRoutes.GET("/:id", controllers.GetEnquiryByID())
		enqRoutes.PATCH("/:id/status", controllers.UpdateEnquiryStatus())
		enqRoutes.PUT("/:id", controllers.UpdateEnquiry())
	}
}

// RecurringInvoiceRoutes — templates that auto-generate invoices on a schedule.
// Gated by the invoices module (a recurring profile is just an invoice factory).
func RecurringInvoiceRoutes(router *gin.Engine) {
	riRoutes := router.Group("/api/recurring-invoices")
	riRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("invoices"))
	{
		riRoutes.POST("/", controllers.CreateRecurringInvoice())
		riRoutes.GET("/", controllers.GetAllRecurringInvoices())
		riRoutes.GET("/:id", controllers.GetRecurringInvoiceByID())
		riRoutes.PUT("/:id", controllers.UpdateRecurringInvoice())
		riRoutes.PATCH("/:id/status", controllers.UpdateRecurringInvoiceStatus())
		riRoutes.POST("/:id/run", controllers.RunRecurringInvoiceNow())
		riRoutes.DELETE("/:id", controllers.DeleteRecurringInvoice())
	}
}

// ExchangeRateRoutes — manual FX quotes powering multi-currency conversion to the
// org base currency. Reads are open to any org member (invoice/bill forms and the
// dashboard need the base currency + rate); only creating a rate needs the accounts
// module (finance setup).
func ExchangeRateRoutes(router *gin.Engine) {
	fxRead := router.Group("/api/exchange-rates")
	fxRead.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		fxRead.GET("/", controllers.GetExchangeRates())
		fxRead.GET("/latest", controllers.GetLatestRate())
	}

	fxWrite := router.Group("/api/exchange-rates")
	fxWrite.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("accounts"))
	{
		fxWrite.POST("/", controllers.CreateExchangeRate())
	}
}

// SearchRoutes — cross-module global search. Gated only by org membership; each
// result category is filtered by the caller's view permission inside the handler.
func SearchRoutes(router *gin.Engine) {
	searchRoutes := router.Group("/api/search")
	searchRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		searchRoutes.GET("", controllers.GlobalSearch())
		searchRoutes.GET("/", controllers.GlobalSearch())
	}
}

func ReportsRoutes(router *gin.Engine) {
	rptRoutes := router.Group("/api/reports")
	rptRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("reports"))
	{
		rptRoutes.GET("/vat", controllers.GetVATReport())
		rptRoutes.GET("/vendor-aging", controllers.GetVendorAging())
		rptRoutes.GET("/profit-loss", controllers.GetProfitAndLoss())
		rptRoutes.GET("/balance-sheet", controllers.GetBalanceSheet())
		rptRoutes.GET("/cash-flow", controllers.GetCashFlow())
	}
}
