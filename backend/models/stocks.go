package models

type Stock struct {
	ID       string `json:"id" bson:"_id"`
	Name     string `json:"name" bson:"name"`
	Quantity string `json:"quantity" bson:"quantity"`
	Price    string `json:"price" bson:"price"`
}
