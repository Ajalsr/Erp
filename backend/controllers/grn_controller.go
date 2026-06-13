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

func grnTaxRate(origin string) float64 {
	o := normaliseOrigin(origin)
	if o == "free_zone" || o == "overseas" {
		return 0.0
	}
	return 0.05
}

func generateGRNNumber(ctx context.Context, orgID string) string {
	return nextNumber(ctx, orgID, "grn", grnCollection, "grnNumber")
}

// computeGRNCharges recomputes each charge's tax + total server-side and returns the
// cleaned slice plus the combined charges total. Assigns a fresh id to new charges.
func computeGRNCharges(charges []models.GRNCharge) ([]models.GRNCharge, float64) {
	total := 0.0
	for i := range charges {
		if charges[i].ID.IsZero() {
			charges[i].ID = primitive.NewObjectID()
		}
		charges[i].TaxAmount = round2(charges[i].Amount * charges[i].TaxRate / 100)
		charges[i].Total = round2(charges[i].Amount + charges[i].TaxAmount)
		total += charges[i].Total
	}
	return charges, round2(total)
}

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

		// Prevent duplicate draft/pending GRNs for the same PO
		if g.PurchaseOrderID != "" {
			existing, _ := grnCollection.CountDocuments(ctx, bson.M{
				"orgId":           orgIDStr,
				"purchaseOrderId": g.PurchaseOrderID,
				"status":          bson.M{"$in": []string{"draft", "pending"}},
			})
			if existing > 0 {
				// Return the existing draft GRN id so frontend can navigate to it
				var existingGRN struct {
					ID        interface{} `bson:"_id"`
					GRNNumber string      `bson:"grnNumber"`
				}
				grnCollection.FindOne(ctx, bson.M{
					"orgId":           orgIDStr,
					"purchaseOrderId": g.PurchaseOrderID,
					"status":          bson.M{"$in": []string{"draft", "pending"}},
				}).Decode(&existingGRN)
				existingID := ""
				if oid, ok := existingGRN.ID.(primitive.ObjectID); ok {
					existingID = oid.Hex()
				}
				c.JSON(http.StatusConflict, gin.H{
					"status":  http.StatusConflict,
					"message": "A draft GRN already exists for this purchase order.",
					"code":    "DRAFT_EXISTS",
					"data":    gin.H{"id": existingID, "grnNumber": existingGRN.GRNNumber},
				})
				return
			}
		}

		g.ID = primitive.NewObjectID()
		g.OrgID = orgIDStr
		g.CreatedAt = time.Now()
		g.UpdatedAt = time.Now()
		if userID != nil {
			g.CreatedBy = fmt.Sprintf("%v", userID)
		}
		if g.Status == "" {
			g.Status = "draft"
		}
		// Always assign from the org's numbering format — ignore any client-sent value.
		g.GRNNumber = generateGRNNumber(ctx, orgIDStr)
		if g.ReceiptDate.IsZero() {
			g.ReceiptDate = time.Now()
		}

		// Resolve vendor origin for correct VAT rate
		if g.VendorOrigin == "" && g.VendorID != "" {
			if vObjID, err := primitive.ObjectIDFromHex(g.VendorID); err == nil {
				var v struct {
					Origin string `bson:"origin"`
				}
				if err2 := vendorCollection.FindOne(ctx, bson.M{"_id": vObjID}).Decode(&v); err2 == nil {
					g.VendorOrigin = v.Origin
				}
			}
		}
		taxRate := grnTaxRate(g.VendorOrigin)

		// Recalculate totals server-side from items (use accepted qty = received - rejected).
		// Per-item freight is prorated to the accepted fraction and taxed at its own rate.
		subTotal := 0.0
		totalTax := 0.0
		for i, item := range g.Items {
			acceptedQty := item.ReceivedQty - item.RejectedQty
			if acceptedQty < 0 {
				acceptedQty = 0
			}
			base := acceptedQty * item.Rate
			tax := base * taxRate
			frac := 0.0
			if item.OrderedQty > 0 {
				frac = acceptedQty / item.OrderedQty
			} else if acceptedQty > 0 {
				frac = 1
			}
			freight := round2(item.Freight * frac)
			freightTax := round2(freight * item.FreightTaxRate / 100)
			g.Items[i].BaseAmount = base
			g.Items[i].TaxAmount = tax
			g.Items[i].Freight = freight
			g.Items[i].FreightTaxAmount = freightTax
			g.Items[i].LineTotal = base + tax + freight + freightTax
			subTotal += base + freight
			totalTax += tax + freightTax
		}
		g.Charges, g.ChargesTotal = computeGRNCharges(g.Charges)
		g.SubTotal = round2(subTotal)
		g.TotalTax = round2(totalTax)
		g.Total = round2(subTotal + totalTax + g.ShippingCharges + g.ChargesTotal + g.Adjustment)

		if _, err := grnCollection.InsertOne(ctx, g); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create GRN", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "GRN saved as draft",
			"data":    gin.H{"id": g.ID.Hex(), "grnNumber": g.GRNNumber, "total": g.Total},
		})
	}
}

// confirmGRNStock runs the stock + PO updates for a single confirmed GRN.
// Called by ConfirmGRN. Separated so it can be tested or reused.
func confirmGRNStock(ctx context.Context, g models.GRN, orgIDStr string) {
	stockCol := config.GetCollection(config.DB, "stocks")
	// Resolve receiving warehouse: the GRN's chosen one, else the org default.
	whID, _ := g.WarehouseID, g.WarehouseName
	defWh, _ := defaultWarehouse(ctx, orgIDStr)
	if whID == "" {
		whID = defWh
	}

	// Landed cost: capitalised charges (customs duty, clearing…) + header shipping are
	// prorated across the accepted goods by value, then absorbed into each item's unit
	// cost so COGS at sale reflects the true landed cost. Non-capitalised charges are
	// expensed (excluded here). Per-item freight is added directly to that item.
	capPool := g.ShippingCharges
	for _, ch := range g.Charges {
		if ch.Capitalise {
			capPool += ch.Amount
		}
	}
	totalAcceptedValue := 0.0
	for _, it := range g.Items {
		acc := it.ReceivedQty - it.RejectedQty
		if acc > 0 {
			totalAcceptedValue += acc * it.Rate
		}
	}

	for _, item := range g.Items {
		if item.ItemID == "" {
			continue
		}
		itemObjID, err := primitive.ObjectIDFromHex(item.ItemID)
		if err != nil {
			continue
		}
		var stockDoc struct {
			Quantity       string             `bson:"quantity"`
			CostPrice      string             `bson:"cost_price"`
			WarehouseStock map[string]float64 `bson:"warehouseStock"`
		}
		if fetchErr := stockCol.FindOne(ctx, bson.M{"_id": itemObjID, "orgId": orgIDStr}).Decode(&stockDoc); fetchErr == nil {
			currentQty := 0.0
			fmt.Sscanf(stockDoc.Quantity, "%f", &currentQty)
			acceptedQty := item.ReceivedQty - item.RejectedQty
			if acceptedQty < 0 {
				acceptedQty = 0
			}
			newQty := currentQty + acceptedQty
			// Per-warehouse breakdown: seed legacy total into default, then credit the
			// received warehouse. Total `quantity` stays authoritative.
			whMap := seedWarehouseMap(stockDoc.WarehouseStock, currentQty, defWh)
			whMap = addToWarehouse(whMap, whID, acceptedQty)

			// Landed unit cost for this receipt = rate + per-unit freight + per-unit
			// share of the capitalised pool (prorated by line value). Then roll into a
			// weighted-average cost over existing on-hand stock.
			setFields := bson.M{"quantity": fmt.Sprintf("%g", newQty), "warehouseStock": whMap, "updated_at": time.Now()}
			if acceptedQty > 0 {
				lineValue := acceptedQty * item.Rate
				chargeShare := 0.0
				if capPool > 0 && totalAcceptedValue > 0 {
					chargeShare = capPool * (lineValue / totalAcceptedValue)
				}
				landedUnitCost := item.Rate + (item.Freight+chargeShare)/acceptedQty
				currentCost := 0.0
				fmt.Sscanf(stockDoc.CostPrice, "%f", &currentCost)
				newCost := landedUnitCost
				if newQty > 0 && currentQty > 0 {
					newCost = (currentQty*currentCost + acceptedQty*landedUnitCost) / newQty
				}
				setFields["cost_price"] = fmt.Sprintf("%g", round2(newCost))
			}

			// Only clear the ACCEPTED qty from the on-order count. Rejected units were
			// returned to the vendor, so they remain outstanding and must stay on-order
			// (the vendor still owes a replacement). Using ReceivedQty here would wrongly
			// mark rejected goods as fulfilled.
			stockCol.UpdateOne(ctx,
				bson.M{"_id": itemObjID, "orgId": orgIDStr},
				bson.M{
					"$set": setFields,
					"$inc": bson.M{"quantity_ordered": -acceptedQty},
				},
			)
			// Write audit record so item History tab shows this purchase
			if acceptedQty > 0 {
				adj := models.StockAdjustment{
					ID:          primitive.NewObjectID(),
					OrgID:       orgIDStr,
					ItemID:      item.ItemID,
					ItemName:    item.Details,
					ItemCode:    item.ItemCode,
					Quantity:    acceptedQty,
					Type:        "increase",
					Reason:      "purchase",
					Reference:   g.GRNNumber,
					PreviousQty: currentQty,
					NewQty:      newQty,
					AdjustedAt:  time.Now(),
					CreatedAt:   time.Now(),
				}
				adjustmentCollection.InsertOne(ctx, adj)
			}
		}
	}

	// Update PO item receivedQty + PO status
	if g.PurchaseOrderID != "" {
		if poObjID, err := primitive.ObjectIDFromHex(g.PurchaseOrderID); err == nil {
			// Increment receivedQty on each matching PO item
			for _, grnItem := range g.Items {
				if grnItem.ItemID == "" {
					continue
				}
				accepted := grnItem.ReceivedQty - grnItem.RejectedQty
				if accepted <= 0 {
					continue
				}
				purchaseOrderCollection.UpdateOne(ctx,
					bson.M{"_id": poObjID, "orgId": orgIDStr, "items.itemId": grnItem.ItemID},
					bson.M{"$inc": bson.M{"items.$.receivedQty": accepted}},
				)
			}

			// Recalculate PO status from updated item receivedQty values
			var po models.PurchaseOrder
			if err2 := purchaseOrderCollection.FindOne(ctx, bson.M{"_id": poObjID, "orgId": orgIDStr}).Decode(&po); err2 == nil {
				totalOrdered := 0.0
				totalReceived := 0.0
				for _, item := range po.Items {
					totalOrdered += item.Quantity
					totalReceived += item.ReceivedQty
				}
				newStatus := "partial"
				if totalOrdered > 0 && totalReceived >= totalOrdered {
					newStatus = "received"
				}
				purchaseOrderCollection.UpdateOne(ctx,
					bson.M{"_id": poObjID, "orgId": orgIDStr},
					bson.M{"$set": bson.M{"status": newStatus, "updatedAt": time.Now()}},
				)

				// Procure-to-order: if this PO was raised to source a sales order, credit
				// the matching SO lines' fulfilledQty with the accepted qty (mapped via the
				// PO line's SourceSOItemID), then recompute the SO's fulfillmentStatus.
				if po.SourceSalesOrderID != "" {
					creditSOFulfillment(ctx, orgIDStr, po, g)
				}
			}
		}
	}

	// Vendor history
	if g.VendorID != "" {
		totalRejected := 0.0
		for _, it := range g.Items {
			totalRejected += it.RejectedQty
		}
		details := fmt.Sprintf("Goods received via %s (PO: %s). Total: AED %.2f", g.GRNNumber, g.PONumber, g.Total)
		if totalRejected > 0 {
			details += fmt.Sprintf(" — %g unit(s) REJECTED on quality inspection (kept open on PO for re-supply).", totalRejected)
		}
		histEntry := bson.M{
			"action":    "grn_received",
			"timestamp": time.Now(),
			"user":      g.CreatedBy,
			"details":   details,
		}
		if vObjID, err := primitive.ObjectIDFromHex(g.VendorID); err == nil {
			vendorCollection.UpdateOne(ctx,
				bson.M{"_id": vObjID, "orgId": orgIDStr},
				bson.M{"$push": bson.M{"history": histEntry}, "$set": bson.M{"updatedAt": time.Now()}},
			)
		}
	}
}

// creditSOFulfillment bumps the source sales order's line fulfilledQty by the qty
// accepted on this GRN, mapping GRN line → PO line (by itemId) → SO line (by the PO
// line's SourceSOItemID). It then recomputes the SO fulfillmentStatus across ALL its
// lines (a partial GRN, or one of several split-vendor POs, leaves it "partial").
func creditSOFulfillment(ctx context.Context, orgIDStr string, po models.PurchaseOrder, g models.GRN) {
	soObjID, err := primitive.ObjectIDFromHex(po.SourceSalesOrderID)
	if err != nil {
		return
	}

	// PO line's itemId → the SO line it sources.
	itemToSOItem := map[string]string{}
	for _, pi := range po.Items {
		if pi.ItemID != "" && pi.SourceSOItemID != "" {
			itemToSOItem[pi.ItemID] = pi.SourceSOItemID
		}
	}
	if len(itemToSOItem) == 0 {
		return
	}

	for _, gi := range g.Items {
		accepted := gi.ReceivedQty - gi.RejectedQty
		if accepted <= 0 || gi.ItemID == "" {
			continue
		}
		soItemID := itemToSOItem[gi.ItemID]
		if soItemID == "" {
			continue
		}
		soItemObjID, err := primitive.ObjectIDFromHex(soItemID)
		if err != nil {
			continue
		}
		salesOrdersCollection.UpdateOne(ctx,
			bson.M{"_id": soObjID, "orgId": orgIDStr, "items._id": soItemObjID},
			bson.M{"$inc": bson.M{"items.$.fulfilledQty": accepted}},
		)
	}

	// Recompute fulfillment status from the freshly updated SO lines.
	var so models.SalesOrder
	if err := salesOrdersCollection.FindOne(ctx, bson.M{"_id": soObjID, "orgId": orgIDStr}).Decode(&so); err != nil {
		return
	}
	totalOrdered, totalFulfilled := 0.0, 0.0
	for _, li := range so.Items {
		totalOrdered += li.Quantity
		totalFulfilled += li.FulfilledQty
	}
	status := "procuring"
	if totalFulfilled > 0 && totalFulfilled < totalOrdered {
		status = "partial"
	} else if totalOrdered > 0 && totalFulfilled >= totalOrdered {
		status = "ready" // fully procured — goods in stock, ready to dispatch
	}
	salesOrdersCollection.UpdateOne(ctx,
		bson.M{"_id": soObjID, "orgId": orgIDStr},
		bson.M{"$set": bson.M{"fulfillmentStatus": status, "updatedAt": time.Now()}},
	)
}

func ConfirmGRN() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		objID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": 400, "message": "Invalid GRN ID"})
			return
		}

		var g models.GRN
		if err := grnCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&g); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": 404, "message": "GRN not found"})
			return
		}
		if g.Status != "draft" && g.Status != "pending" {
			c.JSON(http.StatusBadRequest, gin.H{"status": 400, "message": "Only draft GRNs can be confirmed"})
			return
		}

		// Derive status from quality outcome:
		//   confirmed          → at least some qty accepted into stock
		//   rejected           → every received unit failed QC (nothing entered stock)
		totalAccepted, totalRejected := 0.0, 0.0
		for _, it := range g.Items {
			acc := it.ReceivedQty - it.RejectedQty
			if acc < 0 {
				acc = 0
			}
			totalAccepted += acc
			totalRejected += it.RejectedQty
		}
		newStatus := "confirmed"
		if totalAccepted == 0 && totalRejected > 0 {
			newStatus = "rejected"
		}
		hasRejections := totalRejected > 0

		if _, err := grnCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": bson.M{"status": newStatus, "hasRejections": hasRejections, "updatedAt": time.Now()}},
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "message": "Failed to confirm GRN"})
			return
		}
		g.Status = newStatus

		confirmGRNStock(ctx, g, orgIDStr)

		msg := "GRN confirmed — stock updated"
		if newStatus == "rejected" {
			msg = "GRN recorded — all items rejected on quality inspection (no stock added; qty kept open on PO)"
		} else if hasRejections {
			msg = "GRN confirmed — accepted items stocked; rejected qty kept open on PO"
		}
		c.JSON(http.StatusOK, gin.H{"status": 200, "message": msg, "data": gin.H{"grnNumber": g.GRNNumber, "status": newStatus, "hasRejections": hasRejections}})
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

// GetGRNBatches flattens every confirmed/billed GRN line that carries a batch number
// into a batch-tracking list (item, batch, expiry, accepted qty, source GRN/vendor).
// Powers the Inventory → Batch & Expiry screen. Read-only; no schema change.
func GetGRNBatches() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		// Only received stock counts (confirmed or billed), and only lines with a batch.
		filter := bson.M{
			"orgId":              orgIDStr,
			"status":             bson.M{"$in": []string{"confirmed", "billed"}},
			"items.batchNumber":  bson.M{"$nin": []interface{}{"", nil}},
		}
		opts := options.Find().SetSort(bson.D{{Key: "receiptDate", Value: -1}})
		cursor, err := grnCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "message": "Failed to fetch batches"})
			return
		}
		defer cursor.Close(ctx)

		var grns []models.GRN
		cursor.All(ctx, &grns)

		batches := []gin.H{}
		for _, g := range grns {
			for _, it := range g.Items {
				if it.BatchNumber == "" {
					continue
				}
				accepted := it.ReceivedQty - it.RejectedQty
				if accepted < 0 {
					accepted = 0
				}
				batches = append(batches, gin.H{
					"itemId":      it.ItemID,
					"itemCode":    it.ItemCode,
					"name":        it.Details,
					"unit":        it.Unit,
					"batchNumber": it.BatchNumber,
					"expiryDate":  it.ExpiryDate,
					"qty":         accepted,
					"grnNumber":   g.GRNNumber,
					"receiptDate": g.ReceiptDate,
					"vendorName":  g.VendorName,
				})
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": 200, "message": "Batches retrieved", "data": gin.H{"batches": batches}})
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
		total, _ := grnCollection.CountDocuments(ctx, base)
		draft     := count(bson.M{"status": "draft"})
		confirmed := count(bson.M{"status": "confirmed"})
		rejected  := count(bson.M{"status": "rejected"})
		billed    := count(bson.M{"status": "billed"})

		c.JSON(http.StatusOK, gin.H{"status": 200, "message": "GRN stats", "data": gin.H{
			"total":     total,
			"draft":     draft,
			"confirmed": confirmed,
			"rejected":  rejected,
			"billed":    billed,
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
			Status          string           `json:"status"`
			Notes           string           `json:"notes"`
			WarehouseID     string           `json:"warehouseId"`
			WarehouseName   string           `json:"warehouseName"`
			ShippingCharges *float64             `json:"shippingCharges"`
			Adjustment      *float64             `json:"adjustment"`
			Charges         *[]models.GRNCharge  `json:"charges"`
			Items           []models.GRNItem     `json:"items"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": 400, "message": "Invalid request body"})
			return
		}

		set := bson.M{"updatedAt": time.Now()}
		if body.Status != "" { set["status"] = body.Status }
		if body.Notes != ""  { set["notes"]  = body.Notes  }
		if body.WarehouseID != "" {
			set["warehouseId"]   = body.WarehouseID
			set["warehouseName"] = body.WarehouseName
		}
		// Fetch the stored GRN so we can recompute the grand total whenever items,
		// charges, shipping or adjustment change (each feeds the same total).
		var g models.GRN
		hasStored := grnCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&g) == nil

		if hasStored && len(body.Items) > 0 {
			taxRate := grnTaxRate(g.VendorOrigin)
			subTotal, totalTax := 0.0, 0.0
			for i, item := range body.Items {
				accepted := item.ReceivedQty - item.RejectedQty
				if accepted < 0 { accepted = 0 }
				base := accepted * item.Rate
				tax  := base * taxRate
				frac := 0.0
				if item.OrderedQty > 0 {
					frac = accepted / item.OrderedQty
				} else if accepted > 0 {
					frac = 1
				}
				freight := round2(item.Freight * frac)
				freightTax := round2(freight * item.FreightTaxRate / 100)
				body.Items[i].BaseAmount = base
				body.Items[i].TaxAmount  = tax
				body.Items[i].Freight = freight
				body.Items[i].FreightTaxAmount = freightTax
				body.Items[i].LineTotal  = base + tax + freight + freightTax
				subTotal += base + freight
				totalTax += tax + freightTax
			}
			set["items"]    = body.Items
			set["subTotal"] = round2(subTotal)
			set["totalTax"] = round2(totalTax)
			g.SubTotal = round2(subTotal)
			g.TotalTax = round2(totalTax)
		}

		if hasStored {
			// Apply incoming ship/adjust/charges over the stored values, then recompute total.
			if body.ShippingCharges != nil { g.ShippingCharges = *body.ShippingCharges; set["shippingCharges"] = g.ShippingCharges }
			if body.Adjustment != nil      { g.Adjustment      = *body.Adjustment;      set["adjustment"]      = g.Adjustment      }
			if body.Charges != nil {
				g.Charges, g.ChargesTotal = computeGRNCharges(*body.Charges)
				set["charges"]      = g.Charges
				set["chargesTotal"] = g.ChargesTotal
			}
			set["total"] = round2(g.SubTotal + g.TotalTax + g.ShippingCharges + g.ChargesTotal + g.Adjustment)
		} else {
			if body.ShippingCharges != nil { set["shippingCharges"] = *body.ShippingCharges }
			if body.Adjustment != nil      { set["adjustment"]      = *body.Adjustment      }
		}

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

func DiscardDraftGRN() gin.HandlerFunc {
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
		if err := grnCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&g); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": 404, "message": "GRN not found"})
			return
		}
		if g.Status != "draft" && g.Status != "pending" {
			c.JSON(http.StatusBadRequest, gin.H{"status": 400, "message": "Only draft GRNs can be discarded"})
			return
		}

		if _, err := grnCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "message": "Failed to discard GRN"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  200,
			"message": "Draft GRN discarded",
			"data":    gin.H{"purchaseOrderId": g.PurchaseOrderID},
		})
	}
}
