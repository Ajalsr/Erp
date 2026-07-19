package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

// LetterRoutes — GET /api/letters/types, /api/letters (list), POST create,
// GET/:id, PUT/:id, DELETE/:id, GET/:id/pdf, GET/:id/preview, POST/:id/send-email.
func LetterRoutes(router *gin.Engine) {
	// Public "view online" link emailed with the letter — no auth, keyed by an
	// unguessable token rather than id+org. Registered outside the authenticated
	// group below.
	router.GET("/api/letters/public/:token", controllers.GetPublicLetter())

	letterRoutes := router.Group("/api/letters")
	letterRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg, middlewares.RequireModule("letters"))
	{
		letterRoutes.GET("/types", controllers.GetLetterTypes())
		letterRoutes.GET("/next-number", controllers.GetNextLetterNumber())
		letterRoutes.GET("/", controllers.GetAllLetters())
		letterRoutes.POST("/", controllers.CreateLetter())
		letterRoutes.GET("/:id", controllers.GetLetterByID())
		letterRoutes.PUT("/:id", controllers.UpdateLetter())
		letterRoutes.DELETE("/:id", controllers.DeleteLetter())
		letterRoutes.GET("/:id/pdf", controllers.DownloadLetterPDF())
		letterRoutes.GET("/:id/preview", controllers.PreviewLetterPDF())
		letterRoutes.POST("/:id/send-email", controllers.SendLetterEmail())
	}
}
