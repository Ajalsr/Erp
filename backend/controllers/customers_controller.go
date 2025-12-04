package controllers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/net/context"
)

func GetAllCustomers() gin.HandlerFunc {

	return func(c *gin.Context) {

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)

		var customers []models.Customer
		defer cancel()

		collection := config.GetCollection(config.DB, "customers")
		fmt.Println(collection, "this is the collection")
		results, err := collection.Find(ctx, bson.M{})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		defer results.Close(ctx)

		if err := results.All(ctx, &customers); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "success",
			"data":    customers,
		})

	}

}

var customersCollection *mongo.Collection = config.GetCollection(config.DB, "customers")

func AddCustomers() gin.HandlerFunc {

	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)

		var item models.Customer

		defer cancel()

		if err := c.BindJSON(&item); err != nil {

			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "error",
				"error":   err.Error(),
			})

			return
		}

		item.ID = primitive.NewObjectID()

		result, err := customersCollection.InsertOne(ctx, item)

		fmt.Println(result)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "err",
				"error":   err.Error(),
			})
			return
		}

		responseItem := gin.H{
			"_id": item.ID,
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Customer Added Successfully...",
			"data":    responseItem,
		})

	}
}
