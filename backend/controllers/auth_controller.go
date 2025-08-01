package controllers

import (
	"context"
	"fmt"
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
)

var userCollection *mongo.Collection = config.GetCollection(config.DB, "users")
var validate = Validations.GetValidator()

func SignUp() gin.HandlerFunc {

	return func(c *gin.Context) {

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)

		var user models.Users

		defer cancel()

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
				"message": "error",
				"error":   "Email Already Exists!...",
			})
		}

		val, err := utils.HashPassword(user.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "err",
				"error":   "Failed to hash Password",
			})

			return
		}
		user.Password = string(val)

		user.ID = primitive.NewObjectID()

		result, err := userCollection.InsertOne(ctx, user)

		fmt.Println(result)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "err",
				"error":   err.Error(),
			})
			return
		}

		responseUser := gin.H{
			"_id":    user.ID,
			"userId": user.UserID,
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "User Created Successfully...",
			"data":    responseUser,
		})

	}
}
