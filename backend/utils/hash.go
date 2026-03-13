package utils

import (
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) error {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err
}

type RateLimiter struct {
	requests map[string][]time.Time
	mu       sync.RWMutex
	limit    int
	window   time.Duration
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
}

// Allow checks if a request from an IP is allowed
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()

	// Clean up old requests
	if requests, exists := rl.requests[ip]; exists {
		var validRequests []time.Time
		for _, t := range requests {
			if now.Sub(t) <= rl.window {
				validRequests = append(validRequests, t)
			}
		}
		rl.requests[ip] = validRequests
	}

	// Check rate limit
	if len(rl.requests[ip]) >= rl.limit {
		return false
	}

	// Add current request
	rl.requests[ip] = append(rl.requests[ip], now)
	return true
}

// Validation functions
func IsValidEmail(email string) bool {
	return strings.Contains(email, "@") && strings.Contains(email, ".")
}

func Split(s, sep string) []string {
	return strings.Split(s, sep)
}

func TrimSpace(s string) string {
	return strings.TrimSpace(s)
}

func HasSuffix(s, suffix string) bool {
	return strings.HasSuffix(s, suffix)
}

// Ternary operator implementation
func Ternary[T any](condition bool, trueVal, falseVal T) T {
	if condition {
		return trueVal
	}
	return falseVal
}
