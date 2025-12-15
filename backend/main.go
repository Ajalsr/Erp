package main

import (
	// "context"

	"os"

	"github.com/gin-gonic/gin"

	// "github.com/backend/config"
	"github.com/backend/routes"
)

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:5175")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(200)
			return
		}

		c.Next()
	}
}

func main() {

	port := os.Getenv("PORT")

	if port == "" {
		port = "8000"
	}

	server := gin.Default()

	server.Use(CORSMiddleware())
	routes.StockRoutes(server)
	routes.AuthRoutes(server)
	routes.CustomerRoutes(server)
	//routes.DashboardRoutes(server)

	server.Run(":8080")

	// defer func() {
	// 	if err := config.DB.Disconnect(context.Background()); err != nil {
	// 		panic(err)
	// 	}
	// }()
}
