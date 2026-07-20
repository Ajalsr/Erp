package controllers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var employeeCollection *mongo.Collection = config.GetCollection(config.DB, "employees")

func generateEmployeeCode(ctx context.Context, orgID string) string {
	return nextNumber(ctx, orgID, "employee", employeeCollection, "employeeCode")
}

func splitDisplayName(name string) (first, last string) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "Member", ""
	}
	parts := strings.SplitN(name, " ", 2)
	if len(parts) == 1 {
		return parts[0], ""
	}
	return parts[0], parts[1]
}

func titleCaseRole(role string) string {
	role = strings.ReplaceAll(role, "_", " ")
	words := strings.Fields(role)
	for i, w := range words {
		words[i] = strings.ToUpper(w[:1]) + w[1:]
	}
	if len(words) == 0 {
		return "Member"
	}
	return strings.Join(words, " ")
}

// syncEmployeeFromMember creates a directory Employee row for an org member if one
// doesn't already exist for this org+userId. Self-contained context (like autoJE) so
// it's safe to call as `go syncEmployeeFromMember(...)` from a request handler whose
// own ctx gets cancelled when the handler returns. Best-effort — a failure here must
// never block the member-join flow, so errors are only logged.
func syncEmployeeFromMember(orgID primitive.ObjectID, userIDStr, role string, joinedAt time.Time) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if userIDStr == "" {
		return
	}
	orgIDStr := orgID.Hex()
	count, _ := employeeCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "userId": userIDStr})
	if count > 0 {
		return
	}
	first, last := splitDisplayName(userIDStr)
	email := ""
	if strings.Contains(userIDStr, "@") {
		email = userIDStr
	}
	if joinedAt.IsZero() {
		joinedAt = time.Now()
	}
	e := models.Employee{
		ID:             primitive.NewObjectID(),
		EmployeeCode:   generateEmployeeCode(ctx, orgIDStr),
		FirstName:      first,
		LastName:       last,
		DisplayName:    userIDStr,
		Email:          email,
		JobTitle:       titleCaseRole(role),
		EmploymentType: "full_time",
		Status:         "active",
		HireDate:       joinedAt.Format("2006-01-02"),
		UserID:         userIDStr,
		OrgID:          orgIDStr,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		CreatedBy:      "system",
	}
	if _, err := employeeCollection.InsertOne(ctx, e); err != nil {
		log.Printf("syncEmployeeFromMember: insert failed for org %s userId %s: %v", orgIDStr, userIDStr, err)
	}
}

// EnsureEmployeeRecordsForMembers backfills an Employee directory row for every
// active OrgMember that doesn't have one yet — covers orgs/members that existed
// before the Employees module shipped. Idempotent, safe to run on every boot.
func EnsureEmployeeRecordsForMembers(ctx context.Context) {
	cursor, err := orgMemberCollection.Find(ctx, bson.M{"status": "active"})
	if err != nil {
		log.Printf("EnsureEmployeeRecordsForMembers: find failed: %v", err)
		return
	}
	defer cursor.Close(ctx)

	var members []models.OrgMember
	if err := cursor.All(ctx, &members); err != nil {
		log.Printf("EnsureEmployeeRecordsForMembers: decode failed: %v", err)
		return
	}
	for _, m := range members {
		syncEmployeeFromMember(m.OrgID, m.UserID, m.Role, m.JoinedAt)
	}
}

func CreateEmployee() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var e models.Employee
		if err := c.ShouldBindJSON(&e); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if e.FirstName == "" || e.LastName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "First name and last name are required"})
			return
		}
		if e.JobTitle == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Job title is required"})
			return
		}
		if e.HireDate == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Hire date is required"})
			return
		}

		if e.UserID != "" {
			count, _ := orgMemberCollection.CountDocuments(ctx, bson.M{"orgId": mustOrgObjectID(orgIDStr), "userId": e.UserID})
			if count == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "userId does not match an active member of this organization"})
				return
			}
		}

		e.ID = primitive.NewObjectID()
		e.OrgID = orgIDStr
		e.EmployeeCode = generateEmployeeCode(ctx, orgIDStr)
		if e.DisplayName == "" {
			e.DisplayName = e.FirstName + " " + e.LastName
		}
		if e.Status == "" {
			e.Status = "active"
		}
		if e.EmploymentType == "" {
			e.EmploymentType = "full_time"
		}
		e.CreatedAt = time.Now()
		e.UpdatedAt = time.Now()
		if userID != nil {
			e.CreatedBy = userID.(string)
		}

		if _, err := employeeCollection.InsertOne(ctx, e); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create employee", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Employee created successfully",
			"data":    gin.H{"id": e.ID.Hex(), "employeeCode": e.EmployeeCode, "displayName": e.DisplayName},
		})
	}
}

func GetAllEmployees() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if dept := c.Query("department"); dept != "" {
			filter["department"] = dept
		}
		if q := c.Query("q"); q != "" {
			pattern := primitive.Regex{Pattern: regexp.QuoteMeta(q), Options: "i"}
			filter["$or"] = bson.A{
				bson.M{"firstName": pattern},
				bson.M{"lastName": pattern},
				bson.M{"displayName": pattern},
				bson.M{"employeeCode": pattern},
				bson.M{"email": pattern},
			}
		}

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := employeeCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch employees"})
			return
		}
		defer cursor.Close(ctx)

		var employees []models.Employee
		if err := cursor.All(ctx, &employees); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode employees"})
			return
		}
		if employees == nil {
			employees = []models.Employee{}
		}

		total, _ := employeeCollection.CountDocuments(ctx, filter)
		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Employees retrieved successfully",
			"data":    gin.H{"employees": employees, "total": total},
		})
	}
}

func GetEmployeeByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid employee ID"})
			return
		}

		var e models.Employee
		if err := employeeCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&e); err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Employee not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve employee"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Employee retrieved", "data": e})
	}
}

func UpdateEmployee() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid employee ID"})
			return
		}

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}
		delete(updates, "_id")
		delete(updates, "orgId")
		delete(updates, "employeeCode")
		delete(updates, "createdAt")

		if reportsTo, ok := updates["reportsTo"].(string); ok && reportsTo == id {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "An employee cannot report to themselves"})
			return
		}

		if uid, ok := updates["userId"].(string); ok && uid != "" {
			count, _ := orgMemberCollection.CountDocuments(ctx, bson.M{"orgId": mustOrgObjectID(orgIDStr), "userId": uid})
			if count == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "userId does not match an active member of this organization"})
				return
			}
		}

		updates["updatedAt"] = time.Now()
		result, err := employeeCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr},
			bson.M{"$set": updates},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Employee not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Employee updated successfully"})
	}
}

func DeleteEmployee() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid employee ID"})
			return
		}

		reportsCount, _ := employeeCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "reportsTo": id})
		if reportsCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "This employee has direct reports — reassign them first"})
			return
		}

		if n, _ := salaryStructureCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "employeeId": id}); n > 0 {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "This employee has payroll history — set status to terminated instead of deleting"})
			return
		}
		if n, _ := leaveRequestCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "employeeId": id}); n > 0 {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "This employee has leave history — set status to terminated instead of deleting"})
			return
		}

		result, err := employeeCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr})
		if err != nil || result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Employee not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Employee deleted successfully"})
	}
}

// orgChartNode is one nested tree entry returned by GetOrgChart.
type orgChartNode struct {
	ID           string          `json:"id"`
	EmployeeCode string          `json:"employeeCode"`
	Name         string          `json:"name"`
	JobTitle     string          `json:"jobTitle"`
	Department   string          `json:"department,omitempty"`
	Photo        string          `json:"photo,omitempty"`
	Status       string          `json:"status"`
	Children     []*orgChartNode `json:"children"`
}

// GetOrgChart builds the reporting tree from Employee.ReportsTo. No separate
// backend model — it's a derived read over the employees collection.
func GetOrgChart() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		proj := bson.M{"_id": 1, "employeeCode": 1, "firstName": 1, "lastName": 1, "displayName": 1, "jobTitle": 1, "department": 1, "photo": 1, "status": 1, "reportsTo": 1}
		cursor, err := employeeCollection.Find(ctx, bson.M{"orgId": orgIDStr}, options.Find().SetProjection(proj))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch employees"})
			return
		}
		defer cursor.Close(ctx)

		var employees []models.Employee
		if err := cursor.All(ctx, &employees); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode employees"})
			return
		}

		byID := make(map[string]*orgChartNode, len(employees))
		childrenOf := make(map[string][]string)
		exists := make(map[string]bool, len(employees))
		for _, e := range employees {
			exists[e.ID.Hex()] = true
		}
		for _, e := range employees {
			id := e.ID.Hex()
			name := e.DisplayName
			if name == "" {
				name = e.FirstName + " " + e.LastName
			}
			byID[id] = &orgChartNode{
				ID: id, EmployeeCode: e.EmployeeCode, Name: name, JobTitle: e.JobTitle,
				Department: e.Department, Photo: e.Photo, Status: e.Status, Children: []*orgChartNode{},
			}
			parent := e.ReportsTo
			if parent != "" && !exists[parent] {
				parent = "" // dangling reference — treat as root
			}
			childrenOf[parent] = append(childrenOf[parent], id)
		}

		visited := make(map[string]bool, len(employees))
		var attach func(id string) *orgChartNode
		attach = func(id string) *orgChartNode {
			node := byID[id]
			if visited[id] {
				return node // cycle guard — don't recurse into an already-attached node again
			}
			visited[id] = true
			for _, childID := range childrenOf[id] {
				node.Children = append(node.Children, attach(childID))
			}
			return node
		}

		var roots []*orgChartNode
		for _, rootID := range childrenOf[""] {
			roots = append(roots, attach(rootID))
		}
		// Any employee never visited (pure cycle, no valid root path in) still surfaces
		// as its own root rather than disappearing from the chart.
		for id := range byID {
			if !visited[id] {
				roots = append(roots, attach(id))
			}
		}
		if roots == nil {
			roots = []*orgChartNode{}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": gin.H{"roots": roots}})
	}
}

// mustOrgObjectID converts an orgId string to primitive.ObjectID for queries
// against collections (like org_members) that store orgId as ObjectID rather
// than string. Returns the zero ObjectID on parse failure (matches nothing).
func mustOrgObjectID(orgIDStr string) primitive.ObjectID {
	oid, err := primitive.ObjectIDFromHex(orgIDStr)
	if err != nil {
		return primitive.NilObjectID
	}
	return oid
}
