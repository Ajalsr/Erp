package main

import (
	// "context"

	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	// "github.com/backend/config"
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
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else if origin == "" {
			// Same-origin / non-browser request (sidecar, curl, etc.) — allow
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		}
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Org-ID")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(200)
			return
		}

		c.Next()
	}
}

func main() {
	// Load .env file if present
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // must match VITE_API_URL in the frontend
	}

	// Start the WebSocket hub
	go ws.GlobalHub.Run()

	server := gin.Default()
	server.RedirectTrailingSlash = false

	server.Use(CORSMiddleware())
	routes.StockRoutes(server)
	routes.AuthRoutes(server)
	routes.CustomerRoutes(server)
	routes.SaleOrderRoutes(server)
	routes.OrgRoutes(server)
	routes.NotificationRoutes(server)
	routes.DashboardRoutes(server)
	routes.PurchaseOrderRoutes(server)
	routes.InvoiceRoutes(server)
	routes.PaymentRoutes(server)
	routes.VendorRoutes(server)
	routes.BillRoutes(server)
	routes.VendorPaymentRoutes(server)
	routes.VendorCreditRoutes(server)
	routes.GRNRoutes(server)
	routes.AccountRoutes(server)
	routes.WarehouseRoutes(server)
	routes.AdjustmentRoutes(server)
	routes.ItemGroupRoutes(server)
	routes.PriceListRoutes(server)

	// WebSocket endpoint — no auth required (only broadcasts, no sensitive data)
	server.GET("/ws", ws.ServeWs(ws.GlobalHub))

	server.Run(":" + port)

	// defer func() {
	// 	if err := config.DB.Disconnect(context.Background()); err != nil {
	// 		panic(err)
	// 	}
	// }()
}
