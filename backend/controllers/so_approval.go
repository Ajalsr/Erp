package controllers

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// soRisk is what the customer risk checks found for an order.
type soRisk struct {
	reasons       []string // human-readable flags (credit limit, expired license, overdue invoices)
	creditBlocked bool     // credit limit exceeded on a customer set to "block"
	creditWarning gin.H    // credit usage detail for the UI (nil when within limit)
}

// soRiskChecks flags a sales order for review: credit limit exceeded (only a hard flag
// when the customer is set to "block"), an expired trade license, or overdue invoices.
func soRiskChecks(ctx context.Context, orgIDStr, customerID string, customer models.Customer, total float64) soRisk {
	var r soRisk
	invCol := config.GetCollection(config.DB, "invoices")

	if customer.CreditLimit > 0 {
		var invRes []struct {
			Total float64 `bson:"total"`
		}
		if cur, err := invCol.Aggregate(ctx, []bson.M{
			{"$match": bson.M{"orgId": orgIDStr, "customerId": customerID, "status": bson.M{"$in": []string{"unpaid", "partially_paid", "overdue"}}}},
			{"$group": bson.M{"_id": nil, "total": bson.M{"$sum": "$balanceDue"}}},
		}); err == nil {
			_ = cur.All(ctx, &invRes)
		}
		var soRes []struct {
			Total float64 `bson:"total"`
		}
		if cur, err := config.GetCollection(config.DB, "sales_orders").Aggregate(ctx, []bson.M{
			{"$match": bson.M{"orgId": orgIDStr, "customerId": customerID, "status": bson.M{"$in": []string{"open", "confirmed", "processing"}}}},
			{"$group": bson.M{"_id": nil, "total": bson.M{"$sum": "$total"}}},
		}); err == nil {
			_ = cur.All(ctx, &soRes)
		}
		currentUsed := 0.0
		if len(invRes) > 0 {
			currentUsed += invRes[0].Total
		}
		if len(soRes) > 0 {
			currentUsed += soRes[0].Total
		}
		projectedUsed := currentUsed + total
		if projectedUsed > customer.CreditLimit {
			r.creditWarning = gin.H{
				"creditLimit":   customer.CreditLimit,
				"currentUsed":   math.Round(currentUsed*100) / 100,
				"thisOrder":     total,
				"projectedUsed": math.Round(projectedUsed*100) / 100,
				"exceeded":      true,
			}
			if customer.CreditLimitAction == "block" {
				r.creditBlocked = true
				r.reasons = append(r.reasons, fmt.Sprintf("Credit limit exceeded (limit AED %.2f, this order would reach AED %.2f)", customer.CreditLimit, projectedUsed))
			}
		}
	}

	// Expired trade license (customer custom field "licenseExpiryDate", YYYY-MM-DD).
	if customer.CustomFields != nil {
		if exp, ok := customer.CustomFields["licenseExpiryDate"].(string); ok && exp != "" && exp < time.Now().Format("2006-01-02") {
			r.reasons = append(r.reasons, "Customer's trade license expired on "+exp)
		}
	}

	if n, _ := invCol.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "customerId": customerID, "status": "overdue"}); n > 0 {
		r.reasons = append(r.reasons, fmt.Sprintf("%d overdue invoice(s) on this customer", n))
	}
	return r
}

// soDecision is the outcome of soApprovalDecision.
type soDecision struct {
	hold         bool     // order goes to pending_approval
	autoApproved bool     // risk flags fired but no hold — surfaced as a warning
	reasons      []string // why it was held / flagged
	blockMsg     string   // non-empty ⇒ refuse the order outright
}

// soApprovalDecision decides whether submitting a sales order needs approval. Only the
// org's Sales Orders policy (Settings → Approvals) can hold an order:
//   - owner/admin: never held (risk flags become a warning)
//   - policy off: never held; risk flags are a warning — except a credit limit on a
//     customer set to "block", which refuses the order (that's the customer's setting)
//   - policy on: held when its conditions match or a risk flag fires, unless the
//     submitter is a configured sales-order approver
func soApprovalDecision(ctx context.Context, orgIDStr, userID string, total float64, customerName string, risk soRisk) soDecision {
	d := soDecision{reasons: risk.reasons}
	role := ""
	orgObjID, _ := primitive.ObjectIDFromHex(orgIDStr)
	if r, ok := getMemberRole(ctx, orgObjID, userID); ok {
		role = r
	}
	flagged := len(risk.reasons) > 0

	if role == "owner" || role == "admin" {
		d.autoApproved = flagged
		return d
	}

	policy, ok := loadPolicy(ctx, orgIDStr, "sales_orders")
	if !ok || !policy.Enabled || !policy.GatesAction("create") {
		if risk.creditBlocked {
			d.blockMsg = "Credit limit exceeded — this customer is set to block orders over their limit. Ask an owner or admin to place it."
			return d
		}
		d.autoApproved = flagged
		return d
	}

	triggered := evaluateTrigger(policy, "sales_orders", bson.M{"total": total, "customerName": customerName})
	if !triggered && !flagged {
		return d
	}
	if salesOrderApproverRoles(ctx, orgObjID)[role] {
		d.autoApproved = true // the submitter could approve it themselves
		return d
	}
	d.hold = true
	if len(d.reasons) == 0 {
		d.reasons = []string{"Sales order approval is required (Settings → Approvals)"}
	}
	return d
}

// notifySOApprovers tells everyone who can approve sales orders that one is waiting.
func notifySOApprovers(orgIDStr string, so models.SalesOrder, submittedBy string) {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	orgObjID, err := primitive.ObjectIDFromHex(orgIDStr)
	if err != nil {
		return
	}
	roles := make([]string, 0)
	for r := range salesOrderApproverRoles(ctx, orgObjID) {
		roles = append(roles, r)
	}
	cur, err := orgMemberCollection.Find(ctx, bson.M{"orgId": orgObjID, "status": "active", "role": bson.M{"$in": roles}, "userId": bson.M{"$ne": submittedBy}})
	if err != nil {
		return
	}
	var members []models.OrgMember
	cur.All(ctx, &members)
	cur.Close(ctx)
	msg := fmt.Sprintf("Order %s for %s (AED %.2f) submitted by %s — awaiting your approval.", so.OrderNumber, so.CustomerName, so.Total, submittedBy)
	meta := map[string]string{"orderId": so.ID.Hex(), "orderNumber": so.OrderNumber, "submittedBy": submittedBy}
	for _, m := range members {
		pushNotificationWithMeta(m.UserID, "approval_request", "Sales Order Needs Approval", msg, orgIDStr, "", meta)
	}
}
