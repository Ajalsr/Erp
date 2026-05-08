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
// Expiry is 8 hours — suitable for a full work day in a desktop ERP.
func GenerateToken(userId string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": userId,
		"exp":    time.Now().Add(time.Hour * 8).Unix(),
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
