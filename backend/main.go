package main

import (
	"context"

	"github.com/gin-gonic/gin"

	"github.com/backend/config"
	"github.com/backend/routes"
)

func main() {

	server := gin.Default()
	routes.StockRoutes(server)

	server.Run(":8080")

	defer func() {
		if err := config.DB.Disconnect(context.Background()); err != nil {
			panic(err)
		}
	}()
}
