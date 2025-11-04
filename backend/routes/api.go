package routes

import (
	"github.com/backend/controllers"
	"github.com/gin-gonic/gin"
)

func StockRoutes(router *gin.Engine) {

	stockRoutes := router.Group("/api/stocks")
	{
		stockRoutes.GET("/", controllers.GetAllStocks())
		stockRoutes.POST("/additem", controllers.AddItem())
	}
}

func AuthRoutes(router *gin.Engine) {

	authRoutes := router.Group("/api/auth")
	{
		authRoutes.POST("/signup", controllers.SignUp())
		authRoutes.POST("/signin", controllers.SignIn())
	}
}
