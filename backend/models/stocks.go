package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type Stock struct {
	ID       primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Name     string             `json:"name" bson:"name"`
	Quantity string             `json:"quantity" bson:"quantity"`
	Price    string             `json:"price" bson:"price"`
}
