package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type Company struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	CompanyName string             `json:"companyName" bson:"companyName" binding:"required"`
}
