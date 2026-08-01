package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	_ "github.com/backend/loader"
	"github.com/backend/config"
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/backend/routes"
	"github.com/backend/ws"
)

var allowedOrigins = map[string]bool{
	"http://localhost:5175":   true, // Vite dev server
	"http://localhost:5173":   true, // Vite alt port
	"http://localhost:5500":   true, // VSCode Live Server (spifora.html local test)
	"http://127.0.0.1:5500":   true, // Live Server, alt host form
	"tauri://localhost":       true, // Tauri macOS / Linux
	"http://tauri.localhost":  true, // Tauri Windows
	"https://tauri.localhost": true, // Tauri Windows (https mode)
}

// Seed extra allowed origins from the environment so production domains don't need a
// code change. APP_URL is the deployed frontend; ALLOWED_ORIGINS is an optional
// comma-separated list for any additional origins.
func init() {
	add := func(o string) {
		if o = strings.TrimRight(strings.TrimSpace(o), "/"); o != "" {
			allowedOrigins[o] = true
		}
	}
	add(os.Getenv("APP_URL"))
	for _, o := range strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",") {
		add(o)
	}
}

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if allowedOrigins[origin] {
			// Known allowed origin — reflect it back
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else if origin == "" {
			// Same-origin / non-browser request (sidecar, curl, etc.) — allow
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		} else {
			// Unknown origin — REJECT. Do NOT echo it back.
			// Previously this branch echoed origin, making the allowlist useless.
			c.AbortWithStatus(http.StatusForbidden)
			return
		}

		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Org-ID, X-Admin-Secret")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}

		c.Next()
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Init Cloudinary
	config.InitCloudinary()

	// Start the WebSocket hub
	go ws.GlobalHub.Run()

	// Start invoice due-date scheduler (checks daily: due-soon alerts + overdue status)
	controllers.StartInvoiceScheduler()

	// Start the rolling 30-day backup scheduler — one backup per organization per
	// day (daily, Cloudinary-backed, each org's data isolated from every other org's)
	controllers.StartBackupScheduler()

	// Create MongoDB indexes on startup (idempotent — safe to run every restart)
	config.EnsureIndexes(config.DB)

	// Backfill FX gain/loss accounts (4300/5800) into existing orgs so foreign-currency
	// payments post correctly without a manual re-seed. Idempotent.
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		controllers.EnsureFXAccounts(ctx)
		controllers.EnsurePayrollAccounts(ctx)
		controllers.EnsureEmployeeRecordsForMembers(ctx)
	}()

	router := gin.Default()
	router.RedirectTrailingSlash = false
	router.Use(CORSMiddleware())
	// Emit a WebSocket "<entity>_updated" event after every successful mutation, so all
	// connected clients in the org refresh live (runs post-handler; reads orgId set by
	// RequireOrg). Must come before route registration to wrap every handler.
	router.Use(middlewares.BroadcastMutations())

	routes.StockRoutes(router)
	routes.AuthRoutes(router)
	routes.CustomerRoutes(router)
	routes.SaleOrderRoutes(router)
	routes.OrgRoutes(router)
	routes.NotificationRoutes(router)
	routes.DashboardRoutes(router)
	routes.PurchaseOrderRoutes(router)
	routes.InvoiceRoutes(router)
	routes.PaymentRoutes(router)
	routes.VendorRoutes(router)
	routes.BillRoutes(router)
	routes.ExpenseRoutes(router)
	routes.VendorPaymentRoutes(router)
	routes.VendorCreditRoutes(router)
	routes.GRNRoutes(router)
	routes.AccountRoutes(router)
	routes.JournalEntryRoutes(router)
	routes.BankReconciliationRoutes(router)
	routes.AdvancePaymentRoutes(router)
	routes.WarehouseRoutes(router)
	routes.AdjustmentRoutes(router)
	routes.ItemGroupRoutes(router)
	routes.PriceListRoutes(router)
	routes.EnquiryRoutes(router)
	routes.QuoteRoutes(router)
	routes.DeliveryNoteRoutes(router)
	routes.CreditNoteRoutes(router)
	routes.DebitNoteRoutes(router)
	routes.DocumentRoutes(router)
	routes.ReportsRoutes(router)
	routes.SearchRoutes(router)
	routes.RecurringInvoiceRoutes(router)
	routes.ExchangeRateRoutes(router)
	routes.ApprovalRoutes(router)
	routes.BackupRoutes(router)
	routes.ExportRoutes(router)
	routes.LetterRoutes(router)
	routes.ProjectRoutes(router)
	routes.EmployeeRoutes(router)
	routes.PayrollRoutes(router)
	routes.TimeOffRoutes(router)

	// WebSocket endpoint — no auth required (only broadcasts, no sensitive data)
	router.GET("/ws", ws.ServeWs(ws.GlobalHub))

	// ── Graceful shutdown ──────────────────────────────────────────────────
	// Previously server.Run() was used, which drops all in-flight requests on SIGTERM.
	// Now we listen for OS signals and give active requests 10s to finish.
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	// Start server in a goroutine so it doesn't block the signal listener
	go func() {
		log.Printf("Server starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for interrupt signal (Ctrl+C or SIGTERM from systemd/Docker)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutdown signal received — draining active requests...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	// Disconnect from MongoDB cleanly
	if err := config.DB.Disconnect(ctx); err != nil {
		log.Printf("MongoDB disconnect error: %v", err)
	}

	log.Println("Server exited cleanly")
}
