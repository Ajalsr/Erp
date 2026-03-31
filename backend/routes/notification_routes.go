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
		g.GET("", controllers.GetNotifications())
		g.PUT("/read-all", controllers.MarkAllNotificationsRead())
		g.DELETE("/:id", controllers.DeleteNotification())
	}
}
