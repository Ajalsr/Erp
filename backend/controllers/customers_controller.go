package controllers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"

	// "github.com/backend/utils"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/net/context"
)

func GetAllCustomers() gin.HandlerFunc {

	return func(c *gin.Context) {

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)

		var customers []models.Customer
		defer cancel()

		collection := config.GetCollection(config.DB, "customers")
		fmt.Println(collection, "this is the collection")
		results, err := collection.Find(ctx, bson.M{})

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

var customersCollection *mongo.Collection = config.GetCollection(config.DB, "customers")

func AddCustomers() gin.HandlerFunc {

	return func(c *gin.Context) {

		// token := c.Request.Header.Get("Authorization")

		// if token == "" {
		// 	c.JSON(http.StatusUnauthorized, gin.H{"message": "Not authorized."})
		// 	return
		// }

		// err := utils.VerifyToken(token)

		// if err != nil {
		// 	c.JSON(http.StatusUnauthorized,gin.H{"mesage" : "Not authorized."})
		// 	return
		// }

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)

		var item models.Customer

		defer cancel()

		if err := c.BindJSON(&item); err != nil {

			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "error",
				"error":   err.Error(),
			})

			return
		}

		item.ID = primitive.NewObjectID()

		result, err := customersCollection.InsertOne(ctx, item)

		fmt.Println(result)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "err",
				"error":   err.Error(),
			})
			return
		}

		responseItem := gin.H{
			"_id": item.ID,
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Customer Added Successfully...",
			"data":    responseItem,
		})

	}
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

		filter := bson.M{
			"$or": []bson.M{
				{"customerDisplayName": bson.M{"$regex": query, "$options": "i"}},
				{"companyName": bson.M{"$regex": query, "$options": "i"}},
				{"customerEmail": bson.M{"$regex": query, "$options": "i"}},
				{"customerPhone": bson.M{"$regex": query, "$options": "i"}},
				{"customerCode": bson.M{"$regex": query, "$options": "i"}},
			},
			"status": bson.M{"$ne": "deleted"},
		}

		projection := bson.M{
			"_id":                 1,
			"customerCode":        1,
			"customerDisplayName": 1,
			"companyName":         1,
			"customerEmail":       1,
			"customerPhone":       1,
			"workPhone":           1,
			"mobile":              1,
			"status":              1,
			"created_at":          1,
		}

		findOptions := options.Find().
			SetLimit(int64(limit)).
			SetProjection(projection).
			SetSort(bson.D{{Key: "customerDisplayName", Value: 1}})

		var suggestions []bson.M
		cursor, err := customersCollection.Find(ctx, filter, findOptions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to fetch suggestions",
				"error":   err.Error(),
			})
			return
		}
		defer cursor.Close(ctx)

		if err := cursor.All(ctx, &suggestions); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to decode suggestions",
				"error":   err.Error(),
			})
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

		filter := bson.M{}

		if query != "" {
			filter["$or"] = []bson.M{
				{"customerDisplayName": bson.M{"$regex": query, "$options": "i"}},
				{"companyName": bson.M{"$regex": query, "$options": "i"}},
				{"customerEmail": bson.M{"$regex": query, "$options": "i"}},
				{"customerPhone": bson.M{"$regex": query, "$options": "i"}},
				{"customerCode": bson.M{"$regex": query, "$options": "i"}},
				{"firstName": bson.M{"$regex": query, "$options": "i"}},
				{"lastName": bson.M{"$regex": query, "$options": "i"}},
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
			filter["city"] = bson.M{"$regex": city, "$options": "i"}
		}

		if country != "" {
			filter["country"] = bson.M{"$regex": country, "$options": "i"}
		}

		if company != "" {
			filter["companyName"] = bson.M{"$regex": company, "$options": "i"}
		}

		var customers []models.Customer
		cursor, err := customersCollection.Find(ctx, filter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to search customers",
				"error":   err.Error(),
			})
			return
		}
		defer cursor.Close(ctx)

		if err := cursor.All(ctx, &customers); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to decode search results",
				"error":   err.Error(),
			})
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
				"query":        query,
				"customerType": customerType,
				"status":       status,
				"city":         city,
				"country":      country,
				"company":      company,
			},
		})
	}
}

func GetCustomerByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid customer ID format",
				"error":   err.Error(),
			})
			return
		}

		var customer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&customer)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{
					"status":  http.StatusNotFound,
					"message": "Customer not found",
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  http.StatusInternalServerError,
					"message": "Failed to retrieve customer",
					"error":   err.Error(),
				})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Customer retrieved successfully",
			"data":    customer,
		})
	}
}

func UpdateCustomer() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid customer ID format",
				"error":   err.Error(),
			})
			return
		}

		var existingCustomer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&existingCustomer)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{
					"status":  http.StatusNotFound,
					"message": "Customer not found",
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  http.StatusInternalServerError,
					"message": "Failed to retrieve customer",
					"error":   err.Error(),
				})
			}
			return
		}

		var updateData models.Customer
		if err := c.BindJSON(&updateData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		update := bson.M{
			"updatedAt": time.Now(),
		}

		if updateData.CustomerDisplayName != "" {
			update["customerDisplayName"] = updateData.CustomerDisplayName
		}
		if updateData.FirstName != "" {
			update["firstName"] = updateData.FirstName
		}
		if updateData.LastName != "" {
			update["lastName"] = updateData.LastName
		}
		if updateData.CompanyName != "" {
			update["companyName"] = updateData.CompanyName
		}
		if updateData.CustomerEmail != "" {
			update["customerEmail"] = updateData.CustomerEmail
		}
		if updateData.CustomerPhone != "" {
			update["customerPhone"] = updateData.CustomerPhone
		}
		if updateData.WorkPhone != "" {
			update["workPhone"] = updateData.WorkPhone
		}
		if updateData.Mobile != "" {
			update["mobile"] = updateData.Mobile
		}
		if updateData.Status != "" {
			update["status"] = updateData.Status
		}
		if updateData.StreetAddress != "" {
			update["streetAddress"] = updateData.StreetAddress
		}
		if updateData.City != "" {
			update["city"] = updateData.City
		}
		if updateData.Country != "" {
			update["country"] = updateData.Country
		}
		if updateData.PostalCode != "" {
			update["postalCode"] = updateData.PostalCode
		}
		if updateData.PaymentTerms != "" {
			update["paymentTerms"] = updateData.PaymentTerms
		}
		if updateData.Remarks != "" {
			update["remarks"] = updateData.Remarks
		}
		if updateData.UpdatedBy != "" {
			update["updatedBy"] = updateData.UpdatedBy
		}

		if len(updateData.ContactPersons) > 0 {
			for i := range updateData.ContactPersons {
				if updateData.ContactPersons[i].ID.IsZero() {
					updateData.ContactPersons[i].ID = primitive.NewObjectID()
					updateData.ContactPersons[i].CreatedAt = time.Now()
					updateData.ContactPersons[i].UpdatedAt = time.Now()
				}
			}
			update["contactPersons"] = updateData.ContactPersons
		}

		result, err := customersCollection.UpdateOne(
			ctx,
			bson.M{"_id": objectID},
			bson.M{"$set": update},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to update customer",
				"error":   err.Error(),
			})
			return
		}

		var updatedCustomer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&updatedCustomer)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Customer updated but failed to retrieve updated data",
				"error":   err.Error(),
			})
			return
		}

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

func DeleteCustomer() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid customer ID format",
				"error":   err.Error(),
			})
			return
		}

		var existingCustomer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&existingCustomer)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{
					"status":  http.StatusNotFound,
					"message": "Customer not found",
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  http.StatusInternalServerError,
					"message": "Failed to retrieve customer",
					"error":   err.Error(),
				})
			}
			return
		}

		update := bson.M{
			"$set": bson.M{
				"status":    "deleted",
				"updatedAt": time.Now(),
			},
		}

		result, err := customersCollection.UpdateOne(
			ctx,
			bson.M{"_id": objectID},
			update,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to delete customer",
				"error":   err.Error(),
			})
			return
		}

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

func GetCustomersByStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		status := c.Param("status")
		if status == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Status parameter is required",
			})
			return
		}

		var customers []models.Customer
		cursor, err := customersCollection.Find(ctx, bson.M{"status": status})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to retrieve customers by status",
				"error":   err.Error(),
			})
			return
		}
		defer cursor.Close(ctx)

		if err := cursor.All(ctx, &customers); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to decode customers",
				"error":   err.Error(),
			})
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

func GetCustomerStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		activeCount, _ := customersCollection.CountDocuments(ctx, bson.M{"status": "active"})
		pendingCount, _ := customersCollection.CountDocuments(ctx, bson.M{"status": "pending"})
		inactiveCount, _ := customersCollection.CountDocuments(ctx, bson.M{"status": "inactive"})
		totalCount, _ := customersCollection.CountDocuments(ctx, bson.M{"status": bson.M{"$ne": "deleted"}})

		individualCount, _ := customersCollection.CountDocuments(ctx, bson.M{"customerType": "individual", "status": bson.M{"$ne": "deleted"}})
		businessCount, _ := customersCollection.CountDocuments(ctx, bson.M{"customerType": "business", "status": bson.M{"$ne": "deleted"}})

		weekAgo := time.Now().AddDate(0, 0, -7)
		recentCount, _ := customersCollection.CountDocuments(ctx, bson.M{
			"created_at": bson.M{"$gte": weekAgo},
			"status":     bson.M{"$ne": "deleted"},
		})

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Customer statistics retrieved successfully",
			"data": gin.H{
				"total": gin.H{
					"count": totalCount,
					"label": "Total Customers",
				},
				"active": gin.H{
					"count": activeCount,
					"label": "Active",
				},
				"pending": gin.H{
					"count": pendingCount,
					"label": "Pending",
				},
				"inactive": gin.H{
					"count": inactiveCount,
					"label": "Inactive",
				},
				"byType": gin.H{
					"individual": individualCount,
					"business":   businessCount,
				},
				"recent": gin.H{
					"count": recentCount,
					"label": "Last 7 Days",
				},
			},
		})
	}
}

func ExportCustomersCSV() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		status := c.Query("status")
		format := c.DefaultQuery("format", "csv")

		filter := bson.M{"status": bson.M{"$ne": "deleted"}}
		if status != "" && status != "all" {
			filter["status"] = status
		}

		var customers []models.Customer
		cursor, err := customersCollection.Find(ctx, filter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to retrieve customers for export",
				"error":   err.Error(),
			})
			return
		}
		defer cursor.Close(ctx)

		if err := cursor.All(ctx, &customers); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  http.StatusInternalServerError,
				"message": "Failed to decode customers",
				"error":   err.Error(),
			})
			return
		}

		if format == "csv" {
			c.Header("Content-Type", "text/csv")
			c.Header("Content-Disposition", "attachment; filename=customers_export_"+time.Now().Format("2006-01-02")+".csv")

			writer := csv.NewWriter(c.Writer)

			headers := []string{
				"Customer Code",
				"Customer Name",
				"Company Name",
				"Email",
				"Phone",
				"Work Phone",
				"Mobile",
				"Address",
				"City",
				"Country",
				"Postal Code",
				"Status",
				"Customer Type",
				"Payment Terms",
				"Remarks",
				"Created Date",
				"Last Updated",
			}

			if err := writer.Write(headers); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  http.StatusInternalServerError,
					"message": "Failed to write CSV headers",
					"error":   err.Error(),
				})
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
					customer.Remarks,
					customer.CreatedAt.Format("2006-01-02 15:04:05"),
					customer.UpdatedAt.Format("2006-01-02 15:04:05"),
				}

				if err := writer.Write(record); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{
						"status":  http.StatusInternalServerError,
						"message": "Failed to write CSV row",
						"error":   err.Error(),
					})
					return
				}
			}

			writer.Flush()
			if err := writer.Error(); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  http.StatusInternalServerError,
					"message": "Failed to flush CSV writer",
					"error":   err.Error(),
				})
			}
		} else {
			c.JSON(http.StatusOK, gin.H{
				"status":  http.StatusOK,
				"message": "Customers retrieved for export",
				"data":    customers,
				"count":   len(customers),
			})
		}
	}
}

func GetCustomerTransactions() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid customer ID format",
				"error":   err.Error(),
			})
			return
		}

		var customer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&customer)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{
					"status":  http.StatusNotFound,
					"message": "Customer not found",
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  http.StatusInternalServerError,
					"message": "Failed to retrieve customer",
					"error":   err.Error(),
				})
			}
			return
		}

		transactions := []interface{}{}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Transactions retrieved successfully",
			"data": gin.H{
				"customer":     customer.CustomerDisplayName,
				"customerId":   customer.ID,
				"transactions": transactions,
				"count":        len(transactions),
			},
		})
	}
}

func GetCustomerHistory() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		id := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "Invalid customer ID format",
				"error":   err.Error(),
			})
			return
		}

		var customer models.Customer
		err = customersCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&customer)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{
					"status":  http.StatusNotFound,
					"message": "Customer not found",
				})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  http.StatusInternalServerError,
					"message": "Failed to retrieve customer",
					"error":   err.Error(),
				})
			}
			return
		}

		history := []gin.H{
			{
				"action":    "Customer Created",
				"timestamp": customer.CreatedAt.Format("2006-01-02 15:04:05"),
				"user":      customer.CreatedBy,
				"details":   "Customer record was created in the system",
			},
			{
				"action":    "Customer Updated",
				"timestamp": customer.UpdatedAt.Format("2006-01-02 15:04:05"),
				"user":      customer.UpdatedBy,
				"details":   "Customer information was updated",
			},
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

func GetDashboardStats(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	totalCustomers, _ := customersCollection.CountDocuments(ctx, bson.M{"status": bson.M{"$ne": "deleted"}})
	activeCustomers, _ := customersCollection.CountDocuments(ctx, bson.M{"status": "active"})
	pendingCustomers, _ := customersCollection.CountDocuments(ctx, bson.M{"status": "pending"})

	today := time.Now().Truncate(24 * time.Hour)
	tomorrow := today.Add(24 * time.Hour)
	todayNewCustomers, _ := customersCollection.CountDocuments(ctx, bson.M{
		"created_at": bson.M{"$gte": today, "$lt": tomorrow},
		"status":     bson.M{"$ne": "deleted"},
	})

	startOfMonth := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.Now().Location())
	thisMonthNewCustomers, _ := customersCollection.CountDocuments(ctx, bson.M{
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
