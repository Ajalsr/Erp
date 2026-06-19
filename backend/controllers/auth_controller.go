package controllers

import (
	"context"
	cryptorand "crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/backend/utils"
	Validations "github.com/backend/validations"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var userCollection = config.GetCollection(config.DB, "users")
var validate = Validations.GetValidator()

// ── Device-based login OTP helpers ───────────────────────────────────────────
func hashDevice(deviceID string) string {
	if strings.TrimSpace(deviceID) == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(strings.TrimSpace(deviceID)))
	return hex.EncodeToString(sum[:])
}

func hashOTP(otp string) string {
	sum := sha256.Sum256([]byte(otp))
	return hex.EncodeToString(sum[:])
}

func generateOTP() string {
	n, err := cryptorand.Int(cryptorand.Reader, big.NewInt(1000000))
	if err != nil {
		return "000000"
	}
	return fmt.Sprintf("%06d", n.Int64())
}

// passwordPolicyOK enforces: 6+ chars with an uppercase, lowercase, number and symbol.
func passwordPolicyOK(p string) bool {
	if len([]rune(p)) < 6 {
		return false
	}
	var hasU, hasL, hasN, hasS bool
	for _, r := range p {
		switch {
		case r >= 'A' && r <= 'Z':
			hasU = true
		case r >= 'a' && r <= 'z':
			hasL = true
		case r >= '0' && r <= '9':
			hasN = true
		default:
			hasS = true
		}
	}
	return hasU && hasL && hasN && hasS
}

func maskEmail(email string) string {
	at := strings.Index(email, "@")
	if at <= 1 {
		return email
	}
	return email[:1] + strings.Repeat("*", at-1) + email[at:]
}

func deviceTrusted(trusted []string, deviceHash string) bool {
	if deviceHash == "" {
		return false
	}
	for _, t := range trusted {
		if t == deviceHash {
			return true
		}
	}
	return false
}

// signinLimiter: max 10 attempts per IP per minute on the signin endpoint.
// The RateLimiter implementation already exists in utils/hash.go — wire it here.
var signinLimiter = utils.NewRateLimiter(10, time.Minute)

func SignUp() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var user models.Users

		if err := c.BindJSON(&user); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "error",
				"error":   err.Error(),
			})
			return
		}

		if validationErr := validate.Struct(&user); validationErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "error",
				"error":   validationErr.Error(),
			})
			return
		}

		user.UserID = strings.TrimSpace(user.UserID)
		user.Email = strings.ToLower(strings.TrimSpace(user.Email))
		if user.UserID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "User ID is required", "error": "userId required"})
			return
		}
		if user.Email == "" || !strings.Contains(user.Email, "@") {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "A valid email is required", "error": "email required"})
			return
		}
		// userId is globally unique, case-insensitive EXACT. So "AJAL S R" blocks
		// "ajal s r" but not the distinct "AJAL M S".
		if n, _ := userCollection.CountDocuments(ctx, bson.M{
			"userId": bson.M{"$regex": "^" + regexp.QuoteMeta(user.UserID) + "$", "$options": "i"},
		}); n > 0 {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "User ID already exists", "error": "userId already exists"})
			return
		}
		// Email is unique PER ORG, not globally. When signing up from an invite, block
		// if the email already belongs to a member of that org.
		if strings.TrimSpace(user.InviteToken) != "" {
			var inv models.Invitation
			if invitationCollection.FindOne(ctx, bson.M{"token": user.InviteToken}).Decode(&inv) == nil {
				if emailIsActiveMemberInOrg(ctx, inv.OrgID, user.Email, "") {
					c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "This email already belongs to a member of this organization", "error": "email exists in org"})
					return
				}
			}
		}

		if !passwordPolicyOK(user.Password) {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Password must be at least 6 characters and include an uppercase letter, a lowercase letter, a number and a symbol",
				"error":   "weak password",
			})
			return
		}

		hashedPassword, err := utils.HashPassword(user.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   "Failed to hash password",
			})
			return
		}

		user.Password = hashedPassword
		user.Email = strings.ToLower(strings.TrimSpace(user.Email))
		user.ID = primitive.NewObjectID()
		// No device is trusted at signup — the first login (from any device) must
		// clear an OTP. After that, only a new/changed device triggers another OTP.
		user.DeviceID = "" // request-only; never persisted

		_, err = userCollection.InsertOne(ctx, user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "User Created Successfully",
			"data": gin.H{
				"_id":    user.ID,
				"userId": user.UserID,
			},
		})
	}
}

func SignIn() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// ── Rate limiting: max 10 signin attempts per IP per minute ──────────
		ip := c.ClientIP()
		if !signinLimiter.Allow(ip) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"status":  http.StatusTooManyRequests,
				"message": "Too many login attempts. Please wait a minute and try again.",
			})
			return
		}

		var user models.Users

		if err := c.BindJSON(&user); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "error",
				"error":   err.Error(),
			})
			return
		}

		if validationErr := validate.Struct(&user); validationErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "error",
				"error":   validationErr.Error(),
			})
			return
		}

		// userId may repeat across accounts (email is the unique key). Accept the login
		// value as either a userId or an email, gather candidates, and authenticate the
		// one whose password matches. Reject if the credentials match more than one.
		loginVal := strings.TrimSpace(user.UserID)
		idRx := bson.M{"$regex": "^" + regexp.QuoteMeta(loginVal) + "$", "$options": "i"}
		cur, qErr := userCollection.Find(ctx, bson.M{"$or": []bson.M{{"userId": idRx}, {"email": idRx}}})
		if qErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error", "error": "Database error"})
			return
		}
		var candidates []bson.M
		_ = cur.All(ctx, &candidates)

		var fullUser bson.M
		matches := 0
		for _, cand := range candidates {
			sp, _ := cand["password"].(string)
			if sp != "" && utils.CheckPasswordHash(user.Password, sp) == nil {
				fullUser = cand
				matches++
			}
		}
		if matches == 0 {
			c.JSON(http.StatusUnauthorized, gin.H{"status": http.StatusUnauthorized, "message": "error", "error": "Invalid user ID or password"})
			return
		}
		if matches > 1 {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "Multiple accounts share these credentials. Sign in with your email instead."})
			return
		}
		// Subsequent lookups/updates key on the resolved account's _id (userId may not be unique).
		filter := bson.M{"_id": fullUser["_id"]}
		loginUserID := strings.TrimSpace(fmt.Sprintf("%v", fullUser["userId"]))

		// ── Device-based OTP gate ──────────────────────────────────────────────
		// New/changed device + an email on file → email a 6-digit OTP and stop here.
		// A trusted (already-verified) device, or no email on file, logs in directly.
		email, _ := fullUser["email"].(string)
		email = strings.TrimSpace(email)
		deviceHash := hashDevice(user.DeviceID)
		var trusted []string
		if raw, ok := fullUser["trustedDevices"].(primitive.A); ok {
			for _, v := range raw {
				if d, ok := v.(bson.M); ok {
					if h, ok := d["hash"].(string); ok {
						trusted = append(trusted, h)
					}
				}
			}
		}
		if email != "" && !deviceTrusted(trusted, deviceHash) {
			otp := generateOTP()
			exp := time.Now().Add(10 * time.Minute)
			_, _ = userCollection.UpdateOne(ctx, filter, bson.M{"$set": bson.M{
				"loginOtp": hashOTP(otp), "loginOtpExp": exp, "loginOtpDevice": deviceHash,
			}})
			go func(to, code string) { _ = utils.SendLoginOTPEmail(to, code) }(email, otp)
			masked := maskEmail(email)
			c.JSON(http.StatusOK, gin.H{
				"status":      http.StatusOK,
				"otpRequired": true,
				"message":     "We sent a verification code to " + masked,
				"userId":      loginUserID,
				"email":       masked,
			})
			return
		}

		// Fetch clean user data to return (exclude password)
		projection := bson.M{
			"userId":      1,
			"companyName": 1,
			"orgId":       1,
		}
		var result bson.M
		if dErr := userCollection.FindOne(ctx, filter, options.FindOne().SetProjection(projection)).Decode(&result); dErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   "Failed to fetch user data",
			})
			return
		}

		token, tErr := utils.GenerateToken(loginUserID)
		if tErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   "Could not generate token",
			})
			return
		}

		// Include the user's organizations in the signin response so the client can
		// seed its store and skip the separate GET /api/organizations round-trip on
		// first load — that extra Atlas call was the post-login "Loading…" delay.
		organizations := buildUserOrganizations(ctx, loginUserID)

		// Removed debug fmt.Println — do not log user IDs in production
		c.JSON(http.StatusOK, gin.H{
			"status":        http.StatusOK,
			"message":       "Login successful",
			"data":          result,
			"token":         token,
			"organizations": organizations,
		})
	}
}

// adminSecretOK gates the dev/admin user-cleanup endpoints behind the ADMIN_SECRET
// env var sent in the X-Admin-Secret header. Disabled (403) when ADMIN_SECRET unset.
func adminSecretOK(c *gin.Context) bool {
	s := os.Getenv("ADMIN_SECRET")
	return s != "" && c.GetHeader("X-Admin-Secret") == s
}

// AdminListUsers lists users matching ?q= (userId or email). Cleanup tool.
func AdminListUsers() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !adminSecretOK(c) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Forbidden"})
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		filter := bson.M{}
		if q := strings.TrimSpace(c.Query("q")); q != "" {
			rx := bson.M{"$regex": regexp.QuoteMeta(q), "$options": "i"}
			filter = bson.M{"$or": []bson.M{{"userId": rx}, {"email": rx}}}
		}
		opts := options.Find().SetProjection(bson.M{"userId": 1, "email": 1, "orgId": 1, "created_at": 1}).SetLimit(200)
		cur, err := userCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Database error"})
			return
		}
		var users []bson.M
		_ = cur.All(ctx, &users)
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": users, "count": len(users)})
	}
}

// AdminDeleteUser deletes a user by _id. Cleanup tool.
func AdminDeleteUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !adminSecretOK(c) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Forbidden"})
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		oid, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid id"})
			return
		}
		res, err := userCollection.DeleteOne(ctx, bson.M{"_id": oid})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Delete failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Deleted", "deleted": res.DeletedCount})
	}
}

// UpdateMyProfile lets the signed-in user set/update their email (used for the
// device-verification OTP). Authenticated via the userId in the request context.
func UpdateMyProfile() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		uid, _ := c.Get("userId")
		userID := fmt.Sprintf("%v", uid)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"status": http.StatusUnauthorized, "message": "Not authenticated"})
			return
		}
		var body struct {
			Email string `json:"email"`
		}
		if err := c.BindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request"})
			return
		}
		email := strings.ToLower(strings.TrimSpace(body.Email))
		if email != "" && !strings.Contains(email, "@") {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Enter a valid email"})
			return
		}
		if _, err := userCollection.UpdateOne(ctx, bson.M{"userId": userID}, bson.M{"$set": bson.M{"email": email}}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update profile"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Profile updated", "data": gin.H{"email": email}})
	}
}

// GetMyProfile returns the signed-in user's basic profile (userId + email).
func GetMyProfile() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		uid, _ := c.Get("userId")
		userID := fmt.Sprintf("%v", uid)
		var u bson.M
		if err := userCollection.FindOne(ctx, bson.M{"userId": userID}, options.FindOne().SetProjection(bson.M{"userId": 1, "email": 1, "companyName": 1})).Decode(&u); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "User not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": u})
	}
}

// ListMyDevices returns the signed-in user's trusted devices. Pass the current
// device id as ?deviceId= to flag which entry is "this device".
func ListMyDevices() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		uid, _ := c.Get("userId")
		userID := fmt.Sprintf("%v", uid)
		var u models.Users
		if err := userCollection.FindOne(ctx, bson.M{"userId": userID}, options.FindOne().SetProjection(bson.M{"trustedDevices": 1})).Decode(&u); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "User not found"})
			return
		}
		curHash := hashDevice(c.Query("deviceId"))
		type devOut struct {
			ID      string    `json:"id"`
			Label   string    `json:"label"`
			AddedAt time.Time `json:"addedAt"`
			Current bool      `json:"current"`
		}
		out := []devOut{}
		for _, d := range u.TrustedDevices {
			out = append(out, devOut{ID: d.Hash, Label: d.Label, AddedAt: d.AddedAt, Current: d.Hash == curHash})
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": out})
	}
}

// RevokeMyDevice removes a trusted device by its id (hash); that device must
// pass an OTP again next login.
func RevokeMyDevice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		uid, _ := c.Get("userId")
		userID := fmt.Sprintf("%v", uid)
		hash := c.Param("id")
		if hash == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Device id required"})
			return
		}
		_, err := userCollection.UpdateOne(ctx, bson.M{"userId": userID}, bson.M{"$pull": bson.M{"trustedDevices": bson.M{"hash": hash}}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to revoke device"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Device removed"})
	}
}

// VerifyLoginOTP validates the emailed OTP for a new device. On success it trusts
// the device (so future logins skip OTP) and issues the auth token.
func VerifyLoginOTP() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		ip := c.ClientIP()
		if !signinLimiter.Allow(ip) {
			c.JSON(http.StatusTooManyRequests, gin.H{"status": http.StatusTooManyRequests, "message": "Too many attempts. Please wait a minute and try again."})
			return
		}

		var body struct {
			UserID   string `json:"userId"`
			OTP      string `json:"otp"`
			DeviceID string `json:"deviceId"`
		}
		if err := c.BindJSON(&body); err != nil || strings.TrimSpace(body.UserID) == "" || strings.TrimSpace(body.OTP) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "userId and otp are required"})
			return
		}

		// userId may repeat — match the account whose pending OTP matches this code+device.
		loginVal := strings.TrimSpace(body.UserID)
		idRx := bson.M{"$regex": "^" + regexp.QuoteMeta(loginVal) + "$", "$options": "i"}
		cur, qErr := userCollection.Find(ctx, bson.M{"$or": []bson.M{{"userId": idRx}, {"email": idRx}}})
		if qErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Database error"})
			return
		}
		var candidates []bson.M
		_ = cur.All(ctx, &candidates)

		deviceHash := hashDevice(body.DeviceID)
		otpHashIn := hashOTP(strings.TrimSpace(body.OTP))
		var fullUser bson.M
		for _, cand := range candidates {
			so, _ := cand["loginOtp"].(string)
			sd, _ := cand["loginOtpDevice"].(string)
			expOK := false
			if exp, ok := cand["loginOtpExp"].(primitive.DateTime); ok {
				expOK = time.Now().Before(exp.Time())
			}
			if so != "" && so == otpHashIn && sd == deviceHash && expOK {
				fullUser = cand
				break
			}
		}
		if fullUser == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"status": http.StatusUnauthorized, "message": "Invalid or expired code"})
			return
		}
		filter := bson.M{"_id": fullUser["_id"]}
		loginUserID := strings.TrimSpace(fmt.Sprintf("%v", fullUser["userId"]))

		// Trust this device (replace any existing entry for the same hash) + clear OTP.
		_, _ = userCollection.UpdateOne(ctx, filter, bson.M{
			"$pull":  bson.M{"trustedDevices": bson.M{"hash": deviceHash}},
			"$unset": bson.M{"loginOtp": "", "loginOtpExp": "", "loginOtpDevice": ""},
		})
		_, _ = userCollection.UpdateOne(ctx, filter, bson.M{
			"$push": bson.M{"trustedDevices": models.TrustedDevice{Hash: deviceHash, Label: c.GetHeader("User-Agent"), AddedAt: time.Now()}},
		})

		projection := bson.M{"userId": 1, "companyName": 1, "orgId": 1}
		var result bson.M
		if err := userCollection.FindOne(ctx, filter, options.FindOne().SetProjection(projection)).Decode(&result); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch user data"})
			return
		}
		token, err := utils.GenerateToken(loginUserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Could not generate token"})
			return
		}
		organizations := buildUserOrganizations(ctx, loginUserID)
		c.JSON(http.StatusOK, gin.H{
			"status":        http.StatusOK,
			"message":       "Login successful",
			"data":          result,
			"token":         token,
			"organizations": organizations,
		})
	}
}
