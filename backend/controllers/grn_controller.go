package controllers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var grnCollection *mongo.Collection = config.GetCollection(config.DB, "grns")

func CreateGRN() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		var g models.GRN
		if err := c.ShouldBindJSON(&g); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if g.VendorID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Vendor is required"})
			return
		}

		g.ID = primitive.NewObjectID()
		g.OrgID = orgIDStr
		g.CreatedAt = time.Now()
		g.UpdatedAt = time.Now()
		if userID != nil {
			g.CreatedBy = fmt.Sprintf("%v", userID)
		}
		if g.Status == "" {
			g.Status = "confirmed"
		}
		if g.GRNNumber == "" {
			g.GRNNumber = fmt.Sprintf("GRN-%06d", time.Now().UnixNano()%1000000)
		}
		if g.ReceiptDate.IsZero() {
			g.ReceiptDate = time.Now()
		}

		// Recalculate totals server-side from items
		subTotal := 0.0
		totalTax := 0.0
		for i, item := range g.Items {
			base := item.ReceivedQty * item.Rate
			tax := base * 0.05
			lineTotal := base + tax
			g.Items[i].BaseAmount = base
			g.Items[i].TaxAmount = tax
			g.Items[i].LineTotal = lineTotal
			subTotal += base
			totalTax += tax
		}
		g.SubTotal = subTotal
		g.TotalTax = totalTax
		g.Total = subTotal + totalTax

		if _, err := grnCollection.InsertOne(ctx, g); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create GRN", "error": err.Error()})
			return
		}

		// Mark the linked PO as received
		if g.PurchaseOrderID != "" {
			if poObjID, err := primitive.ObjectIDFromHex(g.PurchaseOrderID); err == nil {
				purchaseOrderCollection.UpdateOne(ctx,
					bson.M{"_id": poObjID, "orgId": orgIDStr},
					bson.M{"$set": bson.M{"status": "received", "updatedAt": time.Now()}},
				)
			}
		}

		// Push vendor history entry
		if g.VendorID != "" {
			histEntry := bson.M{
				"action":    "grn_received",
				"timestamp": time.Now(),
				"user":      g.CreatedBy,
				"details":   fmt.Sprintf("Goods received via %s (PO: %s). Total: AED %.2f", g.GRNNumber, g.PONumber, g.Total),
			}
			if vObjID, err := primitive.ObjectIDFromHex(g.VendorID); err == nil {
				vendorCollection.UpdateOne(ctx,
					bson.M{"_id": vObjID, "orgId": orgIDStr},
					bson.M{
						"$push": bson.M{"history": histEntry},
						"$set":  bson.M{"updatedAt": time.Now()},
					},
				)
			}
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "GRN created successfully",
			"data":    gin.H{"id": g.ID.Hex(), "grnNumber": g.GRNNumber, "total": g.Total},
		})
	}
}

func GetAllGRNs() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if vid := c.Query("vendorId"); vid != "" {
			filter["vendorId"] = vid
		}
		if pid := c.Query("purchaseOrderId"); pid != "" {
			filter["purchaseOrderId"] = pid
		}

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := grnCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "message": "Failed to fetch GRNs"})
			return
		}
		defer cursor.Close(ctx)

		var grns []models.GRN
		cursor.All(ctx, &grns)
		if grns == nil {
			grns = []models.GRN{}
		}

		c.JSON(http.StatusOK, gin.H{"status": 200, "message": "GRNs retrieved", "data": grns})
	}
}

func GetGRNByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": 400, "message": "Invalid GRN ID"})
			return
		}

		var g models.GRN
		err = grnCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&g)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": 404, "message": "GRN not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "message": "Failed to retrieve GRN"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": 200, "message": "GRN retrieved", "data": g})
	}
}
