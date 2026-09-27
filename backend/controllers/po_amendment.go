package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ── PO amendments ─────────────────────────────────────────────────────────
// An amendment changes a PO that has already been issued to the vendor. The PO
// keeps its number; each approved amendment bumps Revision and is logged in
// Revisions with a snapshot of the version it replaced. Whether an amendment needs
// sign-off is set by the org in Settings → Approvals → PO Amendments; while one is
// held (AmendmentStatus = pending_approval) the current version stays in force.

// poAmendmentModule is the approval-policy key for amendments — separate from
// purchase_orders so orgs can give amendments their own chain and conditions.
const poAmendmentModule = "po_amendments"

// amendableStatuses — a PO must be out with the vendor and not yet closed.
var amendableStatuses = map[string]bool{"issued": true, "partial": true}

// amendRequest is the PUT /:id/amend body: the full amended PO plus a reason.
type amendRequest struct {
	models.PurchaseOrder
	AmendmentReason string `json:"amendmentReason"`
}

func poVersionOf(po models.PurchaseOrder) models.POVersion {
	return models.POVersion{
		OrderDate: po.OrderDate, ExpectedDeliveryDate: po.ExpectedDeliveryDate, PaymentTerms: po.PaymentTerms,
		DeliveryAddressLine: po.DeliveryAddressLine, DeliveryPOBox: po.DeliveryPOBox, ShipmentPreference: po.ShipmentPreference,
		ReferenceNo: po.ReferenceNo, Project: po.Project, Currency: po.Currency,
		VendorEmail: po.VendorEmail, VendorPhone: po.VendorPhone, AttentionTo: po.AttentionTo, VendorPOBox: po.VendorPOBox,
		Items: po.Items, SubTotal: po.SubTotal, TaxGroups: po.TaxGroups, TotalTax: po.TotalTax,
		ShippingCharges: po.ShippingCharges, Adjustment: po.Adjustment, Total: po.Total,
		CustomerNotes: po.CustomerNotes, TermsAndConditions: po.TermsAndConditions,
	}
}

// buildAmendedVersion prices the requested lines at the PO's existing VAT rate and
// carries over what GRNs have already received. GRNs credit PO lines by itemId, so
// received qty is pooled per itemId and re-allocated to the new lines in order — an
// amendment that leaves less ordered than already received is rejected.
func buildAmendedVersion(existing models.PurchaseOrder, req models.PurchaseOrder) (models.POVersion, error) {
	if len(req.Items) == 0 {
		return models.POVersion{}, fmt.Errorf("add at least one item")
	}
	appliedTaxRate := 0.05
	if existing.VendorOrigin == "free_zone" || existing.VendorOrigin == "overseas" {
		appliedTaxRate = 0.0
	}

	received := map[string]float64{}
	sourceSO := map[string]string{}
	names := map[string]string{}
	for _, it := range existing.Items {
		if it.ItemID == "" {
			continue
		}
		received[it.ItemID] += it.ReceivedQty
		names[it.ItemID] = it.Details
		if it.SourceSOItemID != "" && sourceSO[it.ItemID] == "" {
			sourceSO[it.ItemID] = it.SourceSOItemID
		}
	}

	var items []models.PurchaseOrderItem
	subTotal := 0.0
	for _, item := range req.Items {
		if item.Quantity <= 0 {
			return models.POVersion{}, fmt.Errorf("quantity for %q must be greater than zero", item.Details)
		}
		base := calcLineBase(item.Quantity, item.Rate, item.Discount, item.DiscountType)
		tax := round2(base * appliedTaxRate)
		freight := round2(item.Freight)
		freightTax := round2(freight * item.FreightTaxRate / 100)

		recv := 0.0
		if item.ItemID != "" && received[item.ItemID] > 0 {
			recv = received[item.ItemID]
			if recv > item.Quantity {
				recv = item.Quantity
			}
			received[item.ItemID] -= recv
		}
		srcSO := item.SourceSOItemID
		if srcSO == "" {
			srcSO = sourceSO[item.ItemID]
		}

		items = append(items, models.PurchaseOrderItem{
			ID: primitive.NewObjectID(), ItemID: item.ItemID, ItemCode: strings.TrimSpace(item.ItemCode), Details: item.Details,
			Quantity: item.Quantity, ReceivedQty: recv, Rate: item.Rate, Discount: item.Discount, DiscountType: item.DiscountType,
			BaseAmount: base, TaxRate: appliedTaxRate * 100, TaxAmount: tax, Amount: round2(base + tax + freight + freightTax),
			Unit: item.Unit, SourceSOItemID: srcSO,
			Freight: freight, FreightTaxRate: item.FreightTaxRate, FreightTaxAmount: freightTax,
		})
		subTotal += base + freight
	}
	for itemID, left := range received {
		if left > 0.0001 {
			return models.POVersion{}, fmt.Errorf("%q has %g more already received than the amended quantity — ordered quantity can't go below what was received", names[itemID], round2(left))
		}
	}

	totalTax := 0.0
	for _, it := range items {
		totalTax += it.TaxAmount + it.FreightTaxAmount
	}
	subTotal, totalTax = round2(subTotal), round2(totalTax)
	shipping, adjustment := round2(req.ShippingCharges), round2(req.Adjustment)

	orderDate := req.OrderDate
	if orderDate.IsZero() {
		orderDate = existing.OrderDate
	}
	return models.POVersion{
		OrderDate: orderDate, ExpectedDeliveryDate: req.ExpectedDeliveryDate, PaymentTerms: req.PaymentTerms,
		DeliveryAddressLine: req.DeliveryAddressLine, DeliveryPOBox: req.DeliveryPOBox, ShipmentPreference: req.ShipmentPreference,
		ReferenceNo: req.ReferenceNo, Project: req.Project, Currency: req.Currency,
		VendorEmail: req.VendorEmail, VendorPhone: req.VendorPhone, AttentionTo: req.AttentionTo, VendorPOBox: req.VendorPOBox,
		Items: items, SubTotal: subTotal, TaxGroups: buildTaxGroups(items), TotalTax: totalTax,
		ShippingCharges: shipping, Adjustment: adjustment, Total: round2(subTotal + totalTax + shipping + adjustment),
		CustomerNotes: req.CustomerNotes, TermsAndConditions: req.TermsAndConditions,
	}, nil
}

// diffPOVersions summarises what an amendment changes, for the revision log.
func diffPOVersions(old, nv models.POVersion) []string {
	var out []string
	str := func(label, a, b string) {
		if strings.TrimSpace(a) != strings.TrimSpace(b) {
			out = append(out, fmt.Sprintf("%s: %s → %s", label, orDash(a), orDash(b)))
		}
	}
	str("Order date", old.OrderDate.Format("02/01/2006"), nv.OrderDate.Format("02/01/2006"))
	str("Expected delivery", fmtDatePtr(old.ExpectedDeliveryDate), fmtDatePtr(nv.ExpectedDeliveryDate))
	str("Payment terms", old.PaymentTerms, nv.PaymentTerms)
	str("Delivery terms", old.ShipmentPreference, nv.ShipmentPreference)
	str("Delivery address", old.DeliveryAddressLine, nv.DeliveryAddressLine)
	str("Supplier ref", old.ReferenceNo, nv.ReferenceNo)
	str("Project", old.Project, nv.Project)
	str("Currency", old.Currency, nv.Currency)
	str("Attention", old.AttentionTo, nv.AttentionTo)
	str("Vendor email", old.VendorEmail, nv.VendorEmail)
	str("Vendor phone", old.VendorPhone, nv.VendorPhone)
	if old.CustomerNotes != nv.CustomerNotes {
		out = append(out, "Notes updated")
	}
	if old.TermsAndConditions != nv.TermsAndConditions {
		out = append(out, "Terms & conditions updated")
	}

	// Lines are compared by itemId (or description for free-text lines).
	key := func(it models.PurchaseOrderItem) string {
		if it.ItemID != "" {
			return it.ItemID
		}
		return "desc:" + strings.ToLower(strings.TrimSpace(it.Details))
	}
	type agg struct {
		name        string
		qty, amount float64
		rate        float64
		code        string
	}
	collect := func(items []models.PurchaseOrderItem) (map[string]*agg, []string) {
		m, order := map[string]*agg{}, []string{}
		for _, it := range items {
			k := key(it)
			if m[k] == nil {
				m[k] = &agg{name: it.Details, rate: it.Rate, code: it.ItemCode}
				order = append(order, k)
			}
			m[k].qty += it.Quantity
			m[k].amount += it.Amount
		}
		return m, order
	}
	oldM, oldOrder := collect(old.Items)
	newM, newOrder := collect(nv.Items)
	for _, k := range oldOrder {
		o, n := oldM[k], newM[k]
		if n == nil {
			out = append(out, fmt.Sprintf("Removed %s (qty %g)", o.name, o.qty))
			continue
		}
		if o.qty != n.qty {
			out = append(out, fmt.Sprintf("%s qty: %g → %g", o.name, o.qty, n.qty))
		}
		if strings.TrimSpace(o.code) != strings.TrimSpace(n.code) {
			out = append(out, fmt.Sprintf("%s article code: %s → %s", o.name, orDash(o.code), orDash(n.code)))
		}
		if o.rate != n.rate {
			out = append(out, fmt.Sprintf("%s rate: %s → %s", o.name, fmtMoney(o.rate), fmtMoney(n.rate)))
		} else if round2(o.amount) != round2(n.amount) && o.qty == n.qty {
			out = append(out, fmt.Sprintf("%s amount: %s → %s", o.name, fmtMoney(o.amount), fmtMoney(n.amount)))
		}
	}
	for _, k := range newOrder {
		if oldM[k] == nil {
			n := newM[k]
			out = append(out, fmt.Sprintf("Added %s (qty %g @ %s)", n.name, n.qty, fmtMoney(n.rate)))
		}
	}
	if old.ShippingCharges != nv.ShippingCharges {
		out = append(out, fmt.Sprintf("Shipping: %s → %s", fmtMoney(old.ShippingCharges), fmtMoney(nv.ShippingCharges)))
	}
	if old.Adjustment != nv.Adjustment {
		out = append(out, fmt.Sprintf("Adjustment: %s → %s", fmtMoney(old.Adjustment), fmtMoney(nv.Adjustment)))
	}
	if old.Total != nv.Total {
		out = append(out, fmt.Sprintf("Total: %s → %s", fmtMoney(old.Total), fmtMoney(nv.Total)))
	}
	return out
}

// applyPOVersion writes an approved amendment onto the PO: new fields, bumped
// revision, the log entry marked approved, stock quantity_ordered re-synced and the
// receipt status recomputed from the carried-over received quantities.
func applyPOVersion(ctx context.Context, orgIDStr string, po models.PurchaseOrder, revIdx int, reviewer string) (models.PurchaseOrder, error) {
	rev := po.Revisions[revIdx]
	v := rev.Proposed
	now := time.Now()
	newRevision := po.Revision + 1

	totalOrdered, totalReceived := 0.0, 0.0
	for _, it := range v.Items {
		totalOrdered += it.Quantity
		totalReceived += it.ReceivedQty
	}
	status := "issued"
	if totalReceived > 0 {
		status = "partial"
	}
	if totalOrdered > 0 && totalReceived >= totalOrdered {
		status = "received"
	}

	set := bson.M{
		"orderDate": v.OrderDate, "expectedDeliveryDate": v.ExpectedDeliveryDate, "paymentTerms": v.PaymentTerms,
		"deliveryAddressLine": v.DeliveryAddressLine, "deliveryPoBox": v.DeliveryPOBox, "shipmentPreference": v.ShipmentPreference,
		"referenceNo": v.ReferenceNo, "project": v.Project, "currency": v.Currency,
		"vendorEmail": v.VendorEmail, "vendorPhone": v.VendorPhone, "attentionTo": v.AttentionTo, "vendorPoBox": v.VendorPOBox,
		"items": v.Items, "subTotal": v.SubTotal, "taxGroups": v.TaxGroups, "totalTax": v.TotalTax,
		"shippingCharges": v.ShippingCharges, "adjustment": v.Adjustment, "total": v.Total,
		"customerNotes": v.CustomerNotes, "termsAndConditions": v.TermsAndConditions,
		"status": status, "revision": newRevision, "amendmentStatus": "", "updatedAt": now,
		fmt.Sprintf("revisions.%d.status", revIdx):     "approved",
		fmt.Sprintf("revisions.%d.revision", revIdx):   newRevision,
		fmt.Sprintf("revisions.%d.reviewedBy", revIdx): reviewer,
		fmt.Sprintf("revisions.%d.reviewedAt", revIdx): now,
	}
	// Guard on the revision we read so two concurrent approvals can't both apply.
	// POs created before amendments existed have no revision field at all.
	var revGuard interface{} = po.Revision
	if po.Revision == 0 {
		revGuard = bson.M{"$in": bson.A{0, nil}}
	}
	res, err := purchaseOrderCollection.UpdateOne(ctx,
		bson.M{"_id": po.ID, "orgId": orgIDStr, "revision": revGuard},
		bson.M{"$set": set})
	if err != nil {
		return po, err
	}
	if res.MatchedCount == 0 {
		return po, fmt.Errorf("purchase order changed while amending — reload and try again")
	}

	// quantity_ordered tracks what's still outstanding with vendors (GRNs decrement it),
	// so shift it by the change in ordered qty per item.
	if po.POType == "goods" {
		delta := map[string]float64{}
		for _, it := range po.Items {
			delta[it.ItemID] -= it.Quantity
		}
		for _, it := range v.Items {
			delta[it.ItemID] += it.Quantity
		}
		stockCol := config.GetCollection(config.DB, "stocks")
		for itemID, d := range delta {
			if d == 0 {
				continue
			}
			if oid, e := primitive.ObjectIDFromHex(itemID); e == nil {
				stockCol.UpdateOne(ctx, bson.M{"_id": oid, "orgId": orgIDStr}, bson.M{"$inc": bson.M{"quantity_ordered": d}})
			}
		}
	}

	if po.VendorID != "" {
		if vObjID, e := primitive.ObjectIDFromHex(po.VendorID); e == nil {
			vendorCollection.UpdateOne(ctx, bson.M{"_id": vObjID, "orgId": orgIDStr}, bson.M{
				"$push": bson.M{"history": bson.M{
					"action": "po_amended", "timestamp": now, "user": reviewer,
					"details": fmt.Sprintf("Purchase order %s amended to Rev %d. Total: AED %.2f → AED %.2f", po.OrderNumber, newRevision, rev.PreviousTotal, v.Total),
				}},
				"$set": bson.M{"updatedAt": now},
			})
		}
	}

	po.Status, po.Revision, po.Total = status, newRevision, v.Total
	return po, nil
}

func loadPOForAmend(c *gin.Context, ctx context.Context) (models.PurchaseOrder, string, bool) {
	var po models.PurchaseOrder
	objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid purchase order ID"})
		return po, "", false
	}
	orgIDStr := c.GetString("orgId")
	if err := purchaseOrderCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgIDStr}).Decode(&po); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Purchase order not found"})
		return po, "", false
	}
	// Older POs have no stored article codes — fill them so the diff doesn't report them.
	stampItemCodes(ctx, orgIDStr, po.Items)
	return po, orgIDStr, true
}

func pendingRevisionIndex(po models.PurchaseOrder) int {
	for i := len(po.Revisions) - 1; i >= 0; i-- {
		if po.Revisions[i].Status == "pending_approval" {
			return i
		}
	}
	return -1
}

// approvePendingAmendment applies the PO's pending amendment once its approval chain
// clears. Goods may have been received since the request, so the received-qty check is
// re-run against the PO as it is now.
func approvePendingAmendment(ctx context.Context, orgIDStr string, po models.PurchaseOrder, reviewer string) (models.PurchaseOrder, error) {
	idx := pendingRevisionIndex(po)
	if idx < 0 {
		return po, fmt.Errorf("no amendment is waiting for approval")
	}
	if !amendableStatuses[po.Status] {
		return po, fmt.Errorf("this purchase order can no longer be amended (status: %s) — reject the amendment instead", po.Status)
	}
	p := po.Revisions[idx].Proposed
	proposed, err := buildAmendedVersion(po, models.PurchaseOrder{
		OrderDate: p.OrderDate, ExpectedDeliveryDate: p.ExpectedDeliveryDate,
		PaymentTerms: p.PaymentTerms, DeliveryAddressLine: p.DeliveryAddressLine,
		DeliveryPOBox: p.DeliveryPOBox, ShipmentPreference: p.ShipmentPreference,
		ReferenceNo: p.ReferenceNo, Project: p.Project, Currency: p.Currency,
		VendorEmail: p.VendorEmail, VendorPhone: p.VendorPhone,
		AttentionTo: p.AttentionTo, VendorPOBox: p.VendorPOBox,
		Items: p.Items, ShippingCharges: p.ShippingCharges, Adjustment: p.Adjustment,
		CustomerNotes: p.CustomerNotes, TermsAndConditions: p.TermsAndConditions,
	})
	if err != nil {
		return po, fmt.Errorf("can't approve: %w", err)
	}
	po.Revisions[idx].Proposed = proposed
	purchaseOrderCollection.UpdateOne(ctx, bson.M{"_id": po.ID, "orgId": orgIDStr},
		bson.M{"$set": bson.M{fmt.Sprintf("revisions.%d.proposed", idx): proposed}})
	return applyPOVersion(ctx, orgIDStr, po, idx, reviewer)
}

// rejectPendingAmendment marks the pending amendment rejected; the current version stays.
func rejectPendingAmendment(ctx context.Context, orgIDStr string, po models.PurchaseOrder, reviewer, reason string) bool {
	idx := pendingRevisionIndex(po)
	if idx < 0 {
		return false
	}
	now := time.Now()
	purchaseOrderCollection.UpdateOne(ctx, bson.M{"_id": po.ID, "orgId": orgIDStr}, bson.M{"$set": bson.M{
		"amendmentStatus": "", "updatedAt": now,
		fmt.Sprintf("revisions.%d.status", idx):       "rejected",
		fmt.Sprintf("revisions.%d.reviewedBy", idx):   reviewer,
		fmt.Sprintf("revisions.%d.reviewedAt", idx):   now,
		fmt.Sprintf("revisions.%d.rejectReason", idx): strings.TrimSpace(reason),
	}})
	return true
}

// amendmentApprovalPayload is what the Approvals inbox shows (and conditions test)
// for a held amendment. "total" is the amended total so the Amount condition applies to
// it; "amountChange" lets a policy gate only amendments that raise the total.
func amendmentApprovalPayload(po models.PurchaseOrder, rev models.PORevision) bson.M {
	return bson.M{
		"orderNumber": po.OrderNumber, "vendorName": po.VendorName, "revisionId": rev.ID.Hex(),
		"reason": rev.Reason, "previousTotal": rev.PreviousTotal, "total": rev.NewTotal,
		"amountChange": round2(rev.NewTotal - rev.PreviousTotal),
		"changes":      rev.Changes, "items": rev.Proposed.Items,
	}
}

// AmendPurchaseOrder — PUT /api/purchase-orders/:id/amend
//
// Approval comes only from the org's PO Amendments policy: when it's on, the amendment
// is held in the Approvals inbox and walks the configured chain. It applies straight
// away when the policy is off, its conditions don't match, the requester is the owner,
// or the requester can clear every step alone (see holdActionForApproval).
func AmendPurchaseOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		po, orgIDStr, ok := loadPOForAmend(c, ctx)
		if !ok {
			return
		}
		if !amendableStatuses[po.Status] {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "Only issued or partially received purchase orders can be amended"})
			return
		}
		if po.AmendmentStatus == "pending_approval" {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "An amendment is already waiting for approval on this purchase order"})
			return
		}
		// Service POs are billed straight from the PO — once billed, the bill is the record.
		if po.POType == "service" {
			if n, _ := billCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "purchaseOrderId": po.ID.Hex(), "status": bson.M{"$ne": "void"}}); n > 0 {
				c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "This service PO has already been billed — void the bill before amending"})
				return
			}
		}

		var req amendRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		reason := strings.TrimSpace(req.AmendmentReason)
		if reason == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "A reason for the amendment is required"})
			return
		}

		proposed, err := buildAmendedVersion(po, req.PurchaseOrder)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": err.Error()})
			return
		}
		stampItemCodes(ctx, orgIDStr, proposed.Items)
		previous := poVersionOf(po)
		changes := diffPOVersions(previous, proposed)
		if len(changes) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Nothing was changed"})
			return
		}

		userID := c.GetString("userId")
		rev := models.PORevision{
			ID: primitive.NewObjectID(), Status: "pending_approval", Reason: reason, Changes: changes,
			PreviousTotal: previous.Total, NewTotal: proposed.Total,
			RequestedBy: userID, RequestedAt: time.Now(), Previous: previous, Proposed: proposed,
		}
		// Only one pending amendment at a time — the filter makes that atomic.
		res, err := purchaseOrderCollection.UpdateOne(ctx,
			bson.M{"_id": po.ID, "orgId": orgIDStr, "amendmentStatus": bson.M{"$ne": "pending_approval"}},
			bson.M{"$push": bson.M{"revisions": rev}, "$set": bson.M{"amendmentStatus": "pending_approval", "updatedAt": time.Now()}})
		if err != nil || res.MatchedCount == 0 {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "An amendment is already waiting for approval on this purchase order"})
			return
		}
		po.Revisions = append(po.Revisions, rev)
		revIdx := len(po.Revisions) - 1

		applyNow := func() {
			updated, err := applyPOVersion(ctx, orgIDStr, po, revIdx, userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"status": http.StatusOK, "message": fmt.Sprintf("Purchase order amended (Rev %d)", updated.Revision),
				"data": gin.H{"id": po.ID.Hex(), "revision": updated.Revision, "status": updated.Status, "total": updated.Total, "changes": changes},
			})
		}

		title := fmt.Sprintf("%s → Rev %d · %s", po.OrderNumber, po.Revision+1, po.VendorName)
		if !holdActionForApproval(c, ctx, orgIDStr, userID, "", "po", "amend", poAmendmentModule, title, proposed.Total, po.ID.Hex(), amendmentApprovalPayload(po, rev)) {
			applyNow()
			return
		}
		// Held (202 already written) — link the request so the PO shows where it is.
		var ar models.ApprovalRequest
		if err := approvalRequestCollection.FindOne(ctx,
			bson.M{"orgId": orgIDStr, "docId": po.ID.Hex(), "action": "amend", "status": "pending", "payload.revisionId": rev.ID.Hex()}).Decode(&ar); err != nil {
			rejectPendingAmendment(ctx, orgIDStr, po, userID, "Could not be submitted for approval")
			return
		}
		purchaseOrderCollection.UpdateOne(ctx, bson.M{"_id": po.ID, "orgId": orgIDStr},
			bson.M{"$set": bson.M{fmt.Sprintf("revisions.%d.approvalRequestId", revIdx): ar.ID.Hex()}})
	}
}

// ── Approvals-inbox hooks (called from approval_controller) ─────────────────

func loadPOByHex(ctx context.Context, orgIDStr, id string) (models.PurchaseOrder, error) {
	var po models.PurchaseOrder
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return po, err
	}
	if err = purchaseOrderCollection.FindOne(ctx, bson.M{"_id": oid, "orgId": orgIDStr}).Decode(&po); err == nil {
		stampItemCodes(ctx, orgIDStr, po.Items)
	}
	return po, err
}

// applyAmendmentFromApproval runs when the last step of a held amendment is approved.
func applyAmendmentFromApproval(ctx context.Context, orgIDStr string, ar models.ApprovalRequest, approver string) (string, string, error) {
	po, err := loadPOByHex(ctx, orgIDStr, ar.DocID)
	if err != nil {
		return "", "", fmt.Errorf("purchase order not found")
	}
	updated, err := approvePendingAmendment(ctx, orgIDStr, po, approver)
	if err != nil {
		return "", "", err
	}
	return po.ID.Hex(), fmt.Sprintf("%s Rev %d", po.OrderNumber, updated.Revision), nil
}

// rejectAmendmentFromApproval mirrors an inbox rejection onto the PO's revision log.
func rejectAmendmentFromApproval(ctx context.Context, orgIDStr string, ar models.ApprovalRequest, approver, reason string) {
	if po, err := loadPOByHex(ctx, orgIDStr, ar.DocID); err == nil {
		rejectPendingAmendment(ctx, orgIDStr, po, approver, reason)
	}
}

// withdrawAmendmentApproval closes an amendment's inbox request when its PO is cancelled.
func withdrawAmendmentApproval(ctx context.Context, orgIDStr string, po models.PurchaseOrder, by string) {
	rejectPendingAmendment(ctx, orgIDStr, po, by, "Purchase order cancelled")
	approvalRequestCollection.UpdateMany(ctx,
		bson.M{"orgId": orgIDStr, "docId": po.ID.Hex(), "action": "amend", "status": "pending"},
		bson.M{"$set": bson.M{"status": "rejected", "decidedBy": by, "decidedAt": time.Now(), "reason": "Purchase order cancelled"}})
}
