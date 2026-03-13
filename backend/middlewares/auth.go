package middlewares

import (
	"net/http"
	"strings"

	"github.com/backend/utils"
	"github.com/gin-gonic/gin"
)

func Authenticate(c *gin.Context) {
	authHeader := c.Request.Header.Get("Authorization")

	if authHeader == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"status":  http.StatusUnauthorized,
			"message": "Authorization header is required",
		})
		return
	}

	// ✅ Frontend sends "Bearer <token>" — strip the prefix
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"status":  http.StatusUnauthorized,
			"message": "Authorization format must be: Bearer <token>",
		})
		return
	}

	token := parts[1]

	// ✅ Uncommented: actually reject invalid/expired tokens
	userId, err := utils.VerifyToken(token)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"status":  http.StatusUnauthorized,
			"message": "Invalid or expired token",
		})
		return
	}

	// Make userId available to all downstream handlers via c.Get("userId")
	c.Set("userId", userId)

	c.Next()
}
