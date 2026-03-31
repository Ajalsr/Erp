package controllers

import (
	"context"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/backend/ws"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var notificationCollection *mongo.Collection = config.GetCollection(config.DB, "notifications")

// pushNotification inserts a notification into MongoDB and pushes it over
// WebSocket to the target user. Safe to call in a goroutine.
func pushNotification(userID, notifType, title, message, orgID, orgName string) {
	notif := models.Notification{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		Type:      notifType,
		Title:     title,
		Message:   message,
		OrgID:     orgID,
		OrgName:   orgName,
		Read:      false,
		CreatedAt: time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	notificationCollection.InsertOne(ctx, notif)

	ws.GlobalHub.SendEventToUser(userID, ws.Event{
		Type:    "notification",
		Payload: notif,
	})
}

// GET /api/notifications
// Returns the calling user's last 50 notifications (newest first).
func GetNotifications() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")

		opts := options.Find().
			SetSort(bson.M{"createdAt": -1}).
			SetLimit(50)

		cursor, err := notificationCollection.Find(ctx, bson.M{"userId": userID.(string)}, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var notifs []models.Notification
		if err = cursor.All(ctx, &notifs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error", "error": err.Error()})
			return
		}
		if notifs == nil {
			notifs = []models.Notification{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "ok",
			"data":    notifs,
		})
	}
}

// PUT /api/notifications/read-all
// Marks every unread notification for the calling user as read.
func MarkAllNotificationsRead() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")

		_, err := notificationCollection.UpdateMany(
			ctx,
			bson.M{"userId": userID.(string), "read": false},
			bson.M{"$set": bson.M{"read": true}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error", "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "All notifications marked as read"})
	}
}

// DELETE /api/notifications/:id
// Deletes a single notification that belongs to the calling user.
func DeleteNotification() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")

		notifID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid notification id"})
			return
		}

		res, err := notificationCollection.DeleteOne(ctx, bson.M{"_id": notifID, "userId": userID.(string)})
		if err != nil || res.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Notification not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Deleted"})
	}
}
