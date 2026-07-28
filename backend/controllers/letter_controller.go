package controllers

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/backend/config"
	"github.com/backend/middlewares"
	"github.com/backend/models"
	"github.com/backend/utils"
	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"github.com/microcosm-cc/bluemonday"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var letterCollection = config.GetCollection(config.DB, "letters")

// letterBodyPolicy sanitizes letter body HTML server-side — defense in depth
// behind the frontend's own DOMPurify pass, since this API can be called
// directly (any client with a valid token, not just the app's own editor).
// Built on UGCPolicy (strips scripts/event handlers/javascript: URLs) plus
// what the rich-text editor actually emits: inline styles for formatting
// (align/color/size/borders), contenteditable="false" on the inserted stamp
// image, and data: URIs for that same image (it's embedded, not hosted).
var letterBodyPolicy = func() *bluemonday.Policy {
	p := bluemonday.UGCPolicy()
	p.AllowAttrs("style").Globally()
	p.AllowAttrs("contenteditable").OnElements("div", "img")
	p.AllowDataURIImages()
	return p
}()

var letterTypeLabels = map[string]string{
	"warranty":           "Warranty Letter",
	"bank_details":       "Bank Details Letter",
	"reference":          "Reference Letter",
	"noc":                "No Objection Certificate",
	"offer_letter":       "Offer Letter",
	"appointment_letter": "Appointment Letter",
	"warning_letter":     "Warning Letter",
	"experience_letter":  "Experience Letter",
	"relieving_letter":   "Relieving Letter",
	"salary_certificate": "Salary Certificate",
	"promotion_letter":   "Promotion Letter",
	"termination_letter": "Termination Letter",
	"custom":             "Letter",
}

// letterTypeCategory says whether a letter type addresses a customer or an
// employee — drives which picker the editor shows and how the list/employee
// panel group letters. "custom" fits either, so it's left uncategorized.
var letterTypeCategory = map[string]string{
	"warranty":           "customer",
	"bank_details":       "customer",
	"reference":          "customer",
	"noc":                "customer",
	"offer_letter":       "employee",
	"appointment_letter": "employee",
	"warning_letter":     "employee",
	"experience_letter":  "employee",
	"relieving_letter":   "employee",
	"salary_certificate": "employee",
	"promotion_letter":   "employee",
	"termination_letter": "employee",
}

// letterModuleFor maps a letter type to the role module that actually gates
// it — "employees" for HR letters (offer/warning/etc, kept out of Sales'
// reach), "letters" for everything customer-addressed. RequireAnyModule only
// checks the caller has ONE of the two at the door; this is what narrows a
// given letter down to the module it really belongs to.
func letterModuleFor(letterType string) string {
	if letterTypeCategory[letterType] == "employee" {
		return "employees"
	}
	return "letters"
}

// canForCategory reports whether the caller's view caps cover a letter
// category ("customer"/"employee"/"" for the uncategorized "custom" type,
// which either module's view cap unlocks).
func canForCategory(category string, canCustomer, canEmployee bool) bool {
	switch category {
	case "employee":
		return canEmployee
	case "customer":
		return canCustomer
	default:
		return canCustomer || canEmployee
	}
}

// letterTypesInCategory lists every letter type key the given single view cap
// unlocks — the matching category (employee or customer) PLUS "custom" (its
// category is "", viewable either way per canForCategory) — used to restrict
// GetAllLetters to whichever module the caller can view when they only have
// one of the two.
func letterTypesInCategory(employee bool) []string {
	want := "customer"
	if employee {
		want = "employee"
	}
	var out []string
	for k := range letterTypeLabels {
		if cat := letterTypeCategory[k]; cat == want || cat == "" {
			out = append(out, k)
		}
	}
	return out
}

// orgAndRole resolves the orgID/role an in-handler HasCap check needs —
// RequireAnyModule already validated membership and set orgRole, this just
// re-parses orgID into the ObjectID HasCap wants.
func orgAndRole(c *gin.Context) (primitive.ObjectID, string) {
	orgID, _ := primitive.ObjectIDFromHex(fmt.Sprintf("%v", mustGet(c, "orgId")))
	role, _ := c.Get("orgRole")
	return orgID, fmt.Sprintf("%v", role)
}

// GetLetterTypes — GET /api/letters/types. Single source of truth for the
// frontend's type dropdown, same pattern as GetExportTypes/GetBackups.
func GetLetterTypes() gin.HandlerFunc {
	return func(c *gin.Context) {
		order := []string{
			"offer_letter", "appointment_letter", "warning_letter", "experience_letter",
			"relieving_letter", "salary_certificate", "promotion_letter", "termination_letter",
			"warranty", "bank_details", "reference", "noc", "custom",
		}
		out := make([]gin.H, 0, len(order))
		for _, k := range order {
			out = append(out, gin.H{"value": k, "label": letterTypeLabels[k], "category": letterTypeCategory[k]})
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": out})
	}
}

// GetNextLetterNumber — GET /api/letters/next-number. Returns the number the
// next created letter would receive (peek — nextNumber derives from existing
// docs and has no side effect), so the editor can seed the Ref line.
func GetNextLetterNumber() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))
		num := nextNumber(ctx, orgID, "letter", letterCollection, "letterNumber")
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": gin.H{"letterNumber": num}})
	}
}

type letterRequest struct {
	Type       string `json:"type"`
	Title      string `json:"title"`
	Body       string `json:"body"`
	CustomerID string `json:"customerId"`
	EmployeeID string `json:"employeeId"`
	Watermark  string `json:"watermark"`
}

func (r letterRequest) validate() error {
	if strings.TrimSpace(r.Title) == "" {
		return fmt.Errorf("title is required")
	}
	if strings.TrimSpace(r.Body) == "" {
		return fmt.Errorf("letter body is required")
	}
	if _, ok := letterTypeLabels[r.Type]; !ok {
		return fmt.Errorf("unknown letter type: %s", r.Type)
	}
	return nil
}

// CreateLetter — POST /api/letters
func CreateLetter() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))
		userID := fmt.Sprintf("%v", mustGet(c, "userId"))

		var req letterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body"})
			return
		}
		if err := req.validate(); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
			return
		}
		if orgOid, role := orgAndRole(c); !middlewares.HasCap(ctx, orgOid, role, letterModuleFor(req.Type), middlewares.CapAdd) {
			c.JSON(http.StatusForbidden, gin.H{"message": "You don't have permission to create this letter type"})
			return
		}
		req.Body = letterBodyPolicy.Sanitize(req.Body)

		letter := models.Letter{
			ID:        primitive.NewObjectID().Hex(),
			OrgID:     orgID,
			Type:      req.Type,
			Title:     strings.TrimSpace(req.Title),
			Body:      req.Body,
			Watermark: strings.TrimSpace(req.Watermark),
			IssueDate: time.Now(),
			CreatedBy: userID,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// Optional addressee — snapshot the customer's details as they are right
		// now, so the letter's wording stays stable even if the customer record
		// changes later.
		if strings.TrimSpace(req.CustomerID) != "" {
			if oid, err := primitive.ObjectIDFromHex(req.CustomerID); err == nil {
				var cust models.Customer
				if err := customersCollection.FindOne(ctx, bson.M{"_id": oid}).Decode(&cust); err == nil {
					letter.CustomerID = req.CustomerID
					letter.CustomerName = cust.CustomerDisplayName
					if letter.CustomerName == "" {
						letter.CustomerName = cust.CompanyName
					}
					letter.CustomerEmail = cust.CustomerEmail
					var parts []string
					for _, p := range []string{cust.StreetAddress, cust.City, cust.Country} {
						if p != "" {
							parts = append(parts, p)
						}
					}
					letter.CustomerAddress = strings.Join(parts, ", ")
				}
			}
		} else if strings.TrimSpace(req.EmployeeID) != "" {
			if oid, err := primitive.ObjectIDFromHex(req.EmployeeID); err == nil {
				var emp models.Employee
				if err := employeeCollection.FindOne(ctx, bson.M{"_id": oid, "orgId": orgID}).Decode(&emp); err == nil {
					letter.EmployeeID = req.EmployeeID
					letter.EmployeeName = emp.DisplayName
					if letter.EmployeeName == "" {
						letter.EmployeeName = strings.TrimSpace(emp.FirstName + " " + emp.LastName)
					}
					letter.EmployeeCode = emp.EmployeeCode
					letter.EmployeeEmail = emp.Email
				}
			}
		}

		letter.LetterNumber = nextNumber(ctx, orgID, "letter", letterCollection, "letterNumber")

		if _, err := letterCollection.InsertOne(ctx, letter); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create letter", "error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Letter created", "data": letter})
	}
}

// GetAllLetters — GET /api/letters?search=&type=
func GetAllLetters() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))
		orgOid, role := orgAndRole(c)
		canCustomer := middlewares.HasCap(ctx, orgOid, role, "letters", middlewares.CapView)
		canEmployee := middlewares.HasCap(ctx, orgOid, role, "employees", middlewares.CapView)

		filter := bson.M{"orgId": orgID}
		if t := c.Query("type"); t != "" {
			if !canForCategory(letterTypeCategory[t], canCustomer, canEmployee) {
				c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": []models.Letter{}, "count": 0})
				return
			}
			filter["type"] = t
		} else if canCustomer != canEmployee {
			// Caller only has one of the two modules — restrict the list to that
			// category's types rather than 403ing the whole list (mirrors
			// GetLetterTypes not existing per-role: the list itself just narrows).
			filter["type"] = bson.M{"$in": letterTypesInCategory(canEmployee)}
		}
		if e := c.Query("employeeId"); e != "" {
			filter["employeeId"] = e
		}
		if q := strings.TrimSpace(c.Query("search")); q != "" {
			rx := bson.M{"$regex": regexp.QuoteMeta(q), "$options": "i"}
			filter["$or"] = []bson.M{{"title": rx}, {"letterNumber": rx}, {"customerName": rx}, {"employeeName": rx}}
		}

		cur, err := letterCollection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to list letters", "error": err.Error()})
			return
		}
		defer cur.Close(ctx)
		var letters []models.Letter
		cur.All(ctx, &letters)
		if letters == nil {
			letters = []models.Letter{}
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": letters, "count": len(letters)})
	}
}

// GetLetterByID — GET /api/letters/:id
func GetLetterByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		var letter models.Letter
		if err := letterCollection.FindOne(ctx, bson.M{"_id": c.Param("id"), "orgId": orgID}).Decode(&letter); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Letter not found"})
			return
		}
		if orgOid, role := orgAndRole(c); !middlewares.HasCap(ctx, orgOid, role, letterModuleFor(letter.Type), middlewares.CapView) {
			c.JSON(http.StatusForbidden, gin.H{"message": "You don't have permission to view this letter"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": letter})
	}
}

// UpdateLetter — PUT /api/letters/:id
func UpdateLetter() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		var req letterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body"})
			return
		}
		if err := req.validate(); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
			return
		}

		var existing models.Letter
		if err := letterCollection.FindOne(ctx, bson.M{"_id": c.Param("id"), "orgId": orgID}).Decode(&existing); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Letter not found"})
			return
		}
		orgOid, role := orgAndRole(c)
		if !middlewares.HasCap(ctx, orgOid, role, letterModuleFor(existing.Type), middlewares.CapEdit) ||
			!middlewares.HasCap(ctx, orgOid, role, letterModuleFor(req.Type), middlewares.CapEdit) {
			c.JSON(http.StatusForbidden, gin.H{"message": "You don't have permission to edit this letter"})
			return
		}
		req.Body = letterBodyPolicy.Sanitize(req.Body)

		set := bson.M{
			"type": req.Type, "title": strings.TrimSpace(req.Title), "body": req.Body,
			"watermark": strings.TrimSpace(req.Watermark),
			"updatedAt": time.Now(),
		}
		res, err := letterCollection.UpdateOne(ctx,
			bson.M{"_id": c.Param("id"), "orgId": orgID},
			bson.M{"$set": set},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update letter", "error": err.Error()})
			return
		}
		if res.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"message": "Letter not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Letter updated"})
	}
}

// DeleteLetter — DELETE /api/letters/:id
func DeleteLetter() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		var existing models.Letter
		if err := letterCollection.FindOne(ctx, bson.M{"_id": c.Param("id"), "orgId": orgID}).Decode(&existing); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Letter not found"})
			return
		}
		if orgOid, role := orgAndRole(c); !middlewares.HasCap(ctx, orgOid, role, letterModuleFor(existing.Type), middlewares.CapDelete) {
			c.JSON(http.StatusForbidden, gin.H{"message": "You don't have permission to delete this letter"})
			return
		}

		res, err := letterCollection.DeleteOne(ctx, bson.M{"_id": c.Param("id"), "orgId": orgID})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to delete letter", "error": err.Error()})
			return
		}
		if res.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"message": "Letter not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Letter deleted"})
	}
}

// ── PDF ──────────────────────────────────────────────────────────────────────

// buildLetterPDF renders a letter: org letterhead (or a plain header when none
// is configured), title, date/number strip, optional addressee block, the free
// text body (line breaks preserved), and a signature block. No items table, no
// totals, no watermark — letters aren't transactional documents.
func buildLetterPDF(l models.Letter) *gofpdf.Fpdf {
	pdf := gofpdf.New("P", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	const x0, x1 = 15.0, 195.0
	const W = x1 - x0

	navy := func() { pdf.SetTextColor(30, 58, 95) }
	dark := func() { pdf.SetTextColor(15, 23, 42) }
	muted := func() { pdf.SetTextColor(100, 116, 139) }
	body := func() { pdf.SetTextColor(51, 65, 85) }

	senderName := loadOrgName(l.OrgID)
	if senderName == "" {
		senderName = "Company"
	}

	lh, hasLH := loadOrgLetterhead(l.OrgID)
	baseTop := 14.0
	botMargin := 16.0
	if hasLH {
		baseTop = lh.topPadMM
		botMargin = lh.botPadMM
	}
	var opt gofpdf.ImageOptions
	if hasLH {
		opt = gofpdf.ImageOptions{ImageType: lh.imgType}
		pdf.RegisterImageOptionsReader("letterhead", opt, bytes.NewReader(lh.data))
	}
	pdf.SetHeaderFunc(func() {
		if hasLH {
			pdf.ImageOptions("letterhead", 0, 0, 210, 297, false, opt, 0, "")
		}
	})
	pdf.AliasNbPages("{nb}")
	pdf.SetFooterFunc(func() {
		pdf.SetY(297 - botMargin - 6)
		pdf.SetFont("Helvetica", "", 8)
		muted()
		pdf.CellFormat(W, 4, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "C", false, 0, "")
	})
	pdf.SetMargins(15, baseTop+6, 15)
	pdf.SetAutoPageBreak(true, botMargin+10)
	pdf.AddPage()

	var y float64
	if hasLH {
		y = lh.topPadMM
	} else {
		pdf.SetFillColor(30, 58, 95)
		pdf.Rect(0, 0, 210, 24, "F")
		pdf.SetXY(x0, 8)
		pdf.SetFont("Helvetica", "B", 15)
		pdf.SetTextColor(255, 255, 255)
		pdf.CellFormat(W, 8, tr(senderName), "", 1, "L", false, 0, "")
		y = 30
	}

	// Number / date strip (right aligned, like the other doc PDFs' header info)
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "", 9)
	muted()
	pdf.CellFormat(W/2, 5, tr(l.LetterNumber), "", 0, "L", false, 0, "")
	pdf.CellFormat(W/2, 5, l.IssueDate.Format("02 Jan 2006"), "", 1, "R", false, 0, "")
	y = pdf.GetY() + 6

	// Addressee block, if any — customer OR employee (a letter has at most one).
	addresseeName, addresseeSub := l.CustomerName, l.CustomerAddress
	if addresseeName == "" && l.EmployeeName != "" {
		addresseeName = l.EmployeeName
		if l.EmployeeCode != "" {
			addresseeSub = "Employee Code: " + l.EmployeeCode
		}
	}
	if addresseeName != "" {
		pdf.SetXY(x0, y)
		pdf.SetFont("Helvetica", "B", 10)
		dark()
		pdf.CellFormat(W, 5, tr(addresseeName), "", 1, "L", false, 0, "")
		if addresseeSub != "" {
			pdf.SetX(x0)
			pdf.SetFont("Helvetica", "", 9)
			body()
			pdf.MultiCell(W, 4.5, tr(addresseeSub), "", "L", false)
		}
		y = pdf.GetY() + 8
	}

	// Title
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "BU", 13)
	navy()
	pdf.CellFormat(W, 7, tr(l.Title), "", 1, "L", false, 0, "")
	y = pdf.GetY() + 6

	// Body — free text, line breaks preserved.
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "", 10)
	dark()
	for _, para := range strings.Split(l.Body, "\n") {
		pdf.SetX(x0)
		if strings.TrimSpace(para) == "" {
			pdf.Ln(5)
			continue
		}
		pdf.MultiCell(W, 5.5, tr(para), "", "L", false)
	}
	y = pdf.GetY() + 16

	// Signature block.
	if y > 297-botMargin-30 {
		pdf.AddPage()
		y = baseTop + 10
	}
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.CellFormat(W, 4, "For "+tr(strings.ToUpper(senderName)), "", 1, "L", false, 0, "")
	pdf.SetXY(x0, y+22)
	pdf.SetDrawColor(148, 163, 184)
	pdf.SetLineWidth(0.2)
	pdf.Line(x0, y+22, x0+70, y+22)
	pdf.SetXY(x0, y+25)
	pdf.SetFont("Helvetica", "", 8.5)
	body()
	pdf.CellFormat(70, 4.5, "Authorized Signatory", "", 1, "L", false, 0, "")

	letterWatermark(pdf, l.Watermark)
	return pdf
}

// letterWatermark stamps user-set diagonal translucent text across every page
// (e.g. "DRAFT", "WARRANTY", "COPY") — unlike the status-driven watermark on
// transactional docs, this text is whatever the user typed when composing the
// letter, so no status→text mapping here.
func letterWatermark(pdf *gofpdf.Fpdf, text string) {
	text = strings.TrimSpace(text)
	if text == "" {
		return
	}
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	for n := 1; n <= pdf.PageCount(); n++ {
		pdf.SetPage(n)
		pdf.SetFont("Helvetica", "B", 60)
		pdf.SetTextColor(220, 38, 38)
		pdf.SetAlpha(0.12, "Normal")
		pdf.TransformBegin()
		pdf.TransformRotate(45, 105, 148.5)
		pdf.SetXY(0, 145)
		pdf.CellFormat(210, 12, tr(strings.ToUpper(text)), "", 0, "C", false, 0, "")
		pdf.TransformEnd()
		pdf.SetAlpha(1, "Normal")
	}
}

func writeLetterPDF(c *gin.Context, inline bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

	var letter models.Letter
	if err := letterCollection.FindOne(ctx, bson.M{"_id": c.Param("id"), "orgId": orgID}).Decode(&letter); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Letter not found"})
		return
	}
	if orgOid, role := orgAndRole(c); !middlewares.HasCap(ctx, orgOid, role, letterModuleFor(letter.Type), middlewares.CapView) {
		c.JSON(http.StatusForbidden, gin.H{"message": "You don't have permission to view this letter"})
		return
	}
	pdf := buildLetterPDF(letter)
	disposition := "attachment"
	if inline {
		disposition = "inline"
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", disposition+`; filename="letter-`+letter.LetterNumber+`.pdf"`)
	if err := pdf.Output(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
	}
}

func DownloadLetterPDF() gin.HandlerFunc { return func(c *gin.Context) { writeLetterPDF(c, false) } }
func PreviewLetterPDF() gin.HandlerFunc  { return func(c *gin.Context) { writeLetterPDF(c, true) } }

// SendLetterEmail — POST /api/letters/:id/send-email. Body: {to:[...], message}
func SendLetterEmail() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		var letter models.Letter
		if err := letterCollection.FindOne(ctx, bson.M{"_id": c.Param("id"), "orgId": orgID}).Decode(&letter); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Letter not found"})
			return
		}
		if orgOid, role := orgAndRole(c); !middlewares.HasCap(ctx, orgOid, role, letterModuleFor(letter.Type), middlewares.CapView) {
			c.JSON(http.StatusForbidden, gin.H{"message": "You don't have permission to email this letter"})
			return
		}

		var body struct {
			To      []string `json:"to"`
			Message string   `json:"message"`
			PDF     string   `json:"pdf"` // optional base64 PDF rendered client-side (WYSIWYG, incl. tables)
		}
		if err := c.ShouldBindJSON(&body); err != nil || len(body.To) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "At least one recipient email is required"})
			return
		}

		// Prefer the client-rendered PDF (matches the on-screen letterhead + tables).
		// Fall back to the server gofpdf build when none is supplied.
		var pdfBytes []byte
		if raw := strings.TrimSpace(body.PDF); raw != "" {
			if i := strings.Index(raw, ","); i >= 0 { // strip data URI prefix if present
				raw = raw[i+1:]
			}
			decoded, err := base64.StdEncoding.DecodeString(raw)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid PDF payload"})
				return
			}
			pdfBytes = decoded
		} else {
			pdf := buildLetterPDF(letter)
			var pdfBuf bytes.Buffer
			if err := pdf.Output(&pdfBuf); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to generate PDF"})
				return
			}
			pdfBytes = pdfBuf.Bytes()
		}

		// Public "view online" link is generated once, the first time a letter is
		// actually emailed — persisted so re-sends and the print/preview page share it.
		if letter.PublicToken == "" {
			letter.PublicToken = generatePublicToken()
			letterCollection.UpdateOne(ctx, bson.M{"_id": letter.ID}, bson.M{"$set": bson.M{"publicToken": letter.PublicToken}})
		}

		if err := utils.SendLetterEmail(body.To, letter, body.Message, pdfBytes); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to send email", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Letter emailed"})
	}
}

// GetPublicLetter — GET /api/letters/public/:token — no auth required. Returns
// both the letter and the minimal org fields the public viewer needs to render
// the letterhead (name/image/pads), in one round trip since an anonymous
// visitor has no session to fetch the org separately with.
func GetPublicLetter() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		token := c.Param("token")
		if token == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid token"})
			return
		}

		var letter models.Letter
		if err := letterCollection.FindOne(ctx, bson.M{"publicToken": token}).Decode(&letter); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Letter not found"})
			return
		}

		org := gin.H{}
		if orgObjID, err := primitive.ObjectIDFromHex(letter.OrgID); err == nil {
			var o models.Organization
			opts := options.FindOne().SetProjection(bson.M{"name": 1, "letterheadImage": 1, "letterheadTopPad": 1, "letterheadBottomPad": 1})
			if err := orgCollection.FindOne(ctx, bson.M{"_id": orgObjID}, opts).Decode(&o); err == nil {
				org = gin.H{"name": o.Name, "letterheadImage": o.LetterheadImage, "letterheadTopPad": o.LetterheadTopPad, "letterheadBottomPad": o.LetterheadBottomPad}
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": gin.H{"letter": letter, "org": org}})
	}
}
