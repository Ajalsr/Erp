package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// DeliveryTerm is an org-configurable shipment/delivery term used on purchase
// orders (Immediate, Within 7 Days, As Scheduled, …). Seeded with the classic
// defaults on org creation.
type DeliveryTerm struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Name        string             `json:"name"          bson:"name"`
	Description string             `json:"description"   bson:"description"`
	Status      string             `json:"status"        bson:"status"` // active | inactive

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
