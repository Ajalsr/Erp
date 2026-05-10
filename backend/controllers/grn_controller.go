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

		// ── Update stock: increase actual qty, decrease quantity_ordered ──
		stockCol := config.GetCollection(config.DB, "stocks")
		for _, item := range g.Items {
			if item.ItemID == "" {
				continue
			}
			itemObjID, err := primitive.ObjectIDFromHex(item.ItemID)
			if err != nil {
				continue
			}
			// Fetch current quantity string and convert to float
			var stockDoc struct {
				Quantity string `bson:"quantity"`
			}
			if fetchErr := stockCol.FindOne(ctx, bson.M{"_id": itemObjID, "orgId": orgIDStr}).Decode(&stockDoc); fetchErr == nil {
				currentQty := 0.0
				fmt.Sscanf(stockDoc.Quantity, "%f", &currentQty)
				newQty := currentQty + item.ReceivedQty
				stockCol.UpdateOne(ctx,
					bson.M{"_id": itemObjID, "orgId": orgIDStr},
					bson.M{
						"$set": bson.M{
							"quantity":   fmt.Sprintf("%g", newQty),
							"updated_at": time.Now(),
						},
						"$inc": bson.M{"quantity_ordered": -item.ReceivedQty},
					},
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
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if search := c.Query("search"); search != "" {
			filter["$or"] = bson.A{
				bson.M{"grnNumber":  bson.M{"$regex": search, "$options": "i"}},
				bson.M{"vendorName": bson.M{"$regex": search, "$options": "i"}},
				bson.M{"poNumber":   bson.M{"$regex": search, "$options": "i"}},
			}
		}

		page, limit := 1, 20
		if p := c.Query("page"); p != "" {
			fmt.Sscanf(p, "%d", &page)
		}
		if l := c.Query("limit"); l != "" {
			fmt.Sscanf(l, "%d", &limit)
		}
		if page < 1 { page = 1 }
		if limit < 1 { limit = 20 }
		skip := int64((page - 1) * limit)

		total, _ := grnCollection.CountDocuments(ctx, filter)

		opts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetSkip(skip).
			SetLimit(int64(limit))
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

		c.JSON(http.StatusOK, gin.H{"status": 200, "message": "GRNs retrieved", "data": gin.H{
			"grns":  grns,
			"total": total,
		}})
	}
}

func GetGRNStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		base := bson.M{"orgId": orgIDStr}
		count := func(extra bson.M) int64 {
			f := bson.M{"orgId": orgIDStr}
			for k, v := range extra { f[k] = v }
			n, _ := grnCollection.CountDocuments(ctx, f)
			return n
		}
		total, _     := grnCollection.CountDocuments(ctx, base)
		pending      := count(bson.M{"status": "pending"})
		confirmed    := count(bson.M{"status": "confirmed"})
		invoiced     := count(bson.M{"status": "invoiced"})

		c.JSON(http.StatusOK, gin.H{"status": 200, "message": "GRN stats", "data": gin.H{
			"total":     total,
			"pending":   pending,
			"confirmed": confirmed,
			"invoiced":  invoiced,
		}})
	}
}

func UpdateGRN() gin.HandlerFunc {
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

		var body struct {
			Status string `json:"status"`
			Notes  string `json:"notes"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": 400, "message": "Invalid request body"})
			return
		}

		set := bson.M{"updatedAt": time.Now()}
		if body.Status != "" { set["status"] = body.Status }
		if body.Notes != ""  { set["notes"]  = body.Notes  }

		result, err := grnCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": set},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": 404, "message": "GRN not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": 200, "message": "GRN updated"})
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
