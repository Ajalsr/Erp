package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// BackupMeta is one row per org per rotation slot (0..29 — day-of-month % 30).
// Upserted by (orgId, slot), so each org's backup history never grows past 30
// documents; the Cloudinary asset at that org+slot's public_id is overwritten
// the same way. Every backup is scoped to a single organization's data only.
type BackupMeta struct {
	ID            primitive.ObjectID `bson:"_id,omitempty"    json:"id,omitempty"`
	OrgID         string             `bson:"orgId"            json:"orgId"`
	Slot          int                `bson:"slot"             json:"slot"`
	UploadedAt    time.Time          `bson:"uploadedAt"       json:"uploadedAt"`
	CloudinaryURL string             `bson:"cloudinaryUrl"    json:"cloudinaryUrl"`
	PublicID      string             `bson:"publicId"         json:"publicId"`
	SizeBytes     int64              `bson:"sizeBytes"        json:"sizeBytes"`
	Status        string             `bson:"status"           json:"status"` // "success" | "failed"
	Collections   int                `bson:"collections"      json:"collections"`
	Error         string             `bson:"error,omitempty"  json:"error,omitempty"`
}
