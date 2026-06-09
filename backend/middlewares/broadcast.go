package middlewares

import (
	"net/http"
	"strings"

	"github.com/backend/ws"
	"github.com/gin-gonic/gin"
)

// entityFromPath maps a route path to a frontend event entity, e.g.
//   /api/invoices/:id/status        → "invoices"
//   /api/sales-orders/              → "sales_orders"
//   /api/inventory/adjustments/     → "adjustments"
// Returns "" when there's no meaningful entity (e.g. /api/auth, /ws).
func entityFromPath(p string) string {
	segs := strings.Split(strings.Trim(p, "/"), "/")
	if len(segs) < 2 || segs[0] != "api" {
		return ""
	}
	entity := segs[1]
	// A couple of group prefixes nest the real entity one level deeper.
	if (entity == "inventory" || entity == "reports") && len(segs) >= 3 {
		entity = segs[2]
	}
	// Routes never broadcast (auth, infra).
	switch entity {
	case "auth", "documents", "search", "":
		return ""
	}
	// Frontend event types use underscores: "sales-orders" → "sales_orders".
	return strings.ReplaceAll(entity, "-", "_")
}

// actionFromMethod maps the HTTP verb to a coarse action label.
func actionFromMethod(m string) string {
	switch m {
	case http.MethodPost:
		return "create"
	case http.MethodPut, http.MethodPatch:
		return "update"
	case http.MethodDelete:
		return "delete"
	default:
		return "update"
	}
}

// BroadcastMutations emits a WebSocket "<entity>_updated" event after any successful
// mutating request, scoped to the caller's org. Registered globally; it runs its work
// AFTER the handler (c.Next) so orgId is set by RequireOrg and the status is known.
// This gives every module live cross-client updates without each controller emitting
// its own event.
func BroadcastMutations() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			return
		}
		if c.Writer.Status() >= http.StatusMultipleChoices {
			return // only broadcast on success (2xx)
		}
		orgVal, ok := c.Get("orgId")
		if !ok {
			return
		}
		orgID, _ := orgVal.(string)
		if orgID == "" {
			return
		}
		entity := entityFromPath(c.FullPath())
		if entity == "" {
			return
		}
		ws.GlobalHub.Broadcast(ws.Event{
			Type:   entity + "_updated",
			Action: actionFromMethod(c.Request.Method),
			OrgID:  orgID,
		})
	}
}
