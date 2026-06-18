package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// TrustedDevice is a device that cleared a login OTP; it skips OTP on future logins.
type TrustedDevice struct {
	Hash    string    `json:"id" bson:"hash"`     // SHA-256 of the client device id
	Label   string    `json:"label" bson:"label"` // user-agent snapshot for display
	AddedAt time.Time `json:"addedAt" bson:"addedAt"`
}

type Users struct {
	ID            primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID        string             `json:"userId" bson:"userId" binding:"required"`
	Password      string             `json:"password" bson:"password" binding:"required"`
	Email         string             `json:"email,omitempty" bson:"email,omitempty"`
	OrgID         primitive.ObjectID `json:"orgId" bson:"orgId"`
	CompanyName   string             `json:"companyName" bson:"companyName" `
	Token         string             `json:"token"`
	Refresh_token string             `json:"refresh_token"`
	// Device-based login OTP. trustedDevices holds devices that already cleared an
	// OTP — those skip OTP on future logins. A new/changed device triggers an emailed
	// OTP that must be verified before a token is issued.
	TrustedDevices []TrustedDevice `json:"-" bson:"trustedDevices,omitempty"`
	LoginOtp       string          `json:"-" bson:"loginOtp,omitempty"`
	LoginOtpExp    *time.Time      `json:"-" bson:"loginOtpExp,omitempty"`
	LoginOtpDevice string          `json:"-" bson:"loginOtpDevice,omitempty"`
	Created_at    time.Time          `json:"created_at"`
	Updated_at    time.Time          `json:"updated_at"`
	// DeviceID is request-only (sent by the client at login) — never stored.
	DeviceID string `json:"deviceId,omitempty" bson:"-"`
}
