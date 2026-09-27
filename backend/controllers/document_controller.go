package controllers

import (
	"context"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// POST /api/documents/upload
// multipart form: file=<binary>, folder=<optional>, docType=<optional>
func UploadDocument() gin.HandlerFunc {
	return func(c *gin.Context) {
		fileHeader, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "file is required"})
			return
		}

		if fileHeader.Size > 10*1024*1024 { // 10 MB cap
			c.JSON(http.StatusBadRequest, gin.H{"message": "file too large (max 10 MB)"})
			return
		}

		file, err := fileHeader.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to open file"})
			return
		}
		defer file.Close()

		folder := c.PostForm("folder")
		if folder == "" {
			folder = "erp/documents"
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		result, err := config.CloudinaryClient.Upload.Upload(ctx, file, uploader.UploadParams{
			Folder:         folder,
			ResourceType:   "raw", // raw = served as-is, publicly accessible, no image-delivery restrictions
			UseFilename:    boolPtr(true),
			UniqueFilename: boolPtr(true),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "upload failed", "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"url":      result.SecureURL,
			"publicId": result.PublicID,
			"format":   result.Format,
			"size":     fileHeader.Size,
			"name":     fileHeader.Filename,
		})
	}
}

func boolPtr(b bool) *bool { return &b }

// POST /api/customers/:id/documents
// Body: { name, type, url, size, description }
func AddCustomerDocument() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid customer id"})
			return
		}

		var body struct {
			Name        string `json:"name"`
			Type        string `json:"type"`
			URL         string `json:"url"`
			Size        int64  `json:"size"`
			Description string `json:"description"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.URL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "name, type, and url are required"})
			return
		}

		doc := models.Document{
			ID:          primitive.NewObjectID(),
			Name:        body.Name,
			Type:        body.Type,
			URL:         body.URL,
			Size:        body.Size,
			Description: body.Description,
			Status:      "uploaded",
			UploadDate:  time.Now().Format(time.RFC3339),
			UploadedAt:  time.Now(),
			UploadedBy:  fmt.Sprintf("%v", userID),
		}

		result, err := customersCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgID},
			bson.M{
				"$push": bson.M{"documents": doc},
				"$set":  bson.M{"updated_at": time.Now()},
			},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"message": "customer not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "document added", "data": doc})
	}
}

// DELETE /api/customers/:id/documents/:docId
func DeleteCustomerDocument() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid customer id"})
			return
		}
		docID, err := primitive.ObjectIDFromHex(c.Param("docId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid document id"})
			return
		}

		result, err := customersCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgID},
			bson.M{
				"$pull": bson.M{"documents": bson.M{"_id": docID}},
				"$set":  bson.M{"updated_at": time.Now()},
			},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"message": "customer not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "document deleted"})
	}
}

// signCloudinaryURL inserts a correct SHA-1 delivery signature for image/upload assets
// that require strict-transformation signing.
// Cloudinary spec: SHA1(public_id + api_secret) → base64url → first 8 chars
// public_id = suffix with version prefix (v\d+/) and file extension stripped.
func signCloudinaryURL(rawURL string) string {
	secret := os.Getenv("CLOUDINARY_API_SECRET")
	if secret == "" {
		return rawURL
	}
	idx := strings.Index(rawURL, "/upload/")
	if idx == -1 {
		return rawURL
	}
	suffix := rawURL[idx+8:] // e.g. "v1234/erp/documents/file.pdf"

	// Derive public_id: strip leading version token (v<digits>/) if present
	toSign := suffix
	if slashIdx := strings.Index(toSign, "/"); slashIdx > 1 && toSign[0] == 'v' {
		isVer := true
		for _, ch := range toSign[1:slashIdx] {
			if ch < '0' || ch > '9' {
				isVer = false
				break
			}
		}
		if isVer {
			toSign = toSign[slashIdx+1:]
		}
	}
	// Strip file extension (last dot after last slash)
	if dotIdx := strings.LastIndex(toSign, "."); dotIdx > strings.LastIndex(toSign, "/") {
		toSign = toSign[:dotIdx]
	}

	h := sha1.New()
	h.Write([]byte(toSign + secret))
	sig := base64.URLEncoding.EncodeToString(h.Sum(nil))
	sig = strings.TrimRight(sig, "=")
	if len(sig) > 8 {
		sig = sig[:8]
	}
	return rawURL[:idx+8] + "s--" + sig + "--/" + suffix
}

// GET /api/documents/proxy?url=<cloudinary-url>
func ProxyDocument() gin.HandlerFunc {
	return func(c *gin.Context) {
		rawURL := c.Query("url")
		if rawURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "url query param required"})
			return
		}
		if !strings.HasPrefix(rawURL, "https://res.cloudinary.com/") {
			c.JSON(http.StatusForbidden, gin.H{"message": "only Cloudinary URLs are allowed"})
			return
		}

		// raw/upload assets are publicly accessible; image/upload assets require a signed URL
		fetchURL := rawURL
		if strings.Contains(rawURL, "/image/upload/") {
			fetchURL = signCloudinaryURL(rawURL)
		}

		req, _ := http.NewRequest("GET", fetchURL, nil)
		req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; Spifora/1.0)")
		resp, err := (&http.Client{}).Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"message": "failed to fetch document"})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusBadGateway, gin.H{"message": fmt.Sprintf("upstream returned %d", resp.StatusCode)})
			return
		}

		ct := resp.Header.Get("Content-Type")
		if ct == "" {
			ct = "application/octet-stream"
		}
		filename := c.Query("filename")
		if filename == "" {
			filename = "document"
		}
		c.Header("Content-Type", ct)
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		c.Status(http.StatusOK)
		io.Copy(c.Writer, resp.Body)
	}
}
