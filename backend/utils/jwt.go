package utils

import (
	"errors"
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"

	_ "github.com/backend/loader"
)

// jwtSecret is loaded once at startup from the JWT_SECRET env variable.
// Never hardcode this value — a leaked or guessable secret lets anyone forge tokens.
var jwtSecret []byte

func init() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("JWT_SECRET environment variable is not set. Set a long random string (32+ chars).")
	}
	jwtSecret = []byte(secret)
}

// GenerateToken creates a signed JWT for the given userId.
// Expiry is 8 hours — suitable for a full work day in a desktop ERP — unless
// rememberMe is set ("Keep me logged in" on the Login page), which extends it
// to 30 days so the session actually survives an app restart.
func GenerateToken(userId string, rememberMe bool) (string, error) {
	exp := time.Now().Add(time.Hour * 8)
	if rememberMe {
		exp = time.Now().Add(time.Hour * 24 * 30)
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": userId,
		"exp":    exp.Unix(),
		"iat":    time.Now().Unix(),
	})
	return token.SignedString(jwtSecret)
}

// VerifyToken parses and validates a JWT, returning the userId claim on success.
func VerifyToken(tokenStr string) (string, error) {
	parsedToken, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret, nil
	})

	if err != nil {
		return "", errors.New("could not parse token")
	}

	if !parsedToken.Valid {
		return "", errors.New("invalid token")
	}

	claims, ok := parsedToken.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("invalid token claims")
	}

	userId, ok := claims["userId"].(string)
	if !ok {
		return "", errors.New("userId claim missing or invalid")
	}

	return userId, nil
}
