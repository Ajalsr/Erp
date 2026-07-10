# Build the Go backend for Linux and ship a tiny runtime image.
# Used by container hosts (Render, Railway, Fly.io, Docker on a VPS).
FROM golang:1.25-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags "-s -w" -o /backend .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /backend /app/backend
EXPOSE 8080
ENV PORT=8080
# Env (MONGO_URI, JWT_SECRET, CLOUDINARY_*, SMTP_*, APP_URL, ALLOWED_ORIGINS,
# ADMIN_SECRET) are injected by the host — no .env file baked into the image.
ENTRYPOINT ["/app/backend"]
