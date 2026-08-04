package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

func NotificationRoutes(router *gin.Engine) {
	g := router.Group("/api/notifications")
	g.Use(middlewares.Authenticate)
	{
		g.GET("", middlewares.RequireOrg, controllers.GetNotifications())
		g.PUT("/read-all", middlewares.RequireOrg, controllers.MarkAllNotificationsRead())
		g.DELETE("/:id", controllers.DeleteNotification())
		g.POST("/cancel-request", middlewares.RequireOrg, controllers.CreateCancelRequest())
	}
}
