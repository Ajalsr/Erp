package controllers

// ── GetActivityFeed ────────────────────────────────────────────────────────────
// GET /api/dashboard/activity-feed?limit=20
//
// Aggregates real events from three collections:
//   • sales_orders  → "new_order", "status_change"
//   • customers     → "new_customer"
//   • stocks        → "low_stock"  (quantity <= reorder_point)
//
// Returns a unified, time-sorted list so the frontend Activity Feed shows
// live data instead of the hardcoded mock array.
//
// Drop this file into your controllers/ package.  Then register the route in
// api.go:
//   dashRoutes.GET("/activity-feed", controllers.GetActivityFeed())

import (
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/backend/config"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/net/context"
)

// ActivityEvent is the unified shape returned to the frontend.
type ActivityEvent struct {
	ID        string                 `json:"id"`
	Kind      string                 `json:"kind"` // "cart"|"truck"|"invoice"|"user"|"box"|"warning"
	Text      string                 `json:"text"` // human-readable description
	By        string                 `json:"by"`   // actor name / "System"
	CreatedAt time.Time              `json:"createdAt"`
	AgoSecs   int64                  `json:"agoSecs"`        // seconds since event, for live "Xm ago" display
	Meta      map[string]interface{} `json:"meta,omitempty"` // optional extra fields
}

func GetActivityFeed() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
		defer cancel()

		// Parse ?limit= (default 20, max 50)
		limitStr := c.DefaultQuery("limit", "20")
		limit, _ := strconv.Atoi(limitStr)
		if limit <= 0 || limit > 50 {
			limit = 20
		}

		now := time.Now()
		var events []ActivityEvent

		// ── 1. Recent Sales Orders ──────────────────────────────────────
		soCol := config.GetCollection(config.DB, "sales_orders")
		soOpts := options.Find().
			SetSort(bson.D{{Key: "createdAt", Value: -1}}).
			SetLimit(int64(limit)).
			SetProjection(bson.M{
				"orderNumber":  1,
				"customerName": 1,
				"status":       1,
				"createdAt":    1,
				"updatedAt":    1,
				"salesperson":  1,
				"total":        1,
			})

		soCursor, err := soCol.Find(ctx, bson.M{}, soOpts)
		if err == nil {
			defer soCursor.Close(ctx)
			var soResults []bson.M
			if err := soCursor.All(ctx, &soResults); err == nil {
				for _, so := range soResults {
					orderNum, _ := so["orderNumber"].(string)
					custName, _ := so["customerName"].(string)
					status, _ := so["status"].(string)
					salesperson, _ := so["salesperson"].(string)
					total, _ := so["total"].(float64)
					if salesperson == "" {
						salesperson = "System"
					}

					// Determine event time — prefer updatedAt for status changes
					eventTime := extractTime(so, "createdAt")
					kind := "cart"
					text := "New sale order #" + orderNum + " created"

					// If order is not in initial state, show latest status change
					if status != "" && status != "draft" && status != "pending" {
						updatedAt := extractTime(so, "updatedAt")
						if !updatedAt.IsZero() && updatedAt.After(eventTime) {
							eventTime = updatedAt
							kind = "invoice"
							text = "Sale order #" + orderNum + " marked as " + status
						}
					}

					if orderNum == "" {
						continue
					}

					meta := map[string]interface{}{
						"orderNumber": orderNum,
						"status":      status,
						"total":       math.Round(total*100) / 100,
					}
					if custName != "" {
						meta["customerName"] = custName
					}

					events = append(events, ActivityEvent{
						ID:        idStr(so["_id"]),
						Kind:      kind,
						Text:      text,
						By:        salesperson,
						CreatedAt: eventTime,
						AgoSecs:   int64(now.Sub(eventTime).Seconds()),
						Meta:      meta,
					})
				}
			}
		}

		// ── 2. Recent Customers ─────────────────────────────────────────
		custCol := config.GetCollection(config.DB, "customers")
		custOpts := options.Find().
			SetSort(bson.D{{Key: "created_at", Value: -1}}).
			SetLimit(int64(limit / 2)).
			SetProjection(bson.M{
				"customerDisplayName": 1,
				"companyName":         1,
				"created_by":          1,
				"created_at":          1,
				"customerCode":        1,
			})

		custCursor, err := custCol.Find(ctx, bson.M{"status": bson.M{"$ne": "deleted"}}, custOpts)
		if err == nil {
			defer custCursor.Close(ctx)
			var custResults []bson.M
			if err := custCursor.All(ctx, &custResults); err == nil {
				for _, cust := range custResults {
					name, _ := cust["customerDisplayName"].(string)
					company, _ := cust["companyName"].(string)
					createdBy, _ := cust["created_by"].(string)
					code, _ := cust["customerCode"].(string)
					if createdBy == "" {
						createdBy = "System"
					}
					eventTime := extractTime(cust, "created_at")
					if name == "" {
						name = company
					}
					if name == "" {
						continue
					}
					displayName := name
					if company != "" && company != name {
						displayName = name + " (" + company + ")"
					}
					events = append(events, ActivityEvent{
						ID:        idStr(cust["_id"]),
						Kind:      "user",
						Text:      "New customer: " + displayName,
						By:        createdBy,
						CreatedAt: eventTime,
						AgoSecs:   int64(now.Sub(eventTime).Seconds()),
						Meta:      map[string]interface{}{"customerCode": code},
					})
				}
			}
		}

		// ── 3. Stock items — new items added + low stock alerts ────────────
		stockCol := config.GetCollection(config.DB, "stocks")
		stockOpts := options.Find().
			SetSort(bson.D{{Key: "created_at", Value: -1}}).
			SetLimit(int64(limit)).
			SetProjection(bson.M{
				"name":          1,
				"item_code":     1,
				"quantity":      1,
				"reorder_point": 1,
				"created_at":    1,
				"created_by":    1,
				"category":      1,
			})

		stockCursor, err := stockCol.Find(ctx, bson.M{}, stockOpts)
		if err == nil {
			defer stockCursor.Close(ctx)
			var stockResults []bson.M
			if err := stockCursor.All(ctx, &stockResults); err == nil {
				for _, item := range stockResults {
					name, _ := item["name"].(string)
					if name == "" {
						continue
					}
					qtyStr, _ := item["quantity"].(string)
					ropStr, _ := item["reorder_point"].(string)
					qty, _ := strconv.ParseFloat(qtyStr, 64)
					rop, _ := strconv.ParseFloat(ropStr, 64)
					createdBy, _ := item["created_by"].(string)
					if createdBy == "" {
						createdBy = "System"
					}

					// New item event — if created_at exists and is recent (last 7 days)
					itemTime := extractTime(item, "created_at")
					if !itemTime.IsZero() && now.Sub(itemTime) < 7*24*time.Hour {
						events = append(events, ActivityEvent{
							ID:        idStr(item["_id"]) + "-new",
							Kind:      "invoice",
							Text:      "New item added: " + name,
							By:        createdBy,
							CreatedAt: itemTime,
							AgoSecs:   int64(now.Sub(itemTime).Seconds()),
							Meta:      map[string]interface{}{"itemCode": item["item_code"]},
						})
					}

					// Low stock alert — independent of creation time
					if rop > 0 && qty <= rop {
						severity := "warning"
						if qty <= 0 {
							severity = "critical"
						}
						events = append(events, ActivityEvent{
							ID:        idStr(item["_id"]) + "-lowstock",
							Kind:      "box",
							Text:      "Low stock alert: " + name,
							By:        "System",
							CreatedAt: now,
							AgoSecs:   0,
							Meta: map[string]interface{}{
								"quantity":     qty,
								"reorderPoint": rop,
								"severity":     severity,
							},
						})
					}
				}
			}
		}

		// ── Sort all events newest-first, cap at limit ──────────────────
		sort.Slice(events, func(i, j int) bool {
			return events[i].CreatedAt.After(events[j].CreatedAt)
		})
		if len(events) > limit {
			events = events[:limit]
		}

		// Recalculate agoSecs after sort (monotone now reference)
		for i := range events {
			events[i].AgoSecs = int64(now.Sub(events[i].CreatedAt).Seconds())
		}

		if events == nil {
			events = []ActivityEvent{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Activity feed retrieved successfully",
			"data":    events,
		})
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

func extractTime(doc bson.M, key string) time.Time {
	if v, ok := doc[key]; ok {
		switch t := v.(type) {
		case time.Time:
			return t
		case primitive.DateTime:
			return t.Time()
		}
	}
	return time.Time{}
}

func idStr(v interface{}) string {
	if v == nil {
		return ""
	}
	switch id := v.(type) {
	case primitive.ObjectID:
		return id.Hex()
	case string:
		return id
	}
	return ""
}
