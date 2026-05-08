package controllers

import (
	"context"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/backend/utils"
	Validations "github.com/backend/validations"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var userCollection = config.GetCollection(config.DB, "users")
var validate = Validations.GetValidator()

// signinLimiter: max 10 attempts per IP per minute on the signin endpoint.
// The RateLimiter implementation already exists in utils/hash.go — wire it here.
var signinLimiter = utils.NewRateLimiter(10, time.Minute)

func SignUp() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var user models.Users

		if err := c.BindJSON(&user); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "error",
				"error":   err.Error(),
			})
			return
		}

		if validationErr := validate.Struct(&user); validationErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "error",
				"error":   validationErr.Error(),
			})
			return
		}

		count, err := userCollection.CountDocuments(ctx, bson.M{"userId": user.UserID})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   err.Error(),
			})
			return
		}

		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{
				"status":  http.StatusConflict,
				"message": "User ID already exists",
				"error":   "User ID already exists",
			})
			return
		}

		hashedPassword, err := utils.HashPassword(user.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   "Failed to hash password",
			})
			return
		}

		user.Password = hashedPassword
		user.ID = primitive.NewObjectID()

		_, err = userCollection.InsertOne(ctx, user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "User Created Successfully",
			"data": gin.H{
				"_id":    user.ID,
				"userId": user.UserID,
			},
		})
	}
}

func SignIn() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// ── Rate limiting: max 10 signin attempts per IP per minute ──────────
		ip := c.ClientIP()
		if !signinLimiter.Allow(ip) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"status":  http.StatusTooManyRequests,
				"message": "Too many login attempts. Please wait a minute and try again.",
			})
			return
		}

		var user models.Users

		if err := c.BindJSON(&user); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "error",
				"error":   err.Error(),
			})
			return
		}

		if validationErr := validate.Struct(&user); validationErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "error",
				"error":   validationErr.Error(),
			})
			return
		}

		filter := bson.M{"userId": user.UserID}
		var fullUser bson.M

		err := userCollection.FindOne(ctx, filter).Decode(&fullUser)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusUnauthorized, gin.H{
					"status":  http.StatusUnauthorized,
					"message": "error",
					"error":   "Invalid user ID or password",
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  http.StatusInternalServerError,
					"message": "error",
					"error":   "Database error",
				})
			}
			return
		}

		storedPassword, ok := fullUser["password"].(string)
		if !ok || storedPassword == "" {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   "User account is corrupted",
			})
			return
		}

		if err := utils.CheckPasswordHash(user.Password, storedPassword); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"status":  http.StatusUnauthorized,
				"message": "error",
				"error":   "Invalid user ID or password",
			})
			return
		}

		// Fetch clean user data to return (exclude password)
		projection := bson.M{
			"userId":      1,
			"companyName": 1,
			"orgId":       1,
		}
		var result bson.M
		if err = userCollection.FindOne(ctx, filter, options.FindOne().SetProjection(projection)).Decode(&result); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   "Failed to fetch user data",
			})
			return
		}

		token, err := utils.GenerateToken(user.UserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   "Could not generate token",
			})
			return
		}

		// Removed debug fmt.Println — do not log user IDs in production
		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Login successful",
			"data":    result,
			"token":   token,
		})
	}
}
