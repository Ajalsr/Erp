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

var vendorCreditCollection *mongo.Collection = config.GetCollection(config.DB, "vendor_credits")

func generateCreditNumber(orgID string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	return nextNumber(ctx, orgID, "vendor_credit", vendorCreditCollection, "creditNumber")
}

func CreateVendorCredit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var cr models.VendorCredit
		if err := c.ShouldBindJSON(&cr); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if cr.VendorID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Vendor is required"})
			return
		}

		cr.ID = primitive.NewObjectID()
		cr.OrgID = orgIDStr
		cr.CreatedAt = time.Now()
		cr.UpdatedAt = time.Now()
		if userID != nil {
			cr.CreatedBy = fmt.Sprintf("%v", userID)
		}
		if cr.CreditNumber == "" {
			cr.CreditNumber = generateCreditNumber(orgIDStr)
		}
		if cr.Status == "" {
			cr.Status = "open"
		}
		if cr.Date == "" {
			cr.Date = time.Now().Format("2006-01-02")
		}

		if _, err := vendorCreditCollection.InsertOne(ctx, cr); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create vendor credit", "error": err.Error()})
			return
		}

		// Push history + increment creditAvailable on vendor
		if cr.VendorID != "" {
			if vObjID, err := primitive.ObjectIDFromHex(cr.VendorID); err == nil {
				histEntry := bson.M{
					"action":    "credit_received",
					"timestamp": time.Now(),
					"user":      cr.CreatedBy,
					"details":   fmt.Sprintf("Vendor credit %s received. Amount: AED %.2f (incl. VAT: AED %.2f)", cr.CreditNumber, cr.Totals.GrandTotal, cr.Totals.TaxTotal),
				}
				vendorCollection.UpdateOne(ctx,
					bson.M{"_id": vObjID, "orgId": orgIDStr},
					bson.M{
						"$inc":  bson.M{"creditAvailable": cr.Totals.GrandTotal},
						"$push": bson.M{"history": histEntry},
						"$set":  bson.M{"updatedAt": time.Now()},
					},
				)
			}
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Vendor credit created successfully",
			"data":    gin.H{"id": cr.ID.Hex(), "creditNumber": cr.CreditNumber},
		})
	}
}

func GetAllVendorCredits() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		filter := bson.M{"orgId": orgID}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if vid := c.Query("vendorId"); vid != "" {
			filter["vendorId"] = vid
		}
		if bid := c.Query("billId"); bid != "" {
			filter["billId"] = bid
		}

		total, _ := vendorCreditCollection.CountDocuments(ctx, filter)

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := vendorCreditCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch vendor credits"})
			return
		}
		defer cursor.Close(ctx)

		var credits []models.VendorCredit
		if err := cursor.All(ctx, &credits); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode credits"})
			return
		}
		if credits == nil {
			credits = []models.VendorCredit{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Vendor credits retrieved successfully",
			"data":    gin.H{"credits": credits, "total": total},
		})
	}
}

func GetVendorCreditByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid credit ID"})
			return
		}

		var cr models.VendorCredit
		err = vendorCreditCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&cr)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Vendor credit not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve credit"})
			}
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor credit retrieved", "data": cr})
	}
}

// ApplyVendorCredit applies a credit note to a bill, reducing its balance due.
func ApplyVendorCredit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")
		userIDStr := fmt.Sprintf("%v", userID)

		id := c.Param("id")
		crObjID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid credit ID"})
			return
		}

		var body struct {
			BillID string `json:"billId"`
		}
		c.ShouldBindJSON(&body)

		// Fetch credit
		var cr models.VendorCredit
		err = vendorCreditCollection.FindOne(ctx, bson.M{"_id": crObjID, "orgId": orgIDStr}).Decode(&cr)
		if err != nil || cr.Status != "open" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Credit not found or already applied/void"})
			return
		}

		if body.BillID == "" {
			body.BillID = cr.BillID
		}
		if body.BillID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "No bill linked to this credit. Please link a bill before applying."})
			return
		}

		billObjID, err := primitive.ObjectIDFromHex(body.BillID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid bill ID"})
			return
		}
		var b models.Bill
		err = billCollection.FindOne(ctx, bson.M{"_id": billObjID, "orgId": orgIDStr}).Decode(&b)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Bill not found"})
			return
		}

		// Block applying credit to a paid / fully-settled bill — credit should apply
		// to a bill with an outstanding balance, else amountPaid overshoots the total.
		if b.Status == "paid" || b.BalanceDue <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  http.StatusBadRequest,
				"message": "This bill has no outstanding balance. The credit stays available against this vendor — apply it to an open bill instead.",
				"code":    "BILL_ALREADY_PAID",
			})
			return
		}

		creditAmt  := cr.Totals.GrandTotal
		vatReversed := cr.Totals.TaxTotal

		// Update bill balance — cap amountPaid at the grand total so a credit larger
		// than the remaining balance does not push "Paid X of Y" past Y.
		newPaid    := b.AmountPaid + creditAmt
		newBalance := b.Totals.GrandTotal - newPaid
		if newBalance < 0 {
			newBalance = 0
			newPaid    = b.Totals.GrandTotal
		}
		newBillStatus := "partial"
		if newBalance <= 0 { newBillStatus = "paid" }

		billCollection.UpdateOne(ctx, bson.M{"_id": billObjID, "orgId": orgIDStr}, bson.M{
			"$set": bson.M{
				"amountPaid": newPaid,
				"balanceDue": newBalance,
				"status":     newBillStatus,
				"updatedAt":  time.Now(),
			},
		})

		// Mark credit as applied
		vendorCreditCollection.UpdateOne(ctx, bson.M{"_id": crObjID, "orgId": orgIDStr}, bson.M{
			"$set": bson.M{
				"status":     "applied",
				"billId":     body.BillID,
				"billNumber": b.BillNumber,
				"updatedAt":  time.Now(),
			},
		})

		// Update vendor: decrement outstandingPayable, decrement creditAvailable, push history
		if cr.VendorID != "" {
			if vObjID, err2 := primitive.ObjectIDFromHex(cr.VendorID); err2 == nil {
				vatNote := ""
				if vatReversed > 0 {
					vatNote = fmt.Sprintf(" (VAT reversed: AED %.2f)", vatReversed)
				}
				histEntry := bson.M{
					"action":    "credit_applied",
					"timestamp": time.Now(),
					"user":      userIDStr,
					"details":   fmt.Sprintf("Credit %s applied to Bill %s. Amount: AED %.2f%s. Bill status: %s.", cr.CreditNumber, b.BillNumber, creditAmt, vatNote, newBillStatus),
				}
				vendorCollection.UpdateOne(ctx,
					bson.M{"_id": vObjID, "orgId": orgIDStr},
					bson.M{
						"$inc":  bson.M{"outstandingPayable": -creditAmt, "creditAvailable": -creditAmt},
						"$push": bson.M{"history": histEntry},
						"$set":  bson.M{"updatedAt": time.Now()},
					},
				)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Vendor credit applied successfully",
			"data": gin.H{
				"creditApplied":  creditAmt,
				"vatReversed":    vatReversed,
				"billBalanceDue": newBalance,
				"billStatus":     newBillStatus,
			},
		})
	}
}

// UnapplyVendorCredit reverses ApplyVendorCredit: detaches a credit from its bill,
// restores the bill balance, and frees the credit back to "open". Needed so a settled
// bill can be unwound (e.g. before voiding).
func UnapplyVendorCredit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")
		userIDStr := fmt.Sprintf("%v", userID)

		crObjID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid credit ID"})
			return
		}

		var cr models.VendorCredit
		if err = vendorCreditCollection.FindOne(ctx, bson.M{"_id": crObjID, "orgId": orgIDStr}).Decode(&cr); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Credit not found"})
			return
		}
		if cr.Status != "applied" || cr.BillID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Credit is not applied to a bill"})
			return
		}

		creditAmt := cr.Totals.GrandTotal

		// Restore the bill balance
		if billObjID, err2 := primitive.ObjectIDFromHex(cr.BillID); err2 == nil {
			var b models.Bill
			if billCollection.FindOne(ctx, bson.M{"_id": billObjID, "orgId": orgIDStr}).Decode(&b) == nil {
				newPaid := round2(b.AmountPaid - creditAmt)
				if newPaid < 0 {
					newPaid = 0
				}
				newBalance := round2(b.Totals.GrandTotal - newPaid)
				newStatus := "open"
				if newPaid > 0 {
					newStatus = "partial"
				}
				billCollection.UpdateOne(ctx, bson.M{"_id": billObjID, "orgId": orgIDStr}, bson.M{
					"$set": bson.M{"amountPaid": newPaid, "balanceDue": newBalance, "status": newStatus, "updatedAt": time.Now()},
				})
			}
		}

		// Free the credit back to open
		vendorCreditCollection.UpdateOne(ctx, bson.M{"_id": crObjID, "orgId": orgIDStr}, bson.M{
			"$set":   bson.M{"status": "open", "updatedAt": time.Now()},
			"$unset": bson.M{"billId": "", "billNumber": ""},
		})

		// Restore vendor: payable goes back up, credit becomes available again
		if cr.VendorID != "" {
			if vObjID, err2 := primitive.ObjectIDFromHex(cr.VendorID); err2 == nil {
				histEntry := bson.M{
					"action":    "credit_unapplied",
					"timestamp": time.Now(),
					"user":      userIDStr,
					"details":   fmt.Sprintf("Credit %s unapplied from Bill %s. Amount restored: AED %.2f", cr.CreditNumber, cr.BillNumber, creditAmt),
				}
				vendorCollection.UpdateOne(ctx,
					bson.M{"_id": vObjID, "orgId": orgIDStr},
					bson.M{
						"$inc":  bson.M{"outstandingPayable": creditAmt, "creditAvailable": creditAmt},
						"$push": bson.M{"history": histEntry},
						"$set":  bson.M{"updatedAt": time.Now()},
					},
				)
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor credit unapplied", "data": gin.H{"creditRestored": creditAmt}})
	}
}

func VoidVendorCredit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid credit ID"})
			return
		}

		var cr models.VendorCredit
		if err2 := vendorCreditCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr, "status": "open"}).Decode(&cr); err2 != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Credit not found or cannot be voided"})
			return
		}

		vendorCreditCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": bson.M{"status": "void", "updatedAt": time.Now()}},
		)

		// Reverse the creditAvailable on vendor + push history
		if cr.VendorID != "" {
			if vObjID, err2 := primitive.ObjectIDFromHex(cr.VendorID); err2 == nil {
				histEntry := bson.M{
					"action":    "credit_voided",
					"timestamp": time.Now(),
					"details":   fmt.Sprintf("Credit %s voided. Amount reversed: AED %.2f", cr.CreditNumber, cr.Totals.GrandTotal),
				}
				vendorCollection.UpdateOne(ctx,
					bson.M{"_id": vObjID, "orgId": orgIDStr},
					bson.M{
						"$inc":  bson.M{"creditAvailable": -cr.Totals.GrandTotal},
						"$push": bson.M{"history": histEntry},
						"$set":  bson.M{"updatedAt": time.Now()},
					},
				)
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Vendor credit voided"})
	}
}

func GetVendorCreditStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")

		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"orgId": orgID}}},
			{{Key: "$group", Value: bson.M{
				"_id":        "$status",
				"count":      bson.M{"$sum": 1},
				"grandTotal": bson.M{"$sum": "$totals.grandTotal"},
			}}},
		}

		cursor, _ := vendorCreditCollection.Aggregate(ctx, pipeline)
		var results []bson.M
		if cursor != nil {
			cursor.All(ctx, &results)
		}

		byStatus := map[string]gin.H{}
		openTotal := 0.0

		for _, r := range results {
			status, _ := r["_id"].(string)
			count, _ := r["count"].(int32)
			total, _ := r["grandTotal"].(float64)
			byStatus[status] = gin.H{"count": count, "grandTotal": total}
			if status == "open" {
				openTotal = total
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"byStatus":  byStatus,
				"openTotal": openTotal,
			},
		})
	}
}
