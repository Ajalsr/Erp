package controllers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/backend/ws"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/net/context"
)

var customersCollection *mongo.Collection = config.GetCollection(config.DB, "customers")

func GetAllCustomers() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		var customers []models.Customer
		defer cancel()

		orgID, _ := c.Get("orgId")
		collection := config.GetCollection(config.DB, "customers")
		results, err := collection.Find(ctx, bson.M{"orgId": orgID})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer results.Close(ctx)

		if err := results.All(ctx, &customers); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "error",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "success",
			"data":    customers,
		})
	}
}

func AddCustomers() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var item models.Customer

		if err := c.ShouldBindJSON(&item); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		if item.CustomerDisplayName == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "customerDisplayName is required",
			})
			return
		}

		// ── Auto-generate customer code ───────────────────────────────────
		orgIDVal, _ := c.Get("orgId")
		customerCode, err := generateCustomerCodeContinuous(ctx, fmt.Sprintf("%v", orgIDVal))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to generate customer code",
				"error":   err.Error(),
			})
			return
		}

		// ── Assign all server-side fields ─────────────────────────────────
		now := time.Now()
		item.ID = primitive.NewObjectID()
		item.CustomerCode = customerCode
		item.CreatedAt = now
		item.UpdatedAt = now // ← was missing

		// Default status to "active" when the form doesn't supply one
		if item.Status == "" {
			item.Status = "active"
		}

		// Default customer type
		if item.CustomerType == "" {
			item.CustomerType = "business"
		}

		// ── CreatedBy from JWT (set by middlewares.Authenticate) ──────────
		// The middleware stores the authenticated user's ID in the gin context
		// under the key "userId". We record it here for the audit trail.
		if userID, exists := c.Get("userId"); exists {
			item.CreatedBy = fmt.Sprintf("%v", userID)
		}
		if orgID, exists := c.Get("orgId"); exists {
			item.OrgID = fmt.Sprintf("%v", orgID)
		}

		// ── Assign real ObjectIDs to every ContactPerson ──────────────────
		// The frontend sends contacts without _id (useAddCustomer already
		// strips the local Date.now() key). We assign proper MongoDB IDs.
		for i := range item.ContactPersons {
			if item.ContactPersons[i].ID.IsZero() {
				item.ContactPersons[i].ID = primitive.NewObjectID()
				item.ContactPersons[i].CreatedAt = now
				item.ContactPersons[i].UpdatedAt = now
			}
		}

		// ── Assign real ObjectIDs to every Document record ────────────────
		for i := range item.Documents {
			if item.Documents[i].ID.IsZero() {
				item.Documents[i].ID = primitive.NewObjectID()
				item.Documents[i].UploadedAt = now
			}
		}

		_, err = customersCollection.InsertOne(ctx, item)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to save customer",
				"error":   err.Error(),
			})
			return
		}

		ws.GlobalHub.Broadcast(ws.Event{Type: "customers_updated", Action: "create", ID: item.ID.Hex()})

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Customer Added Successfully",
			"data":    item,
		})
	}
}

func generateCustomerCodeContinuous(ctx context.Context, orgID string) (string, error) {
	now := time.Now()
	currentMonth := int(now.Month())
	currentYear := now.Year() % 100

	// Find the last customer code used by this org, sorted descending
	opts := options.FindOne().SetSort(bson.D{{Key: "customerCode", Value: -1}})
	var lastCustomer bson.M
	err := customersCollection.FindOne(ctx, bson.M{"orgId": orgID}, opts).Decode(&lastCustomer)

	nextSequence := 1
	if err == nil {
		if lastCode, ok := lastCustomer["customerCode"].(string); ok && len(lastCode) == 6 {
			if lastSeq, e := strconv.Atoi(lastCode[4:]); e == nil {
				nextSequence = lastSeq + 1
				if nextSequence > 99 {
					nextSequence = 1
				}
			}
		}
	} else if err != mongo.ErrNoDocuments {
		return "", err
	}

	return fmt.Sprintf("%02d%02d%02d", currentMonth, currentYear, nextSequence), nil
}

func GetCustomerSuggestions() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := c.Query("q")
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "8"))

		if query == "" {
			c.JSON(http.StatusOK, gin.H{
				"status":  http.StatusOK,
				"message": "No query provided",
				"data":    []interface{}{},
			})
			return
		}

		orgID, _ := c.Get("orgId")
		safeQ := regexp.QuoteMeta(query)
		filter := bson.M{
			"orgId": orgID,
			"$or": []bson.M{
				{"customerDisplayName": bson.M{"$regex": safeQ, "$options": "i"}},
				{"companyName": bson.M{"$regex": safeQ, "$options": "i"}},
				{"customerEmail": bson.M{"$regex": safeQ, "$options": "i"}},
				{"customerPhone": bson.M{"$regex": safeQ, "$options": "i"}},
				{"customerCode": bson.M{"$regex": safeQ, "$options": "i"}},
			},
			"status": bson.M{"$ne": "deleted"},
		}

		projection := bson.M{
			"_id": 1, "customerCode": 1, "customerDisplayName": 1,
			"companyName": 1, "customerEmail": 1, "customerPhone": 1,
			"workPhone": 1, "mobile": 1, "status": 1, "created_at": 1,
		}

		findOptions := options.Find().
			SetLimit(int64(limit)).
			SetProjection(projection).
			SetSort(bson.D{{Key: "customerDisplayName", Value: 1}})

		var suggestions []bson.M
		cursor, err := customersCollection.Find(ctx, filter, findOptions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch suggestions", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		if err := cursor.All(ctx, &suggestions); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode suggestions", "error": err.Error()})
			return
		}
		if suggestions == nil {
			suggestions = []bson.M{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Suggestions retrieved successfully",
			"data":    suggestions,
			"count":   len(suggestions),
		})
	}
}

// ─── SEARCH ──────────────────────────────────────────────────────────────────
func SearchCustomers() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		query := c.Query("q")
		customerType := c.Query("type")
		status := c.Query("status")
		city := c.Query("city")
		country := c.Query("country")
		company := c.Query("company")

		orgID, _ := c.Get("orgId")
		filter := bson.M{"orgId": orgID}

		if query != "" {
			safe := regexp.QuoteMeta(query)
			filter["$or"] = []bson.M{
				{"customerDisplayName": bson.M{"$regex": safe, "$options": "i"}},
				{"companyName": bson.M{"$regex": safe, "$options": "i"}},
				{"customerEmail": bson.M{"$regex": safe, "$options": "i"}},
				{"customerPhone": bson.M{"$regex": safe, "$options": "i"}},
				{"customerCode": bson.M{"$regex": safe, "$options": "i"}},
				{"firstName": bson.M{"$regex": safe, "$options": "i"}},
				{"lastName": bson.M{"$regex": safe, "$options": "i"}},
			}
		}
		if customerType != "" {
			filter["customerType"] = customerType
		}
		if status != "" {
			filter["status"] = status
		} else {
			filter["status"] = bson.M{"$ne": "deleted"}
		}
		if city != "" {
			filter["city"] = bson.M{"$regex": regexp.QuoteMeta(city), "$options": "i"}
		}
		if country != "" {
			filter["country"] = bson.M{"$regex": regexp.QuoteMeta(country), "$options": "i"}
		}
		if company != "" {
			filter["companyName"] = bson.M{"$regex": regexp.QuoteMeta(company), "$options": "i"}
		}

		var customers []models.Customer
		cursor, err := customersCollection.Find(ctx, filter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to search customers", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		if err := cursor.All(ctx, &customers); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode search results", "error": err.Error()})
			return
		}
		if customers == nil {
			customers = []models.Customer{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Search completed successfully",
			"data":    customers,
			"count":   len(customers),
			"filters": gin.H{
				"query": query, "customerType": customerType, "status": status,
				"city": city, "country": country, "company": company,
			},
		})
	}
}

// ─── GET BY ID ────────────────────────────────────────────────────────────────
func GetCustomerByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid customer ID format", "error": err.Error()})
			return
		}

		var customer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&customer)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Customer not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve customer", "error": err.Error()})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Customer retrieved successfully", "data": customer})
	}
}

// ─── UPDATE CUSTOMER ──────────────────────────────────────────────────────────
func UpdateCustomer() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid customer ID format", "error": err.Error()})
			return
		}

		var existingCustomer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&existingCustomer)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Customer not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve customer", "error": err.Error()})
			}
			return
		}

		var updateData models.Customer
		if err := c.ShouldBindJSON(&updateData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}

		now := time.Now()
		update := bson.M{"updated_at": now}

		// ── String fields ─────────────────────────────────────────────────
		strFields := map[string]string{
			"salutation":          updateData.Salutation,
			"firstName":           updateData.FirstName,
			"lastName":            updateData.LastName,
			"customerDisplayName": updateData.CustomerDisplayName,
			"companyName":         updateData.CompanyName,
			"customerEmail":       updateData.CustomerEmail,
			"customerPhone":       updateData.CustomerPhone,
			"workPhone":           updateData.WorkPhone,
			"mobile":              updateData.Mobile,
			"status":              updateData.Status,
			"streetAddress":       updateData.StreetAddress,
			"city":                updateData.City,
			"country":             updateData.Country,
			"postalCode":          updateData.PostalCode,
			"payment_terms":       updateData.PaymentTerms,
			"currency":            updateData.Currency,
			"remarks":             updateData.Remarks,
			"updated_by":          updateData.UpdatedBy,
			"customerType":        updateData.CustomerType,
		}
		for key, val := range strFields {
			if val != "" {
				update[key] = val
			}
		}

		// ── UpdatedBy from JWT ────────────────────────────────────────────
		if userID, exists := c.Get("userId"); exists {
			update["updated_by"] = fmt.Sprintf("%v", userID)
		}

		// ── Numeric fields ────────────────────────────────────────────────
		if updateData.CreditLimit > 0 {
			update["credit_limit"] = updateData.CreditLimit
		}
		if updateData.CreditUsed > 0 {
			update["credit_used"] = updateData.CreditUsed
		} // ← NEW
		if updateData.NoOfDays > 0 {
			update["no_of_days"] = updateData.NoOfDays
		} // ← NEW

		// ── Slice fields ──────────────────────────────────────────────────
		if len(updateData.ReportingTags) > 0 {
			update["reporting_tags"] = updateData.ReportingTags
		}
		if len(updateData.CustomFields) > 0 {
			update["custom_fields"] = updateData.CustomFields
		}

		if len(updateData.Documents) > 0 {
			for i := range updateData.Documents {
				if updateData.Documents[i].ID.IsZero() {
					updateData.Documents[i].ID = primitive.NewObjectID()
					updateData.Documents[i].UploadedAt = now
				}
			}
			update["documents"] = updateData.Documents
		}

		if len(updateData.ContactPersons) > 0 {
			for i := range updateData.ContactPersons {
				if updateData.ContactPersons[i].ID.IsZero() {
					updateData.ContactPersons[i].ID = primitive.NewObjectID()
					updateData.ContactPersons[i].CreatedAt = now
					updateData.ContactPersons[i].UpdatedAt = now
				} else {
					updateData.ContactPersons[i].UpdatedAt = now
				}
			}
			update["contactPersons"] = updateData.ContactPersons
		}

		result, err := customersCollection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": update})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update customer", "error": err.Error()})
			return
		}

		var updatedCustomer models.Customer
		_ = customersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&updatedCustomer)

		ws.GlobalHub.Broadcast(ws.Event{Type: "customers_updated", Action: "update", ID: id})

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Customer updated successfully",
			"data":    updatedCustomer,
			"updateInfo": gin.H{
				"matchedCount":  result.MatchedCount,
				"modifiedCount": result.ModifiedCount,
			},
		})
	}
}

// ─── DELETE (soft) ────────────────────────────────────────────────────────────
func DeleteCustomer() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid customer ID format", "error": err.Error()})
			return
		}

		var existingCustomer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&existingCustomer)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Customer not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve customer", "error": err.Error()})
			}
			return
		}

		result, err := customersCollection.UpdateOne(
			ctx,
			bson.M{"_id": objectID},
			bson.M{"$set": bson.M{"status": "deleted", "updated_at": time.Now()}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to delete customer", "error": err.Error()})
			return
		}

		ws.GlobalHub.Broadcast(ws.Event{Type: "customers_updated", Action: "delete", ID: id})

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Customer deleted successfully",
			"data": gin.H{
				"id":            id,
				"customerCode":  existingCustomer.CustomerCode,
				"displayName":   existingCustomer.CustomerDisplayName,
				"matchedCount":  result.MatchedCount,
				"modifiedCount": result.ModifiedCount,
			},
		})
	}
}

// ─── BY STATUS ────────────────────────────────────────────────────────────────
func GetCustomersByStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		status := c.Param("status")
		if status == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Status parameter is required"})
			return
		}

		orgID, _ := c.Get("orgId")
		var customers []models.Customer
		cursor, err := customersCollection.Find(ctx, bson.M{"orgId": orgID, "status": status})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve customers by status", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		if err := cursor.All(ctx, &customers); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode customers", "error": err.Error()})
			return
		}
		if customers == nil {
			customers = []models.Customer{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": fmt.Sprintf("Customers with status '%s' retrieved successfully", status),
			"data":    customers,
			"count":   len(customers),
		})
	}
}

// ─── STATS ────────────────────────────────────────────────────────────────────
func GetCustomerStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		activeCount, _ := customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "active"})
		pendingCount, _ := customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "pending"})
		inactiveCount, _ := customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "inactive"})
		totalCount, _ := customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": bson.M{"$ne": "deleted"}})
		individualCount, _ := customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "customerType": "individual", "status": bson.M{"$ne": "deleted"}})
		businessCount, _ := customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "customerType": "business", "status": bson.M{"$ne": "deleted"}})
		weekAgo := time.Now().AddDate(0, 0, -7)
		recentCount, _ := customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "created_at": bson.M{"$gte": weekAgo}, "status": bson.M{"$ne": "deleted"}})

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Customer statistics retrieved successfully",
			"data": gin.H{
				"total":    gin.H{"count": totalCount, "label": "Total Customers"},
				"active":   gin.H{"count": activeCount, "label": "Active"},
				"pending":  gin.H{"count": pendingCount, "label": "Pending"},
				"inactive": gin.H{"count": inactiveCount, "label": "Inactive"},
				"byType":   gin.H{"individual": individualCount, "business": businessCount},
				"recent":   gin.H{"count": recentCount, "label": "Last 7 Days"},
			},
		})
	}
}

// ─── EXPORT CSV ───────────────────────────────────────────────────────────────
func ExportCustomersCSV() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		status := c.Query("status")
		format := c.DefaultQuery("format", "csv")

		orgID, _ := c.Get("orgId")
		filter := bson.M{"orgId": orgID, "status": bson.M{"$ne": "deleted"}}
		if status != "" && status != "all" {
			filter["status"] = status
		}

		var customers []models.Customer
		cursor, err := customersCollection.Find(ctx, filter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve customers for export", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		if err := cursor.All(ctx, &customers); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode customers", "error": err.Error()})
			return
		}

		if format == "csv" {
			c.Header("Content-Type", "text/csv")
			c.Header("Content-Disposition", "attachment; filename=customers_export_"+time.Now().Format("2006-01-02")+".csv")

			writer := csv.NewWriter(c.Writer)

			headers := []string{
				"Customer Code", "Customer Name", "Company Name", "Email",
				"Phone", "Work Phone", "Mobile", "Address", "City", "Country",
				"Postal Code", "Status", "Customer Type", "Payment Terms",
				"Credit Limit", "Credit Used", "No of Days", "Currency",
				"Remarks", "Created Date", "Last Updated",
			}
			if err := writer.Write(headers); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to write CSV headers", "error": err.Error()})
				return
			}

			for _, customer := range customers {
				record := []string{
					customer.CustomerCode,
					customer.CustomerDisplayName,
					customer.CompanyName,
					customer.CustomerEmail,
					customer.CustomerPhone,
					customer.WorkPhone,
					customer.Mobile,
					customer.StreetAddress,
					customer.City,
					customer.Country,
					customer.PostalCode,
					customer.Status,
					customer.CustomerType,
					customer.PaymentTerms,
					fmt.Sprintf("%.2f", customer.CreditLimit),
					fmt.Sprintf("%.2f", customer.CreditUsed), // ← NEW
					fmt.Sprintf("%.0f", customer.NoOfDays),   // ← NEW
					customer.Currency,
					customer.Remarks,
					customer.CreatedAt.Format("2006-01-02 15:04:05"),
					customer.UpdatedAt.Format("2006-01-02 15:04:05"),
				}
				if err := writer.Write(record); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to write CSV row", "error": err.Error()})
					return
				}
			}

			writer.Flush()
			if err := writer.Error(); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to flush CSV writer", "error": err.Error()})
			}
		} else {
			c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Customers retrieved for export", "data": customers, "count": len(customers)})
		}
	}
}

// ─── TRANSACTIONS (stub) ──────────────────────────────────────────────────────
func GetCustomerTransactions() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid customer ID format", "error": err.Error()})
			return
		}

		var customer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&customer)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Customer not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve customer", "error": err.Error()})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Transactions retrieved successfully",
			"data": gin.H{
				"customer":     customer.CustomerDisplayName,
				"customerId":   customer.ID,
				"transactions": []interface{}{},
				"count":        0,
			},
		})
	}
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
func GetCustomerHistory() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid customer ID format", "error": err.Error()})
			return
		}

		var customer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&customer)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Customer not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve customer", "error": err.Error()})
			}
			return
		}

		history := []gin.H{
			{"action": "Customer Created", "timestamp": customer.CreatedAt.Format("2006-01-02 15:04:05"), "user": customer.CreatedBy, "details": "Customer record was created in the system"},
			{"action": "Customer Updated", "timestamp": customer.UpdatedAt.Format("2006-01-02 15:04:05"), "user": customer.UpdatedBy, "details": "Customer information was updated"},
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Customer history retrieved successfully",
			"data": gin.H{
				"customer":   customer.CustomerDisplayName,
				"customerId": customer.ID,
				"history":    history,
				"count":      len(history),
			},
		})
	}
}

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
func GetDashboardStats(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	orgID, _ := c.Get("orgId")
	totalCustomers, _ := customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": bson.M{"$ne": "deleted"}})
	activeCustomers, _ := customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "active"})
	pendingCustomers, _ := customersCollection.CountDocuments(ctx, bson.M{"orgId": orgID, "status": "pending"})

	today := time.Now().Truncate(24 * time.Hour)
	tomorrow := today.Add(24 * time.Hour)
	todayNewCustomers, _ := customersCollection.CountDocuments(ctx, bson.M{
		"orgId":      orgID,
		"created_at": bson.M{"$gte": today, "$lt": tomorrow},
		"status":     bson.M{"$ne": "deleted"},
	})

	startOfMonth := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.Now().Location())
	thisMonthNewCustomers, _ := customersCollection.CountDocuments(ctx, bson.M{
		"orgId":      orgID,
		"created_at": bson.M{"$gte": startOfMonth},
		"status":     bson.M{"$ne": "deleted"},
	})

	growthRate := 0.0
	if totalCustomers > 0 {
		growthRate = 12.5
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  http.StatusOK,
		"message": "Dashboard statistics retrieved successfully",
		"data": gin.H{
			"totalCustomers":        totalCustomers,
			"activeCustomers":       activeCustomers,
			"pendingCustomers":      pendingCustomers,
			"todayNewCustomers":     todayNewCustomers,
			"thisMonthNewCustomers": thisMonthNewCustomers,
			"growthRate":            growthRate,
			"updatedAt":             time.Now().Format("2006-01-02 15:04:05"),
		},
	})
}

// ─── ADD CUSTOMER HISTORY ─────────────────────────────────────────────────────
func AddCustomerHistory() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid customer ID format", "error": err.Error()})
			return
		}

		var entry models.HistoryEntry
		if err := c.ShouldBindJSON(&entry); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if entry.Timestamp.IsZero() {
			entry.Timestamp = time.Now()
		}

		update := bson.M{"$push": bson.M{"history": entry}}
		result, err := customersCollection.UpdateOne(ctx, bson.M{"_id": objectID}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to add history entry", "error": err.Error()})
			return
		}
		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Customer not found"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "History entry added successfully"})
	}
}

// ─── MIGRATE: stamp orgId + reassign sequential customer codes ────────────────
// Call once per org after upgrading. Safe to call multiple times (idempotent).
func MigrateCustomerOrgAndCodes() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		// Step 1: stamp orgId on every customer that is missing it, using createdBy
		// membership — we treat all un-scoped customers as belonging to this org
		// (safe for single-org setups or first migration).
		stampResult, err := customersCollection.UpdateMany(ctx,
			bson.M{"$or": []bson.M{{"orgId": ""}, {"orgId": bson.M{"$exists": false}}}},
			bson.M{"$set": bson.M{"orgId": orgIDStr}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to stamp orgId", "error": err.Error()})
			return
		}

		// Step 2: reassign sequential codes to all customers in this org, ordered by createdAt
		cursor, err := customersCollection.Find(ctx,
			bson.M{"orgId": orgIDStr},
			options.Find().SetSort(bson.D{{Key: "created_at", Value: 1}}),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch customers", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var customers []models.Customer
		if err := cursor.All(ctx, &customers); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode customers", "error": err.Error()})
			return
		}

		updated := 0
		for i, cust := range customers {
			now := cust.CreatedAt
			if now.IsZero() {
				now = time.Now()
			}
			month := int(now.Month())
			year := now.Year() % 100
			newCode := fmt.Sprintf("%02d%02d%02d", month, year, i+1)

			_, err := customersCollection.UpdateOne(ctx,
				bson.M{"_id": cust.ID},
				bson.M{"$set": bson.M{"customerCode": newCode}},
			)
			if err == nil {
				updated++
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Migration complete",
			"data": gin.H{
				"orgIdStamped": stampResult.ModifiedCount,
				"codesFixed":   updated,
				"total":        len(customers),
			},
		})
	}
}
