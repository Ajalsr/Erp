package routes

import (
	"github.com/backend/controllers"
	"github.com/gin-gonic/gin"
)

func StockRoutes(router *gin.Engine) {

	stockRoutes := router.Group("/api/stocks")
	{
		stockRoutes.GET("/", controllers.GetAllStocks())

	}
}
