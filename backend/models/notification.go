package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Notification is a per-user in-app notification stored in MongoDB.
// It is also pushed in real-time over WebSocket to the target user.
type Notification struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"     json:"_id,omitempty"`
	UserID    string             `bson:"userId"            json:"userId"`
	Type      string             `bson:"type"              json:"type"`    // invite | accepted | role_changed | removed
	Title     string             `bson:"title"             json:"title"`
	Message   string             `bson:"message"           json:"message"`
	OrgID     string             `bson:"orgId,omitempty"   json:"orgId,omitempty"`
	OrgName   string             `bson:"orgName,omitempty" json:"orgName,omitempty"`
	Read      bool               `bson:"read"              json:"read"`
	CreatedAt time.Time          `bson:"createdAt"         json:"createdAt"`
}
