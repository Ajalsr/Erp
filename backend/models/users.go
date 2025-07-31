package models

type Users struct {
	UserID   string `json:"userId" bson:"userId" binding:"required"`
	Password string `json:"password" bson:"pssword" binding:"required"`
}
