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

var salaryStructureCollection *mongo.Collection = config.GetCollection(config.DB, "salary_structures")
var payRunCollection *mongo.Collection = config.GetCollection(config.DB, "pay_runs")
var payslipCollection *mongo.Collection = config.GetCollection(config.DB, "payslips")

func generatePayRunNumber(ctx context.Context, orgID string) string {
	return nextNumber(ctx, orgID, "pay_run", payRunCollection, "runNumber")
}

func generatePayslipNumber(ctx context.Context, orgID string) string {
	return nextNumber(ctx, orgID, "payslip", payslipCollection, "payslipNumber")
}

func componentTotal(components []models.SalaryComponent) float64 {
	var total float64
	for _, comp := range components {
		total += comp.Amount
	}
	return total
}

// ── Salary Structures ───────────────────────────────────────────────────────

func CreateSalaryStructure() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var s models.SalaryStructure
		if err := c.ShouldBindJSON(&s); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if s.EmployeeID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "employeeId is required"})
			return
		}
		if s.EffectiveFrom == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "effectiveFrom is required"})
			return
		}
		if s.BasicSalary <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "basicSalary must be greater than zero"})
			return
		}
		empObjID, err := primitive.ObjectIDFromHex(s.EmployeeID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid employeeId"})
			return
		}
		if err := employeeCollection.FindOne(ctx, bson.M{"_id": empObjID, "orgId": orgIDStr}).Err(); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Employee not found"})
			return
		}

		// Supersede the employee's current active structure — history is kept,
		// never edited away (same "unset others" shape as Warehouse.IsDefault).
		salaryStructureCollection.UpdateMany(ctx,
			bson.M{"orgId": orgIDStr, "employeeId": s.EmployeeID, "status": "active"},
			bson.M{"$set": bson.M{"status": "superseded", "updatedAt": time.Now()}},
		)

		s.ID = primitive.NewObjectID()
		s.OrgID = orgIDStr
		s.Status = "active"
		if s.Currency == "" {
			s.Currency = orgBaseCurrency(ctx, orgIDStr)
		}
		s.GrossMonthly = s.BasicSalary + componentTotal(s.Allowances)
		s.CreatedAt = time.Now()
		s.UpdatedAt = time.Now()
		if userID != nil {
			s.CreatedBy = userID.(string)
		}

		if _, err := salaryStructureCollection.InsertOne(ctx, s); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create salary structure", "error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Salary structure created successfully", "data": gin.H{"id": s.ID.Hex(), "grossMonthly": s.GrossMonthly}})
	}
}

func GetSalaryStructures() gin.HandlerFunc {
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

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := salaryStructureCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch salary structures"})
			return
		}
		defer cursor.Close(ctx)

		var structures []models.SalaryStructure
		if err := cursor.All(ctx, &structures); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode salary structures"})
			return
		}
		if structures == nil {
			structures = []models.SalaryStructure{}
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Salary structures retrieved successfully", "data": gin.H{"salaryStructures": structures}})
	}
}

func GetSalaryStructureByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid salary structure ID"})
			return
		}

		var s models.SalaryStructure
		if err := salaryStructureCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&s); err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Salary structure not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve salary structure"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Salary structure retrieved", "data": s})
	}
}

func UpdateSalaryStructure() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid salary structure ID"})
			return
		}

		var existing models.SalaryStructure
		if err := salaryStructureCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&existing); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Salary structure not found"})
			return
		}
		if existing.Status != "active" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Only the current active salary structure can be edited — create a new one instead"})
			return
		}

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}
		delete(updates, "_id")
		delete(updates, "orgId")
		delete(updates, "employeeId")
		delete(updates, "status")
		delete(updates, "createdAt")

		// Recompute gross if basic/allowances changed.
		basic := existing.BasicSalary
		if b, ok := updates["basicSalary"].(float64); ok {
			basic = b
		}
		allowances := existing.Allowances
		if _, touched := updates["allowances"]; touched {
			// Re-decode via bson roundtrip so []interface{} from JSON becomes []SalaryComponent.
			var reparsed models.SalaryStructure
			raw, _ := bson.Marshal(updates)
			_ = bson.Unmarshal(raw, &reparsed)
			allowances = reparsed.Allowances
		}
		updates["grossMonthly"] = basic + componentTotal(allowances)
		updates["updatedAt"] = time.Now()

		result, err := salaryStructureCollection.UpdateOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}, bson.M{"$set": updates})
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Salary structure not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Salary structure updated successfully"})
	}
}

func DeleteSalaryStructure() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid salary structure ID"})
			return
		}

		result, err := salaryStructureCollection.DeleteOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr})
		if err != nil || result.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Salary structure not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Salary structure deleted successfully"})
	}
}

// ── Pay Runs ────────────────────────────────────────────────────────────────

func CreatePayRun() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")

		var body struct {
			PeriodStart string   `json:"periodStart"`
			PeriodEnd   string   `json:"periodEnd"`
			PayDate     string   `json:"payDate"`
			EmployeeIDs []string `json:"employeeIds"`
			Notes       string   `json:"notes"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body", "error": err.Error()})
			return
		}
		if body.PeriodStart == "" || body.PeriodEnd == "" || body.PayDate == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "periodStart, periodEnd and payDate are required"})
			return
		}

		employeeIDs := body.EmployeeIDs
		if len(employeeIDs) == 0 {
			cursor, err := employeeCollection.Find(ctx, bson.M{"orgId": orgIDStr, "status": "active"}, options.Find().SetProjection(bson.M{"_id": 1}))
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
			RunNumber:   generatePayRunNumber(ctx, orgIDStr),
			PeriodStart: body.PeriodStart,
			PeriodEnd:   body.PeriodEnd,
			PayDate:     body.PayDate,
			Status:      "draft",
			EmployeeIDs: employeeIDs,
			Notes:       body.Notes,
			OrgID:       orgIDStr,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
		if userID != nil {
			run.CreatedBy = userID.(string)
		}

		if _, err := payRunCollection.InsertOne(ctx, run); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create pay run", "error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Pay run created successfully", "data": gin.H{"id": run.ID.Hex(), "runNumber": run.RunNumber, "employeeCount": len(employeeIDs)}})
	}
}

func GetAllPayRuns() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := payRunCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch pay runs"})
			return
		}
		defer cursor.Close(ctx)

		var runs []models.PayRun
		if err := cursor.All(ctx, &runs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode pay runs"})
			return
		}
		if runs == nil {
			runs = []models.PayRun{}
		}
		total, _ := payRunCollection.CountDocuments(ctx, filter)
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Pay runs retrieved successfully", "data": gin.H{"payRuns": runs, "total": total}})
	}
}

func GetPayRunByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid pay run ID"})
			return
		}

		var run models.PayRun
		if err := payRunCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&run); err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Pay run not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve pay run"})
			}
			return
		}

		var payslips []models.Payslip
		cursor, err := payslipCollection.Find(ctx, bson.M{"orgId": orgIDStr, "payRunId": id})
		if err == nil {
			_ = cursor.All(ctx, &payslips)
			cursor.Close(ctx)
		}
		if payslips == nil {
			payslips = []models.Payslip{}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Pay run retrieved", "data": gin.H{"payRun": run, "payslips": payslips}})
	}
}

// GeneratePayslips reads each employee's active salary structure and builds
// draft payslips. Re-runnable while the run is still draft — it deletes and
// rebuilds this run's payslips each time, so edits to salary structures made
// before approval are picked up on the next generate.
func GeneratePayslips() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid pay run ID"})
			return
		}

		var run models.PayRun
		if err := payRunCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&run); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Pay run not found"})
			return
		}
		if run.Status != "draft" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Payslips can only be generated for a draft pay run"})
			return
		}
		if len(run.EmployeeIDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "This pay run has no employees"})
			return
		}

		generated, totalGross, totalDeductions, totalNet := generatePayslipsForRun(ctx, orgIDStr, run)

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": fmt.Sprintf("%d payslip(s) generated", generated), "data": gin.H{
			"generated": generated, "totalGross": totalGross, "totalDeductions": totalDeductions, "totalNet": totalNet,
		}})
	}
}

// generatePayslipsForRun does the actual draft-payslip build for a pay run —
// shared by the GeneratePayslips HTTP handler and the payroll scheduler so both
// paths compute payslips identically. Rebuild-from-scratch, safe while draft.
func generatePayslipsForRun(ctx context.Context, orgIDStr string, run models.PayRun) (generated int, totalGross, totalDeductions, totalNet float64) {
	id := run.ID.Hex()
	payslipCollection.DeleteMany(ctx, bson.M{"orgId": orgIDStr, "payRunId": id})

	currency := orgBaseCurrency(ctx, orgIDStr)
	unpaidTypeIDs := unpaidLeaveTypeIDs(ctx, orgIDStr)

	for _, employeeID := range run.EmployeeIDs {
		empObjID, err := primitive.ObjectIDFromHex(employeeID)
		if err != nil {
			continue
		}
		var employee models.Employee
		if err := employeeCollection.FindOne(ctx, bson.M{"_id": empObjID, "orgId": orgIDStr}).Decode(&employee); err != nil {
			continue // employee removed/not found — skip, don't fail the whole run
		}
		var structure models.SalaryStructure
		if err := salaryStructureCollection.FindOne(ctx, bson.M{"orgId": orgIDStr, "employeeId": employeeID, "status": "active"}).Decode(&structure); err != nil {
			continue // no active salary structure — skip
		}

		unpaidDays := unpaidLeaveDaysInPeriod(ctx, orgIDStr, employeeID, run.PeriodStart, run.PeriodEnd, unpaidTypeIDs)
		unpaidDeduction := (structure.BasicSalary / 30) * unpaidDays

		grossPay := structure.BasicSalary + componentTotal(structure.Allowances) - unpaidDeduction
		if grossPay < 0 {
			grossPay = 0
		}
		deductionsTotal := componentTotal(structure.Deductions)
		netPay := grossPay - deductionsTotal

		empName := employee.DisplayName
		if empName == "" {
			empName = employee.FirstName + " " + employee.LastName
		}

		payslip := models.Payslip{
			ID:                   primitive.NewObjectID(),
			PayslipNumber:        generatePayslipNumber(ctx, orgIDStr),
			PayRunID:             id,
			EmployeeID:           employeeID,
			EmployeeCode:         employee.EmployeeCode,
			EmployeeName:         empName,
			JobTitle:             employee.JobTitle,
			PeriodStart:          run.PeriodStart,
			PeriodEnd:            run.PeriodEnd,
			PayDate:              run.PayDate,
			Currency:             currency,
			BasicSalary:          structure.BasicSalary,
			Earnings:             structure.Allowances,
			Deductions:           structure.Deductions,
			GrossPay:             grossPay,
			TotalDeductions:      deductionsTotal,
			NetPay:               netPay,
			UnpaidLeaveDays:      unpaidDays,
			UnpaidLeaveDeduction: unpaidDeduction,
			Status:               "draft",
			OrgID:                orgIDStr,
			CreatedAt:            time.Now(),
			UpdatedAt:            time.Now(),
		}
		if _, err := payslipCollection.InsertOne(ctx, payslip); err != nil {
			continue
		}
		totalGross += grossPay
		totalDeductions += deductionsTotal
		totalNet += netPay
		generated++
	}

	payRunCollection.UpdateOne(ctx, bson.M{"_id": run.ID}, bson.M{"$set": bson.M{
		"totalGross": totalGross, "totalDeductions": totalDeductions, "totalNet": totalNet, "updatedAt": time.Now(),
	}})

	return generated, totalGross, totalDeductions, totalNet
}

// unpaidLeaveTypeIDs returns the set of LeaveType._id (hex) for this org whose
// Paid flag is false. Fetched once per generatePayslipsForRun call rather than
// per employee.
func unpaidLeaveTypeIDs(ctx context.Context, orgIDStr string) map[string]bool {
	ids := map[string]bool{}
	cursor, err := leaveTypeCollection.Find(ctx, bson.M{"orgId": orgIDStr, "paid": false}, options.Find().SetProjection(bson.M{"_id": 1}))
	if err != nil {
		return ids
	}
	defer cursor.Close(ctx)
	var types []models.LeaveType
	if cursor.All(ctx, &types) != nil {
		return ids
	}
	for _, t := range types {
		ids[t.ID.Hex()] = true
	}
	return ids
}

// unpaidLeaveDaysInPeriod sums calendar days of this employee's approved leave
// requests (against an unpaid LeaveType) that overlap [periodStart, periodEnd],
// clipped to the period boundary. Date strings are YYYY-MM-DD so lexicographic
// comparison is safe.
func unpaidLeaveDaysInPeriod(ctx context.Context, orgIDStr, employeeID, periodStart, periodEnd string, unpaidTypeIDs map[string]bool) float64 {
	if len(unpaidTypeIDs) == 0 {
		return 0
	}
	cursor, err := leaveRequestCollection.Find(ctx, bson.M{
		"orgId": orgIDStr, "employeeId": employeeID, "status": "approved",
		"startDate": bson.M{"$lte": periodEnd},
		"endDate":   bson.M{"$gte": periodStart},
	})
	if err != nil {
		return 0
	}
	defer cursor.Close(ctx)
	var requests []models.LeaveRequest
	if cursor.All(ctx, &requests) != nil {
		return 0
	}
	var total float64
	for _, r := range requests {
		if !unpaidTypeIDs[r.LeaveTypeID] {
			continue
		}
		start, end := r.StartDate, r.EndDate
		if start < periodStart {
			start = periodStart
		}
		if end > periodEnd {
			end = periodEnd
		}
		if d, derr := calendarDays(start, end); derr == nil {
			total += d
		}
	}
	return total
}

// ApprovePayRun finalizes the run's payslips and posts the payroll journal
// entry: DR gross salary expense, CR deductions payable, CR net salaries
// payable. Balances by construction since gross == deductions + net.
func ApprovePayRun() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		userID, _ := c.Get("userId")
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid pay run ID"})
			return
		}

		var run models.PayRun
		if err := payRunCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&run); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Pay run not found"})
			return
		}
		if run.Status != "draft" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Only a draft pay run can be approved"})
			return
		}
		payslipCount, _ := payslipCollection.CountDocuments(ctx, bson.M{"orgId": orgIDStr, "payRunId": id})
		if payslipCount == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Generate payslips before approving this pay run"})
			return
		}

		now := time.Now()
		payslipCollection.UpdateMany(ctx, bson.M{"orgId": orgIDStr, "payRunId": id}, bson.M{"$set": bson.M{"status": "final", "updatedAt": now}})

		userIDStr, _ := userID.(string)
		update := bson.M{"status": "approved", "approvedBy": userIDStr, "approvedAt": now, "updatedAt": now}
		payRunCollection.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": update})

		go autoJE(orgIDStr, "payroll_run", run.ID.Hex(), run.RunNumber, run.PayDate,
			fmt.Sprintf("Payroll - %s to %s", run.PeriodStart, run.PeriodEnd),
			[]jeLineInput{
				{AccountCode: "5100", Debit: run.TotalGross, Description: "Gross salaries"},
				{AccountCode: "2510", Credit: run.TotalDeductions, Description: "Employee deductions withheld"},
				{AccountCode: "2500", Credit: run.TotalNet, Description: "Net salaries payable"},
			})

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Pay run approved and posted to the ledger"})
	}
}

// MarkPayRunPaid clears the payroll payable against the bank account.
func MarkPayRunPaid() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid pay run ID"})
			return
		}

		var run models.PayRun
		if err := payRunCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&run); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Pay run not found"})
			return
		}
		if run.Status != "approved" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Only an approved pay run can be marked paid"})
			return
		}

		now := time.Now()
		payslipCollection.UpdateMany(ctx, bson.M{"orgId": orgIDStr, "payRunId": id}, bson.M{"$set": bson.M{"status": "paid", "updatedAt": now}})
		payRunCollection.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": bson.M{"status": "paid", "paidAt": now, "updatedAt": now}})

		go autoJE(orgIDStr, "payroll_run", run.ID.Hex(), run.RunNumber, now.Format("2006-01-02"),
			"Payroll disbursement - "+run.RunNumber,
			[]jeLineInput{
				{AccountCode: "2500", Debit: run.TotalNet, Description: "Net salaries paid"},
				{AccountCode: "1002", Credit: run.TotalNet, Description: "Bank - salary payment"},
			})

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Pay run marked as paid"})
	}
}

func CancelPayRun() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid pay run ID"})
			return
		}

		result, err := payRunCollection.UpdateOne(ctx,
			bson.M{"_id": objID, "orgId": orgIDStr, "status": "draft"},
			bson.M{"$set": bson.M{"status": "cancelled", "updatedAt": time.Now()}},
		)
		if err != nil || result.MatchedCount == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Only a draft pay run can be cancelled"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Pay run cancelled"})
	}
}

func DeletePayRun() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid pay run ID"})
			return
		}

		var run models.PayRun
		if err := payRunCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&run); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Pay run not found"})
			return
		}
		if run.Status != "draft" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Only a draft pay run can be deleted"})
			return
		}

		payslipCollection.DeleteMany(ctx, bson.M{"orgId": orgIDStr, "payRunId": id})
		payRunCollection.DeleteOne(ctx, bson.M{"_id": objID})
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Pay run deleted successfully"})
	}
}

// ── Payslips ────────────────────────────────────────────────────────────────

func GetAllPayslips() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)

		filter := bson.M{"orgId": orgIDStr}
		if payRunID := c.Query("payRunId"); payRunID != "" {
			filter["payRunId"] = payRunID
		}
		if employeeID := c.Query("employeeId"); employeeID != "" {
			filter["employeeId"] = employeeID
		}

		opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		cursor, err := payslipCollection.Find(ctx, filter, opts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to fetch payslips"})
			return
		}
		defer cursor.Close(ctx)

		var payslips []models.Payslip
		if err := cursor.All(ctx, &payslips); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to decode payslips"})
			return
		}
		if payslips == nil {
			payslips = []models.Payslip{}
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Payslips retrieved successfully", "data": gin.H{"payslips": payslips}})
	}
}

func GetPayslipByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		orgIDStr := fmt.Sprintf("%v", orgID)
		id := c.Param("id")
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid payslip ID"})
			return
		}

		var p models.Payslip
		if err := payslipCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&p); err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Payslip not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to retrieve payslip"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Payslip retrieved", "data": p})
	}
}

// getPayslipForOrg loads a payslip scoped to the org — small shared helper for
// the PDF and email handlers, which both need the same lookup.
func getPayslipForOrg(ctx context.Context, orgIDStr, id string) (models.Payslip, error) {
	var p models.Payslip
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return p, err
	}
	err = payslipCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgIDStr}).Decode(&p)
	return p, err
}
