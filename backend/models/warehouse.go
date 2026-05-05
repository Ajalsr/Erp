package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Warehouse struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Name        string             `json:"name"          bson:"name"`
	Code        string             `json:"code"          bson:"code"`
	Location    string             `json:"location"      bson:"location"`
	Description string             `json:"description"   bson:"description"`
	Manager     string             `json:"manager"       bson:"manager"`
	Phone       string             `json:"phone"         bson:"phone"`
	Capacity    float64            `json:"capacity"      bson:"capacity"` // sq ft or units
	IsDefault   bool               `json:"isDefault"     bson:"isDefault"`
	Status      string             `json:"status"        bson:"status"` // active | inactive

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
