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
		authRoutes.POST("/verify-otp", controllers.VerifyLoginOTP())
		authRoutes.POST("/forgot-password", controllers.ForgotPassword())
		authRoutes.POST("/reset-password", controllers.ResetPassword())
	}

	// Admin user cleanup — gated by the X-Admin-Secret header (ADMIN_SECRET env).
	adminRoutes := router.Group("/api/admin")
	{
		adminRoutes.GET("/users", controllers.AdminListUsers())
		adminRoutes.DELETE("/users/:id", controllers.AdminDeleteUser())
		adminRoutes.PATCH("/organizations/:id/license", controllers.AdminSetLicense())
		adminRoutes.POST("/licenses", controllers.AdminCreateLicense())
		adminRoutes.GET("/licenses", controllers.AdminListLicenses())
		adminRoutes.PATCH("/licenses/:id/approve", controllers.AdminApproveLicense())
		adminRoutes.PATCH("/licenses/:id/reject", controllers.AdminRejectLicense())
	}

	// Public — license verification, needed before any account/session exists
	// (marketing/download site, and the Tauri app's first-launch activation).
	router.GET("/api/license/verify", controllers.VerifyLicenseKey())
	// Public — self-serve "get a license" request form. No key exists yet.
	router.POST("/api/license/request", controllers.RequestLicense())
}

// All routes below are protected — require valid JWT

func StockRoutes(router *gin.Engine) {
	stockRoutes := router.Group("/api/stocks")
	stockRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("items"), middlewares.RequireModule("items"))
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

// ReorderAlertRoutes — same underlying item list as StockRoutes.GetAllStocks, exposed
// under its own path + module key so the Reorder Alerts view can be granted independently
// of general Items access.
func ReorderAlertRoutes(router *gin.Engine) {
	router.GET("/api/stocks/reorder-alerts", middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("reorder_alerts"), middlewares.RequireModule("reorder_alerts"), controllers.GetAllStocks())
}

func CustomerRoutes(router *gin.Engine) {
	custRoutes := router.Group("/api/customers")
	custRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("customers"), middlewares.RequireModule("customers"))

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
	// Reports page only — gate on its own module too, not just "customers" (org could
	// license customers without this report; endpoint has no other caller, see CustomerStatement.jsx).
	custRoutes.GET("/:id/statement", middlewares.RequireLicenseModule("customer_statement_report"), middlewares.RequireModule("customer_statement_report"), controllers.GetStatementOfAccount())
	custRoutes.POST("/:id/history", controllers.AddCustomerHistory())
	custRoutes.GET("/:id/credit-status", controllers.GetCustomerCreditStatus())
	custRoutes.POST("/:id/apply-credit", controllers.ApplyCredit())
	custRoutes.POST("/migrate-codes", controllers.MigrateCustomerOrgAndCodes())
	custRoutes.POST("/:id/documents", controllers.AddCustomerDocument())
	custRoutes.DELETE("/:id/documents/:docId", controllers.DeleteCustomerDocument())
}

func SaleOrderRoutes(router *gin.Engine) {
	salesOrderRoutes := router.Group("/api/sales-orders")
	salesOrderRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("sales_orders"), middlewares.RequireModule("sales_orders"))
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
		salesOrderRoutes.GET("/:id/pdf", controllers.DownloadSalesOrderPDF())
		salesOrderRoutes.GET("/:id/preview", controllers.PreviewSalesOrderPDF())
	}
}

func InvoiceRoutes(router *gin.Engine) {
	// Public — no auth (shareable link for customers)
	router.GET("/api/invoices/public/:token", controllers.GetPublicInvoice())
	router.GET("/api/invoices/public/:token/pdf", controllers.PublicInvoicePDF())
	router.GET("/api/quotes/public/:token", controllers.GetPublicQuote())
	router.GET("/api/quotes/public/:token/pdf", controllers.PublicQuotePDF())

	invRoutes := router.Group("/api/invoices")
	invRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("invoices"), middlewares.RequireModule("invoices"))
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
		// Reports page only (AgingReport.jsx) — gate on its own module too, not just "invoices".
		invRoutes.GET("/aging", middlewares.RequireLicenseModule("ar_aging_report"), middlewares.RequireModule("ar_aging_report"), controllers.GetInvoiceAging())
		invRoutes.POST("/:id/finalize", controllers.FinalizeProforma())
		invRoutes.POST("/:id/send", controllers.SendInvoice())
		invRoutes.POST("/:id/send-reminder", controllers.SendInvoiceReminder())
		invRoutes.POST("/:id/return", controllers.CreateSalesReturn())
		invRoutes.GET("/:id/history", controllers.GetInvoiceHistory())
		invRoutes.GET("/:id/pdf", controllers.DownloadInvoicePDF())
		invRoutes.GET("/:id/preview", controllers.PreviewInvoicePDF())
	}
}

func QuoteRoutes(router *gin.Engine) {
	qRoutes := router.Group("/api/quotes")
	qRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("quotes"), middlewares.RequireModule("quotes"))
	{
		qRoutes.POST("/", controllers.CreateQuote())
		qRoutes.GET("/", controllers.GetAllQuotes())
		qRoutes.GET("/stats", controllers.GetQuoteStats())
		qRoutes.GET("/:id", controllers.GetQuoteByID())
		qRoutes.PUT("/:id", controllers.UpdateQuote())
		qRoutes.PATCH("/:id/status", controllers.UpdateQuoteStatus())
		qRoutes.POST("/:id/send", controllers.SendQuote())
		qRoutes.POST("/:id/convert", controllers.ConvertQuoteToInvoice())
		qRoutes.POST("/:id/convert-to-so", controllers.ConvertQuoteToSalesOrder())
		qRoutes.DELETE("/:id", controllers.DeleteQuote())
		qRoutes.GET("/:id/pdf", controllers.DownloadQuotePDF())
		qRoutes.GET("/:id/preview", controllers.PreviewQuotePDF())
	}
}

func CreditNoteRoutes(router *gin.Engine) {
	cnRoutes := router.Group("/api/credit-notes")
	cnRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("credit_notes"), middlewares.RequireModule("credit_notes"))
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
	dnRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("debit_notes"), middlewares.RequireModule("debit_notes"))
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
	dashRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("dashboard"), middlewares.RequireModule("dashboard"))
	{
		dashRoutes.GET("/activity-feed", controllers.GetActivityFeed())
		dashRoutes.GET("/summary", controllers.GetDashboardSummary())
	}

	// Sales-rep dashboard: returns ONLY the caller's own quotes/sales for the year, so
	// it is safe for any org member. Deliberately NOT behind RequireModule("dashboard")
	// — custom roles (e.g. "sales rep") lack the dashboard module grant and would 403.
	repDash := router.Group("/api/dashboard")
	repDash.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		repDash.GET("/sales-rep", controllers.GetSalesRepSummary())
		repDash.GET("/sales-rep/records", controllers.GetSalesRepRecords())
	}
}

func PurchaseOrderRoutes(router *gin.Engine) {
	poRoutes := router.Group("/api/purchase-orders")
	poRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("purchase_orders"), middlewares.RequireModule("purchase_orders"))
	{
		poRoutes.POST("/", controllers.CreatePurchaseOrder())
		poRoutes.GET("/getorders", controllers.GetAllPurchaseOrders())
		poRoutes.GET("/stats", controllers.GetPurchaseOrderStats())
		poRoutes.GET("/:id", controllers.GetPurchaseOrderByID())
		poRoutes.PUT("/:id", controllers.UpdatePurchaseOrder())
		poRoutes.PATCH("/:id/status", controllers.UpdatePurchaseOrderStatus())
		poRoutes.PATCH("/:id/approve", controllers.ApprovePurchaseOrder())
		poRoutes.PATCH("/:id/cancel", controllers.CancelPurchaseOrder())
		poRoutes.POST("/:id/convert-to-bill", controllers.ConvertPOToBill())
		poRoutes.GET("/:id/pdf", controllers.DownloadPurchaseOrderPDF())
		poRoutes.GET("/:id/preview", controllers.PreviewPurchaseOrderPDF())
	}
}

func GRNRoutes(router *gin.Engine) {
	grnRoutes := router.Group("/api/grns")
	grnRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("grns"), middlewares.RequireModule("grns"))
	{
		grnRoutes.POST("/", controllers.CreateGRN())
		grnRoutes.GET("/", controllers.GetAllGRNs())
		grnRoutes.GET("/stats", controllers.GetGRNStats())
		grnRoutes.GET("/:id", controllers.GetGRNByID())
		grnRoutes.PATCH("/:id", controllers.UpdateGRN())
		grnRoutes.POST("/:id/confirm", controllers.ConfirmGRN())
		grnRoutes.GET("/:id/pdf", controllers.DownloadGRNPDF())
		grnRoutes.GET("/:id/preview", controllers.PreviewGRNPDF())
		grnRoutes.DELETE("/:id", controllers.DiscardDraftGRN())
	}
}

// BatchExpiryRoutes — the batch/expiry-tracking view over GRN receipts, exposed under
// its own module key so it can be granted independently of general GRN access.
func BatchExpiryRoutes(router *gin.Engine) {
	router.GET("/api/grns/batches", middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("batch_expiry"), middlewares.RequireModule("batch_expiry"), controllers.GetGRNBatches())
}

func PaymentRoutes(router *gin.Engine) {
	pmtRoutes := router.Group("/api/payments")
	pmtRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("payments"), middlewares.RequireModule("payments"))
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
	vendorRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("vendors"), middlewares.RequireModule("vendors"))
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
	// Public "view online" link emailed with the bill — no auth, keyed by an
	// unguessable token rather than id+org.
	router.GET("/api/bills/public/:token", controllers.GetPublicBill())
	router.GET("/api/bills/public/:token/pdf", controllers.PublicBillPDF())

	billRoutes := router.Group("/api/bills")
	billRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("bills"), middlewares.RequireModule("bills"))
	{
		billRoutes.POST("/", controllers.CreateBill())
		billRoutes.GET("/", controllers.GetAllBills())
		billRoutes.GET("/stats", controllers.GetBillStats())
		billRoutes.GET("/:id", controllers.GetBillByID())
		billRoutes.PUT("/:id", controllers.UpdateBill())
		billRoutes.PATCH("/:id/status", controllers.UpdateBillStatus())
		billRoutes.PATCH("/:id/void", controllers.VoidBill())
		billRoutes.GET("/:id/pdf", controllers.DownloadBillPDF())
		billRoutes.GET("/:id/preview", controllers.PreviewBillPDF())
		billRoutes.POST("/:id/send", controllers.SendBill())
	}
}

func ExpenseRoutes(router *gin.Engine) {
	// Fast spend entries (salary, petrol, rent…), payables-adjacent to Bills but
	// independently grantable via its own "expenses" module.
	expenseRoutes := router.Group("/api/expenses")
	expenseRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("expenses"), middlewares.RequireModule("expenses"))
	{
		expenseRoutes.POST("/", controllers.CreateExpense())
		expenseRoutes.GET("/", controllers.GetAllExpenses())
		expenseRoutes.GET("/:id", controllers.GetExpenseByID())
		expenseRoutes.PATCH("/:id/pay", controllers.PayExpense())
		expenseRoutes.PATCH("/:id/void", controllers.VoidExpense())
	}
}

func VendorPaymentRoutes(router *gin.Engine) {
	vpRoutes := router.Group("/api/vendor-payments")
	vpRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("vendor_payments"), middlewares.RequireModule("vendor_payments"))
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
	wRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("warehouses"), middlewares.RequireModule("warehouses"))
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
	adjRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("adjustments"), middlewares.RequireModule("adjustments"))
	{
		adjRoutes.POST("/", controllers.CreateAdjustment())
		adjRoutes.GET("/", controllers.GetAllAdjustments())
	}
}

func ItemGroupRoutes(router *gin.Engine) {
	igRoutes := router.Group("/api/item-groups")
	igRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("item_groups"), middlewares.RequireModule("item_groups"))
	{
		igRoutes.POST("/", controllers.CreateItemGroup())
		igRoutes.GET("/", controllers.GetAllItemGroups())
		igRoutes.GET("/:id", controllers.GetItemGroupByID())
		igRoutes.PUT("/:id", controllers.UpdateItemGroup())
		igRoutes.DELETE("/:id", controllers.DeleteItemGroup())
	}
}

func UOMRoutes(router *gin.Engine) {
	uomRoutes := router.Group("/api/uoms")
	uomRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("uom"), middlewares.RequireModule("uom"))
	{
		uomRoutes.POST("/", controllers.CreateUOM())
		uomRoutes.GET("/", controllers.GetAllUOMs())
		uomRoutes.GET("/:id", controllers.GetUOMByID())
		uomRoutes.PUT("/:id", controllers.UpdateUOM())
		uomRoutes.DELETE("/:id", controllers.DeleteUOM())
	}
}

func PaymentTermRoutes(router *gin.Engine) {
	ptRoutes := router.Group("/api/payment-terms")
	ptRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("payment_terms"), middlewares.RequireModule("payment_terms"))
	{
		ptRoutes.POST("/", controllers.CreatePaymentTerm())
		ptRoutes.GET("/", controllers.GetAllPaymentTerms())
		ptRoutes.GET("/:id", controllers.GetPaymentTermByID())
		ptRoutes.PUT("/:id", controllers.UpdatePaymentTerm())
		ptRoutes.DELETE("/:id", controllers.DeletePaymentTerm())
	}
}

func SalesTypeRoutes(router *gin.Engine) {
	stRoutes := router.Group("/api/sales-types")
	stRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("sales_types"), middlewares.RequireModule("sales_types"))
	{
		stRoutes.POST("/", controllers.CreateSalesType())
		stRoutes.GET("/", controllers.GetAllSalesTypes())
		stRoutes.GET("/:id", controllers.GetSalesTypeByID())
		stRoutes.PUT("/:id", controllers.UpdateSalesType())
		stRoutes.DELETE("/:id", controllers.DeleteSalesType())
	}
}

func PriceListRoutes(router *gin.Engine) {
	plRoutes := router.Group("/api/price-lists")
	plRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("price_lists"), middlewares.RequireModule("price_lists"))
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
	accRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("accounts"), middlewares.RequireModule("accounts"))
	{
		accRoutes.POST("/", controllers.CreateAccount())
		accRoutes.POST("/seed", controllers.SeedDefaultAccounts())
		accRoutes.GET("/", controllers.GetAllAccounts())
		accRoutes.GET("/stats", controllers.GetAccountStats())
		accRoutes.GET("/:id", controllers.GetAccountByID())
		accRoutes.GET("/:id/ledger", controllers.GetAccountLedger())
		accRoutes.PUT("/:id", controllers.UpdateAccount())
		accRoutes.DELETE("/:id", controllers.DeleteAccount())
	}
}

// TrialBalanceRoutes — its own module key so it can be granted independently of
// general Chart of Accounts access.
func TrialBalanceRoutes(router *gin.Engine) {
	router.GET("/api/accounts/trial-balance", middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("trial_balance"), middlewares.RequireModule("trial_balance"), controllers.GetTrialBalance())
}

func JournalEntryRoutes(router *gin.Engine) {
	jeRoutes := router.Group("/api/journal-entries")
	jeRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("journal_entries"), middlewares.RequireModule("journal_entries"))
	{
		jeRoutes.POST("/", controllers.CreateManualJournalEntry())
		jeRoutes.GET("/", controllers.GetJournalEntries())
		jeRoutes.GET("/:id", controllers.GetJournalEntryByID())
	}
}

func BankReconciliationRoutes(router *gin.Engine) {
	brRoutes := router.Group("/api/bank-reconciliation")
	brRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("bank_reconciliation"), middlewares.RequireModule("bank_reconciliation"))
	{
		brRoutes.GET("/transactions", controllers.GetBankTransactions())
		brRoutes.POST("/toggle", controllers.ToggleBankClearing())
		brRoutes.POST("/", controllers.CreateBankReconciliation())
		brRoutes.GET("/", controllers.GetBankReconciliations())
	}
}

func AdvancePaymentRoutes(router *gin.Engine) {
	advRoutes := router.Group("/api/advance-payments")
	advRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("advance_payments"), middlewares.RequireModule("advance_payments"))
	{
		advRoutes.POST("/", controllers.CreateAdvancePayment())
		advRoutes.GET("/", controllers.GetAdvancePayments())
		advRoutes.GET("/:id", controllers.GetAdvancePaymentByID())
		advRoutes.POST("/:id/apply", controllers.ApplyAdvanceToInvoice())
	}
}

func VendorCreditRoutes(router *gin.Engine) {
	vcRoutes := router.Group("/api/vendor-credits")
	vcRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("vendor_credits"), middlewares.RequireModule("vendor_credits"))
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
	dnRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("delivery_notes"), middlewares.RequireModule("delivery_notes"))
	{
		dnRoutes.POST("/", controllers.CreateDeliveryNote())
		dnRoutes.GET("/", controllers.GetAllDeliveryNotes())
		dnRoutes.GET("/stats", controllers.GetDeliveryNoteStats())
		dnRoutes.GET("/:id", controllers.GetDeliveryNoteByID())
		dnRoutes.PATCH("/:id/status", controllers.UpdateDeliveryNoteStatus())
		dnRoutes.PATCH("/:id/location", controllers.UpdateDeliveryNoteLocation())
		// Reports page only (SalesByEmirate.jsx) — gate on its own module too, not just "delivery_notes".
		dnRoutes.GET("/sales-by-emirate", middlewares.RequireLicenseModule("sales_by_emirate_report"), middlewares.RequireModule("sales_by_emirate_report"), controllers.GetSalesByEmirate())
		dnRoutes.PATCH("/:id/invoice", controllers.MarkDeliveryNoteInvoiced())
		dnRoutes.GET("/:id/pdf", controllers.DownloadDeliveryNotePDF())
		dnRoutes.GET("/:id/preview", controllers.PreviewDeliveryNotePDF())
	}
}

func EnquiryRoutes(router *gin.Engine) {
	enqRoutes := router.Group("/api/enquiries")
	enqRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("enquiries"), middlewares.RequireModule("enquiries"))
	{
		enqRoutes.POST("/", controllers.CreateEnquiry())
		enqRoutes.GET("/", controllers.GetAllEnquiries())
		enqRoutes.GET("/stats", controllers.GetEnquiryStats())
		enqRoutes.GET("/:id", controllers.GetEnquiryByID())
		enqRoutes.PATCH("/:id/status", controllers.UpdateEnquiryStatus())
		enqRoutes.PUT("/:id", controllers.UpdateEnquiry())
		enqRoutes.POST("/:id/followups", controllers.AddEnquiryFollowUp())
	}
}

// RecurringInvoiceRoutes — templates that auto-generate invoices on a schedule.
// Independently grantable via its own "recurring_invoices" module.
func RecurringInvoiceRoutes(router *gin.Engine) {
	riRoutes := router.Group("/api/recurring-invoices")
	riRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("recurring_invoices"), middlewares.RequireModule("recurring_invoices"))
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
	fxWrite.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("exchange_rates"), middlewares.RequireModule("exchange_rates"))
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

// ReportsRoutes — each report independently grantable via its own module key
// (previously all shared one generic "reports" key).
func ReportsRoutes(router *gin.Engine) {
	vatRoutes := router.Group("/api/reports")
	vatRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("vat_report"), middlewares.RequireModule("vat_report"))
	{
		vatRoutes.GET("/vat", controllers.GetVATReport())
		vatRoutes.GET("/vat/lines", controllers.GetVATReportLines())
	}

	router.GET("/api/reports/vendor-aging", middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("vendor_aging_report"), middlewares.RequireModule("vendor_aging_report"), controllers.GetVendorAging())
	router.GET("/api/reports/profit-loss", middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("profit_loss_report"), middlewares.RequireModule("profit_loss_report"), controllers.GetProfitAndLoss())
	router.GET("/api/reports/balance-sheet", middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("balance_sheet_report"), middlewares.RequireModule("balance_sheet_report"), controllers.GetBalanceSheet())
	router.GET("/api/reports/cash-flow", middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireLicenseModule("cash_flow_report"), middlewares.RequireModule("cash_flow_report"), controllers.GetCashFlow())
}
