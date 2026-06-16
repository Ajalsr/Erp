package controllers

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ── helpers ──────────────────────────────────────────────────────────────────

func fmtMoney(n float64) string { return fmt.Sprintf("%.2f", n) }

func pdfHeader(pdf *gofpdf.Fpdf, isDark bool) {
	// Accent bar
	pdf.SetFillColor(245, 158, 11)
	pdf.Rect(0, 0, 210, 8, "F")
}

func pdfParty(pdf *gofpdf.Fpdf, label, name, address, trn string, x, y float64) {
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(100, 116, 139)
	pdf.SetXY(x, y)
	pdf.CellFormat(80, 5, label, "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(15, 23, 42)
	pdf.SetX(x)
	pdf.CellFormat(80, 6, name, "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(71, 85, 105)
	pdf.SetX(x)
	pdf.MultiCell(80, 5, address, "", "L", false)
	if trn != "" {
		pdf.SetX(x)
		pdf.SetFont("Helvetica", "B", 8)
		pdf.SetTextColor(100, 116, 139)
		pdf.CellFormat(80, 5, "TRN: "+trn, "", 1, "L", false, 0, "")
	}
}

func pdfLineItems(pdf *gofpdf.Fpdf, items []models.InvoiceLineItem, currency string) {
	pdf.SetY(pdf.GetY() + 6)

	headers := []struct {
		label string
		w     float64
		align string
	}{
		{"Description", 68, "L"},
		{"Qty", 18, "C"},
		{"Unit Price", 30, "R"},
		{"Disc", 18, "R"},
		{"Tax", 18, "R"},
		{"Total", 28, "R"},
	}

	// Table header
	pdf.SetFillColor(245, 247, 250)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(100, 116, 139)
	for _, h := range headers {
		pdf.CellFormat(h.w, 8, h.label, "B", 0, h.align, true, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Helvetica", "", 9)
	for i, item := range items {
		if i%2 == 0 {
			pdf.SetFillColor(255, 255, 255)
		} else {
			pdf.SetFillColor(249, 250, 251)
		}
		pdf.SetTextColor(15, 23, 42)

		// Desc (multi-line cell workaround)
		x, y := pdf.GetXY()
		pdf.MultiCell(68, 6, item.Desc, "", "L", true)
		newY := pdf.GetY()
		rowH := newY - y
		if rowH < 6 {
			rowH = 6
		}
		pdf.SetXY(x+68, y)
		pdf.CellFormat(18, rowH, fmt.Sprintf("%.2f", item.Qty), "", 0, "C", true, 0, "")
		pdf.CellFormat(30, rowH, fmtMoney(item.UnitPrice), "", 0, "R", true, 0, "")
		pdf.CellFormat(18, rowH, fmt.Sprintf("%.1f%%", item.Discount), "", 0, "R", true, 0, "")
		pdf.CellFormat(18, rowH, fmt.Sprintf("%.1f%%", item.TaxRate), "", 0, "R", true, 0, "")
		pdf.CellFormat(28, rowH, fmtMoney(item.Total), "", 0, "R", true, 0, "")
		pdf.SetXY(x, y+rowH)
	}
}

func pdfTotals(pdf *gofpdf.Fpdf, subtotal, discTotal, taxTotal, grandTotal float64, currency string) {
	type row struct{ label, val string }
	rows := []row{
		{"Subtotal", currency + " " + fmtMoney(subtotal)},
		{"Discount", "- " + currency + " " + fmtMoney(discTotal)},
		{"VAT", currency + " " + fmtMoney(taxTotal)},
	}

	pdf.SetY(pdf.GetY() + 4)
	for _, r := range rows {
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(71, 85, 105)
		pdf.CellFormat(152, 7, r.label, "", 0, "R", false, 0, "")
		pdf.SetTextColor(15, 23, 42)
		pdf.CellFormat(28, 7, r.val, "", 1, "R", false, 0, "")
	}

	// Grand total
	pdf.SetFillColor(245, 158, 11)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(152, 10, "Total Due", "T", 0, "R", true, 0, "")
	pdf.CellFormat(28, 10, currency+" "+fmtMoney(grandTotal), "T", 1, "R", true, 0, "")
}

// ── Invoice PDF ───────────────────────────────────────────────────────────────

// GET /api/invoices/:id/pdf
func DownloadInvoicePDF() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid invoice ID"})
			return
		}

		var inv models.Invoice
		if err := invoiceCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&inv); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Invoice not found"})
			return
		}

		pdf := gofpdf.New("P", "mm", "A4", "")

		// Render the org letterhead on every page when configured (matches preview).
		lh, hasLH := loadOrgLetterhead(inv.OrgID)
		if hasLH {
			opt := gofpdf.ImageOptions{ImageType: lh.imgType}
			pdf.RegisterImageOptionsReader("letterhead", opt, bytes.NewReader(lh.data))
			pdf.SetHeaderFunc(func() {
				pdf.ImageOptions("letterhead", 0, 0, 210, 297, false, opt, 0, "")
			})
			pdf.SetMargins(15, lh.topPadMM, 15)
			pdf.SetAutoPageBreak(true, lh.botPadMM)
		} else {
			pdf.SetMargins(15, 14, 15)
			pdf.SetAutoPageBreak(true, 20)
		}
		pdf.AddPage()

		// Content starts below the letterhead top pad, or below the accent bar.
		top := 14.0
		if hasLH {
			top = lh.topPadMM
		} else {
			pdfHeader(pdf, false)
		}

		// Title
		docLabel := "INVOICE"
		if inv.Type == "proforma" {
			docLabel = "PROFORMA INVOICE"
		}
		pdf.SetFont("Helvetica", "B", 20)
		pdf.SetTextColor(15, 23, 42)
		pdf.SetXY(15, top+2)
		pdf.CellFormat(100, 10, docLabel, "", 0, "L", false, 0, "")

		// Invoice meta (right side)
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(71, 85, 105)
		pdf.SetXY(120, top+2)
		pdf.CellFormat(75, 5, "Invoice #: "+inv.InvoiceNumber, "", 1, "R", false, 0, "")
		pdf.SetX(120)
		pdf.CellFormat(75, 5, "Issue Date: "+inv.IssueDate, "", 1, "R", false, 0, "")
		pdf.SetX(120)
		pdf.CellFormat(75, 5, "Due Date: "+inv.DueDate, "", 1, "R", false, 0, "")
		if inv.PaymentTerms != "" {
			pdf.SetX(120)
			pdf.CellFormat(75, 5, "Terms: "+inv.PaymentTerms, "", 1, "R", false, 0, "")
		}

		pdf.SetY(top + 18)
		pdf.SetDrawColor(226, 232, 240)
		pdf.Line(15, pdf.GetY(), 195, pdf.GetY())
		pdf.SetY(pdf.GetY() + 4)

		// From / Bill To
		fromY := pdf.GetY()
		pdfParty(pdf, "FROM", inv.From.Name, inv.From.Address, inv.From.TRN, 15, fromY)
		pdfParty(pdf, "BILL TO", inv.BillTo.Name, inv.BillTo.Address, inv.BillTo.TRN, 110, fromY)

		// Move below whichever party block is taller
		if pdf.GetY() < fromY+22 {
			pdf.SetY(fromY + 22)
		}
		pdf.SetY(pdf.GetY() + 4)
		pdf.Line(15, pdf.GetY(), 195, pdf.GetY())

		// Line items
		pdfLineItems(pdf, inv.LineItems, inv.Currency)

		// Totals
		pdfTotals(pdf, inv.Totals.Subtotal, inv.Totals.DiscountTotal, inv.Totals.TaxTotal, inv.Totals.GrandTotal, inv.Currency)

		// Notes
		if inv.Notes.Customer != "" {
			pdf.SetY(pdf.GetY() + 8)
			pdf.SetFont("Helvetica", "B", 8)
			pdf.SetTextColor(100, 116, 139)
			pdf.CellFormat(0, 5, "NOTES", "", 1, "L", false, 0, "")
			pdf.SetFont("Helvetica", "", 9)
			pdf.SetTextColor(71, 85, 105)
			pdf.MultiCell(0, 5, inv.Notes.Customer, "", "L", false)
		}

		// Footer — skip when a letterhead already supplies the page footer.
		if !hasLH {
			pdf.SetY(-18)
			pdf.SetFont("Helvetica", "I", 8)
			pdf.SetTextColor(148, 163, 184)
			pdf.CellFormat(0, 5, fmt.Sprintf("Generated by Nexus ERP · %s · Thank you for your business", time.Now().Format("02 Jan 2006")), "", 0, "C", false, 0, "")
		}

		filename := "invoice-" + inv.InvoiceNumber + ".pdf"
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
		if err := pdf.Output(c.Writer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
		}
	}
}

// ── Quote PDF ─────────────────────────────────────────────────────────────────

// GET /api/quotes/:id/pdf
// buildQuotePDF renders a quote into a gofpdf document (shared by the PDF download
// handler and the email-send attachment).
// orgLetterhead holds a decoded letterhead image plus the top/bottom content
// padding (in mm) so the PDF can reserve space the same way the print preview does.
type orgLetterhead struct {
	data     []byte
	imgType  string // "PNG" | "JPG"
	topPadMM float64
	botPadMM float64
}

// loadOrgLetterhead fetches the org's letterhead image (base64 data-URL) and
// converts the percentage top/bottom pads into mm based on the rendered image
// height at full A4 width (210mm). Returns ok=false when there's no letterhead.
func loadOrgLetterhead(orgID string) (orgLetterhead, bool) {
	objID, err := primitive.ObjectIDFromHex(orgID)
	if err != nil {
		return orgLetterhead{}, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var org models.Organization
	if err := orgCollection.FindOne(ctx, bson.M{"_id": objID}).Decode(&org); err != nil {
		return orgLetterhead{}, false
	}
	src := strings.TrimSpace(org.LetterheadImage)
	if src == "" {
		return orgLetterhead{}, false
	}

	// The letterhead is stored either as a hosted URL (Cloudinary) or a base64
	// data-URL. Resolve both to raw image bytes.
	var data []byte
	if strings.HasPrefix(src, "http://") || strings.HasPrefix(src, "https://") {
		client := &http.Client{Timeout: 8 * time.Second}
		resp, err := client.Get(src)
		if err != nil {
			return orgLetterhead{}, false
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return orgLetterhead{}, false
		}
		if data, err = io.ReadAll(io.LimitReader(resp.Body, 15<<20)); err != nil {
			return orgLetterhead{}, false
		}
	} else {
		raw := src
		if i := strings.Index(raw, ","); i >= 0 { // strip "data:image/png;base64," prefix
			raw = raw[i+1:]
		}
		var err error
		if data, err = base64.StdEncoding.DecodeString(raw); err != nil {
			return orgLetterhead{}, false
		}
	}

	// Decode dimensions + format (png/jpeg) so gofpdf gets the right ImageType.
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width == 0 {
		return orgLetterhead{}, false
	}
	imgType := "PNG"
	if format == "jpeg" {
		imgType = "JPG"
	}

	imgHmm := 210.0 * float64(cfg.Height) / float64(cfg.Width) // height at full A4 width
	top := org.LetterheadTopPad
	if top == 0 {
		top = 13
	}
	bot := org.LetterheadBottomPad
	if bot == 0 {
		bot = 8
	}
	return orgLetterhead{
		data:     data,
		imgType:  imgType,
		topPadMM: imgHmm * float64(top) / 100,
		botPadMM: imgHmm * float64(bot) / 100,
	}, true
}

// ── amount-in-words helpers (mirror the print component) ─────────────────────
var pdfOnes = []string{"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"}
var pdfTens = []string{"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"}

func pdfThree(n int) string {
	s := ""
	if n >= 100 {
		s += pdfOnes[n/100] + " Hundred "
		n %= 100
	}
	if n >= 20 {
		s += pdfTens[n/10] + " "
		n %= 10
	}
	if n > 0 {
		s += pdfOnes[n] + " "
	}
	return strings.TrimSpace(s)
}

func pdfToWords(num int) string {
	if num == 0 {
		return "Zero"
	}
	scales := []string{"", "Thousand", "Million", "Billion"}
	i, words := 0, ""
	for num > 0 {
		if chunk := num % 1000; chunk != 0 {
			scale := ""
			if scales[i] != "" {
				scale = " " + scales[i]
			}
			words = pdfThree(chunk) + scale + " " + words
		}
		num /= 1000
		i++
	}
	return strings.TrimSpace(words)
}

func amountInWords(total float64) string {
	dh := int(total)
	fils := int(total*100+0.5) - dh*100
	s := pdfToWords(dh) + " Dirham"
	if fils > 0 {
		s += " and " + pdfToWords(fils) + " Fils"
	} else {
		s += " and No Fils"
	}
	return s
}

func fmtDateDMY(s string) string {
	if s == "" {
		return "—"
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t.Format("02/01/2006")
	}
	return s
}

func orDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "—"
	}
	return s
}

func buildQuotePDF(q models.Quote) *gofpdf.Fpdf {
	pdf := gofpdf.New("P", "mm", "A4", "")

	lh, hasLH := loadOrgLetterhead(q.OrgID)
	if hasLH {
		opt := gofpdf.ImageOptions{ImageType: lh.imgType}
		pdf.RegisterImageOptionsReader("letterhead", opt, bytes.NewReader(lh.data))
		pdf.SetHeaderFunc(func() {
			pdf.ImageOptions("letterhead", 0, 0, 210, 297, false, opt, 0, "")
		})
		pdf.SetMargins(15, lh.topPadMM, 15)
		pdf.SetAutoPageBreak(true, lh.botPadMM)
	} else {
		pdf.SetMargins(15, 14, 15)
		pdf.SetAutoPageBreak(true, 16)
	}
	pdf.AddPage()

	const x0, x1, mid = 15.0, 195.0, 105.0
	const W = x1 - x0

	navy := func() { pdf.SetTextColor(30, 58, 95) }
	dark := func() { pdf.SetTextColor(15, 23, 42) }
	muted := func() { pdf.SetTextColor(100, 116, 139) }
	body := func() { pdf.SetTextColor(51, 65, 85) }
	borderPen := func() { pdf.SetDrawColor(226, 232, 240); pdf.SetLineWidth(0.2) }
	navyPen := func() { pdf.SetDrawColor(30, 58, 95); pdf.SetLineWidth(0.5) }
	hline := func(y float64, accent bool) {
		if accent {
			navyPen()
		} else {
			borderPen()
		}
		pdf.Line(x0, y, x1, y)
	}

	company := q.Company
	cur := q.Currency
	if cur == "" {
		cur = "AED"
	}
	senderName := company.Name
	if senderName == "" {
		senderName = "Company"
	}

	var y float64
	if hasLH {
		y = lh.topPadMM
	} else {
		pdf.SetFillColor(30, 58, 95)
		pdf.Rect(0, 0, 210, 24, "F")
		pdf.SetXY(x0, 6)
		pdf.SetFont("Helvetica", "B", 15)
		pdf.SetTextColor(255, 255, 255)
		pdf.CellFormat(120, 8, senderName, "", 1, "L", false, 0, "")
		if company.Address != "" {
			pdf.SetX(x0)
			pdf.SetFont("Helvetica", "", 8)
			pdf.SetTextColor(220, 228, 238)
			pdf.CellFormat(180, 4, company.Address, "", 0, "L", false, 0, "")
		}
		y = 28
	}

	// Title
	pdf.SetXY(x0, y+3)
	pdf.SetFont("Helvetica", "BU", 14)
	navy()
	pdf.CellFormat(W, 7, "QUOTATION", "", 1, "C", false, 0, "")
	if company.TRN != "" {
		pdf.SetX(x0)
		pdf.SetFont("Helvetica", "B", 9)
		navy()
		pdf.CellFormat(W, 5, "TRN : "+company.TRN, "", 1, "C", false, 0, "")
	}
	y = pdf.GetY() + 3

	// Quote number / date strip
	stripH := 8.0
	hline(y, false)
	hline(y+stripH, false)
	borderPen()
	pdf.Line(mid, y, mid, y+stripH)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.SetXY(x0+5, y+2.2)
	pdf.CellFormat(40, 4, "QUOTE NUMBER", "", 0, "L", false, 0, "")
	dark()
	pdf.SetXY(mid-50, y+2.2)
	pdf.CellFormat(45, 4, q.QuoteNumber, "", 0, "R", false, 0, "")
	navy()
	pdf.SetXY(mid+5, y+2.2)
	pdf.CellFormat(40, 4, "DATE", "", 0, "L", false, 0, "")
	dark()
	pdf.SetXY(x1-50, y+2.2)
	pdf.CellFormat(45, 4, fmtDateDMY(q.QuoteDate), "", 0, "R", false, 0, "")
	y += stripH

	// TO / DETAILS
	blockY := y
	pdf.SetXY(x0+5, blockY+3)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.CellFormat(80, 4, "TO", "", 0, "L", false, 0, "")
	ly := blockY + 8
	toName := q.BillTo.Name
	if toName == "" {
		toName = q.CustomerName
	}
	pdf.SetXY(x0+5, ly)
	pdf.SetFont("Helvetica", "B", 9)
	dark()
	pdf.CellFormat(85, 4.5, toName, "", 0, "L", false, 0, "")
	ly += 5
	body()
	pdf.SetFont("Helvetica", "", 8.5)
	if q.BillTo.Address != "" {
		pdf.SetXY(x0+5, ly)
		pdf.MultiCell(85, 4.2, q.BillTo.Address, "", "L", false)
		ly = pdf.GetY() + 1
	}
	if q.CustomerEmail != "" {
		pdf.SetXY(x0+5, ly)
		pdf.CellFormat(85, 4.2, q.CustomerEmail, "", 0, "L", false, 0, "")
		ly += 5
	}
	if q.BillTo.TRN != "" {
		pdf.SetXY(x0+5, ly)
		pdf.CellFormat(85, 4.2, "TRN: "+q.BillTo.TRN, "", 0, "L", false, 0, "")
		ly += 5
	}
	pdf.SetXY(mid+5, blockY+3)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.CellFormat(80, 4, "DETAILS", "", 0, "L", false, 0, "")
	details := [][2]string{
		{"Currency", cur},
		{"Quote Date", fmtDateDMY(q.QuoteDate)},
		{"Valid Until", fmtDateDMY(q.ValidUntil)},
		{"Payment Terms", orDash(q.PaymentTerms)},
		{"Attention To", orDash(q.AttentionTo)},
		{"Subject", orDash(q.Subject)},
		{"Project", orDash(q.ProjectName)},
	}
	ry := blockY + 8
	pdf.SetFont("Helvetica", "", 8.5)
	for _, d := range details {
		muted()
		pdf.SetXY(mid+5, ry)
		pdf.CellFormat(32, 4.4, d[0], "", 0, "L", false, 0, "")
		dark()
		pdf.SetXY(mid+37, ry)
		pdf.CellFormat(48, 4.4, ": "+d[1], "", 0, "L", false, 0, "")
		ry += 4.6
	}
	blockH := ry - blockY + 1
	if h := ly - blockY + 1; h > blockH {
		blockH = h
	}
	borderPen()
	pdf.Line(mid, blockY, mid, blockY+blockH)
	hline(blockY+blockH, true)
	y = blockY + blockH

	// Intro text
	if q.IntroText != "" {
		pdf.SetXY(x0+5, y+2.5)
		pdf.SetFont("Helvetica", "", 8.5)
		body()
		pdf.MultiCell(W-10, 4.4, q.IntroText, "", "L", false)
		y = pdf.GetY() + 2.5
		hline(y, false)
	}

	// Items table
	cols := []struct {
		label string
		w     float64
		align string
	}{
		{"Sl.No", 9, "C"}, {"Part No", 20, "L"}, {"Description", 46, "L"},
		{"Qty", 11, "C"}, {"Unit", 12, "C"}, {"Unit Price", 20, "R"},
		{"Discount", 16, "R"}, {"VAT %", 13, "C"}, {"Net Value", 16, "R"}, {"Total Value", 17, "R"},
	}
	pdf.SetXY(x0, y)
	pdf.SetFillColor(241, 245, 249)
	pdf.SetFont("Helvetica", "B", 8)
	navy()
	for _, c := range cols {
		pdf.CellFormat(c.w, 8, c.label, "", 0, c.align, true, 0, "")
	}
	pdf.Ln(-1)
	hline(pdf.GetY(), true)

	descX := x0 + cols[0].w + cols[1].w
	afterDescX := descX + cols[2].w
	drawRow := func(item *models.QuoteLineItem, idx int) {
		_, yy := pdf.GetXY()
		pdf.SetFont("Helvetica", "", 8.5)
		desc := ""
		if item != nil {
			desc = item.Desc
		}
		pdf.SetXY(descX, yy)
		dark()
		pdf.MultiCell(cols[2].w, 5, desc, "", "L", false)
		rowH := pdf.GetY() - yy
		if rowH < 7 {
			rowH = 7
		}
		if item != nil {
			gross := item.Qty * item.UnitPrice
			net := item.Subtotal
			if net == 0 {
				net = gross - item.DiscAmt
			}
			partNo := item.PartNumber
			if partNo == "" {
				partNo = "—"
			}
			pdf.SetXY(x0, yy)
			muted()
			pdf.CellFormat(cols[0].w, rowH, fmt.Sprintf("%d", idx+1), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[1].w, rowH, partNo, "", 0, "L", false, 0, "")
			pdf.SetX(afterDescX)
			dark()
			pdf.CellFormat(cols[3].w, rowH, fmt.Sprintf("%g", item.Qty), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[4].w, rowH, item.Unit, "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[5].w, rowH, fmtMoney(item.UnitPrice), "", 0, "R", false, 0, "")
			if item.DiscAmt > 0 {
				dark()
			} else {
				muted()
			}
			pdf.CellFormat(cols[6].w, rowH, fmtMoney(item.DiscAmt), "", 0, "R", false, 0, "")
			dark()
			pdf.CellFormat(cols[7].w, rowH, fmt.Sprintf("%g%%", item.TaxRate), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[8].w, rowH, fmtMoney(net), "", 0, "R", false, 0, "")
			pdf.SetFont("Helvetica", "B", 8.5)
			pdf.CellFormat(cols[9].w, rowH, fmtMoney(item.Total), "", 0, "R", false, 0, "")
		}
		by := yy + rowH
		hline(by, false)
		pdf.SetXY(x0, by)
	}
	for i := range q.LineItems {
		drawRow(&q.LineItems[i], i)
	}
	for i := len(q.LineItems); i < 3; i++ {
		drawRow(nil, i)
	}
	y = pdf.GetY()

	// Totals box
	hline(y, true)
	totalsH := 24.0
	rx := 125.0
	rw := x1 - rx
	pdf.SetXY(x0+5, y+3)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.CellFormat(100, 4, "TOTAL IN WORDS", "", 0, "L", false, 0, "")
	pdf.SetXY(x0+5, y+8)
	pdf.SetFont("Helvetica", "B", 9)
	dark()
	pdf.MultiCell(rx-x0-8, 4.6, cur+" "+amountInWords(q.Totals.GrandTotal), "", "L", false)
	totRows := []struct {
		label string
		val   float64
		bold  bool
	}{
		{"Quote Value (excl. VAT)", q.Totals.Subtotal, false},
		{"VAT", q.Totals.TaxTotal, false},
		{"Total Value (incl. VAT)", q.Totals.GrandTotal, true},
	}
	rowH := totalsH / 3
	ty := y
	for _, r := range totRows {
		if r.bold {
			pdf.SetFillColor(239, 246, 255)
			pdf.Rect(rx, ty, rw, rowH, "F")
		}
		pdf.SetXY(rx+4, ty+rowH/2-2)
		if r.bold {
			pdf.SetFont("Helvetica", "B", 9)
			navy()
		} else {
			pdf.SetFont("Helvetica", "", 8.5)
			muted()
		}
		pdf.CellFormat(rw*0.55, 4, r.label, "", 0, "L", false, 0, "")
		if r.bold {
			pdf.SetFont("Helvetica", "B", 9.5)
			navy()
		} else {
			pdf.SetFont("Helvetica", "", 8.5)
			dark()
		}
		pdf.SetXY(rx+4, ty+rowH/2-2)
		pdf.CellFormat(rw-8, 4, cur+" "+fmtMoney(r.val), "", 0, "R", false, 0, "")
		ty += rowH
		hline(ty, false)
	}
	borderPen()
	pdf.Line(rx, y, rx, y+totalsH)
	y += totalsH

	// Terms & Conditions
	terms := []string{}
	for _, t := range q.TermsAndConditions {
		if strings.TrimSpace(t) != "" {
			terms = append(terms, t)
		}
	}
	if len(terms) > 0 {
		hline(y, true)
		pdf.SetXY(x0+5, y+3)
		pdf.SetFont("Helvetica", "B", 9)
		navy()
		pdf.CellFormat(W, 4, "TERMS & CONDITIONS", "", 1, "L", false, 0, "")
		tyy := pdf.GetY() + 1
		pdf.SetFont("Helvetica", "", 8.5)
		body()
		for i, t := range terms {
			pdf.SetXY(x0+5, tyy)
			pdf.CellFormat(6, 4.4, fmt.Sprintf("%d", i+1), "", 0, "L", false, 0, "")
			pdf.SetXY(x0+11, tyy)
			pdf.MultiCell(W-16, 4.4, t, "", "L", false)
			tyy = pdf.GetY() + 1
		}
		y = tyy + 2
	}

	// Notes
	noteLines := []string{}
	for _, n := range splitLines(q.Notes.Customer) {
		if strings.TrimSpace(n) != "" {
			noteLines = append(noteLines, strings.TrimSpace(n))
		}
	}
	if len(noteLines) > 0 {
		hline(y, false)
		pdf.SetXY(x0+5, y+2.5)
		pdf.SetFont("Helvetica", "B", 8)
		muted()
		pdf.CellFormat(W, 4, "NOTES", "", 1, "L", false, 0, "")
		ny := pdf.GetY() + 1
		pdf.SetFont("Helvetica", "", 8.5)
		body()
		for _, n := range noteLines {
			pdf.SetXY(x0+5, ny)
			pdf.CellFormat(4, 4.4, "-", "", 0, "L", false, 0, "")
			pdf.SetXY(x0+9, ny)
			pdf.MultiCell(W-14, 4.4, n, "", "L", false)
			ny = pdf.GetY() + 0.5
		}
		y = ny + 2
	}

	// Signature block
	hline(y, true)
	sigY := y
	sigH := 38.0
	pdf.SetXY(x0+5, sigY+4)
	pdf.SetFont("Helvetica", "B", 8.5)
	navy()
	pdf.CellFormat(85, 4, "CUSTOMER ACCEPTANCE (NAME, SIGNATURE & STAMP)", "", 0, "L", false, 0, "")
	pdf.SetDrawColor(148, 163, 184)
	pdf.SetLineWidth(0.2)
	pdf.Line(x0+5, sigY+26, x0+5+70, sigY+26)
	pdf.SetXY(mid+5, sigY+4)
	pdf.SetFont("Helvetica", "B", 8.5)
	navy()
	pdf.CellFormat(85, 4, "FOR "+strings.ToUpper(senderName), "", 0, "L", false, 0, "")
	if q.Signatory.Name != "" {
		pdf.SetXY(mid+5, sigY+18)
		pdf.SetFont("Helvetica", "B", 9)
		dark()
		pdf.CellFormat(85, 4.5, q.Signatory.Name, "", 1, "L", false, 0, "")
	}
	if q.Signatory.Title != "" {
		pdf.SetX(mid + 5)
		pdf.SetFont("Helvetica", "", 8.5)
		body()
		pdf.CellFormat(85, 4.5, q.Signatory.Title, "", 1, "L", false, 0, "")
	}
	borderPen()
	pdf.Line(mid, sigY, mid, sigY+sigH)
	y = sigY + sigH
	hline(y, true)

	// Company contact footer — skip when the letterhead already supplies a footer.
	if !hasLH && (company.Name != "" || company.Phone != "" || company.Email != "" || company.TRN != "") {
		pdf.SetFillColor(248, 250, 252)
		footH := 13.0
		pdf.Rect(x0, y, W, footH, "F")
		pdf.SetXY(x0, y+2)
		pdf.SetFont("Helvetica", "B", 9)
		navy()
		pdf.CellFormat(W, 4, company.Name, "", 1, "C", false, 0, "")
		parts := []string{}
		if company.Phone != "" {
			parts = append(parts, "Tel: "+company.Phone)
		}
		if company.Email != "" {
			parts = append(parts, "Email: "+company.Email)
		}
		if company.Website != "" {
			parts = append(parts, company.Website)
		}
		if company.TRN != "" {
			parts = append(parts, "TRN: "+company.TRN)
		}
		pdf.SetX(x0)
		pdf.SetFont("Helvetica", "", 8)
		muted()
		pdf.CellFormat(W, 4, strings.Join(parts, "   |   "), "", 1, "C", false, 0, "")
		y += footH
		hline(y, false)
	}

	return pdf
}

func DownloadQuotePDF() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgID, _ := c.Get("orgId")
		objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid quote ID"})
			return
		}

		var q models.Quote
		if err := quoteCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&q); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Quote not found"})
			return
		}

		pdf := buildQuotePDF(q)

		filename := "quote-" + q.QuoteNumber + ".pdf"
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
		if err := pdf.Output(c.Writer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
		}
	}
}

// splitLines splits a multi-line string into individual lines
func splitLines(s string) []string {
	var lines []string
	cur := ""
	for _, ch := range s {
		if ch == '\n' {
			lines = append(lines, cur)
			cur = ""
		} else {
			cur += string(ch)
		}
	}
	if cur != "" {
		lines = append(lines, cur)
	}
	return lines
}
