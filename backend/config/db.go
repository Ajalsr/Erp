package config

import (
	"context"
	"log"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func ConnectToMongo() (*mongo.Client, error) {

	atlasURI := "mongodb+srv://ajalsr989:xziTIKRSdt12oNRt@cluster0.snp8e.mongodb.net/products?retryWrites=true&w=majority&appName=Cluster0"

	clientOptions := options.Client().ApplyURI(atlasURI)

	client, err := mongo.Connect(context.Background(), clientOptions)

	if err != nil {
		log.Fatal(err)
		return nil, err
	}

	log.Println("Connected to mongo.....")

	return client, nil
}

var DB, err = ConnectToMongo()

func GetCollection(client *mongo.Client, collectionName string) *mongo.Collection {
	collection := client.Database("ERP").Collection(collectionName)
	return collection
}
