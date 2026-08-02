package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/backend/ws"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var approvalRequestCollection *mongo.Collection = config.GetCollection(config.DB, "approval_requests")

// ── Field catalog ────────────────────────────────────────────────────────────
// Which fields each module's trigger conditions can test, and how to pull that value
// out of the stored create payload (bson.M, keyed by the model's bson tags).

type apprField struct{ Key, Type string } // Type: money | number | text | select

var approvalFieldCatalog = map[string][]apprField{
	"bills":           {{"amount", "money"}, {"vendor", "text"}},
	"invoices":        {{"amount", "money"}, {"customer", "text"}},
	"payments":        {{"amount", "money"}, {"customer", "text"}},
	"vendor_payments": {{"amount", "money"}, {"vendor", "text"}},
	"purchase_orders": {{"amount", "money"}, {"vendor", "text"}},
	"quotes":          {{"amount", "money"}, {"customer", "text"}},
	"customers":       {{"name", "text"}},
	"vendors":         {{"name", "text"}},
	"projects":        {{"name", "text"}},
}

func fieldType(moduleKey, field string) string {
	for _, f := range approvalFieldCatalog[moduleKey] {
		if f.Key == field {
			return f.Type
		}
	}
	return "text"
}

func nestedNum(m bson.M, path ...string) (float64, bool) {
	var cur interface{} = m
	for _, k := range path {
		mm, ok := cur.(bson.M)
		if !ok {
			return 0, false
		}
		cur = mm[k]
	}
	switch v := cur.(type) {
	case float64:
		return v, true
	case int64:
		return float64(v), true
	case int32:
		return float64(v), true
	case int:
		return float64(v), true
	}
	return 0, false
}

func nestedStr(m bson.M, path ...string) string {
	var cur interface{} = m
	for _, k := range path {
		mm, ok := cur.(bson.M)
		if !ok {
			return ""
		}
		cur = mm[k]
	}
	if s, ok := cur.(string); ok {
		return s
	}
	return ""
}

// docFieldValue extracts a trigger field's value from the stored payload.
func docFieldValue(moduleKey, field string, p bson.M) interface{} {
	switch moduleKey {
	case "bills":
		if field == "vendor" {
			return nestedStr(p, "vendorName")
		}
		n, _ := nestedNum(p, "totals", "grandTotal")
		return n
	case "invoices":
		if field == "customer" {
			return nestedStr(p, "billTo", "name")
		}
		n, _ := nestedNum(p, "totals", "grandTotal")
		return n
	case "payments":
		if field == "customer" {
			return nestedStr(p, "customerName")
		}
		n, _ := nestedNum(p, "amount")
		return n
	case "vendor_payments":
		if field == "vendor" {
			return nestedStr(p, "vendorName")
		}
		n, _ := nestedNum(p, "amount")
		return n
	case "purchase_orders":
		if field == "vendor" {
			return nestedStr(p, "vendorName")
		}
		n, _ := nestedNum(p, "total")
		return n
	case "quotes":
		if field == "customer" {
			return nestedStr(p, "customerName")
		}
		n, _ := nestedNum(p, "totals", "grandTotal")
		return n
	case "customers":
		return nestedStr(p, "customerDisplayName")
	case "vendors":
		return nestedStr(p, "displayName")
	case "projects":
		return nestedStr(p, "projectName")
	}
	return nil
}

// ── Engine ───────────────────────────────────────────────────────────────────

func apprToFloat(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int64:
		return float64(n), true
	case int32:
		return float64(n), true
	case int:
		return float64(n), true
	case string:
		var f float64
		_, err := fmt.Sscanf(strings.TrimSpace(n), "%f", &f)
		return f, err == nil
	}
	return 0, false
}

func evalCondition(ftype, op string, docVal, condVal interface{}) bool {
	if ftype == "money" || ftype == "number" {
		a, okA := apprToFloat(docVal)
		b, okB := apprToFloat(condVal)
		if !okA || !okB {
			return false
		}
		switch op {
		case "gte":
			return a >= b
		case "lte":
			return a <= b
		case "gt":
			return a > b
		case "lt":
			return a < b
		case "eq":
			return a == b
		case "ne":
			return a != b
		}
		return false
	}
	a := strings.ToLower(fmt.Sprintf("%v", docVal))
	b := strings.ToLower(fmt.Sprintf("%v", condVal))
	switch op {
	case "eq":
		return a == b
	case "ne":
		return a != b
	case "contains":
		return strings.Contains(a, b)
	}
	return false
}

// evaluateTrigger reports whether the policy's trigger fires for this payload.
func evaluateTrigger(policy models.ApprovalPolicy, moduleKey string, p bson.M) bool {
	t := policy.Trigger
	if t.Mode != "conditions" || len(t.Conditions) == 0 {
		return true // "always"
	}
	matchAll := t.Match != "any"
	for _, c := range t.Conditions {
		ok := evalCondition(fieldType(moduleKey, c.Field), c.Op, docFieldValue(moduleKey, c.Field, p), c.Value)
		if matchAll && !ok {
			return false
		}
		if !matchAll && ok {
			return true
		}
	}
	return matchAll
}

// buildChainStates snapshots the policy's steps into runtime state. Empty chain ⇒ a
// single implicit step that only owner/admin can clear.
func buildChainStates(policy models.ApprovalPolicy) []models.ApprovalStepState {
	out := make([]models.ApprovalStepState, 0, len(policy.Steps))
	for _, s := range policy.Steps {
		n := s.N
		if s.Mode != "quorum" || n < 1 {
			n = 1
		}
		out = append(out, models.ApprovalStepState{
			Mode: s.Mode, Roles: s.Roles, N: n, Delegate: s.Delegate,
			Approvals: []models.StepApproval{}, Done: false,
		})
	}
	if len(out) == 0 {
		out = append(out, models.ApprovalStepState{Mode: "single", Roles: []string{}, N: 1})
	}
	return out
}

func loadPolicy(ctx context.Context, orgID, moduleKey string) (models.ApprovalPolicy, bool) {
	oid, err := primitive.ObjectIDFromHex(orgID)
	if err != nil {
		return models.ApprovalPolicy{}, false
	}
	var org models.Organization
	if orgCollection.FindOne(ctx, bson.M{"_id": oid},
		options.FindOne().SetProjection(bson.M{"approvalPolicies": 1})).Decode(&org) != nil {
		return models.ApprovalPolicy{}, false
	}
	p, ok := org.ApprovalPolicies[moduleKey]
	return p, ok
}

func toBsonM(v interface{}) bson.M {
	raw, err := bson.Marshal(v)
	if err != nil {
		return bson.M{}
	}
	var m bson.M
	_ = bson.Unmarshal(raw, &m)
	return m
}

// holdForApproval is the create-action gate (kept for the create handlers).
func holdForApproval(c *gin.Context, ctx context.Context, orgIDStr, userIDStr, userName,
	docType, moduleKey, title string, amount float64, payloadModel interface{}) bool {
	return holdActionForApproval(c, ctx, orgIDStr, userIDStr, userName, docType, "create", moduleKey, title, amount, "", payloadModel)
}

// holdActionForApproval evaluates the module's policy for a create/update/delete action.
// Returns true (caller STOPS) when held: writes 202 + a pending ApprovalRequest with the
// chain snapshot. delete is always held when the policy is enabled (its payload carries no
// fields to test conditions against); create/update evaluate the trigger on the payload.
func holdActionForApproval(c *gin.Context, ctx context.Context, orgIDStr, userIDStr, userName,
	docType, action, moduleKey, title string, amount float64, docID string, payloadModel interface{}) bool {

	policy, ok := loadPolicy(ctx, orgIDStr, moduleKey)
	if !ok || !policy.Enabled || !policy.GatesAction(action) {
		return false
	}
	payload := toBsonM(payloadModel)
	if action != "delete" && !evaluateTrigger(policy, moduleKey, payload) {
		return false // conditions not met → proceed normally
	}

	steps := buildChainStates(policy)

	// Self-clearance: if the creator's own role can satisfy every step alone, approval is
	// a no-op — skip the hold and let the document create normally.
	if orgObjID, err := primitive.ObjectIDFromHex(orgIDStr); err == nil {
		if role, ok := getMemberRole(ctx, orgObjID, userIDStr); ok && canSelfClear(role, steps) {
			return false
		}
	}

	req := models.ApprovalRequest{
		ID:              primitive.NewObjectID(),
		OrgID:           orgIDStr,
		DocType:         docType,
		Action:          action,
		DocID:           docID,
		PermKey:         moduleKey,
		Title:           title,
		Amount:          amount,
		Payload:         payload,
		Steps:           steps,
		CurrentStep:     0,
		Status:          "pending",
		RequestedBy:     userIDStr,
		RequestedByName: userName,
		RequestedAt:     time.Now(),
	}
	if _, err := approvalRequestCollection.InsertOne(ctx, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to submit for approval", "error": err.Error()})
		return true
	}

	go notifyStepApprovers(orgIDStr, req)
	go ws.GlobalHub.Broadcast(ws.Event{Type: "approvals_updated", Action: "create", OrgID: orgIDStr})
	c.JSON(http.StatusAccepted, gin.H{
		"status":  http.StatusAccepted,
		"message": "Submitted for approval",
		"data":    gin.H{"approvalId": req.ID.Hex(), "status": "pending_approval"},
	})
	return true
}

// docTypeLabel maps an approval docType to a human label.
func docTypeLabel(dt string) string {
	if l := map[string]string{
		"po": "Purchase order", "bill": "Bill", "vendor_payment": "Vendor payment",
		"payment": "Customer payment", "invoice": "Invoice", "customer": "Customer", "vendor": "Vendor",
		"quote": "Quote", "project": "Project",
	}[dt]; l != "" {
		return l
	}
	return dt
}

// notifyRequester tells the user who raised the request about its final outcome.
// Safe to call in a goroutine.
func notifyRequester(orgIDStr string, ar models.ApprovalRequest, approved bool, reason, docNumber string) {
	if ar.RequestedBy == "" {
		return
	}
	label := docTypeLabel(ar.DocType)
	result := "rejected"
	var title, msg string
	if approved {
		result = "approved"
		title = label + " approved"
		msg = fmt.Sprintf("Your %s (%s) was approved", strings.ToLower(label), ar.Title)
		if docNumber != "" {
			msg += " — " + docNumber
		}
		if reason != "" {
			msg += " · Note: " + reason
		}
	} else {
		title = label + " rejected"
		msg = fmt.Sprintf("Your %s (%s) was rejected", strings.ToLower(label), ar.Title)
		if reason != "" {
			msg += ": " + reason
		}
	}
	meta := map[string]string{"approvalId": ar.ID.Hex(), "docType": ar.DocType, "result": result}
	pushNotificationWithMeta(ar.RequestedBy, "approval_result", title, msg, orgIDStr, "", meta)
}

// notifyStepApprovers pushes an "approval_request" notification to every active org
// member who may clear the request's current step (step roles + delegate + owner/admin),
// excluding the requester. Safe to call in a goroutine.
func notifyStepApprovers(orgIDStr string, ar models.ApprovalRequest) {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	orgObjID, err := primitive.ObjectIDFromHex(orgIDStr)
	if err != nil || ar.CurrentStep >= len(ar.Steps) {
		return
	}
	step := ar.Steps[ar.CurrentStep]

	roleSet := map[string]bool{"owner": true, "admin": true}
	for _, r := range step.Roles {
		roleSet[r] = true
	}
	if step.Delegate != "" {
		roleSet[step.Delegate] = true
	}
	roles := make([]string, 0, len(roleSet))
	for r := range roleSet {
		roles = append(roles, r)
	}

	cursor, err := orgMemberCollection.Find(ctx, bson.M{
		"orgId":  orgObjID,
		"status": "active",
		"role":   bson.M{"$in": roles},
		"userId": bson.M{"$ne": ar.RequestedBy},
	})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)
	var members []models.OrgMember
	cursor.All(ctx, &members)

	verb := map[string]string{"create": "created", "update": "edited", "delete": "voided"}[ar.Action]
	if verb == "" {
		verb = "submitted"
	}
	docLabel := docTypeLabel(ar.DocType)
	title := docLabel + " needs approval"
	name := ar.RequestedByName
	if name == "" {
		name = "Someone"
	}
	msg := fmt.Sprintf("%s %s a %s (%s) awaiting your sign-off", name, verb, strings.ToLower(docLabel), ar.Title)
	meta := map[string]string{"approvalId": ar.ID.Hex(), "docType": ar.DocType, "action": ar.Action}

	for _, m := range members {
		go pushNotificationWithMeta(m.UserID, "approval_request", title, msg, orgIDStr, "", meta)
	}
}

// canSelfClear reports whether a single user of the given role can satisfy every step in
// the chain alone — eligible for each step, and no step needs a quorum of distinct people.
// When true, holding the document for approval is pointless (the creator could just approve
// it themselves), so the gate is skipped.
func canSelfClear(role string, steps []models.ApprovalStepState) bool {
	for _, st := range steps {
		if !stepEligible(role, st) {
			return false
		}
		if st.Mode == "quorum" && st.N > 1 {
			return false // needs ≥2 distinct approvers — one person can't clear it
		}
	}
	return true
}

// stepEligible reports whether a role may clear this step (owner/admin always).
func stepEligible(role string, st models.ApprovalStepState) bool {
	if role == "owner" || role == "admin" {
		return true
	}
	if role == st.Delegate && st.Delegate != "" {
		return true
	}
	for _, r := range st.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// stepSatisfied: single ⇒ ≥1 approval; quorum ⇒ ≥N distinct approvers.
func stepSatisfied(st models.ApprovalStepState) bool {
	seen := map[string]bool{}
	for _, a := range st.Approvals {
		seen[a.UserID] = true
	}
	if st.Mode == "quorum" {
		return len(seen) >= st.N
	}
	return len(seen) >= 1
}

// ── HTTP handlers ────────────────────────────────────────────────────────────

func GetApprovalRequests() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		filter := bson.M{"orgId": fmt.Sprintf("%v", orgID)}
		status := c.DefaultQuery("status", "pending")
		if status != "all" {
			filter["status"] = status
		}
		if dt := c.Query("docType"); dt != "" {
			filter["docType"] = dt
		}

		opts := options.Find().SetSort(bson.D{{Key: "requestedAt", Value: -1}})
		cursor, err := approvalRequestCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch approvals"})
			return
		}
		defer cursor.Close(ctx)

		var reqs []models.ApprovalRequest
		if err := cursor.All(ctx, &reqs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode approvals"})
			return
		}
		if reqs == nil {
			reqs = []models.ApprovalRequest{}
		}

		orgIDStr := fmt.Sprintf("%v", orgID)
		pendingCount, _ := approvalRequestCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "status": "pending"})

		// Tell the caller which pending requests THEY can act on right now.
		userID, _ := c.Get("userId")
		orgObjID, _ := primitive.ObjectIDFromHex(orgIDStr)
		role, _ := getMemberRole(ctx, orgObjID, fmt.Sprintf("%v", userID))
		out := make([]gin.H, 0, len(reqs))
		for _, r := range reqs {
			canAct := false
			if r.Status == "pending" && r.CurrentStep < len(r.Steps) {
				canAct = stepEligible(role, r.Steps[r.CurrentStep])
			}
			out = append(out, gin.H{"req": r, "canAct": canAct})
		}

		// ── Sales orders ──────────────────────────────────────────────────────
		// SOs run a bespoke status-based approval (status="pending_approval" on the
		// order itself), not the generic approval_requests engine. Surface them here
		// so they show up in this module like every other held document. Actions are
		// routed back to /api/sales-orders/:id/status by the client (docType=sales_order).
		soPend, _ := salesOrdersCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "status": "pending_approval"})
		pendingCount += soPend

		soFilter := bson.M{"orgId": orgIDStr}
		switch status {
		case "all":
			soFilter["status"] = bson.M{"$in": []string{"pending_approval", "approved", "rejected"}}
		case "approved", "rejected":
			soFilter["status"] = status
		default: // pending
			soFilter["status"] = "pending_approval"
		}
		soApprover := salesOrderApproverRoles(ctx, orgObjID)
		if soCur, soErr := salesOrdersCollection.Find(ctx, soFilter,
			options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})); soErr == nil {
			var sos []models.SalesOrder
			soCur.All(ctx, &sos)
			soCur.Close(ctx)
			for _, so := range sos {
				synth := "pending"
				switch so.Status {
				case "approved":
					synth = "approved"
				case "rejected":
					synth = "rejected"
				}
				items := make([]gin.H, 0, len(so.Items))
				for _, it := range so.Items {
					items = append(items, gin.H{"details": it.Details, "quantity": it.Quantity, "rate": it.Rate, "amount": it.Amount})
				}
				out = append(out, gin.H{"req": gin.H{
					"_id":             so.ID.Hex(),
					"docType":         "sales_order",
					"action":          "create",
					"title":           so.OrderNumber,
					"amount":          so.Total,
					"status":          synth,
					"reason":          so.RejectionReason,
					"requestedBy":     so.CreatedBy,
					"requestedByName": so.CreatedBy,
					"requestedAt":     so.CreatedAt,
					"steps":           []gin.H{},
					"currentStep":     0,
					"payload": gin.H{
						"customerName": so.CustomerName,
						"lpoNumber":    so.LpoNumber,
						"items":        items,
						"totals":       gin.H{"subTotal": so.SubTotal, "vat": so.VAT, "grandTotal": so.Total},
					},
				}, "canAct": synth == "pending" && soApprover[role] && so.CreatedBy != fmt.Sprintf("%v", userID)})
			}
		}

		// ── Purchase orders ──────────────────────────────────────────────────
		// POs also run a bespoke status-based approval (status="pending_approval"
		// on the order itself, set at creation for non owner/admin creators), not
		// the generic approval_requests engine — that engine is only used for PO
		// *updates* (docType "po", action "update"). Surface creation-pending POs
		// here too, under a distinct docType ("purchase_order") so they never
		// collide with real update-hold entries. Actions are routed back to
		// /api/purchase-orders/:id/{approve,cancel} by the client.
		poPend, _ := purchaseOrderCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "status": "pending_approval"})
		pendingCount += poPend

		poFilter := bson.M{"orgId": orgIDStr}
		switch status {
		case "all":
			poFilter["status"] = bson.M{"$in": []string{"pending_approval", "issued", "partial", "received", "cancelled"}}
		case "approved":
			poFilter["status"] = bson.M{"$in": []string{"issued", "partial", "received"}}
		case "rejected":
			poFilter["status"] = "cancelled"
		default: // pending
			poFilter["status"] = "pending_approval"
		}
		if poCur, poErr := purchaseOrderCollection.Find(ctx, poFilter,
			options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})); poErr == nil {
			var pos []models.PurchaseOrder
			poCur.All(ctx, &pos)
			poCur.Close(ctx)
			for _, po := range pos {
				synth := "pending"
				switch po.Status {
				case "issued", "partial", "received":
					synth = "approved"
				case "cancelled":
					synth = "rejected"
				}
				items := make([]gin.H, 0, len(po.Items))
				for _, it := range po.Items {
					items = append(items, gin.H{"details": it.Details, "quantity": it.Quantity, "rate": it.Rate, "amount": it.Amount})
				}
				out = append(out, gin.H{"req": gin.H{
					"_id":             po.ID.Hex(),
					"docType":         "purchase_order",
					"action":          "create",
					"title":           po.OrderNumber,
					"amount":          po.Total,
					"status":          synth,
					"requestedBy":     po.CreatedBy,
					"requestedByName": po.CreatedBy,
					"requestedAt":     po.CreatedAt,
					"steps":           []gin.H{},
					"currentStep":     0,
					"payload": gin.H{
						"vendorName": po.VendorName,
						"items":      items,
						"totals":     gin.H{"subTotal": po.SubTotal, "tax": po.TotalTax, "grandTotal": po.Total},
					},
				}, "canAct": synth == "pending" && (role == "owner" || role == "admin")})
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": gin.H{"requests": out, "pendingCount": pendingCount, "myRole": role}})
	}
}

func ApproveRequest() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()

		orgIDStr := fmt.Sprintf("%v", func() interface{} { v, _ := c.Get("orgId"); return v }())
		userIDStr := fmt.Sprintf("%v", func() interface{} { v, _ := c.Get("userId"); return v }())
		orgObjID, _ := primitive.ObjectIDFromHex(orgIDStr)

		reqObjID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid approval ID"})
			return
		}
		// Optional approver note — shown to the requester on the approval notification.
		var body struct {
			Note string `json:"note"`
		}
		c.ShouldBindJSON(&body)
		var ar models.ApprovalRequest
		if err := approvalRequestCollection.FindOne(ctx, bson.M{"_id": reqObjID, "orgId": orgIDStr}).Decode(&ar); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Approval request not found"})
			return
		}
		if ar.Status != "pending" {
			c.JSON(http.StatusConflict, gin.H{"message": "Request already " + ar.Status})
			return
		}
		if ar.CurrentStep >= len(ar.Steps) {
			c.JSON(http.StatusConflict, gin.H{"message": "No step to approve"})
			return
		}

		role, ok := getMemberRole(ctx, orgObjID, userIDStr)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"message": "Not a member of this organization"})
			return
		}
		step := &ar.Steps[ar.CurrentStep]
		if !stepEligible(role, *step) {
			c.JSON(http.StatusForbidden, gin.H{"message": "You can't approve the current step"})
			return
		}

		// Record this approval (one per user per step).
		already := false
		for _, a := range step.Approvals {
			if a.UserID == userIDStr {
				already = true
				break
			}
		}
		if !already {
			step.Approvals = append(step.Approvals, models.StepApproval{UserID: userIDStr, Role: role, At: time.Now()})
		}

		advanced := false
		if stepSatisfied(*step) {
			step.Done = true
			ar.CurrentStep++
			advanced = true
		}

		// All steps cleared → create the document.
		if advanced && ar.CurrentStep >= len(ar.Steps) {
			docID, docNumber, err := replayApprovedCreate(ctx, orgIDStr, ar.RequestedBy, ar)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create the approved document", "error": err.Error()})
				return
			}
			approvalRequestCollection.UpdateOne(ctx, bson.M{"_id": reqObjID}, bson.M{"$set": bson.M{
				"steps": ar.Steps, "currentStep": ar.CurrentStep,
				"status": "approved", "decidedBy": userIDStr, "decidedAt": time.Now(),
				"resultDocId": docID, "resultDocNumber": docNumber, "approvalNote": body.Note,
			}})
			go notifyRequester(orgIDStr, ar, true, body.Note, docNumber)
			go ws.GlobalHub.Broadcast(ws.Event{Type: "approvals_updated", Action: "update", OrgID: orgIDStr})
			c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Approved — document created", "data": gin.H{"docId": docID, "docNumber": docNumber, "complete": true}})
			return
		}

		// Otherwise persist progress (more approvals or next step pending).
		approvalRequestCollection.UpdateOne(ctx, bson.M{"_id": reqObjID}, bson.M{"$set": bson.M{
			"steps": ar.Steps, "currentStep": ar.CurrentStep,
		}})
		if advanced {
			go notifyStepApprovers(orgIDStr, ar)
		}
		go ws.GlobalHub.Broadcast(ws.Event{Type: "approvals_updated", Action: "update", OrgID: orgIDStr})
		msg := "Approval recorded"
		if advanced {
			msg = "Step cleared — moved to next approver"
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": msg, "data": gin.H{"complete": false, "currentStep": ar.CurrentStep}})
	}
}

func RejectRequest() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgIDStr := fmt.Sprintf("%v", func() interface{} { v, _ := c.Get("orgId"); return v }())
		userIDStr := fmt.Sprintf("%v", func() interface{} { v, _ := c.Get("userId"); return v }())
		orgObjID, _ := primitive.ObjectIDFromHex(orgIDStr)

		reqObjID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid approval ID"})
			return
		}
		var body struct {
			Reason string `json:"reason"`
		}
		c.ShouldBindJSON(&body)

		var ar models.ApprovalRequest
		if err := approvalRequestCollection.FindOne(ctx, bson.M{"_id": reqObjID, "orgId": orgIDStr}).Decode(&ar); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Approval request not found"})
			return
		}
		if ar.Status != "pending" {
			c.JSON(http.StatusConflict, gin.H{"message": "Request already " + ar.Status})
			return
		}
		role, ok := getMemberRole(ctx, orgObjID, userIDStr)
		if !ok || (ar.CurrentStep < len(ar.Steps) && !stepEligible(role, ar.Steps[ar.CurrentStep])) {
			c.JSON(http.StatusForbidden, gin.H{"message": "You can't act on the current step"})
			return
		}

		approvalRequestCollection.UpdateOne(ctx, bson.M{"_id": reqObjID}, bson.M{"$set": bson.M{
			"status": "rejected", "decidedBy": userIDStr, "decidedAt": time.Now(), "reason": body.Reason,
		}})
		go notifyRequester(orgIDStr, ar, false, body.Reason, "")
		go ws.GlobalHub.Broadcast(ws.Event{Type: "approvals_updated", Action: "update", OrgID: orgIDStr})
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Rejected"})
	}
}

// replayApprovedCreate re-runs the held create through its normal path. The bill has a
// dedicated core; the others are replayed through their real gin handlers via a synthetic
// request context (gate bypassed with "approvalReplay"), so every GL / balance side-effect
// runs exactly as a non-approval create would.
func replayApprovedCreate(ctx context.Context, orgIDStr, requestedBy string, ar models.ApprovalRequest) (string, string, error) {
	idParam := gin.Params{{Key: "id", Value: ar.DocID}}

	switch ar.Action {
	case "update":
		switch ar.DocType {
		case "bill":
			return syntheticReplay(UpdateBill(), http.MethodPut, idParam, orgIDStr, requestedBy, ar.Payload, ar.DocID)
		case "invoice":
			return syntheticReplay(UpdateInvoice(), http.MethodPut, idParam, orgIDStr, requestedBy, ar.Payload, ar.DocID)
		case "customer":
			return syntheticReplay(UpdateCustomer(), http.MethodPut, idParam, orgIDStr, requestedBy, ar.Payload, ar.DocID)
		case "vendor":
			return syntheticReplay(UpdateVendor(), http.MethodPut, idParam, orgIDStr, requestedBy, ar.Payload, ar.DocID)
		case "quote":
			return syntheticReplay(UpdateQuote(), http.MethodPut, idParam, orgIDStr, requestedBy, ar.Payload, ar.DocID)
		case "po":
			return syntheticReplay(UpdatePurchaseOrder(), http.MethodPut, idParam, orgIDStr, requestedBy, ar.Payload, ar.DocID)
		}
	case "delete":
		switch ar.DocType {
		case "bill":
			return syntheticReplay(VoidBill(), http.MethodPatch, idParam, orgIDStr, requestedBy, nil, ar.DocID)
		case "invoice":
			return syntheticReplay(VoidInvoice(), http.MethodPatch, idParam, orgIDStr, requestedBy, nil, ar.DocID)
		}
	case "finalize":
		if ar.DocType == "invoice" {
			return syntheticReplay(FinalizeProforma(), http.MethodPost, idParam, orgIDStr, requestedBy, nil, ar.DocID)
		}
	default: // create
		switch ar.DocType {
		case "bill":
			raw, err := bson.Marshal(ar.Payload)
			if err != nil {
				return "", "", err
			}
			var b models.Bill
			if err := bson.Unmarshal(raw, &b); err != nil {
				return "", "", err
			}
			return createBillCore(ctx, orgIDStr, requestedBy, b)
		case "invoice":
			return syntheticReplay(CreateInvoice(), http.MethodPost, nil, orgIDStr, requestedBy, ar.Payload, "")
		case "vendor_payment":
			return syntheticReplay(CreateVendorPayment(), http.MethodPost, nil, orgIDStr, requestedBy, ar.Payload, "")
		case "payment":
			return syntheticReplay(CreatePayment(), http.MethodPost, nil, orgIDStr, requestedBy, ar.Payload, "")
		case "po":
			return syntheticReplay(CreatePurchaseOrder(), http.MethodPost, nil, orgIDStr, requestedBy, ar.Payload, "")
		case "customer":
			return syntheticReplay(AddCustomers(), http.MethodPost, nil, orgIDStr, requestedBy, ar.Payload, "")
		case "vendor":
			return syntheticReplay(CreateVendor(), http.MethodPost, nil, orgIDStr, requestedBy, ar.Payload, "")
		case "quote":
			return syntheticReplay(CreateQuote(), http.MethodPost, nil, orgIDStr, requestedBy, ar.Payload, "")
		case "project":
			return syntheticReplay(CreateProject(), http.MethodPost, nil, orgIDStr, requestedBy, ar.Payload, "")
		}
	}
	return "", "", fmt.Errorf("unsupported %s/%s", ar.Action, ar.DocType)
}

// syntheticReplay invokes a handler with a synthetic request (gate bypassed). For
// update/delete it passes the :id param and returns docID as the result id.
func syntheticReplay(handler gin.HandlerFunc, method string, params gin.Params, orgID, userID string, payload bson.M, docID string) (string, string, error) {
	var body []byte
	if payload != nil {
		body, _ = json.Marshal(payload)
	}
	w := httptest.NewRecorder()
	tc, _ := gin.CreateTestContext(w)
	tc.Request = httptest.NewRequest(method, "/", bytes.NewReader(body))
	tc.Request.Header.Set("Content-Type", "application/json")
	if params != nil {
		tc.Params = params
	}
	tc.Set("orgId", orgID)
	tc.Set("userId", userID)
	tc.Set("approvalReplay", true)
	handler(tc)

	if w.Code >= 300 {
		return "", "", fmt.Errorf("replay failed (%d): %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data map[string]interface{} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	id, _ := resp.Data["id"].(string)
	if id == "" {
		id = docID
	}
	number := ""
	for _, k := range []string{"billNumber", "paymentNumber", "invoiceNumber", "orderNumber", "number"} {
		if v, ok := resp.Data[k].(string); ok && v != "" {
			number = v
			break
		}
	}
	return id, number, nil
}
