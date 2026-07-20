package controllers

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/backend/models"
	"github.com/backend/utils"
	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// buildPayslipPDF hand-draws a payslip: org letterhead (or a plain navy header
// when none is configured), employee/period block, an earnings table and a
// deductions table, totals, and an amount-in-words line — same construction
// as buildLetterPDF, reusing its shared helpers verbatim.
func buildPayslipPDF(p models.Payslip) *gofpdf.Fpdf {
	pdf := gofpdf.New("P", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	const x0, x1 = 15.0, 195.0
	const W = x1 - x0

	navy := func() { pdf.SetTextColor(30, 58, 95) }
	dark := func() { pdf.SetTextColor(15, 23, 42) }
	muted := func() { pdf.SetTextColor(100, 116, 139) }
	body := func() { pdf.SetTextColor(51, 65, 85) }

	senderName := loadOrgName(p.OrgID)
	if senderName == "" {
		senderName = "Company"
	}

	lh, hasLH := loadOrgLetterhead(p.OrgID)
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

	// Title / number / pay date strip.
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "BU", 13)
	navy()
	pdf.CellFormat(W/2, 7, "Payslip", "", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	muted()
	pdf.CellFormat(W/2, 7, tr(p.PayslipNumber)+"  |  Pay date "+fmtDateDMY(p.PayDate), "", 1, "R", false, 0, "")
	y = pdf.GetY() + 3

	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "", 9)
	muted()
	pdf.CellFormat(W, 5, "Pay period: "+fmtDateDMY(p.PeriodStart)+" - "+fmtDateDMY(p.PeriodEnd), "", 1, "L", false, 0, "")
	y = pdf.GetY() + 6

	// Employee block.
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "B", 11)
	dark()
	pdf.CellFormat(W, 5.5, tr(p.EmployeeName), "", 1, "L", false, 0, "")
	pdf.SetX(x0)
	pdf.SetFont("Helvetica", "", 9)
	body()
	pdf.CellFormat(W, 5, tr(orDash(p.JobTitle))+"  ·  "+tr(p.EmployeeCode), "", 1, "L", false, 0, "")
	y = pdf.GetY() + 8

	rowH := 6.5
	tableRow := func(label string, amount float64, bold bool) {
		pdf.SetX(x0)
		if bold {
			pdf.SetFont("Helvetica", "B", 9.5)
			dark()
		} else {
			pdf.SetFont("Helvetica", "", 9.5)
			body()
		}
		pdf.CellFormat(W*0.7, rowH, tr(label), "", 0, "L", false, 0, "")
		pdf.CellFormat(W*0.3, rowH, fmt.Sprintf("%s %s", p.Currency, fmtMoney(amount)), "", 1, "R", false, 0, "")
	}
	sectionHeader := func(title string) {
		pdf.SetX(x0)
		pdf.SetFillColor(241, 245, 249)
		pdf.SetFont("Helvetica", "B", 9)
		navy()
		pdf.CellFormat(W, 7, tr(title), "", 1, "L", true, 0, "")
	}

	sectionHeader("Earnings")
	tableRow("Basic Salary", p.BasicSalary, false)
	for _, e := range p.Earnings {
		tableRow(e.Name, e.Amount, false)
	}
	if p.UnpaidLeaveDays > 0 {
		tableRow(fmt.Sprintf("Unpaid Leave (%.1f day(s))", p.UnpaidLeaveDays), -p.UnpaidLeaveDeduction, false)
	}
	pdf.SetDrawColor(226, 232, 240)
	pdf.SetLineWidth(0.2)
	pdf.Line(x0, pdf.GetY(), x1, pdf.GetY())
	tableRow("Gross Pay", p.GrossPay, true)

	pdf.Ln(4)
	if len(p.Deductions) > 0 {
		sectionHeader("Deductions")
		for _, d := range p.Deductions {
			tableRow(d.Name, d.Amount, false)
		}
		pdf.Line(x0, pdf.GetY(), x1, pdf.GetY())
		tableRow("Total Deductions", p.TotalDeductions, true)
		pdf.Ln(4)
	}

	// Net pay — highlighted.
	pdf.SetX(x0)
	pdf.SetFillColor(30, 58, 95)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(W*0.7, 9, "Net Pay", "", 0, "L", true, 0, "")
	pdf.CellFormat(W*0.3, 9, fmt.Sprintf("%s %s", p.Currency, fmtMoney(p.NetPay)), "", 1, "R", true, 0, "")
	y = pdf.GetY() + 6

	if p.Currency == "AED" {
		pdf.SetXY(x0, y)
		pdf.SetFont("Helvetica", "I", 8.5)
		muted()
		pdf.MultiCell(W, 4.5, tr(amountInWords(p.NetPay)), "", "L", false)
		y = pdf.GetY() + 4
	}

	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "", 8)
	muted()
	pdf.MultiCell(W, 4, "This is a system-generated payslip.", "", "L", false)

	return pdf
}

func writePayslipPDF(c *gin.Context, inline bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

	p, err := getPayslipForOrg(ctx, orgID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Payslip not found"})
		return
	}
	pdf := buildPayslipPDF(p)
	disposition := "attachment"
	if inline {
		disposition = "inline"
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", disposition+`; filename="payslip-`+p.PayslipNumber+`.pdf"`)
	if err := pdf.Output(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "PDF generation failed"})
	}
}

func DownloadPayslipPDF() gin.HandlerFunc { return func(c *gin.Context) { writePayslipPDF(c, false) } }
func PreviewPayslipPDF() gin.HandlerFunc  { return func(c *gin.Context) { writePayslipPDF(c, true) } }

// SendPayslipEmailHandler — POST /api/payroll/payslips/:id/send-email.
// Builds the PDF in-memory (same pdf.Output(io.Writer) dual-use as the
// download endpoint, just pointed at a buffer instead of the response) and
// emails it as an attachment. No public "view online" link — unlike
// invoices/quotes, payslips carry salary data that shouldn't sit behind a
// guessable token link.
func SendPayslipEmailHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		p, err := getPayslipForOrg(ctx, orgID, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Payslip not found"})
			return
		}

		var body struct {
			To string `json:"to"`
		}
		_ = c.ShouldBindJSON(&body)
		toEmail := body.To
		if toEmail == "" {
			if empObjID, err := primitive.ObjectIDFromHex(p.EmployeeID); err == nil {
				var employee models.Employee
				if employeeCollection.FindOne(ctx, bson.M{"_id": empObjID, "orgId": orgID}).Decode(&employee) == nil {
					toEmail = employee.Email
				}
			}
		}
		if toEmail == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "No recipient email — pass \"to\" or set the employee's email on file"})
			return
		}

		pdf := buildPayslipPDF(p)
		var buf bytes.Buffer
		if err := pdf.Output(&buf); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "PDF generation failed"})
			return
		}

		if err := utils.SendPayslipEmail(toEmail, p, buf.Bytes()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to send payslip email", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Payslip emailed to " + toEmail})
	}
}
