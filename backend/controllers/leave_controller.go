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

var leaveRequestCollection *mongo.Collection = config.GetCollection(config.DB, "leave_requests")
var leaveBalanceCollection *mongo.Collection = config.GetCollection(config.DB, "leave_balances")

func generateLeaveRequestNumber(ctx context.Context, orgID string) string {
	return nextNumber(ctx, orgID, "leave_request", leaveRequestCollection, "requestNumber")
}

// calendarDays counts inclusive calendar days between two YYYY-MM-DD dates.
// v1 counts calendar days (no weekend/public-holiday calendar exists to
// exclude them correctly — see plan decisions).
func calendarDays(startDate, endDate string) (float64, error) {
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return 0, fmt.Errorf("invalid startDate")
	}
	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return 0, fmt.Errorf("invalid endDate")
	}
	if end.Before(start) {
		return 0, fmt.Errorf("endDate is before startDate")
	}
	days := end.Sub(start).Hours()/24 + 1
	return days, nil
}

// initializeLeaveBalance loads or lazily creates the balance row for one
// employee/leaveType/year, seeding Entitled from LeaveType.AccrualDaysPerYear.
func initializeLeaveBalance(ctx context.Context, orgID, employeeID, leaveTypeID string, year int) (*models.LeaveBalance, error) {
	var bal models.LeaveBalance
	err := leaveBalanceCollection.FindOne(ctx, bson.M{"orgId": orgID, "employeeId": employeeID, "leaveTypeId": leaveTypeID, "year": year}).Decode(&bal)
	if err == nil {
		return &bal, nil
	}
	if err != mongo.ErrNoDocuments {
		return nil, err
	}

	var lt models.LeaveType
	ltObjID, _ := primitive.ObjectIDFromHex(leaveTypeID)
	_ = leaveTypeCollection.FindOne(ctx, bson.M{"_id": ltObjID, "orgId": orgID}).Decode(&lt)

	bal = models.LeaveBalance{
		ID:          primitive.NewObjectID(),
		EmployeeID:  employeeID,
		LeaveTypeID: leaveTypeID,
		Year:        year,
		Entitled:    lt.AccrualDaysPerYear,
		Remaining:   lt.AccrualDaysPerYear,
		OrgID:       orgID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if _, err := leaveBalanceCollection.InsertOne(ctx, bal); err != nil {
		return nil, err
	}
	return &bal, nil
}

// applyLeaveApproval increments the matching balance's Used by req.Days and
// recomputes Remaining. Called once, when a request reaches final approval
// (including immediate auto-approval).
func applyLeaveApproval(ctx context.Context, orgID string, req models.LeaveRequest) error {
	year, _ := yearOf(req.StartDate)
	bal, err := initializeLeaveBalance(ctx, orgID, req.EmployeeID, req.LeaveTypeID, year)
	if err != nil {
		return err
	}
	newUsed := bal.Used + req.Days
	newRemaining := bal.Entitled + bal.CarriedForward + bal.Adjusted - newUsed
	_, err = leaveBalanceCollection.UpdateOne(ctx,
		bson.M{"_id": bal.ID},
		bson.M{"$set": bson.M{"used": newUsed, "remaining": newRemaining, "updatedAt": time.Now()}},
	)
	return err
}

func yearOf(dateStr string) (int, error) {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return time.Now().Year(), err
	}
	return t.Year(), nil
}

func CreateLeaveRequest() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var body struct {
			EmployeeID  string `json:"employeeId"`
			LeaveTypeID string `json:"leaveTypeId"`
			StartDate   string `json:"startDate"`
			EndDate     string `json:"endDate"`
			Reason      string `json:"reason"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if body.EmployeeID == "" || body.LeaveTypeID == "" || body.StartDate == "" || body.EndDate == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "employeeId, leaveTypeId, startDate and endDate are required"})
			return
		}

		days, err := calendarDays(body.StartDate, body.EndDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": err.Error()})
			return
		}

		empObjID, err := primitive.ObjectIDFromHex(body.EmployeeID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid employeeId"})
			return
		}
		var employee models.Employee
		if err := employeeCollection.FindOne(ctx, bson.M{"_id": empObjID, "orgId": orgIDStr}).Decode(&employee); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Employee not found"})
			return
		}

		// Block a second request over the same dates while an earlier one is still
		// pending or already approved — regardless of leave type, since an employee
		// can't be on two kinds of leave the same day. A rejected or cancelled
		// request doesn't count, so re-applying for the same dates after a
		// rejection is allowed.
		overlapCount, err := leaveRequestCollection.CountDocuments(ctx, bson.M{
			"orgId": orgIDStr, "employeeId": body.EmployeeID,
			"status":    bson.M{"$in": []string{"pending_approval", "approved"}},
			"startDate": bson.M{"$lte": body.EndDate},
			"endDate":   bson.M{"$gte": body.StartDate},
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to check existing leave requests", "error": err.Error()})
			return
		}
		if overlapCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Employee already has a pending or approved leave request overlapping these dates"})
			return
		}

		ltObjID, err := primitive.ObjectIDFromHex(body.LeaveTypeID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid leaveTypeId"})
			return
		}
		var leaveType models.LeaveType
		if err := leaveTypeCollection.FindOne(ctx, bson.M{"_id": ltObjID, "orgId": orgIDStr}).Decode(&leaveType); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Leave type not found"})
			return
		}

		// Hard-block over-balance requests before they're even created — not just
		// warned, not left for the approver to catch. Skipped for leave types with
		// AccrualDaysPerYear == 0, which is this codebase's existing convention for
		// "not accrual-based / no cap" (e.g. unpaid leave) — see models.LeaveType.
		if leaveType.AccrualDaysPerYear > 0 {
			year, _ := yearOf(body.StartDate)
			bal, err := initializeLeaveBalance(ctx, orgIDStr, body.EmployeeID, body.LeaveTypeID, year)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to check leave balance", "error": err.Error()})
				return
			}
			remaining := bal.Entitled + bal.CarriedForward + bal.Adjusted - bal.Used
			if days > remaining {
				c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": fmt.Sprintf(
					"Insufficient %s balance: requesting %.1f day(s), only %.1f remaining", leaveType.Name, days, remaining)})
				return
			}
		}

		empName := employee.DisplayName
		if empName == "" {
			empName = employee.FirstName + " " + employee.LastName
		}

		req := models.LeaveRequest{
			ID:            primitive.NewObjectID(),
			RequestNumber: generateLeaveRequestNumber(ctx, orgIDStr),
			EmployeeID:    body.EmployeeID,
			EmployeeName:  empName,
			LeaveTypeID:   body.LeaveTypeID,
			LeaveTypeName: leaveType.Name,
			StartDate:     body.StartDate,
			EndDate:       body.EndDate,
			Days:          days,
			Reason:        body.Reason,
			OrgID:         orgIDStr,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		if userID != nil {
			req.CreatedBy = userID.(string)
		}

		// Resolve the approval chain: direct manager only (single level — see plan
		// decisions). No manager, or the leave type doesn't require approval, means
		// nothing to route to, so the request is auto-approved immediately.
		var manager models.Employee
		hasManager := false
		if employee.ReportsTo != "" {
			mgrObjID, err := primitive.ObjectIDFromHex(employee.ReportsTo)
			if err == nil {
				if err := employeeCollection.FindOne(ctx, bson.M{"_id": mgrObjID, "orgId": orgIDStr}).Decode(&manager); err == nil {
					hasManager = true
				}
			}
		}

		if !leaveType.RequiresApproval || !hasManager {
			now := time.Now()
			req.Status = "approved"
			req.DecidedAt = &now
			if userID != nil {
				req.DecidedBy = userID.(string)
			}
			if _, err := leaveRequestCollection.InsertOne(ctx, req); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create leave request", "error": err.Error()})
				return
			}
			if err := applyLeaveApproval(ctx, orgIDStr, req); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Leave request created, but balance update failed", "error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Leave request auto-approved (no manager set or approval not required)", "data": gin.H{"id": req.ID.Hex(), "requestNumber": req.RequestNumber, "status": req.Status}})
			return
		}

		mgrName := manager.DisplayName
		if mgrName == "" {
			mgrName = manager.FirstName + " " + manager.LastName
		}
		req.Status = "pending_approval"
		req.CurrentStep = 0
		req.ApproverChain = []models.LeaveApprovalStep{
			{
				ApproverEmployeeID: manager.ID.Hex(),
				ApproverUserID:     manager.UserID,
				ApproverName:       mgrName,
				Status:             "pending",
			},
		}

		if _, err := leaveRequestCollection.InsertOne(ctx, req); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create leave request", "error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Leave request submitted for approval", "data": gin.H{"id": req.ID.Hex(), "requestNumber": req.RequestNumber, "status": req.Status}})
	}
}

func GetAllLeaveRequests() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if employeeID := c.Query("employeeId"); employeeID != "" {
			filter["employeeId"] = employeeID
		}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if leaveTypeID := c.Query("leaveTypeId"); leaveTypeID != "" {
			filter["leaveTypeId"] = leaveTypeID
		}

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := leaveRequestCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch leave requests"})
			return
		}
		defer cursor.Close(ctx)

		var requests []models.LeaveRequest
		if err := cursor.All(ctx, &requests); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode leave requests"})
			return
		}
		if requests == nil {
			requests = []models.LeaveRequest{}
		}

		total, _ := leaveRequestCollection.CountDocuments(ctx, filter)
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Leave requests retrieved successfully", "data": gin.H{"requests": requests, "total": total}})
	}
}

func GetLeaveRequestByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid leave request ID"})
			return
		}

		var req models.LeaveRequest
		if err := leaveRequestCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&req); err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Leave request not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve leave request"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Leave request retrieved", "data": req})
	}
}

// canDecide reports whether the caller may approve/reject the request's
// current step: either they ARE that step's approver, or they hold an
// owner/admin org role. This is the real authorization gate — RequireModule's
// verb-derived capability ("add"/"edit") can't express "must be this specific
// manager," so it's enforced here instead.
func canDecide(c *gin.Context, req models.LeaveRequest) bool {
	role := c.GetString("orgRole")
	if role == "owner" || role == "admin" {
		return true
	}
	if req.CurrentStep < 0 || req.CurrentStep >= len(req.ApproverChain) {
		return false
	}
	userID, _ := c.Get("userId")
	userIDStr, _ := userID.(string)
	step := req.ApproverChain[req.CurrentStep]
	return userIDStr != "" && step.ApproverUserID != "" && step.ApproverUserID == userIDStr
}

func ApproveLeaveRequest() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid leave request ID"})
			return
		}

		var req models.LeaveRequest
		if err := leaveRequestCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&req); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Leave request not found"})
			return
		}
		if req.Status != "pending_approval" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Only pending requests can be approved"})
			return
		}
		if !canDecide(c, req) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You are not the assigned approver for this request"})
			return
		}

		now := time.Now()
		req.ApproverChain[req.CurrentStep].Status = "approved"
		req.ApproverChain[req.CurrentStep].DecidedAt = &now

		update := bson.M{"approverChain": req.ApproverChain, "updatedAt": now}
		if req.CurrentStep+1 < len(req.ApproverChain) {
			req.CurrentStep++
			update["currentStep"] = req.CurrentStep
		} else {
			req.Status = "approved"
			update["status"] = "approved"
			update["decidedAt"] = now
			if userID != nil {
				update["decidedBy"] = userID.(string)
			}
		}

		if _, err := leaveRequestCollection.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": update}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update leave request"})
			return
		}

		if req.Status == "approved" {
			if err := applyLeaveApproval(ctx, orgIDStr, req); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Approved, but balance update failed", "error": err.Error()})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Leave request approved", "data": gin.H{"status": req.Status}})
	}
}

func RejectLeaveRequest() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid leave request ID"})
			return
		}

		var body struct {
			Reason string `json:"reason"`
		}
		_ = c.ShouldBindJSON(&body)

		var req models.LeaveRequest
		if err := leaveRequestCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&req); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Leave request not found"})
			return
		}
		if req.Status != "pending_approval" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Only pending requests can be rejected"})
			return
		}
		if !canDecide(c, req) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "You are not the assigned approver for this request"})
			return
		}

		now := time.Now()
		req.ApproverChain[req.CurrentStep].Status = "rejected"
		req.ApproverChain[req.CurrentStep].DecidedAt = &now
		req.ApproverChain[req.CurrentStep].Reason = body.Reason

		update := bson.M{"approverChain": req.ApproverChain, "status": "rejected", "decidedAt": now, "updatedAt": now}
		if userID != nil {
			update["decidedBy"] = userID.(string)
		}
		if _, err := leaveRequestCollection.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": update}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update leave request"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Leave request rejected"})
	}
}

func CancelLeaveRequest() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")
		userIDStr, _ := userID.(string)
		role := c.GetString("orgRole")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid leave request ID"})
			return
		}

		var req models.LeaveRequest
		if err := leaveRequestCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&req); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Leave request not found"})
			return
		}
		if req.Status != "pending_approval" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Only pending requests can be cancelled"})
			return
		}
		if req.CreatedBy != userIDStr && role != "owner" && role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only the requester or an admin can cancel this request"})
			return
		}

		if _, err := leaveRequestCollection.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": bson.M{"status": "cancelled", "updatedAt": time.Now()}}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to cancel leave request"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Leave request cancelled"})
	}
}

func GetLeaveBalances() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		year := time.Now().Year()
		if y := c.Query("year"); y != "" {
			fmt.Sscanf(y, "%d", &year)
		}

		employeeID := c.Query("employeeId")
		if employeeID != "" {
			// Lazily create a balance row for every active leave type this
			// employee doesn't already have one for this year.
			cursor, err := leaveTypeCollection.Find(ctx, bson.M{"orgId": orgIDStr, "status": "active"})
			if err == nil {
				var types []models.LeaveType
				if cursor.All(ctx, &types) == nil {
					for _, lt := range types {
						_, _ = initializeLeaveBalance(ctx, orgIDStr, employeeID, lt.ID.Hex(), year)
					}
				}
				cursor.Close(ctx)
			}
		}

		filter := bson.M{"orgId": orgIDStr, "year": year}
		if employeeID != "" {
			filter["employeeId"] = employeeID
		}

		cursor, err := leaveBalanceCollection.Find(ctx, filter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch leave balances"})
			return
		}
		defer cursor.Close(ctx)

		var balances []models.LeaveBalance
		if err := cursor.All(ctx, &balances); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode leave balances"})
			return
		}
		if balances == nil {
			balances = []models.LeaveBalance{}
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Leave balances retrieved successfully", "data": gin.H{"balances": balances}})
	}
}

func AdjustLeaveBalance() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid leave balance ID"})
			return
		}

		var body struct {
			Adjusted float64 `json:"adjusted"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}

		var bal models.LeaveBalance
		if err := leaveBalanceCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&bal); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Leave balance not found"})
			return
		}

		newRemaining := bal.Entitled + bal.CarriedForward + body.Adjusted - bal.Used
		if _, err := leaveBalanceCollection.UpdateOne(ctx,
			bson.M{"_id": objID},
			bson.M{"$set": bson.M{"adjusted": body.Adjusted, "remaining": newRemaining, "updatedAt": time.Now()}},
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to adjust leave balance"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Leave balance adjusted successfully"})
	}
}
