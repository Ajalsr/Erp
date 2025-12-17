package middlewares

import (
	"net/http"

	"github.com/backend/utils"
	"github.com/gin-gonic/gin"
)

func Authenticate(c *gin.Context) {
	token := c.Request.Header.Get("Authorization")

	if token == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Not authorized."})
		return
	}

	userId, _ := utils.VerifyToken(token)

	// if err != nil {
	// 	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"mesage": "Not authorized."})
	// 	return
	// }

	c.Set("userId", userId)

	c.Next()
}
