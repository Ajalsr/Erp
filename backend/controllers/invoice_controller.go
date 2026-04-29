package controllers

import (
	"context"
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

var invoiceCollection *mongo.Collection = config.GetCollection(config.DB, "invoices")

func CreateInvoice() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var inv models.Invoice
		if err := c.ShouldBindJSON(&inv); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}

		inv.ID = primitive.NewObjectID()
		inv.OrgID = orgID.(string)
		inv.CreatedBy = func() string {
			if userID != nil {
				return userID.(string)
			}
			return ""
		}()
		inv.CreatedAt = time.Now()
		inv.UpdatedAt = time.Now()

		if inv.Status == "" {
			inv.Status = "unpaid"
		}

		// Assign IDs to line items
		for i := range inv.LineItems {
			inv.LineItems[i].ID = primitive.NewObjectID()
		}

		_, err := invoiceCollection.InsertOne(ctx, inv)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create invoice", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Invoice created successfully",
			"data":    gin.H{"id": inv.ID.Hex(), "invoiceNumber": inv.InvoiceNumber},
		})
	}
}

func GetAllInvoices() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
		limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 64)
		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}
		skip := (page - 1) * limit

		filter := bson.M{"orgId": orgID}
		if status := c.Query("status"); status != "" && status != "all" {
			filter["status"] = status
		}
		if customerId := c.Query("customerId"); customerId != "" {
			filter["customerId"] = customerId
		}

		total, _ := invoiceCollection.CountDocuments(ctx, filter)

		opts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetSkip(skip).
			SetLimit(limit)

		cursor, err := invoiceCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch invoices", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var invoices []models.Invoice
		if err := cursor.All(ctx, &invoices); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode invoices", "error": err.Error()})
			return
		}
		if invoices == nil {
			invoices = []models.Invoice{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Invoices retrieved successfully",
			"data": gin.H{
				"invoices":   invoices,
				"total":      total,
				"page":       page,
				"limit":      limit,
				"totalPages": (total + limit - 1) / limit,
			},
		})
	}
}

func GetInvoiceByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid invoice ID"})
			return
		}

		var inv models.Invoice
		err = invoiceCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&inv)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Invoice not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve invoice", "error": err.Error()})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Invoice retrieved successfully", "data": inv})
	}
}

func GetInvoiceStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgID}}},
			{{Key: "$group", Value: bson.M{
				"_id":   "$status",
				"count": bson.M{"$sum": 1},
				"total": bson.M{"$sum": "$totals.grandTotal"},
				"paid":  bson.M{"$sum": "$amountPaid"},
			}}},
		}

		cursor, err := invoiceCollection.Aggregate(ctx, pipeline)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Stats failed"})
			return
		}
		defer cursor.Close(ctx)

		var rows []bson.M
		cursor.All(ctx, &rows)

		result := map[string]gin.H{}
		for _, r := range rows {
			st, _ := r["_id"].(string)
			cnt, _ := r["count"].(int32)
			tot, _ := r["total"].(float64)
			pd, _ := r["paid"].(float64)
			result[st] = gin.H{"count": cnt, "total": tot, "paid": pd, "balance": tot - pd}
		}

		// Convenience: sum of unpaid + partial = outstanding
		outstanding := 0.0
		outstandingCount := int32(0)
		for _, st := range []string{"unpaid", "partial", "overdue"} {
			if v, ok := result[st]; ok {
				if b, ok := v["balance"].(float64); ok {
					outstanding += b
				}
				if n, ok := v["count"].(int32); ok {
					outstandingCount += n
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"byStatus":          result,
				"outstandingTotal":  outstanding,
				"outstandingCount":  outstandingCount,
			},
		})
	}
}

func UpdateInvoiceStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid invoice ID"})
			return
		}

		var req struct {
			Status string `json:"status" binding:"required,oneof=draft unpaid paid partial overdue void"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid status", "error": err.Error()})
			return
		}

		orgID, _ := c.Get("orgId")
		update := bson.M{"$set": bson.M{"status": req.Status, "updatedAt": time.Now()}}
		result, err := invoiceCollection.UpdateOne(ctx, bson.M{"_id": objectID, "orgId": orgID}, update)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Invoice not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Invoice status updated"})
	}
}
