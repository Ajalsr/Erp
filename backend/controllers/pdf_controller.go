package controllers

import (
	"context"
	"fmt"
	"net/http"
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
		pdf.SetMargins(15, 14, 15)
		pdf.AddPage()
		pdf.SetAutoPageBreak(true, 20)

		pdfHeader(pdf, false)

		// Title
		docLabel := "INVOICE"
		if inv.Type == "proforma" {
			docLabel = "PROFORMA INVOICE"
		}
		pdf.SetFont("Helvetica", "B", 20)
		pdf.SetTextColor(15, 23, 42)
		pdf.SetXY(15, 16)
		pdf.CellFormat(100, 10, docLabel, "", 0, "L", false, 0, "")

		// Invoice meta (right side)
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(71, 85, 105)
		pdf.SetXY(120, 16)
		pdf.CellFormat(75, 5, "Invoice #: "+inv.InvoiceNumber, "", 1, "R", false, 0, "")
		pdf.SetX(120)
		pdf.CellFormat(75, 5, "Issue Date: "+inv.IssueDate, "", 1, "R", false, 0, "")
		pdf.SetX(120)
		pdf.CellFormat(75, 5, "Due Date: "+inv.DueDate, "", 1, "R", false, 0, "")
		if inv.PaymentTerms != "" {
			pdf.SetX(120)
			pdf.CellFormat(75, 5, "Terms: "+inv.PaymentTerms, "", 1, "R", false, 0, "")
		}

		pdf.SetY(32)
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

		// Footer
		pdf.SetY(-18)
		pdf.SetFont("Helvetica", "I", 8)
		pdf.SetTextColor(148, 163, 184)
		pdf.CellFormat(0, 5, fmt.Sprintf("Generated by Nexus ERP · %s · Thank you for your business", time.Now().Format("02 Jan 2006")), "", 0, "C", false, 0, "")

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

		pdf := gofpdf.New("P", "mm", "A4", "")
		pdf.SetMargins(15, 14, 15)
		pdf.AddPage()
		pdf.SetAutoPageBreak(true, 22)

		// ── Company header ───────────────────────────────────────────────────
		// Top accent bar
		pdf.SetFillColor(30, 64, 175) // blue-800
		pdf.Rect(0, 0, 210, 6, "F")

		// Company name block (top right)
		companyName := q.Company.Name
		if companyName == "" {
			companyName = "Your Company"
		}
		pdf.SetFont("Helvetica", "B", 12)
		pdf.SetTextColor(15, 23, 42)
		pdf.SetXY(105, 10)
		pdf.CellFormat(90, 6, companyName, "", 1, "R", false, 0, "")

		if q.Company.Address != "" {
			pdf.SetFont("Helvetica", "", 9)
			pdf.SetTextColor(71, 85, 105)
			pdf.SetX(105)
			pdf.MultiCell(90, 4, q.Company.Address, "", "R", false)
		}
		if q.Company.TRN != "" {
			pdf.SetFont("Helvetica", "", 8)
			pdf.SetTextColor(100, 116, 139)
			pdf.SetX(105)
			pdf.CellFormat(90, 4, "TRN: "+q.Company.TRN, "", 1, "R", false, 0, "")
		}

		headerBottomY := pdf.GetY()
		if headerBottomY < 30 {
			headerBottomY = 30
		}

		// Separator
		pdf.SetDrawColor(226, 232, 240)
		pdf.Line(15, headerBottomY+3, 195, headerBottomY+3)

		// ── QUOTATION title ──────────────────────────────────────────────────
		titleY := headerBottomY + 7
		pdf.SetFont("Helvetica", "B", 18)
		pdf.SetTextColor(15, 23, 42)
		pdf.SetXY(15, titleY)
		pdf.CellFormat(180, 9, "QUOTATION", "", 1, "C", false, 0, "")
		// Underline
		underlineY := pdf.GetY() + 1
		pdf.SetDrawColor(30, 64, 175)
		pdf.Line(55, underlineY, 155, underlineY)

		pdf.SetDrawColor(226, 232, 240)
		pdf.Line(15, underlineY+4, 195, underlineY+4)

		// ── Ref / Date block ─────────────────────────────────────────────────
		refY := underlineY + 8
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(71, 85, 105)

		writeKV := func(label, value string, y float64) float64 {
			pdf.SetXY(15, y)
			pdf.SetFont("Helvetica", "B", 9)
			pdf.SetTextColor(100, 116, 139)
			pdf.CellFormat(20, 5, label, "", 0, "L", false, 0, "")
			pdf.SetFont("Helvetica", "", 9)
			pdf.SetTextColor(15, 23, 42)
			pdf.CellFormat(80, 5, value, "", 1, "L", false, 0, "")
			return pdf.GetY()
		}

		curY := writeKV("Ref:", q.QuoteNumber, refY)
		curY = writeKV("Date:", q.QuoteDate, curY)
		curY += 3

		// ── Customer block ───────────────────────────────────────────────────
		customerDisplayName := q.BillTo.Name
		if customerDisplayName == "" {
			customerDisplayName = q.CustomerName
		}
		pdf.SetXY(15, curY)
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(71, 85, 105)
		pdf.CellFormat(12, 5, "M/s.", "", 0, "L", false, 0, "")
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetTextColor(15, 23, 42)
		pdf.CellFormat(100, 5, customerDisplayName, "", 1, "L", false, 0, "")
		curY = pdf.GetY()

		if q.BillTo.Address != "" {
			pdf.SetXY(27, curY)
			pdf.SetFont("Helvetica", "", 9)
			pdf.SetTextColor(71, 85, 105)
			pdf.MultiCell(120, 5, q.BillTo.Address, "", "L", false)
			curY = pdf.GetY()
		}
		if q.BillTo.TRN != "" {
			curY = writeKV("TRN:", q.BillTo.TRN, curY)
		}
		curY += 2

		if q.AttentionTo != "" {
			curY = writeKV("Attn:", q.AttentionTo, curY)
		}
		curY += 2

		if q.Subject != "" {
			curY = writeKV("Sub:", q.Subject, curY)
		}
		if q.ProjectName != "" {
			curY = writeKV("Project:", q.ProjectName, curY)
		}
		curY += 4

		// ── Intro text ───────────────────────────────────────────────────────
		introText := q.IntroText
		if introText == "" {
			introText = "Please find attached our offer for supply of the above subject. Our offer is as under:"
		}
		pdf.SetXY(15, curY)
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(71, 85, 105)
		pdf.MultiCell(180, 5, introText, "", "L", false)
		curY = pdf.GetY() + 2

		pdf.SetXY(15, curY)
		pdf.SetFont("Helvetica", "I", 9)
		pdf.SetTextColor(71, 85, 105)
		pdf.CellFormat(180, 5, "Our offer for supply of the same is, as under:", "", 1, "L", false, 0, "")
		curY = pdf.GetY() + 2

		// ── Line items table ─────────────────────────────────────────────────
		// Columns: Sl.No(10) | Part No(28) | Description(66) | Qty(14) | Unit(16) | Unit Price(24) | Total(22) = 180
		type col struct {
			label string
			w     float64
			align string
		}
		cols := []col{
			{"Sl.No", 10, "C"},
			{"Part Number", 28, "L"},
			{"Description", 66, "L"},
			{"Qty", 14, "C"},
			{"Unit", 16, "C"},
			{"Unit Price " + q.Currency, 24, "R"},
			{"Total " + q.Currency, 22, "R"},
		}

		pdf.SetY(curY)
		pdf.SetFillColor(240, 242, 245)
		pdf.SetFont("Helvetica", "B", 8)
		pdf.SetTextColor(100, 116, 139)
		for _, h := range cols {
			pdf.CellFormat(h.w, 8, h.label, "B", 0, h.align, true, 0, "")
		}
		pdf.Ln(-1)

		pdf.SetFont("Helvetica", "", 9)
		for i, item := range q.LineItems {
			if i%2 == 0 {
				pdf.SetFillColor(255, 255, 255)
			} else {
				pdf.SetFillColor(249, 250, 251)
			}
			pdf.SetTextColor(15, 23, 42)

			x, y := pdf.GetXY()
			// Description cell — multi-line
			pdf.MultiCell(cols[2].w, 5.5, item.Desc, "", "L", true)
			descH := pdf.GetY() - y
			if descH < 5.5 {
				descH = 5.5
			}

			pdf.SetXY(x, y)
			pdf.CellFormat(cols[0].w, descH, fmt.Sprintf("%d", i+1), "", 0, "C", true, 0, "")
			pdf.CellFormat(cols[1].w, descH, item.PartNumber, "", 0, "L", true, 0, "")
			pdf.SetX(x + cols[0].w + cols[1].w + cols[2].w)
			pdf.CellFormat(cols[3].w, descH, fmt.Sprintf("%.2f", item.Qty), "", 0, "C", true, 0, "")
			pdf.CellFormat(cols[4].w, descH, item.Unit, "", 0, "C", true, 0, "")
			pdf.CellFormat(cols[5].w, descH, fmtMoney(item.UnitPrice), "", 0, "R", true, 0, "")
			pdf.CellFormat(cols[6].w, descH, fmtMoney(item.Total), "", 1, "R", true, 0, "")
		}

		// ── Totals ───────────────────────────────────────────────────────────
		pdf.Ln(2)
		labelW := 158.0
		valW := 22.0

		totRows := []struct{ label, val string }{
			{"Sub Total " + q.Currency, fmtMoney(q.Totals.Subtotal)},
		}
		if q.Totals.DiscountTotal > 0 {
			totRows = append(totRows, struct{ label, val string }{"Discount", "- " + fmtMoney(q.Totals.DiscountTotal)})
		}
		taxPct := 0.0
		if q.Totals.Subtotal > 0 {
			taxPct = q.Totals.TaxTotal / q.Totals.Subtotal * 100
		}
		taxLabel := fmt.Sprintf("VAT %.0f%%", taxPct)
		totRows = append(totRows, struct{ label, val string }{taxLabel, fmtMoney(q.Totals.TaxTotal)})

		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(71, 85, 105)
		for _, r := range totRows {
			pdf.CellFormat(labelW, 6, r.label, "", 0, "R", false, 0, "")
			pdf.SetTextColor(15, 23, 42)
			pdf.CellFormat(valW, 6, r.val, "", 1, "R", false, 0, "")
			pdf.SetTextColor(71, 85, 105)
		}

		// Grand total row
		pdf.SetFillColor(30, 64, 175)
		pdf.SetFont("Helvetica", "B", 10)
		pdf.SetTextColor(255, 255, 255)
		pdf.CellFormat(labelW, 9, "Grand Total "+q.Currency, "T", 0, "R", true, 0, "")
		pdf.CellFormat(valW, 9, fmtMoney(q.Totals.GrandTotal), "T", 1, "R", true, 0, "")

		// ── Notes (bullet points) ────────────────────────────────────────────
		if q.Notes.Customer != "" {
			pdf.Ln(5)
			pdf.SetFont("Helvetica", "BU", 9)
			pdf.SetTextColor(15, 23, 42)
			pdf.CellFormat(0, 5, "Note:", "", 1, "L", false, 0, "")
			for _, line := range splitLines(q.Notes.Customer) {
				if line == "" {
					continue
				}
				pdf.SetFont("Helvetica", "", 9)
				pdf.SetTextColor(71, 85, 105)
				x := pdf.GetX()
				pdf.SetX(x + 3)
				pdf.MultiCell(177, 5, "➤ "+line, "", "L", false)
			}
		}

		// ── Terms & Conditions ───────────────────────────────────────────────
		if len(q.TermsAndConditions) > 0 {
			pdf.Ln(4)
			pdf.SetFont("Helvetica", "BU", 9)
			pdf.SetTextColor(15, 23, 42)
			pdf.CellFormat(0, 5, "Terms and conditions of our offer", "", 1, "L", false, 0, "")
			pdf.SetFont("Helvetica", "", 9)
			pdf.SetTextColor(71, 85, 105)
			for i, t := range q.TermsAndConditions {
				pdf.SetX(15)
				numLabel := fmt.Sprintf("%d", i+1)
				pdf.CellFormat(6, 5, numLabel, "", 0, "L", false, 0, "")
				pdf.MultiCell(174, 5, t, "", "L", false)
			}
		}

		// ── Closing + Signature ──────────────────────────────────────────────
		pdf.Ln(5)
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(71, 85, 105)
		pdf.MultiCell(0, 5, "Hope the above meets your requirement. We eagerly look forward to serving you at the earliest.\n\nThanking you and assuring you of our best services, always.", "", "L", false)

		pdf.Ln(4)
		pdf.SetFont("Helvetica", "I", 9)
		pdf.CellFormat(0, 5, "Yours Truly", "", 1, "L", false, 0, "")
		if q.Company.Name != "" {
			pdf.SetFont("Helvetica", "I", 9)
			pdf.CellFormat(0, 5, "For "+q.Company.Name, "", 1, "L", false, 0, "")
		}

		pdf.Ln(10)
		if q.Signatory.Name != "" {
			pdf.SetFont("Helvetica", "B", 10)
			pdf.SetTextColor(15, 23, 42)
			pdf.CellFormat(0, 5, q.Signatory.Name, "", 1, "L", false, 0, "")
		}
		if q.Signatory.Title != "" {
			pdf.SetFont("Helvetica", "", 9)
			pdf.SetTextColor(71, 85, 105)
			pdf.CellFormat(0, 5, q.Signatory.Title, "", 1, "L", false, 0, "")
		}
		if q.Company.Phone != "" {
			pdf.CellFormat(0, 5, "Tel: "+q.Company.Phone, "", 1, "L", false, 0, "")
		}
		if q.Company.Email != "" {
			pdf.CellFormat(0, 5, "Email: "+q.Company.Email, "", 1, "L", false, 0, "")
		}

		// ── Footer bar ───────────────────────────────────────────────────────
		pdf.SetY(-14)
		pdf.SetFillColor(30, 64, 175)
		pdf.Rect(0, pdf.GetY(), 210, 14, "F")
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(255, 255, 255)
		footerParts := []string{}
		if q.Company.Phone != "" {
			footerParts = append(footerParts, "Mob: "+q.Company.Phone)
		}
		if q.Company.Email != "" {
			footerParts = append(footerParts, "E-mail: "+q.Company.Email)
		}
		if q.Company.Website != "" {
			footerParts = append(footerParts, "Website: "+q.Company.Website)
		}
		footerText := ""
		for i, p := range footerParts {
			if i > 0 {
				footerText += "   |   "
			}
			footerText += p
		}
		if footerText == "" {
			footerText = fmt.Sprintf("Generated by Nexus ERP · %s", time.Now().Format("02 Jan 2006"))
		}
		pdf.SetXY(15, pdf.GetY()+4)
		pdf.CellFormat(180, 6, footerText, "", 0, "C", false, 0, "")

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
