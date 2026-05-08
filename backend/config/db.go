package config

import (
	"context"
	"log"
	"os"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	_ "github.com/backend/loader"
)

func ConnectToMongo() (*mongo.Client, error) {
	// Load URI from environment variable — never hardcode credentials in source code.
	// Set MONGO_URI in your .env file (add .env to .gitignore).
	// Example: MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/products?...
	atlasURI := os.Getenv("MONGO_URI")
	if atlasURI == "" {
		log.Fatal("MONGO_URI environment variable is not set")
	}

	clientOptions := options.Client().ApplyURI(atlasURI)

	client, err := mongo.Connect(context.Background(), clientOptions)
	if err != nil {
		log.Fatal(err)
		return nil, err
	}

	// Verify the connection is actually reachable
	if err := client.Ping(context.Background(), nil); err != nil {
		log.Fatalf("MongoDB ping failed: %v", err)
		return nil, err
	}

	log.Println("Connected to MongoDB")
	return client, nil
}

var DB, err = ConnectToMongo()

func GetCollection(client *mongo.Client, collectionName string) *mongo.Collection {
	collection := client.Database("ERP").Collection(collectionName)
	return collection
}
