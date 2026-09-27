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
	pushNotificationWithMeta(userID, notifType, title, message, orgID, orgName, nil)
}

// pushNotificationWithMeta is the same as pushNotification but also stores
// arbitrary key/value metadata (e.g. itemId, requestedBy) in the record.
func pushNotificationWithMeta(userID, notifType, title, message, orgID, orgName string, metadata map[string]string) {
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
		Metadata:  metadata,
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
// Returns the calling user's last 50 notifications for the active org
// (newest first) — scoped by X-Org-ID so switching orgs shows that org's own
// notifications instead of the same global list every time.
func GetNotifications() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, _ := c.Get("orgId")

		opts := options.Find().
			SetSort(bson.M{"createdAt": -1}).
			SetLimit(50)

		cursor, err := notificationCollection.Find(ctx, bson.M{"userId": userID.(string), "orgId": orgID}, opts)
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
// Marks every unread notification for the calling user, in the active org, as read.
func MarkAllNotificationsRead() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, _ := c.Get("orgId")

		_, err := notificationCollection.UpdateMany(
			ctx,
			bson.M{"userId": userID.(string), "orgId": orgID, "read": false},
			bson.M{"$set": bson.M{"read": true}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error", "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "All notifications marked as read"})
	}
}

// POST /api/notifications/cancel-request
// Called by a member when they request cancellation of an outbound item.
// Finds every active owner/admin in the same org and pushes a real-time
// notification to each of them.
func CreateCancelRequest() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgIDStr, _ := c.Get("orgId")

		var body struct {
			Title       string `json:"title"`
			Message     string `json:"message"`
			ItemName    string `json:"itemName"`
			ItemId      string `json:"itemId"`
			RequestedBy string `json:"requestedBy"`
			Reason      string `json:"reason"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid body"})
			return
		}

		orgID, err := primitive.ObjectIDFromHex(orgIDStr.(string))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid orgId"})
			return
		}

		// Find all active owners and admins in this org (excluding the requester)
		cursor, err := orgMemberCollection.Find(ctx, bson.M{
			"orgId":  orgID,
			"status": "active",
			"role":   bson.M{"$in": []string{"owner", "admin"}},
			"userId": bson.M{"$ne": userID.(string)},
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "db error"})
			return
		}
		defer cursor.Close(ctx)

		var members []models.OrgMember
		cursor.All(ctx, &members)

		title := body.Title
		if title == "" {
			title = "Cancellation Approval Required"
		}

		metadata := map[string]string{
			"itemId":      body.ItemId,
			"itemName":    body.ItemName,
			"requestedBy": body.RequestedBy,
			"reason":      body.Reason,
			"requesterId": userID.(string),
		}

		sent := 0
		for _, m := range members {
			go pushNotificationWithMeta(m.UserID, "cancel_request", title, body.Message, orgIDStr.(string), "", metadata)
			sent++
		}

		c.JSON(http.StatusOK, gin.H{"message": "notifications sent", "sent": sent})
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
