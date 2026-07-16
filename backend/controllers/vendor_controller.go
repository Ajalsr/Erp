package controllers

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
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

var vendorCollection *mongo.Collection = config.GetCollection(config.DB, "vendors")

func generateVendorCode(orgID string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	return nextNumber(ctx, orgID, "vendor", vendorCollection, "vendorCode")
}

func CreateVendor() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var v models.Vendor
		if err := c.ShouldBindJSON(&v); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if v.DisplayName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Display name is required"})
			return
		}

		// Approval gate — hold the create for an approver when the org requires it.
		if !c.GetBool("approvalReplay") {
			if holdActionForApproval(c, ctx, fmt.Sprintf("%v", orgID), fmt.Sprintf("%v", userID), "", "vendor", "create", "vendors", v.DisplayName, 0, "", v) {
				return
			}
		}

		v.ID = primitive.NewObjectID()
		v.OrgID = orgID.(string)
		v.CreatedAt = time.Now()
		v.UpdatedAt = time.Now()
		if userID != nil {
			v.CreatedBy = userID.(string)
		}
		if v.VendorCode == "" {
			v.VendorCode = generateVendorCode(orgID.(string))
		}
		if v.Status == "" {
			v.Status = "active"
		}
		v.OutstandingPayable = 0

		if _, err := vendorCollection.InsertOne(ctx, v); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create vendor", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Vendor created successfully",
			"data":    gin.H{"id": v.ID.Hex(), "vendorCode": v.VendorCode},
		})
	}
}

func GetAllVendors() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		filter := bson.M{"orgId": orgID}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if search := c.Query("search"); search != "" {
			search = regexp.QuoteMeta(search)
			filter["$or"] = []bson.M{
				{"displayName": bson.M{"$regex": search, "$options": "i"}},
				{"companyName": bson.M{"$regex": search, "$options": "i"}},
				{"vendorCode": bson.M{"$regex": search, "$options": "i"}},
				{"email": bson.M{"$regex": search, "$options": "i"}},
			}
		}

		total, _ := vendorCollection.CountDocuments(ctx, filter)

		page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
		limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "50"), 10, 64)
		skip := (page - 1) * limit

		opts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetSkip(skip).
			SetLimit(limit)

		cursor, err := vendorCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch vendors"})
			return
		}
		defer cursor.Close(ctx)

		var vendors []models.Vendor
		if err := cursor.All(ctx, &vendors); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode vendors"})
			return
		}
		if vendors == nil {
			vendors = []models.Vendor{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Vendors retrieved successfully",
			"data":    gin.H{"vendors": vendors, "total": total, "page": page, "limit": limit},
		})
	}
}

func GetVendorByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid vendor ID"})
			return
		}

		var raw bson.M
		err = vendorCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&raw)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Vendor not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve vendor"})
			}
			return
		}
		// Convert ObjectID to string so JSON serialises cleanly
		if oid, ok := raw["_id"].(primitive.ObjectID); ok {
			raw["_id"] = oid.Hex()
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor retrieved", "data": raw})
	}
}

func UpdateVendor() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid vendor ID"})
			return
		}

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}

		// Approval gate — hold the edit for an approver when the org requires it.
		if !c.GetBool("approvalReplay") {
			userID, _ := c.Get("userId")
			title, _ := updates["displayName"].(string)
			if title == "" {
				title = "Vendor"
			}
			if holdActionForApproval(c, ctx, fmt.Sprintf("%v", orgID), fmt.Sprintf("%v", userID), "", "vendor", "update", "vendors", title, 0, id, updates) {
				return
			}
		}

		delete(updates, "_id")
		delete(updates, "orgId")
		delete(updates, "createdAt")
		delete(updates, "outstandingPayable")
		updates["updatedAt"] = time.Now()

		result, err := vendorCollection.UpdateOne(ctx, bson.M{"_id": objID, "orgId": orgID}, bson.M{"$set": updates})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update vendor"})
			return
		}
		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Vendor not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor updated successfully"})
	}
}

func DeleteVendor() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid vendor ID"})
			return
		}

		result, err := vendorCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgID})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to delete vendor"})
			return
		}
		if result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Vendor not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor deleted successfully"})
	}
}

func GetVendorStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		total, _ := vendorCollection.CountDocuments(ctx, bson.M{"orgId": orgID})
		active, _ := vendorCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "active"})

		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgID}}},
			{{Key: "$group", Value: bson.M{
				"_id":          nil,
				"totalPayable": bson.M{"$sum": "$outstandingPayable"},
			}}},
		}
		cursor, _ := vendorCollection.Aggregate(ctx, pipeline)
		var agg []bson.M
		if cursor != nil {
			cursor.All(ctx, &agg)
		}

		totalPayable := 0.0
		if len(agg) > 0 {
			if v, ok := agg[0]["totalPayable"].(float64); ok {
				totalPayable = v
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"total":        total,
				"active":       active,
				"inactive":     total - active,
				"totalPayable": totalPayable,
			},
		})
	}
}

func SearchVendors() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		q := regexp.QuoteMeta(c.Query("q"))

		filter := bson.M{
			"orgId": orgID,
			"$or": []bson.M{
				{"displayName": bson.M{"$regex": q, "$options": "i"}},
				{"companyName": bson.M{"$regex": q, "$options": "i"}},
				{"vendorCode": bson.M{"$regex": q, "$options": "i"}},
			},
		}

		opts := options.Find().SetLimit(10).SetSort(bson.D{{Key: "displayName", Value: 1}})
		cursor, err := vendorCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Search failed"})
			return
		}
		defer cursor.Close(ctx)

		var vendors []models.Vendor
		cursor.All(ctx, &vendors)
		if vendors == nil {
			vendors = []models.Vendor{}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": vendors})
	}
}

func GetVendorTransactions() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		vendorID := c.Param("id")

		billsColl := config.GetCollection(config.DB, "bills")
		paysColl := config.GetCollection(config.DB, "vendor_payments")
		posColl := config.GetCollection(config.DB, "purchase_orders")
		grnsColl := config.GetCollection(config.DB, "grns")

		filter := bson.M{"orgId": orgIDStr, "vendorId": vendorID}
		sortDesc := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})

		var bills []bson.M
		if cur, err := billsColl.Find(ctx, filter, sortDesc); err == nil {
			cur.All(ctx, &bills)
			cur.Close(ctx)
		}
		if bills == nil {
			bills = []bson.M{}
		}

		var payments []bson.M
		if cur, err := paysColl.Find(ctx, filter, sortDesc); err == nil {
			cur.All(ctx, &payments)
			cur.Close(ctx)
		}
		if payments == nil {
			payments = []bson.M{}
		}

		var pos []bson.M
		if cur, err := posColl.Find(ctx, bson.M{"orgId": orgIDStr, "vendorId": vendorID}, sortDesc); err == nil {
			cur.All(ctx, &pos)
			cur.Close(ctx)
		}
		if pos == nil {
			pos = []bson.M{}
		}

		var grns []bson.M
		if cur, err := grnsColl.Find(ctx, filter, sortDesc); err == nil {
			cur.All(ctx, &grns)
			cur.Close(ctx)
		}
		if grns == nil {
			grns = []bson.M{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"bills":          bills,
				"payments":       payments,
				"purchaseOrders": pos,
				"grns":           grns,
			},
		})
	}
}

// POST /api/vendors/import — bulk-create vendors from parsed CSV rows.
// Body: { "vendors": [ { displayName, companyName, email, phone, ... }, ... ] }.
func ImportVendors() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		var body struct {
			Vendors []models.Vendor `json:"vendors"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if len(body.Vendors) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "No rows to import"})
			return
		}
		if len(body.Vendors) > 5000 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Too many rows — import up to 5000 at a time"})
			return
		}

		orgIDStr := fmt.Sprintf("%v", mustGet(c, "orgId"))
		userIDStr := fmt.Sprintf("%v", mustGet(c, "userId"))
		imported := 0
		type rowErr struct {
			Row     int    `json:"row"`
			Message string `json:"message"`
		}
		errors := []rowErr{}

		for i, v := range body.Vendors {
			if v.DisplayName == "" {
				v.DisplayName = v.CompanyName
			}
			if v.DisplayName == "" {
				errors = append(errors, rowErr{Row: i + 1, Message: "missing display name / company name"})
				continue
			}
			now := time.Now()
			v.ID = primitive.NewObjectID()
			v.OrgID = orgIDStr
			v.CreatedBy = userIDStr
			v.CreatedAt = now
			v.UpdatedAt = now
			if v.VendorCode == "" {
				v.VendorCode = generateVendorCode(orgIDStr)
			}
			if v.VendorType == "" {
				v.VendorType = "business"
			}
			if v.Status == "" {
				v.Status = "active"
			}
			if _, err := vendorCollection.InsertOne(ctx, v); err != nil {
				errors = append(errors, rowErr{Row: i + 1, Message: "insert failed"})
				continue
			}
			imported++
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": fmt.Sprintf("Imported %d of %d vendors", imported, len(body.Vendors)),
			"data":    gin.H{"imported": imported, "failed": len(errors), "errors": errors},
		})
	}
}
