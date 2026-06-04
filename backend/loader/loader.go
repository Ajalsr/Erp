package loader

import (
	"encoding/base64"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// EnvBlob is injected at build time via:
//   go build -ldflags "-X 'github.com/backend/loader.EnvBlob=<base64 of .env>'"
// It is empty in dev builds (`go run .`), where godotenv.Load() reads ./.env instead.
// This lets the shipped sidecar binary be fully self-contained — no loose .env file
// needs to travel with the app.
var EnvBlob string

func init() {
	// Dev path: load ./.env from the working directory if present.
	_ = godotenv.Load()

	// Shipped path: apply build-time embedded vars for anything not already set.
	// Real OS env and a present .env always take precedence (set-only-if-missing).
	if EnvBlob == "" {
		return
	}

	decoded, err := base64.StdEncoding.DecodeString(EnvBlob)
	if err != nil {
		return
	}

	for _, line := range strings.Split(string(decoded), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		eq := strings.Index(line, "=")
		if eq == -1 {
			continue
		}
		key := strings.TrimSpace(line[:eq])
		val := strings.TrimSpace(line[eq+1:])
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, val)
		}
	}
}
