package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var deliveryNotesCollection *mongo.Collection = config.GetCollection(config.DB, "delivery_notes")

func generateDNNumber(ctx context.Context, orgID string) string {
	count, _ := deliveryNotesCollection.CountDocuments(ctx, bson.M{"orgId": orgID})
	year := time.Now().Year()
	return fmt.Sprintf("DN-%d-%04d", year, count+1)
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
func CreateDeliveryNote() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var req models.DeliveryNote
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}

		if req.DNNumber == "" {
			req.DNNumber = generateDNNumber(ctx, fmt.Sprintf("%v", orgID))
		}
		if req.Status == "" {
			req.Status = "draft"
		}

		req.ID = primitive.NewObjectID()
		req.OrgID = fmt.Sprintf("%v", orgID)
		req.CreatedBy = fmt.Sprintf("%v", userID)
		req.CreatedAt = time.Now()
		req.UpdatedAt = time.Now()
		if req.Date == "" {
			req.Date = time.Now().Format("02 Jan 2006")
		}

		result, err := deliveryNotesCollection.InsertOne(ctx, req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create delivery note", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Delivery note created successfully",
			"data": gin.H{
				"id":       req.ID.Hex(),
				"dnNumber": req.DNNumber,
				"status":   req.Status,
				"insertedId": result.InsertedID,
			},
		})
	}
}

// ─── GET ALL ──────────────────────────────────────────────────────────────────
func GetAllDeliveryNotes() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		filter := bson.M{"orgId": fmt.Sprintf("%v", orgID)}

		if status := c.Query("status"); status != "" && status != "all" {
			filter["status"] = status
		}
		if search := c.Query("search"); search != "" {
			filter["$or"] = []bson.M{
				{"dnNumber":     bson.M{"$regex": search, "$options": "i"}},
				{"customerName": bson.M{"$regex": search, "$options": "i"}},
				{"orderNumber":  bson.M{"$regex": search, "$options": "i"}},
			}
		}

		page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
		limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "50"), 10, 64)
		skip := (page - 1) * limit

		total, _ := deliveryNotesCollection.CountDocuments(ctx, filter)
		opts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetSkip(skip).
			SetLimit(limit)

		cursor, err := deliveryNotesCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch delivery notes"})
			return
		}
		defer cursor.Close(ctx)

		var notes []models.DeliveryNote
		if err := cursor.All(ctx, &notes); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode delivery notes"})
			return
		}
		if notes == nil {
			notes = []models.DeliveryNote{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Delivery notes retrieved successfully",
			"data": gin.H{
				"deliveryNotes": notes,
				"total":         total,
				"page":          page,
				"limit":         limit,
			},
		})
	}
}

// ─── GET STATS ────────────────────────────────────────────────────────────────
func GetDeliveryNoteStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		base := bson.M{"orgId": fmt.Sprintf("%v", orgID)}

		total, _ := deliveryNotesCollection.CountDocuments(ctx, base)
		draft, _ := deliveryNotesCollection.CountDocuments(ctx, bson.M{"orgId": fmt.Sprintf("%v", orgID), "status": "draft"})
		confirmed, _ := deliveryNotesCollection.CountDocuments(ctx, bson.M{"orgId": fmt.Sprintf("%v", orgID), "status": "confirmed"})
		dispatched, _ := deliveryNotesCollection.CountDocuments(ctx, bson.M{"orgId": fmt.Sprintf("%v", orgID), "status": "dispatched"})
		delivered, _ := deliveryNotesCollection.CountDocuments(ctx, bson.M{"orgId": fmt.Sprintf("%v", orgID), "status": "delivered"})

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Stats retrieved",
			"data": gin.H{
				"total": total, "draft": draft, "confirmed": confirmed,
				"dispatched": dispatched, "delivered": delivered,
			},
		})
	}
}

// ─── GET BY ID ────────────────────────────────────────────────────────────────
func GetDeliveryNoteByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid delivery note ID"})
			return
		}

		orgID, _ := c.Get("orgId")
		var note models.DeliveryNote
		err = deliveryNotesCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": fmt.Sprintf("%v", orgID)}).Decode(&note)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Delivery note not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch delivery note"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Delivery note retrieved", "data": note})
	}
}

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────
func UpdateDeliveryNoteStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid delivery note ID"})
			return
		}

		var body struct {
			Status string `json:"status"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Status == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Status is required"})
			return
		}

		allowed := map[string]bool{"draft": true, "confirmed": true, "dispatched": true, "delivered": true}
		if !allowed[body.Status] {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid status value"})
			return
		}

		orgID, _ := c.Get("orgId")
		result, err := deliveryNotesCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": fmt.Sprintf("%v", orgID)},
			bson.M{"$set": bson.M{"status": body.Status, "updatedAt": time.Now()}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update status"})
			return
		}
		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Delivery note not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Status updated successfully", "data": gin.H{"status": body.Status}})
	}
}

// ─── MARK INVOICED ────────────────────────────────────────────────────────────
func MarkDeliveryNoteInvoiced() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid delivery note ID"})
			return
		}

		var body struct {
			InvoiceID     string `json:"invoiceId"`
			InvoiceNumber string `json:"invoiceNumber"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.InvoiceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "invoiceId is required"})
			return
		}

		orgID, _ := c.Get("orgId")
		result, err := deliveryNotesCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": fmt.Sprintf("%v", orgID)},
			bson.M{"$set": bson.M{
				"invoiceId":     body.InvoiceID,
				"invoiceNumber": body.InvoiceNumber,
				"updatedAt":     time.Now(),
			}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to mark as invoiced"})
			return
		}
		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Delivery note not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Delivery note marked as invoiced", "data": gin.H{"invoiceId": body.InvoiceID, "invoiceNumber": body.InvoiceNumber}})
	}
}
