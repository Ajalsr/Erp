package controllers

import (
	"context"
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/backend/config"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// SearchResult is one hit in the global search dropdown. type drives the icon and
// the client-side route (Frontend Navbar routeForResult).
type SearchResult struct {
	Type     string `json:"type"`     // customer | item | invoice | sales_order | quote | vendor | bill | purchase_order
	ID       string `json:"id"`       // hex ObjectID
	Title    string `json:"title"`    // primary line (name / number)
	Subtitle string `json:"subtitle"` // secondary line (code / counterparty)
	Status   string `json:"status"`   // optional status chip
}

// searchCategory describes how to search one collection: the module key gating it,
// the result type, the Mongo collection name, the bson fields matched against the
// query, and how to turn a matched document into a SearchResult.
type searchCategory struct {
	module     string
	resultType string
	collection string
	fields     []string
	titleField string
	subFields  []string // first non-empty used as subtitle
	statusFld  string
}

var searchCategories = []searchCategory{
	{module: "customers", resultType: "customer", collection: "customers",
		fields:     []string{"customerDisplayName", "companyName", "customerCode", "customerEmail", "customerPhone"},
		titleField: "customerDisplayName", subFields: []string{"customerCode", "companyName"}, statusFld: "status"},
	{module: "items", resultType: "item", collection: "stocks",
		fields:     []string{"name", "item_code"},
		titleField: "name", subFields: []string{"item_code"}},
	{module: "invoices", resultType: "invoice", collection: "invoices",
		fields:     []string{"invoiceNumber", "billTo.name"},
		titleField: "invoiceNumber", subFields: []string{"billTo.name"}, statusFld: "status"},
	{module: "sales_orders", resultType: "sales_order", collection: "sales_orders",
		fields:     []string{"orderNumber", "customerName", "customerCode"},
		titleField: "orderNumber", subFields: []string{"customerName"}, statusFld: "status"},
	{module: "quotes", resultType: "quote", collection: "quotes",
		fields:     []string{"quoteNumber", "customerName"},
		titleField: "quoteNumber", subFields: []string{"customerName"}, statusFld: "status"},
	{module: "vendors", resultType: "vendor", collection: "vendors",
		fields:     []string{"displayName", "companyName", "vendorCode", "email"},
		titleField: "displayName", subFields: []string{"vendorCode", "companyName"}, statusFld: "status"},
	{module: "bills", resultType: "bill", collection: "bills",
		fields:     []string{"billNumber", "vendorName", "vendorRef"},
		titleField: "billNumber", subFields: []string{"vendorName"}, statusFld: "status"},
	{module: "purchase_orders", resultType: "purchase_order", collection: "purchase_orders",
		fields:     []string{"orderNumber", "vendorName", "vendorCode"},
		titleField: "orderNumber", subFields: []string{"vendorName"}, statusFld: "status"},
}

// firstString pulls a value out of a (possibly dotted) bson path, returning "" when
// absent. Supports one level of nesting (e.g. "billTo.name").
func firstString(doc bson.M, path string) string {
	if v, ok := doc[path]; ok {
		if s, ok := v.(string); ok {
			return s
		}
		return ""
	}
	// dotted path — one level deep is all we need
	for i := 0; i < len(path); i++ {
		if path[i] == '.' {
			if sub, ok := doc[path[:i]].(bson.M); ok {
				if s, ok := sub[path[i+1:]].(string); ok {
					return s
				}
			}
			return ""
		}
	}
	return ""
}

// GlobalSearch searches across the core entities in one request. Each category is
// gated by the caller's view permission on its module, so results never leak a
// module the role cannot read. Per-category limit keeps the payload small.
func GlobalSearch() gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("q")
		if len(query) < 2 {
			c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "results": []SearchResult{}})
			return
		}

		orgIDVal, _ := c.Get("orgId")
		orgID, _ := orgIDVal.(string)
		userIDVal, _ := c.Get("userId")
		userID, _ := userIDVal.(string)

		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()

		// Resolve role once to gate categories by view permission.
		role := ""
		if oid, err := primitive.ObjectIDFromHex(orgID); err == nil {
			if r, ok := middlewares.MemberRole(ctx, oid, userID); ok {
				role = r
			}
			// Build the per-category regex filter once.
			safe := regexp.QuoteMeta(query)
			rx := bson.M{"$regex": safe, "$options": "i"}

			var (
				wg   sync.WaitGroup
				mu   sync.Mutex
				hits = make([]SearchResult, 0, 32)
			)

			for _, cat := range searchCategories {
				if !middlewares.RoleCanView(ctx, oid, role, cat.module) {
					continue
				}
				wg.Add(1)
				go func(cat searchCategory) {
					defer wg.Done()

					or := make([]bson.M, 0, len(cat.fields))
					for _, f := range cat.fields {
						or = append(or, bson.M{f: rx})
					}
					filter := bson.M{"orgId": orgID, "$or": or}
					if cat.statusFld != "" {
						filter[cat.statusFld] = bson.M{"$ne": "deleted"}
					}

					col := config.GetCollection(config.DB, cat.collection)
					opts := options.Find().SetLimit(5).SetSort(bson.D{{Key: "updatedAt", Value: -1}})
					cur, err := col.Find(ctx, filter, opts)
					if err != nil {
						return
					}
					defer cur.Close(ctx)

					var docs []bson.M
					if err := cur.All(ctx, &docs); err != nil {
						return
					}

					local := make([]SearchResult, 0, len(docs))
					for _, d := range docs {
						id := ""
						if oid, ok := d["_id"].(primitive.ObjectID); ok {
							id = oid.Hex()
						}
						sub := ""
						for _, sf := range cat.subFields {
							if v := firstString(d, sf); v != "" {
								sub = v
								break
							}
						}
						local = append(local, SearchResult{
							Type:     cat.resultType,
							ID:       id,
							Title:    firstString(d, cat.titleField),
							Subtitle: sub,
							Status:   firstString(d, cat.statusFld),
						})
					}

					mu.Lock()
					hits = append(hits, local...)
					mu.Unlock()
				}(cat)
			}

			wg.Wait()
			c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "results": hits})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid organization ID"})
	}
}
