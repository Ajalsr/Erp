package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	_ "github.com/backend/loader"
	"github.com/backend/config"
	"github.com/backend/routes"
	"github.com/backend/ws"
)

var allowedOrigins = map[string]bool{
	"http://localhost:5175":   true, // Vite dev server
	"http://localhost:5173":   true, // Vite alt port
	"tauri://localhost":       true, // Tauri macOS / Linux
	"http://tauri.localhost":  true, // Tauri Windows
	"https://tauri.localhost": true, // Tauri Windows (https mode)
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
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Org-ID")
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

	// Start the WebSocket hub
	go ws.GlobalHub.Run()

	// Create MongoDB indexes on startup (idempotent — safe to run every restart)
	config.EnsureIndexes(config.DB)

	router := gin.Default()
	router.RedirectTrailingSlash = false
	router.Use(CORSMiddleware())

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
	routes.VendorPaymentRoutes(router)
	routes.VendorCreditRoutes(router)
	routes.GRNRoutes(router)
	routes.AccountRoutes(router)
	routes.WarehouseRoutes(router)
	routes.AdjustmentRoutes(router)
	routes.ItemGroupRoutes(router)
	routes.PriceListRoutes(router)
	routes.EnquiryRoutes(router)

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
