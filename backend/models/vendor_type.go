package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// VendorType is an org-configurable classification for vendors (Individual,
// Manufacturer, Distributor, …). Seeded with sensible defaults on org creation.
type VendorType struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Name        string             `json:"name"          bson:"name"`
	Description string             `json:"description"   bson:"description"`
	Status      string             `json:"status"        bson:"status"` // active | inactive

	OrgID     string    `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt time.Time `json:"createdAt"       bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"       bson:"updatedAt"`
	CreatedBy string    `json:"createdBy"       bson:"createdBy"`
}
