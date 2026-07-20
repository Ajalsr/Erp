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

var payrollScheduleCollection *mongo.Collection = config.GetCollection(config.DB, "payroll_schedules")

func validPayrollFrequency(f string) bool {
	switch f {
	case "weekly", "biweekly", "monthly", "yearly":
		return true
	}
	return false
}

// CreatePayrollSchedule stores a new recurring-run config. NextRunDate seeds to
// StartDate so the first pay run is created on/after the start.
func CreatePayrollSchedule() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		userID, _ := c.Get("userId")

		var s models.PayrollSchedule
		if err := c.ShouldBindJSON(&s); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if !validPayrollFrequency(s.Frequency) {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "frequency must be weekly, biweekly, monthly, or yearly"})
			return
		}
		if _, err := time.Parse(dateLayout, s.StartDate); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "startDate must be YYYY-MM-DD"})
			return
		}
		if s.Interval < 1 {
			s.Interval = 1
		}
		if s.ProfileName == "" {
			s.ProfileName = "Payroll — " + s.Frequency
		}

		s.ID = primitive.NewObjectID()
		s.OrgID = orgID.(string)
		if userID != nil {
			s.CreatedBy = userID.(string)
		}
		s.Status = "active"
		s.NextRunDate = s.StartDate
		s.GeneratedCount = 0
		s.LastGeneratedAt = nil
		s.LastRunNumber = ""
		s.CreatedAt = time.Now()
		s.UpdatedAt = time.Now()

		if _, err := payrollScheduleCollection.InsertOne(ctx, s); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create payroll schedule", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Payroll schedule created", "data": gin.H{"id": s.ID.Hex()}})
	}
}

func GetAllPayrollSchedules() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		filter := bson.M{"orgId": orgID}
		if status := c.Query("status"); status != "" && status != "all" {
			filter["status"] = status
		}

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := payrollScheduleCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch payroll schedules", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var schedules []models.PayrollSchedule
		if err := cursor.All(ctx, &schedules); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode", "error": err.Error()})
			return
		}
		if schedules == nil {
			schedules = []models.PayrollSchedule{}
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": schedules})
	}
}

func GetPayrollScheduleByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		oid, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}

		var s models.PayrollSchedule
		err = payrollScheduleCollection.FindOne(ctx, bson.M{"_id": oid, "orgId": orgID}).Decode(&s)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Payroll schedule not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed", "error": err.Error()})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": s})
	}
}

// UpdatePayrollSchedule edits the schedule/shaping fields. Runtime counters are
// never overwritten from the client. If nothing has generated yet, NextRunDate is
// rebased off the (possibly new) StartDate.
func UpdatePayrollSchedule() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		oid, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}

		var existing models.PayrollSchedule
		if err := payrollScheduleCollection.FindOne(ctx, bson.M{"_id": oid, "orgId": orgID}).Decode(&existing); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Payroll schedule not found"})
			return
		}

		var s models.PayrollSchedule
		if err := c.ShouldBindJSON(&s); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if !validPayrollFrequency(s.Frequency) {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "frequency must be weekly, biweekly, monthly, or yearly"})
			return
		}
		if s.Interval < 1 {
			s.Interval = 1
		}

		set := bson.M{
			"profileName":          s.ProfileName,
			"frequency":            s.Frequency,
			"interval":             s.Interval,
			"startDate":            s.StartDate,
			"endDate":              s.EndDate,
			"maxCount":             s.MaxCount,
			"payDateOffsetDays":    s.PayDateOffsetDays,
			"employeeIds":          s.EmployeeIDs,
			"autoGeneratePayslips": s.AutoGeneratePayslips,
			"updatedAt":            time.Now(),
		}
		if existing.GeneratedCount == 0 && s.StartDate != "" {
			set["nextRunDate"] = s.StartDate
		}

		if _, err := payrollScheduleCollection.UpdateOne(ctx, bson.M{"_id": oid, "orgId": orgID}, bson.M{"$set": set}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Payroll schedule updated"})
	}
}

// UpdatePayrollScheduleStatus toggles active/paused (cannot move to completed manually).
func UpdatePayrollScheduleStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		oid, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}

		var body struct {
			Status string `json:"status"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || (body.Status != "active" && body.Status != "paused") {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "status must be active or paused"})
			return
		}

		res, err := payrollScheduleCollection.UpdateOne(ctx,
			bson.M{"_id": oid, "orgId": orgID, "status": bson.M{"$ne": "completed"}},
			bson.M{"$set": bson.M{"status": body.Status, "updatedAt": time.Now()}},
		)
		if err != nil || res.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Payroll schedule not found or already completed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Status updated"})
	}
}

func DeletePayrollSchedule() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		oid, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}
		res, err := payrollScheduleCollection.DeleteOne(ctx, bson.M{"_id": oid, "orgId": orgID})
		if err != nil || res.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Payroll schedule not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Payroll schedule deleted"})
	}
}

// RunPayrollScheduleNow creates one pay run immediately (period start = today),
// independent of the schedule. NextRunDate is left untouched so the regular
// cadence is unaffected — useful for an ad-hoc off-cycle run.
func RunPayrollScheduleNow() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		oid, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid ID"})
			return
		}

		var s models.PayrollSchedule
		if err := payrollScheduleCollection.FindOne(ctx, bson.M{"_id": oid, "orgId": orgID}).Decode(&s); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Payroll schedule not found"})
			return
		}

		run, err := generatePayRunFromSchedule(ctx, &s, time.Now().Format(dateLayout), false)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create pay run", "error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Pay run created", "data": gin.H{"id": run.ID.Hex(), "runNumber": run.RunNumber}})
	}
}

// generatePayRunFromSchedule builds and persists one real, draft PayRun from a
// schedule. When advanceSchedule is true the schedule's NextRunDate/counters
// advance (scheduler path); when false only the generated counters bump (manual
// "run now"). Never approves or marks paid — those stay manual regardless of the
// schedule's settings, so GL posting and cash movement always have a human gate.
func generatePayRunFromSchedule(ctx context.Context, s *models.PayrollSchedule, periodStart string, advanceSchedule bool) (models.PayRun, error) {
	periodEndDate := periodStart
	if t, err := time.Parse(dateLayout, advanceDate(periodStart, s.Frequency, s.Interval)); err == nil {
		periodEndDate = t.AddDate(0, 0, -1).Format(dateLayout)
	}

	payDate := periodEndDate
	if s.PayDateOffsetDays > 0 {
		if t, err := time.Parse(dateLayout, periodEndDate); err == nil {
			payDate = t.AddDate(0, 0, s.PayDateOffsetDays).Format(dateLayout)
		}
	}

	employeeIDs := s.EmployeeIDs
	if len(employeeIDs) == 0 {
		cursor, err := employeeCollection.Find(ctx, bson.M{"orgId": s.OrgID, "status": "active"}, options.Find().SetProjection(bson.M{"_id": 1}))
		if err == nil {
			var employees []models.Employee
			if cursor.All(ctx, &employees) == nil {
				for _, e := range employees {
					employeeIDs = append(employeeIDs, e.ID.Hex())
				}
			}
			cursor.Close(ctx)
		}
	}

	run := models.PayRun{
		ID:          primitive.NewObjectID(),
		RunNumber:   generatePayRunNumber(ctx, s.OrgID),
		PeriodStart: periodStart,
		PeriodEnd:   periodEndDate,
		PayDate:     payDate,
		Status:      "draft",
		EmployeeIDs: employeeIDs,
		Notes:       "Auto-created by schedule: " + s.ProfileName,
		OrgID:       s.OrgID,
		CreatedBy:   "system",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if _, err := payRunCollection.InsertOne(ctx, run); err != nil {
		return models.PayRun{}, err
	}

	if s.AutoGeneratePayslips && len(employeeIDs) > 0 {
		generatePayslipsForRun(ctx, s.OrgID, run)
	}

	// Advance the schedule bookkeeping.
	now := time.Now()
	newCount := s.GeneratedCount + 1
	update := bson.M{
		"generatedCount":  newCount,
		"lastGeneratedAt": now,
		"lastRunNumber":   run.RunNumber,
		"updatedAt":       now,
	}
	if advanceSchedule {
		next := advanceDate(s.NextRunDate, s.Frequency, s.Interval)
		update["nextRunDate"] = next
		if (s.MaxCount > 0 && newCount >= s.MaxCount) ||
			(s.EndDate != "" && next > s.EndDate) {
			update["status"] = "completed"
		}
		s.NextRunDate = next
	} else if s.MaxCount > 0 && newCount >= s.MaxCount {
		update["status"] = "completed"
	}
	s.GeneratedCount = newCount

	payrollScheduleCollection.UpdateOne(ctx, bson.M{"_id": s.ID}, bson.M{"$set": update})

	notifyOrgAdmins(ctx, s.OrgID,
		"payroll_schedule_generated",
		"Pay run "+run.RunNumber+" created",
		fmt.Sprintf("%s — %s to %s, %d employee(s). Review and approve when ready.", s.ProfileName, run.PeriodStart, run.PeriodEnd, len(employeeIDs)),
		map[string]string{"payRunId": run.ID.Hex(), "runNumber": run.RunNumber},
	)

	return run, nil
}

// processPayrollSchedules is called by the daily scheduler. It creates every due
// pay run for each active schedule whose NextRunDate has arrived, catching up on
// any missed cycles (bounded to avoid runaway loops if a schedule is badly
// configured).
func processPayrollSchedules(ctx context.Context, todayStr string) {
	cursor, err := payrollScheduleCollection.Find(ctx, bson.M{
		"status":      "active",
		"nextRunDate": bson.M{"$lte": todayStr, "$gt": ""},
	})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	var schedules []models.PayrollSchedule
	if err := cursor.All(ctx, &schedules); err != nil {
		return
	}

	for i := range schedules {
		s := schedules[i]
		for guard := 0; guard < 24; guard++ {
			if s.Status != "active" || s.NextRunDate == "" || s.NextRunDate > todayStr {
				break
			}
			if _, gerr := generatePayRunFromSchedule(ctx, &s, s.NextRunDate, true); gerr != nil {
				break
			}
			if (s.MaxCount > 0 && s.GeneratedCount >= s.MaxCount) ||
				(s.EndDate != "" && s.NextRunDate > s.EndDate) {
				s.Status = "completed"
			}
		}
	}
}
