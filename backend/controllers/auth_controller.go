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
	"go.mongodb.org/mongo-driver/mongo/options"
)

var userCollection *mongo.Collection = config.GetCollection(config.DB, "users")
var companyCollection *mongo.Collection = config.GetCollection(config.DB, "company")
var validate = Validations.GetValidator()

func SignUp() gin.HandlerFunc {

	return func(c *gin.Context) {

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)

		var user models.Users
		var company models.Company

		fmt.Println(company, "thsi si company")

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
				"message": "Id Already Exists!...",
				"error":   "Id Already Exists!...",
			})
			return
		}

		//company.ID = primitive.NewObjectID()
		company = models.Company{
			ID:          primitive.NewObjectID(),
			CompanyName: user.CompanyName,
		}

		newresult, err := companyCollection.InsertOne(ctx, company)

		fmt.Println(newresult)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"message": "Failed to create company",
				"error":   err.Error(),
			})
			return
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
		user.CompanyName = string(val)

		user.OrgID = company.ID
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

func SignIn() gin.HandlerFunc {

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

		filter := bson.M{"userId": user.UserID}
		var fullUser bson.M
		// projection := bson.M{
		// 	"userId":      1,
		// 	"companyName": 1,
		// }

		err := userCollection.FindOne(ctx, filter).Decode(&fullUser)

		fmt.Println(err, "this is valueeee")

		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "No document found matching the filter."})
				return
			}

		}

		fmt.Println("Found document:", fullUser)

		isValid := utils.CheckPasswordHash(user.Password, fullUser["password"].(string))

		fmt.Println("Found is valid:", isValid)

		if isValid != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID or password"})
			return
		}

		projection := bson.M{
			"userId":      1,
			"companyName": 1,
		}

		var result bson.M
		err = userCollection.FindOne(ctx, filter, options.FindOne().SetProjection(projection)).Decode(&result)

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Login successful...",
			"data":    result,
		})

	}

}
