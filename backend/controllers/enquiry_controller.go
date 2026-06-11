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

var enquiryCollection *mongo.Collection = config.GetCollection(config.DB, "enquiries")

func CreateEnquiry() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var enq models.Enquiry
		if err := c.ShouldBindJSON(&enq); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body", "error": err.Error()})
			return
		}

		// Auto-generate enquiry number: ENQ-YYYY-XXXX
		count, _ := enquiryCollection.CountDocuments(ctx, bson.M{"orgId": orgID})
		enq.ID = primitive.NewObjectID()
		enq.EnquiryNumber = fmt.Sprintf("ENQ-%d-%04d", time.Now().Year(), count+1)
		enq.OrgID = orgID.(string)
		enq.CreatedBy = func() string {
			if userID != nil {
				return userID.(string)
			}
			return ""
		}()
		if enq.Status == "" {
			enq.Status = "new"
		}
		if enq.Priority == "" {
			enq.Priority = "medium"
		}
		if enq.Date == "" {
			enq.Date = time.Now().Format("2006-01-02")
		}
		enq.CreatedAt = time.Now()
		enq.UpdatedAt = time.Now()

		if _, err := enquiryCollection.InsertOne(ctx, enq); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create enquiry", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message": "Enquiry created successfully",
			"data":    gin.H{"id": enq.ID.Hex(), "enquiryNumber": enq.EnquiryNumber},
		})
	}
}

func GetAllEnquiries() gin.HandlerFunc {
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
		if priority := c.Query("priority"); priority != "" {
			filter["priority"] = priority
		}
		// followUp filter: today | overdue | due (overdue + today). Open enquiries only.
		if fu := c.Query("followUp"); fu != "" {
			todayStr := time.Now().Format("2006-01-02")
			switch fu {
			case "today":
				filter["followUpDate"] = todayStr
			case "overdue":
				filter["followUpDate"] = bson.M{"$lt": todayStr, "$gt": ""}
			case "due":
				filter["followUpDate"] = bson.M{"$lte": todayStr, "$gt": ""}
			}
			filter["status"] = bson.M{"$nin": bson.A{"converted", "won", "lost", "closed", "cancelled"}}
		}
		if q := c.Query("q"); q != "" {
			filter["$or"] = bson.A{
				bson.M{"enquiryNumber": bson.M{"$regex": q, "$options": "i"}},
				bson.M{"customerName": bson.M{"$regex": q, "$options": "i"}},
				bson.M{"company": bson.M{"$regex": q, "$options": "i"}},
				bson.M{"subject": bson.M{"$regex": q, "$options": "i"}},
			}
		}

		total, _ := enquiryCollection.CountDocuments(ctx, filter)
		opts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetSkip(skip).
			SetLimit(limit)

		cursor, err := enquiryCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch enquiries"})
			return
		}
		defer cursor.Close(ctx)

		var enquiries []models.Enquiry
		if err := cursor.All(ctx, &enquiries); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to decode enquiries"})
			return
		}
		if enquiries == nil {
			enquiries = []models.Enquiry{}
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Enquiries retrieved successfully",
			"data": gin.H{
				"enquiries":  enquiries,
				"total":      total,
				"page":       page,
				"totalPages": (total + limit - 1) / limit,
			},
		})
	}
}

func GetEnquiryStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		base := bson.M{"orgId": orgID}

		total, _ := enquiryCollection.CountDocuments(ctx, base)
		newCount, _ := enquiryCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "new"})
		contacted, _ := enquiryCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "contacted"})
		quoted, _ := enquiryCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "quoted"})
		converted, _ := enquiryCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "converted"})
		lost, _ := enquiryCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "lost"})

		// Total estimated value
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: base}},
			{{Key: "$group", Value: bson.M{"_id": nil, "total": bson.M{"$sum": "$estimatedValue"}}}},
		}
		cur, _ := enquiryCollection.Aggregate(ctx, pipeline)
		var valueResult []bson.M
		_ = cur.All(ctx, &valueResult)
		totalValue := 0.0
		if len(valueResult) > 0 {
			if v, ok := valueResult[0]["total"]; ok {
				switch val := v.(type) {
				case float64:
					totalValue = val
				case int32:
					totalValue = float64(val)
				case int64:
					totalValue = float64(val)
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Stats retrieved",
			"data": gin.H{
				"total":      total,
				"new":        newCount,
				"contacted":  contacted,
				"quoted":     quoted,
				"converted":  converted,
				"lost":       lost,
				"totalValue": totalValue,
			},
		})
	}
}

func GetEnquiryByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid enquiry ID"})
			return
		}

		var enq models.Enquiry
		err = enquiryCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&enq)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"message": "Enquiry not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to retrieve enquiry"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Enquiry retrieved", "data": enq})
	}
}

func UpdateEnquiryStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid enquiry ID"})
			return
		}

		var req struct {
			Status string `json:"status" binding:"required,oneof=new contacted quoted converted lost cancelled"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid status", "error": err.Error()})
			return
		}

		// Terminal enquiries can't change state — converted/lost/cancelled are final.
		var existing models.Enquiry
		if enquiryCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&existing) == nil {
			switch existing.Status {
			case "converted", "lost", "cancelled":
				c.JSON(http.StatusConflict, gin.H{"message": "This enquiry is " + existing.Status + " and can no longer change status"})
				return
			}
		}

		result, err := enquiryCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": orgID},
			bson.M{"$set": bson.M{"status": req.Status, "updatedAt": time.Now()}},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"message": "Enquiry not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
	}
}

func UpdateEnquiry() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid enquiry ID"})
			return
		}

		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid body"})
			return
		}
		delete(body, "_id")
		delete(body, "orgId")
		delete(body, "enquiryNumber")
		delete(body, "createdAt")
		body["updatedAt"] = time.Now()

		result, err := enquiryCollection.UpdateOne(ctx,
			bson.M{"_id": objectID, "orgId": orgID},
			bson.M{"$set": body},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"message": "Enquiry not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Enquiry updated"})
	}
}
