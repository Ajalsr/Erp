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

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:5175")
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
		port = "8000"
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

	// WebSocket endpoint — no auth required (only broadcasts, no sensitive data)
	server.GET("/ws", ws.ServeWs(ws.GlobalHub))

	server.Run(":" + port)

	// defer func() {
	// 	if err := config.DB.Disconnect(context.Background()); err != nil {
	// 		panic(err)
	// 	}
	// }()
}
