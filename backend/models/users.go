package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type Users struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID      string             `json:"userId" bson:"userId" binding:"required"`
	Password    string             `json:"password" bson:"password" binding:"required"`
	OrgID       primitive.ObjectID `json:"orgId" bson:"orgId"`
	CompanyName string             `json:"companyName" bson:"companyName" `
}
