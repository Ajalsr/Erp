package loader

import "github.com/joho/godotenv"

func init() {
	if err := godotenv.Load(); err != nil {
		// No .env file — rely on environment variables already being set
		_ = err
	}
}
