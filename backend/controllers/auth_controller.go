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
		defer cancel()

		var user models.Users
		var company models.Company

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

		// Hash password BEFORE saving
		hashedPassword, err := utils.HashPassword(user.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   "Failed to hash password",
			})
			return
		}

		// ✅ FIX 1: Was user.CompanyName = string(val) — overwrote company name with hash
		// Save the original company name before overwriting password
		originalCompanyName := user.CompanyName
		user.Password = hashedPassword // ✅ store hash in Password field, not CompanyName

		// Create company record using the original company name
		company = models.Company{
			ID:          primitive.NewObjectID(),
			CompanyName: originalCompanyName,
		}

		_, err = companyCollection.InsertOne(ctx, company)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   "Failed to create company",
			})
			return
		}

		user.OrgID = company.ID
		user.ID = primitive.NewObjectID()
		// ✅ Keep CompanyName intact on the user record
		user.CompanyName = originalCompanyName

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
			"message": "User Created Successfully...",
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
			// ✅ FIX 2: Was missing return after non-ErrNoDocuments error
			// Both cases (not found AND db error) should return unauthorized
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
			return // ✅ was missing — execution continued even on DB error
		}

		// ✅ FIX 3: Safe type assertion — old code would panic if "password" field missing
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
		// ✅ FIX 4: Was ignoring error from this FindOne — if it fails, token still returned
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

		// Remove debug fmt.Println statements — not safe in production
		fmt.Println("User signed in:", user.UserID) // remove this line in production

		c.JSON(http.StatusOK, gin.H{ // ✅ Changed from 201 Created to 200 OK for login
			"status":  http.StatusOK,
			"message": "Login successful...",
			"data":    result,
			"token":   token,
		})
	}
}
