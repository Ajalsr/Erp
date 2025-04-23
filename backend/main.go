package main

import (
	"log"
	"net/http"
	"time"

	"context"
	"fmt"

	"github.com/backend/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

func main() {

	atlasURI := "mongodb+srv://ajalsr989:xziTIKRSdt12oNRt@cluster0.snp8e.mongodb.net/products?retryWrites=true&w=majority&appName=Cluster0"
	client, err := mongo.Connect(context.TODO(), options.Client().ApplyURI(atlasURI))
	if err != nil {
		log.Fatal(err)
	}
	defer func() {
		if err = client.Disconnect(context.TODO()); err != nil {
			log.Fatal(err)
		}
	}()

	// Ping the primary
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = client.Ping(ctx, readpref.Primary())
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Successfully connected to MongoDB Atlas cluster!")

	server := gin.Default()
	server.GET("/server", getServers)
	server.POST("/server", createServers)
	server.Run(":8080")
}

func getServers(context *gin.Context) {
	stocks := models.GetAllStocks()
	// context.JSON(http.StatusOK, gin.H{
	// 	"message": "Hello, World!"})
	context.JSON(http.StatusOK, stocks)
}

func createServers(context *gin.Context) {
	var stock models.Stock
	err := context.ShouldBindJSON(&stock)

	if err != nil {
		context.JSON(http.StatusBadRequest, gin.H{"message": "Could not parse request data."})
		return
	}

	stock.ID = 1

	context.JSON(http.StatusCreated, gin.H{"message": "Stock created successfully.", "stock": stock})

}
