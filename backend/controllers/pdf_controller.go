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
	"sync"
	"time"

	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ── helpers ──────────────────────────────────────────────────────────────────

func fmtMoney(n float64) string { return fmt.Sprintf("%.2f", n) }

// watermarkFor maps a document status to the watermark text to stamp across the
// page ("" = no watermark). Normalizes spaces/underscores/case so "pending approval",
// "pending_approval", "Pending_Approval" all match.
func watermarkFor(status string) string {
	switch strings.ToLower(strings.ReplaceAll(status, " ", "_")) {
	case "draft":
		return "DRAFT"
	case "pending_approval", "under_approval", "pending":
		return "NOT APPROVED"
	case "rejected":
		return "REJECTED"
	case "cancelled", "canceled":
		return "CANCELLED"
	case "void", "voided":
		return "VOIDED"
	}
	return "" // approved / issued / paid / received / etc → no watermark
}

// pdfWatermark stamps diagonal translucent text across every page. Call AFTER the
// builder returns so it overlays the finished content. No-op when text is empty.
func pdfWatermark(pdf *gofpdf.Fpdf, text string) {
	if text == "" {
		return
	}
	pages := pdf.PageCount()
	for n := 1; n <= pages; n++ {
		pdf.SetPage(n)
		pdf.SetFont("Helvetica", "B", 90)
		pdf.SetTextColor(255, 80, 80)
		pdf.SetAlpha(0.12, "Normal")
		pdf.TransformBegin()
		pdf.TransformRotate(45, 105, 150) // rotate about A4 centre (mm)
		pdf.Text(20, 158, text)
		pdf.TransformEnd()
		pdf.SetAlpha(1, "Normal")
	}
	// Restore defaults for any later drawing.
	pdf.SetTextColor(15, 23, 42)
}


// ── Invoice PDF ───────────────────────────────────────────────────────────────

// GET /api/invoices/:id/pdf
// invoiceExtras carries the related-info enriched from the customer + linked
// sales order (the same fields the on-screen preview fetches separately).
type invoiceExtras struct {
	custCode    string
	custPhone   string
	soRef       string
	lpoNumber   string
	lpoDate     string
	salesperson string
	orgName     string
}

// buildInvoicePDF renders an invoice. Same letterhead-per-page machinery as the
// quote (header top, footer bottom, content flows inside, overflow → next page),
// mirroring the on-screen invoice layout so preview matches print.
func buildInvoicePDF(inv models.Invoice, ex invoiceExtras) *gofpdf.Fpdf {
	pdf := gofpdf.New("P", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")

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

	cur := inv.Currency
	if cur == "" {
		cur = "AED"
	}
	senderName := ex.orgName
	if senderName == "" {
		senderName = inv.From.Name
	}
	if senderName == "" {
		senderName = "Company"
	}
	invRef := inv.InvoiceNumber
	invDate := fmtDateDMY(inv.IssueDate)
	docLabel := "TAX INVOICE"
	if inv.Type == "proforma" {
		docLabel = "PROFORMA INVOICE"
	}

	lh, hasLH := loadOrgLetterhead(inv.OrgID)
	baseTop := 14.0
	botMargin := 16.0
	if hasLH {
		baseTop = lh.topPadMM
		botMargin = lh.botPadMM
	}
	const contBandH = 9.0

	var opt gofpdf.ImageOptions
	if hasLH {
		opt = gofpdf.ImageOptions{ImageType: lh.imgType}
		pdf.RegisterImageOptionsReader("letterhead", opt, bytes.NewReader(lh.data))
	}

	pdf.SetHeaderFunc(func() {
		if hasLH {
			pdf.ImageOptions("letterhead", 0, 0, 210, 297, false, opt, 0, "")
		}
		if pdf.PageNo() > 1 {
			pdf.SetXY(x0, baseTop)
			pdf.SetFont("Helvetica", "B", 9)
			navy()
			pdf.CellFormat(W/2, 5, tr("Invoice: "+invRef), "", 0, "L", false, 0, "")
			pdf.CellFormat(W/2, 5, "Date: "+invDate, "", 1, "R", false, 0, "")
			hline(baseTop+6, false)
		}
	})

	pdf.AliasNbPages("{nb}")
	pdf.SetFooterFunc(func() {
		pdf.SetY(297 - botMargin - 6)
		pdf.SetFont("Helvetica", "", 8)
		muted()
		pdf.CellFormat(W, 4, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "C", false, 0, "")
	})

	contTop := baseTop + contBandH
	bottomLimit := 297 - botMargin - 10
	pdf.SetMargins(15, contTop, 15)
	pdf.SetAutoPageBreak(true, botMargin+10)
	pdf.AddPage()

	breakIfNeeded := func(yp *float64, need float64) {
		if *yp+need > bottomLimit {
			pdf.AddPage()
			*yp = contTop
		}
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
		pdf.CellFormat(120, 8, tr(senderName), "", 1, "L", false, 0, "")
		if inv.From.Address != "" {
			pdf.SetX(x0)
			pdf.SetFont("Helvetica", "", 8)
			pdf.SetTextColor(220, 228, 238)
			pdf.CellFormat(180, 4, tr(inv.From.Address), "", 0, "L", false, 0, "")
		}
		y = 28
	}

	// Title
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "BU", 14)
	navy()
	pdf.CellFormat(W, 7, docLabel, "", 1, "C", false, 0, "")
	if inv.From.TRN != "" {
		pdf.SetX(x0)
		pdf.SetFont("Helvetica", "B", 9)
		navy()
		pdf.CellFormat(W, 5, "TRN : "+tr(inv.From.TRN), "", 1, "C", false, 0, "")
	}
	y = pdf.GetY() + 3

	// Invoice number / date strip
	stripH := 8.0
	hline(y, false)
	hline(y+stripH, false)
	borderPen()
	pdf.Line(mid, y, mid, y+stripH)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.SetXY(x0+5, y+2.2)
	pdf.CellFormat(45, 4, "INVOICE NUMBER", "", 0, "L", false, 0, "")
	dark()
	pdf.SetXY(mid-50, y+2.2)
	pdf.CellFormat(45, 4, tr(invRef), "", 0, "R", false, 0, "")
	navy()
	pdf.SetXY(mid+5, y+2.2)
	pdf.CellFormat(40, 4, "DATE INVOICE", "", 0, "L", false, 0, "")
	dark()
	pdf.SetXY(x1-50, y+2.2)
	pdf.CellFormat(45, 4, invDate, "", 0, "R", false, 0, "")
	y += stripH

	// Bill To / Related Info
	blockY := y
	ly := blockY + 3
	pdf.SetXY(x0+5, ly)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.CellFormat(80, 4, "BILL TO", "", 0, "L", false, 0, "")
	ly += 5.5
	if ex.custCode != "" {
		muted()
		pdf.SetFont("Helvetica", "", 8.5)
		pdf.SetXY(x0+5, ly)
		pdf.CellFormat(85, 4.2, tr("Customer Code: "+ex.custCode), "", 0, "L", false, 0, "")
		ly += 5
	}
	toName := inv.BillTo.Name
	if toName == "" {
		toName = "-"
	}
	dark()
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetXY(x0+5, ly)
	pdf.CellFormat(85, 4.5, tr(toName), "", 0, "L", false, 0, "")
	ly += 5
	body()
	pdf.SetFont("Helvetica", "", 8.5)
	if inv.BillTo.Address != "" {
		pdf.SetXY(x0+5, ly)
		pdf.MultiCell(85, 4.2, tr(inv.BillTo.Address), "", "L", false)
		ly = pdf.GetY() + 1
	}
	if ex.custPhone != "" {
		pdf.SetXY(x0+5, ly)
		pdf.CellFormat(85, 4.2, tr("Tel: "+ex.custPhone), "", 0, "L", false, 0, "")
		ly += 5
	}
	if inv.BillTo.TRN != "" {
		pdf.SetXY(x0+5, ly)
		pdf.CellFormat(85, 4.2, "TRN: "+tr(inv.BillTo.TRN), "", 0, "L", false, 0, "")
		ly += 5
	}

	pdf.SetXY(mid+5, blockY+3)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.CellFormat(80, 4, "RELATED INFO", "", 0, "L", false, 0, "")
	details := [][2]string{
		{"Currency", cur},
		{"Sale Order Ref", orDash(ex.soRef)},
		{"Cust PO No", orDash(ex.lpoNumber)},
		{"Cust PO Date", orDash(ex.lpoDate)},
		{"Payment Terms", orDash(inv.PaymentTerms)},
		{"Sales Division", orDash(ex.orgName)},
		{"Salesperson", orDash(ex.salesperson)},
		{"Delivery Ref", orDash(inv.LinkedDNNumber)},
	}
	ry := blockY + 8.5
	pdf.SetFont("Helvetica", "", 8.5)
	for _, d := range details {
		muted()
		pdf.SetXY(mid+5, ry)
		pdf.CellFormat(32, 4.4, d[0], "", 0, "L", false, 0, "")
		dark()
		pdf.SetXY(mid+37, ry)
		pdf.CellFormat(48, 4.4, ": "+tr(d[1]), "", 0, "L", false, 0, "")
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

	// Split goods vs charge lines (charges show only in the totals box).
	isCharge := func(li models.InvoiceLineItem) bool {
		if li.LineItemType == "expense" {
			return true
		}
		d := strings.ToLower(strings.TrimSpace(li.Desc))
		for _, p := range []string{"shipping", "adjustment", "freight", "delivery", "handling"} {
			if strings.HasPrefix(d, p) {
				return true
			}
		}
		return false
	}
	var goods, charges []models.InvoiceLineItem
	prodNet := 0.0
	for _, li := range inv.LineItems {
		if isCharge(li) {
			charges = append(charges, li)
		} else {
			goods = append(goods, li)
			net := li.Subtotal
			if net == 0 {
				net = li.Qty*li.UnitPrice - li.DiscAmt
			}
			prodNet += net
		}
	}

	// Items table
	cols := []struct {
		label string
		w     float64
		align string
	}{
		{"Sl.No", 9, "C"}, {"Material Description", 53, "L"}, {"Qty", 11, "C"},
		{"Unit Price", 19, "R"}, {"Gross Price", 20, "R"}, {"Discount", 16, "R"},
		{"VAT %", 12, "C"}, {"Net Value", 18, "R"}, {"Total Value", 22, "R"},
	}
	descX := x0 + cols[0].w
	afterDescX := descX + cols[1].w

	drawItemsHeader := func() {
		pdf.SetXY(x0, y)
		pdf.SetFillColor(241, 245, 249)
		pdf.SetFont("Helvetica", "B", 7.5)
		navy()
		for _, c := range cols {
			pdf.CellFormat(c.w, 8, c.label, "", 0, c.align, true, 0, "")
		}
		pdf.Ln(-1)
		hline(pdf.GetY(), true)
		y = pdf.GetY()
	}
	drawItemsHeader()

	drawRow := func(item *models.InvoiceLineItem, idx int) {
		desc := ""
		if item != nil {
			desc = item.Desc
		}
		desc = tr(desc)
		pdf.SetFont("Helvetica", "", 8.5)
		nLines := len(pdf.SplitText(desc, cols[1].w))
		if nLines < 1 {
			nLines = 1
		}
		rowH := float64(nLines) * 5
		if rowH < 7 {
			rowH = 7
		}
		if y+rowH > bottomLimit {
			pdf.AddPage()
			y = contTop
			drawItemsHeader()
		}
		yy := y
		descTop := yy + (rowH-float64(nLines)*5)/2
		if descTop < yy {
			descTop = yy
		}
		pdf.SetXY(descX, descTop)
		dark()
		pdf.MultiCell(cols[1].w, 5, desc, "", "L", false)
		if item != nil {
			gross := item.Qty * item.UnitPrice
			net := item.Subtotal
			if net == 0 {
				net = gross - item.DiscAmt
			}
			pdf.SetXY(x0, yy)
			muted()
			pdf.CellFormat(cols[0].w, rowH, fmt.Sprintf("%d", idx+1), "", 0, "C", false, 0, "")
			pdf.SetX(afterDescX)
			dark()
			pdf.CellFormat(cols[2].w, rowH, fmt.Sprintf("%g", item.Qty), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[3].w, rowH, fmtMoney(item.UnitPrice), "", 0, "R", false, 0, "")
			pdf.CellFormat(cols[4].w, rowH, fmtMoney(gross), "", 0, "R", false, 0, "")
			if item.DiscAmt > 0 {
				dark()
			} else {
				muted()
			}
			pdf.CellFormat(cols[5].w, rowH, fmtMoney(item.DiscAmt), "", 0, "R", false, 0, "")
			dark()
			pdf.CellFormat(cols[6].w, rowH, fmt.Sprintf("%g%%", item.TaxRate), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[7].w, rowH, fmtMoney(net), "", 0, "R", false, 0, "")
			pdf.SetFont("Helvetica", "B", 8.5)
			pdf.CellFormat(cols[8].w, rowH, fmtMoney(item.Total), "", 0, "R", false, 0, "")
		}
		by := yy + rowH
		hline(by, false)
		y = by
		pdf.SetXY(x0, by)
	}
	for i := range goods {
		drawRow(&goods[i], i)
	}
	for i := len(goods); i < 3; i++ {
		drawRow(nil, i)
	}

	// Totals box
	breakIfNeeded(&y, 30)
	hline(y, true)
	rx := 125.0
	rw := x1 - rx
	pdf.SetXY(x0+5, y+3)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.CellFormat(100, 4, "TOTAL IN WORDS", "", 0, "L", false, 0, "")
	pdf.SetXY(x0+5, y+8)
	pdf.SetFont("Helvetica", "B", 9)
	dark()
	pdf.MultiCell(rx-x0-8, 4.6, cur+" "+amountInWords(inv.Totals.GrandTotal), "", "L", false)

	grand := inv.Totals.GrandTotal
	advance := inv.AmountPaid
	balance := inv.BalanceDue
	if balance == 0 {
		balance = grand - advance
	}
	type totRow struct {
		label string
		val   float64
		bold  bool
	}
	totRows := []totRow{{"Invoice Value (excl. VAT)", prodNet, false}}
	for _, c := range charges {
		lbl := c.Desc
		if strings.TrimSpace(lbl) == "" {
			lbl = "Charge"
		}
		totRows = append(totRows, totRow{lbl, c.Total, false})
	}
	totRows = append(totRows,
		totRow{"VAT", inv.Totals.TaxTotal, false},
		totRow{"Total Value (incl. VAT)", grand, true},
	)
	if advance > 0 {
		totRows = append(totRows,
			totRow{"Advance / Paid", advance, false},
			totRow{"Balance Payable", balance, false},
		)
	}
	rowH := 6.0
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
		pdf.CellFormat(rw*0.55, 4, tr(r.label), "", 0, "L", false, 0, "")
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
	totalsH := float64(len(totRows)) * rowH
	if wordsBottom := y + 14; wordsBottom > y+totalsH {
		totalsH = wordsBottom - y
	}
	borderPen()
	pdf.Line(rx, y, rx, y+totalsH)
	y += totalsH

	// Signature block
	sigH := 38.0
	breakIfNeeded(&y, sigH+2)
	hline(y, true)
	sigY := y
	pdf.SetXY(x0+5, sigY+4)
	pdf.SetFont("Helvetica", "B", 8.5)
	navy()
	pdf.CellFormat(85, 4, "RECEIVER NAME, SIGNATURE & STAMP", "", 0, "L", false, 0, "")
	pdf.SetDrawColor(148, 163, 184)
	pdf.SetLineWidth(0.2)
	pdf.Line(x0+5, sigY+26, x0+5+70, sigY+26)
	pdf.SetXY(mid+5, sigY+4)
	pdf.SetFont("Helvetica", "B", 8.5)
	navy()
	pdf.CellFormat(85, 4, "FOR "+tr(strings.ToUpper(senderName)), "", 0, "L", false, 0, "")
	pdf.SetXY(mid+5, sigY+12)
	pdf.SetFont("Helvetica", "", 8.5)
	body()
	pdf.CellFormat(85, 4.5, "Prepared By", "", 1, "L", false, 0, "")
	borderPen()
	pdf.Line(mid, sigY, mid, sigY+sigH)
	y = sigY + sigH
	hline(y, true)

	// Notes
	if strings.TrimSpace(inv.Notes.Customer) != "" {
		pdf.SetFont("Helvetica", "", 8.5)
		noteLines := pdf.SplitText(inv.Notes.Customer, W-26)
		need := float64(len(noteLines))*4.4 + 5
		breakIfNeeded(&y, need)
		muted()
		pdf.SetXY(x0+5, y+2.5)
		pdf.SetFont("Helvetica", "B", 8)
		pdf.CellFormat(20, 4.4, "NOTES", "", 1, "L", false, 0, "")
		y = pdf.GetY() + 0.5
		body()
		pdf.SetFont("Helvetica", "", 8.5)
		pdf.SetXY(x0+5, y)
		pdf.MultiCell(W-10, 4.4, tr(inv.Notes.Customer), "", "L", false)
		y = pdf.GetY() + 1
		hline(y, false)
	}

	return pdf
}

// renderInvoicePDF enriches related-info from the customer + first linked sales
// order (mirroring the on-screen preview — failures are non-fatal, the PDF just
// shows "-"), builds the PDF, and stamps the status watermark. Shared by the
// authenticated (by id+org) and public (by token) PDF routes so both always
// render identically.
func renderInvoicePDF(ctx context.Context, inv models.Invoice) *gofpdf.Fpdf {
	ex := invoiceExtras{orgName: loadOrgName(inv.OrgID)}
	if inv.CustomerID != "" {
		if cid, err := primitive.ObjectIDFromHex(inv.CustomerID); err == nil {
			var cust models.Customer
			if err := customersCollection.FindOne(ctx, bson.M{"_id": cid}).Decode(&cust); err == nil {
				ex.custCode = cust.CustomerCode
				ex.custPhone = cust.CustomerPhone
				if ex.custPhone == "" {
					ex.custPhone = cust.WorkPhone
				}
			}
		}
	}
	if len(inv.LinkedSalesOrderIDs) > 0 {
		if sid, err := primitive.ObjectIDFromHex(inv.LinkedSalesOrderIDs[0]); err == nil {
			var so models.SalesOrder
			if err := salesOrdersCollection.FindOne(ctx, bson.M{"_id": sid}).Decode(&so); err == nil {
				ex.soRef = so.OrderNumber
				ex.lpoNumber = so.LpoNumber
				ex.salesperson = so.Salesperson
				if so.LpoDate != nil {
					ex.lpoDate = so.LpoDate.Format("02/01/2006")
				}
			}
		}
	}

	pdf := buildInvoicePDF(inv, ex)
	pdfWatermark(pdf, watermarkFor(inv.Status))
	return pdf
}

// writeInvoicePDF renders an invoice PDF. inline=true → in-browser preview.
func writeInvoicePDF(c *gin.Context, inline bool) {
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

	pdf := renderInvoicePDF(ctx, inv)

	disposition := "attachment"
	if inline {
		disposition = "inline"
	}
	filename := "invoice-" + inv.InvoiceNumber + ".pdf"
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", disposition+`; filename="`+filename+`"`)
	if err := pdf.Output(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
	}
}

// DownloadInvoicePDF forces a download — gated by `export` (path has "/pdf").
func DownloadInvoicePDF() gin.HandlerFunc {
	return func(c *gin.Context) { writeInvoicePDF(c, false) }
}

// PreviewInvoicePDF serves the PDF inline — its /preview route needs only `view`.
func PreviewInvoicePDF() gin.HandlerFunc {
	return func(c *gin.Context) { writeInvoicePDF(c, true) }
}

// PublicInvoicePDF serves the same PDF (letterhead, watermark, everything) for
// the unauthenticated public share link — keyed by the invoice's random token,
// not id+org, so no login/permission is needed. Always inline (viewed in a
// browser tab from the emailed link, not force-downloaded).
func PublicInvoicePDF() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		token := c.Param("token")
		if token == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid token"})
			return
		}

		var inv models.Invoice
		if err := invoiceCollection.FindOne(ctx, bson.M{"publicToken": token}).Decode(&inv); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Invoice not found"})
			return
		}

		pdf := renderInvoicePDF(ctx, inv)
		filename := "invoice-" + inv.InvoiceNumber + ".pdf"
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", `inline; filename="`+filename+`"`)
		if err := pdf.Output(c.Writer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
		}
	}
}

// buildGRNPDF renders a goods-receipt note. Same letterhead-per-page machinery as
// the quote/DN, mirroring the on-screen GRN layout so preview matches print.
func buildGRNPDF(grn models.GRN) *gofpdf.Fpdf {
	pdf := gofpdf.New("P", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")

	const x0, x1, mid = 15.0, 195.0, 105.0
	const W = x1 - x0
	const cur = "AED"

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

	orgName := loadOrgName(grn.OrgID)
	grnRef := grn.GRNNumber
	receiptDate := "-"
	if !grn.ReceiptDate.IsZero() {
		receiptDate = grn.ReceiptDate.Format("02/01/2006")
	}

	lh, hasLH := loadOrgLetterhead(grn.OrgID)
	baseTop := 14.0
	botMargin := 16.0
	if hasLH {
		baseTop = lh.topPadMM
		botMargin = lh.botPadMM
	}
	const contBandH = 9.0

	var opt gofpdf.ImageOptions
	if hasLH {
		opt = gofpdf.ImageOptions{ImageType: lh.imgType}
		pdf.RegisterImageOptionsReader("letterhead", opt, bytes.NewReader(lh.data))
	}

	pdf.SetHeaderFunc(func() {
		if hasLH {
			pdf.ImageOptions("letterhead", 0, 0, 210, 297, false, opt, 0, "")
		}
		if pdf.PageNo() > 1 {
			pdf.SetXY(x0, baseTop)
			pdf.SetFont("Helvetica", "B", 9)
			navy()
			pdf.CellFormat(W/2, 5, tr("GRN: "+grnRef), "", 0, "L", false, 0, "")
			pdf.CellFormat(W/2, 5, "Date: "+receiptDate, "", 1, "R", false, 0, "")
			hline(baseTop+6, false)
		}
	})

	pdf.AliasNbPages("{nb}")
	pdf.SetFooterFunc(func() {
		pdf.SetY(297 - botMargin - 6)
		pdf.SetFont("Helvetica", "", 8)
		muted()
		pdf.CellFormat(W, 4, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "C", false, 0, "")
	})

	contTop := baseTop + contBandH
	bottomLimit := 297 - botMargin - 10
	pdf.SetMargins(15, contTop, 15)
	pdf.SetAutoPageBreak(true, botMargin+10)
	pdf.AddPage()

	breakIfNeeded := func(yp *float64, need float64) {
		if *yp+need > bottomLimit {
			pdf.AddPage()
			*yp = contTop
		}
	}

	var y float64
	if hasLH {
		y = lh.topPadMM
	} else {
		pdf.SetFillColor(30, 58, 95)
		pdf.Rect(0, 0, 210, 22, "F")
		pdf.SetXY(x0, 6)
		pdf.SetFont("Helvetica", "B", 15)
		pdf.SetTextColor(255, 255, 255)
		name := orgName
		if name == "" {
			name = "Company"
		}
		pdf.CellFormat(180, 8, tr(name), "", 1, "L", false, 0, "")
		y = 26
	}

	// Title
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "BU", 14)
	navy()
	pdf.CellFormat(W, 7, "GOODS RECEIPT NOTE", "", 1, "C", false, 0, "")
	y = pdf.GetY() + 2
	hline(y, true)
	y += 1

	// ── Info — two columns ──
	leftRows := [][2]string{
		{"Vendor", orDash(grn.VendorName)},
		{"PO No", orDash(grn.PONumber)},
	}
	if strings.TrimSpace(grn.WarehouseName) != "" {
		leftRows = append(leftRows, [2]string{"Warehouse", grn.WarehouseName})
	}
	if strings.TrimSpace(grn.DeliveryNoteNumber) != "" {
		leftRows = append(leftRows, [2]string{"Vendor DN No", grn.DeliveryNoteNumber})
	}
	status := grn.Status
	if status != "" {
		status = strings.ToUpper(status[:1]) + status[1:]
	}
	rightRows := [][2]string{
		{"GRN Number", grnRef},
		{"Receipt Date", receiptDate},
		{"Received By", orDash(grn.ReceivedBy)},
		{"Status", orDash(status)},
	}

	renderCol := func(startX, ry, labelW, valW float64, rows [][2]string) float64 {
		for _, r := range rows {
			muted()
			pdf.SetFont("Helvetica", "", 8.5)
			pdf.SetXY(startX, ry)
			pdf.CellFormat(labelW, 4.6, r[0], "", 0, "L", false, 0, "")
			dark()
			val := tr(": " + r[1])
			lines := pdf.SplitText(val, valW)
			if len(lines) < 1 {
				lines = []string{val}
			}
			pdf.SetXY(startX+labelW, ry)
			pdf.MultiCell(valW, 4.6, val, "", "L", false)
			ry += float64(len(lines)) * 4.6
		}
		return ry
	}

	blockTop := y + 3
	leftEnd := renderCol(x0+5, blockTop, 28, 55, leftRows)
	rightEnd := renderCol(mid+5, blockTop, 34, 49, rightRows)
	blockBottom := leftEnd
	if rightEnd > blockBottom {
		blockBottom = rightEnd
	}
	blockBottom += 2
	borderPen()
	pdf.Line(mid, y, mid, blockBottom)
	hline(blockBottom, false)
	y = blockBottom

	// ── Items table ──
	cols := []struct {
		label string
		w     float64
		align string
	}{
		{"Sl.No", 9, "C"}, {"Part Number", 26, "L"}, {"Description", 50, "L"},
		{"Ordered", 14, "C"}, {"Received", 15, "C"}, {"Unit", 12, "C"},
		{"Unit Cost", 18, "R"}, {"VAT", 16, "R"}, {"Line Total", 20, "R"},
	}
	descX := x0 + cols[0].w + cols[1].w
	afterDescX := descX + cols[2].w

	drawItemsHeader := func() {
		pdf.SetXY(x0, y)
		pdf.SetFillColor(241, 245, 249)
		pdf.SetFont("Helvetica", "B", 7.5)
		navy()
		for _, c := range cols {
			pdf.CellFormat(c.w, 8, c.label, "", 0, c.align, true, 0, "")
		}
		pdf.Ln(-1)
		hline(pdf.GetY(), true)
		y = pdf.GetY()
	}
	drawItemsHeader()

	drawRow := func(item *models.GRNItem, idx int) {
		desc, partNo, unit := "", "-", ""
		if item != nil {
			desc = item.Details
			if strings.TrimSpace(item.ItemCode) != "" {
				partNo = item.ItemCode
			}
			unit = item.Unit
			if unit == "" {
				unit = "Pcs"
			}
		}
		desc = tr(desc)
		pdf.SetFont("Helvetica", "", 8.5)
		nLines := len(pdf.SplitText(desc, cols[2].w))
		if nLines < 1 {
			nLines = 1
		}
		rowH := float64(nLines) * 5
		if rowH < 7 {
			rowH = 7
		}
		if y+rowH > bottomLimit {
			pdf.AddPage()
			y = contTop
			drawItemsHeader()
		}
		yy := y
		descTop := yy + (rowH-float64(nLines)*5)/2
		if descTop < yy {
			descTop = yy
		}
		pdf.SetXY(descX, descTop)
		dark()
		pdf.MultiCell(cols[2].w, 5, desc, "", "L", false)
		if item != nil {
			pdf.SetXY(x0, yy)
			muted()
			pdf.CellFormat(cols[0].w, rowH, fmt.Sprintf("%d", idx+1), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[1].w, rowH, tr(partNo), "", 0, "L", false, 0, "")
			pdf.SetX(afterDescX)
			dark()
			pdf.CellFormat(cols[3].w, rowH, fmt.Sprintf("%g", item.OrderedQty), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[4].w, rowH, fmt.Sprintf("%g", item.ReceivedQty), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[5].w, rowH, tr(unit), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[6].w, rowH, fmtMoney(item.Rate), "", 0, "R", false, 0, "")
			pdf.CellFormat(cols[7].w, rowH, fmtMoney(item.TaxAmount), "", 0, "R", false, 0, "")
			pdf.SetFont("Helvetica", "B", 8.5)
			pdf.CellFormat(cols[8].w, rowH, fmtMoney(item.LineTotal), "", 0, "R", false, 0, "")
		}
		by := yy + rowH
		hline(by, false)
		y = by
		pdf.SetXY(x0, by)
	}
	for i := range grn.Items {
		drawRow(&grn.Items[i], i)
	}
	for i := len(grn.Items); i < 3; i++ {
		drawRow(nil, i)
	}

	// ── Totals ──
	type totRow struct {
		label string
		val   float64
		bold  bool
	}
	totRows := []totRow{
		{"Subtotal (excl. VAT)", grn.SubTotal, false},
		{"VAT", grn.TotalTax, false},
	}
	if grn.ShippingCharges != 0 {
		totRows = append(totRows, totRow{"Shipping Charges", grn.ShippingCharges, false})
	}
	for _, c := range grn.Charges {
		lbl := c.Label
		if strings.TrimSpace(lbl) == "" {
			lbl = "Other charge"
		}
		totRows = append(totRows, totRow{lbl, c.Total, false})
	}
	if grn.Adjustment != 0 {
		totRows = append(totRows, totRow{"Adjustment", grn.Adjustment, false})
	}
	totRows = append(totRows, totRow{"Grand Total (incl. VAT)", grn.Total, true})

	rowH := 6.0
	totalsH := float64(len(totRows)) * rowH
	breakIfNeeded(&y, totalsH+4)
	hline(y, true)
	rx := 125.0
	rw := x1 - rx
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
		pdf.CellFormat(rw*0.5, 4, tr(r.label), "", 0, "L", false, 0, "")
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

	// ── Notes ──
	if strings.TrimSpace(grn.Notes) != "" {
		pdf.SetFont("Helvetica", "", 8.5)
		noteLines := pdf.SplitText(grn.Notes, W-26)
		need := float64(len(noteLines))*4.4 + 5
		breakIfNeeded(&y, need)
		muted()
		pdf.SetXY(x0+5, y+2.5)
		pdf.SetFont("Helvetica", "B", 8)
		pdf.CellFormat(20, 4.4, "NOTES", "", 1, "L", false, 0, "")
		y = pdf.GetY() + 0.5
		body()
		pdf.SetFont("Helvetica", "", 8.5)
		pdf.SetXY(x0+5, y)
		pdf.MultiCell(W-10, 4.4, tr(grn.Notes), "", "L", false)
		y = pdf.GetY() + 1
	}

	// ── Signatures — Received / Inspected / Authorized ──
	sigH := 26.0
	breakIfNeeded(&y, sigH+2)
	hline(y, true)
	sigY := y + 14
	colW := W / 3
	for i, lab := range []string{"Received By", "Inspected By", "Authorized By"} {
		cx := x0 + float64(i)*colW
		pdf.SetDrawColor(148, 163, 184)
		pdf.SetLineWidth(0.2)
		pdf.Line(cx+6, sigY, cx+colW-6, sigY)
		muted()
		pdf.SetFont("Helvetica", "B", 8)
		pdf.SetXY(cx, sigY+1.5)
		pdf.CellFormat(colW, 4, lab, "", 0, "C", false, 0, "")
		pdf.SetFont("Helvetica", "", 7.5)
		pdf.SetXY(cx, sigY+5.5)
		pdf.CellFormat(colW, 4, "Signature & Date", "", 0, "C", false, 0, "")
	}
	y += sigH
	hline(y, true)

	return pdf
}

// writeGRNPDF renders a GRN PDF. inline=true → in-browser preview.
func writeGRNPDF(c *gin.Context, inline bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	orgID, _ := c.Get("orgId")
	objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid GRN ID"})
		return
	}

	var grn models.GRN
	if err := grnCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&grn); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "GRN not found"})
		return
	}

	pdf := buildGRNPDF(grn)
	pdfWatermark(pdf, watermarkFor(grn.Status))

	disposition := "attachment"
	if inline {
		disposition = "inline"
	}
	filename := "grn-" + grn.GRNNumber + ".pdf"
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", disposition+`; filename="`+filename+`"`)
	if err := pdf.Output(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
	}
}

// DownloadGRNPDF forces a download — gated by `export` (path has "/pdf").
func DownloadGRNPDF() gin.HandlerFunc {
	return func(c *gin.Context) { writeGRNPDF(c, false) }
}

// PreviewGRNPDF serves the PDF inline — its /preview route needs only `view`.
func PreviewGRNPDF() gin.HandlerFunc {
	return func(c *gin.Context) { writeGRNPDF(c, true) }
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

// Per-org letterhead cache — avoids re-downloading the Cloudinary image on every PDF.
// 10-min TTL means letterhead/padding edits reflect within 10 minutes.
type lhEntry struct {
	lh orgLetterhead
	ok bool
	at time.Time
}

var lhCache sync.Map // orgID -> lhEntry

const lhCacheTTL = 10 * time.Minute

// loadOrgLetterhead returns the org letterhead, served from cache when fresh.
// Only a SUCCESSFUL load is cached — a transient failure (e.g. a network blip
// fetching the image from Cloudinary) used to get cached as "no letterhead"
// for the full 10-minute TTL, making every PDF in that window silently lose
// its letterhead until the cache expired. Not caching failures means the next
// request just retries fresh instead of being stuck for 10 minutes.
func loadOrgLetterhead(orgID string) (orgLetterhead, bool) {
	if v, ok := lhCache.Load(orgID); ok {
		if e := v.(lhEntry); time.Since(e.at) < lhCacheTTL {
			return e.lh, e.ok
		}
	}
	lh, ok := loadOrgLetterheadUncached(orgID)
	if ok {
		lhCache.Store(orgID, lhEntry{lh: lh, ok: ok, at: time.Now()})
	}
	return lh, ok
}

// loadOrgLetterheadUncached fetches the org's letterhead image (URL or base64
// data-URL) and converts the percentage top/bottom pads into mm based on the
// rendered image height at full A4 width (210mm). ok=false when no letterhead.
func loadOrgLetterheadUncached(orgID string) (orgLetterhead, bool) {
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

// loadOrgStamp fetches the org's company seal/stamp image (base64 data-URL
// only — unlike the letterhead this is always uploaded inline, never hosted)
// for the closing signature block. ok=false when none is set.
func loadOrgStamp(orgID string) (data []byte, imgType string, ok bool) {
	objID, err := primitive.ObjectIDFromHex(orgID)
	if err != nil {
		return nil, "", false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var org models.Organization
	if err := orgCollection.FindOne(ctx, bson.M{"_id": objID}).Decode(&org); err != nil {
		return nil, "", false
	}
	src := strings.TrimSpace(org.StampImage)
	if src == "" {
		return nil, "", false
	}
	raw := src
	if i := strings.Index(raw, ","); i >= 0 {
		raw = raw[i+1:]
	}
	data, err = base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, "", false
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width == 0 {
		return nil, "", false
	}
	imgType = "PNG"
	if format == "jpeg" {
		imgType = "JPG"
	}
	return data, imgType, true
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
		return "-"
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t.Format("02/01/2006")
	}
	return s
}

func orDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "-"
	}
	return s
}

func buildQuotePDF(q models.Quote) *gofpdf.Fpdf {
	pdf := gofpdf.New("P", "mm", "A4", "")

	// Core PDF fonts are CP1252-encoded; raw UTF-8 (em-dash, curly quotes, accents)
	// renders as mojibake ("â€"") unless translated. tr maps Unicode → CP1252.
	tr := pdf.UnicodeTranslatorFromDescriptor("")

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
	quoteRef := q.QuoteNumber
	quoteDate := fmtDateDMY(q.QuoteDate)

	lh, hasLH := loadOrgLetterhead(q.OrgID)
	baseTop := 14.0
	botMargin := 16.0
	if hasLH {
		baseTop = lh.topPadMM
		botMargin = lh.botPadMM
	}
	const contBandH = 9.0 // space reserved on continuation pages for the repeated ref/date bar

	var opt gofpdf.ImageOptions
	if hasLH {
		opt = gofpdf.ImageOptions{ImageType: lh.imgType}
		pdf.RegisterImageOptionsReader("letterhead", opt, bytes.NewReader(lh.data))
	}

	// Header — letterhead on every page, plus a repeated "Quotation / Date" bar on
	// continuation pages (page 1 already carries the full strip lower down).
	pdf.SetHeaderFunc(func() {
		if hasLH {
			pdf.ImageOptions("letterhead", 0, 0, 210, 297, false, opt, 0, "")
		}
		if pdf.PageNo() > 1 {
			pdf.SetXY(x0, baseTop)
			pdf.SetFont("Helvetica", "B", 9)
			navy()
			pdf.CellFormat(W/2, 5, "Quotation: "+tr(quoteRef), "", 0, "L", false, 0, "")
			pdf.CellFormat(W/2, 5, "Date: "+quoteDate, "", 1, "R", false, 0, "")
			hline(baseTop+6, false)
		}
	})

	// Footer — page numbers only when the document spans more than one page.
	// Sits well above botMargin so it doesn't crowd/overlap the letterhead's
	// own footer band (the contact-info strip baked into the letterhead image).
	pdf.AliasNbPages("{nb}")
	pdf.SetFooterFunc(func() {
		pdf.SetY(297 - botMargin - 12)
		pdf.SetFont("Helvetica", "", 8)
		muted()
		pdf.CellFormat(W, 4, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "C", false, 0, "")
	})

	contTop := baseTop + contBandH
	bottomLimit := 297 - botMargin - 10 // content must stay above this (leaves room for page no. + letterhead footer)
	pdf.SetMargins(15, contTop, 15)
	pdf.SetAutoPageBreak(true, botMargin+10)
	pdf.AddPage()

	// breakIfNeeded starts a fresh page (header redraws) when `need` mm won't fit,
	// then resets the running y to the content-top. Used by every flowing section so
	// rows/terms never split across a page boundary.
	breakIfNeeded := func(yp *float64, need float64) {
		if *yp+need > bottomLimit {
			pdf.AddPage()
			*yp = contTop
		}
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
		pdf.CellFormat(120, 8, tr(senderName), "", 1, "L", false, 0, "")
		if company.Address != "" {
			pdf.SetX(x0)
			pdf.SetFont("Helvetica", "", 8)
			pdf.SetTextColor(220, 228, 238)
			pdf.CellFormat(180, 4, tr(company.Address), "", 0, "L", false, 0, "")
		}
		y = 28
	}

	// Title (nudged up)
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "BU", 14)
	navy()
	pdf.CellFormat(W, 7, "QUOTATION", "", 1, "C", false, 0, "")
	if company.TRN != "" {
		pdf.SetX(x0)
		pdf.SetFont("Helvetica", "B", 9)
		navy()
		pdf.CellFormat(W, 5, "TRN : "+tr(company.TRN), "", 1, "C", false, 0, "")
	}
	y = pdf.GetY() + 3

	// Ref / Date — plain letter-style lines, tight label-to-value gap (not a
	// fixed tab-stop column), matching a natural typed letter.
	pdf.SetFont("Helvetica", "B", 9)
	gap := pdf.GetStringWidth("M/s.") + 3 // widest label here — others compute their own tight width below
	writeField := func(label, val string) {
		pdf.SetX(x0)
		pdf.SetFont("Helvetica", "B", 9)
		dark()
		lw := pdf.GetStringWidth(label) + 3
		pdf.CellFormat(lw, 5, label, "", 0, "L", false, 0, "")
		pdf.SetFont("Helvetica", "", 9)
		pdf.CellFormat(W-lw, 5, tr(val), "", 1, "L", false, 0, "")
	}
	pdf.SetXY(x0, y)
	writeField("Ref:", q.QuoteNumber)
	writeField("Date:", fmtDateDMY(q.QuoteDate))
	y = pdf.GetY() + 4

	// M/s. — customer name + address, plain (no box), matching a letter's salutation block.
	toName := q.BillTo.Name
	if toName == "" {
		toName = q.CustomerName
	}
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "B", 9)
	dark()
	pdf.CellFormat(gap, 5, "M/s.", "", 0, "L", false, 0, "")
	pdf.CellFormat(W-gap, 5, tr(toName), "", 1, "L", false, 0, "")
	if q.BillTo.POBox != "" {
		pdf.SetX(x0)
		pdf.SetFont("Helvetica", "B", 9)
		dark()
		poLabel := "P.O. Box: "
		poLabelW := pdf.GetStringWidth(poLabel)
		pdf.CellFormat(poLabelW, 4.6, poLabel, "", 0, "L", false, 0, "")
		pdf.SetFont("Helvetica", "", 9)
		body()
		pdf.CellFormat(W-poLabelW, 4.6, tr(q.BillTo.POBox), "", 1, "L", false, 0, "")
	}
	if q.BillTo.Address != "" {
		pdf.SetX(x0)
		pdf.SetFont("Helvetica", "", 9)
		body()
		pdf.MultiCell(W, 4.6, tr(q.BillTo.Address), "", "L", false)
	}
	if q.BillTo.TRN != "" {
		pdf.SetX(x0)
		pdf.SetFont("Helvetica", "", 9)
		body()
		pdf.CellFormat(W, 4.6, "TRN: "+tr(q.BillTo.TRN), "", 1, "L", false, 0, "")
	}
	y = pdf.GetY() + 4

	if q.AttentionTo != "" {
		pdf.SetXY(x0, y)
		writeField("Attn:", q.AttentionTo)
		y = pdf.GetY() + 4
	}
	if q.Salutation != "" {
		pdf.SetXY(x0, y)
		pdf.SetFont("Helvetica", "", 9)
		dark()
		pdf.CellFormat(W, 5, tr(q.Salutation), "", 1, "L", false, 0, "")
		y = pdf.GetY() + 4
	}
	if q.Subject != "" {
		pdf.SetXY(x0, y)
		writeField("Sub:", q.Subject)
		y = pdf.GetY() + 4
	}
	if q.ProjectName != "" {
		pdf.SetXY(x0, y)
		writeField("Project:", q.ProjectName)
		y = pdf.GetY() + 4
	}

	// Intro text
	if q.IntroText != "" {
		pdf.SetXY(x0, y)
		pdf.SetFont("Helvetica", "", 9)
		body()
		pdf.MultiCell(W, 4.6, tr(q.IntroText), "", "L", false)
		y = pdf.GetY() + 4
	}

	// Items table — Sl.No / Part Number / Description / Qty / Unit / Unit Price / Total
	// only (no per-line discount or VAT% columns — VAT is summarized once below).
	cols := []struct {
		label string
		w     float64
		align string
	}{
		{"Sl.No", 10, "C"}, {"Part Number", 24, "L"}, {"Description", 58, "L"},
		{"Qty", 14, "C"}, {"Unit", 14, "C"}, {"Unit Price " + cur, 30, "R"}, {"Total " + cur, 30, "R"},
	}
	descX := x0 + cols[0].w + cols[1].w
	afterDescX := descX + cols[2].w

	// Full black grid lines (every cell bordered on all sides), matching the
	// reference — column x-boundaries used to draw verticals per row/header.
	colX := []float64{x0}
	for _, c := range cols {
		colX = append(colX, colX[len(colX)-1]+c.w)
	}
	gridPen := func() { pdf.SetDrawColor(0, 0, 0); pdf.SetLineWidth(0.25) }
	vLines := func(top, bottom float64) {
		gridPen()
		for _, x := range colX {
			pdf.Line(x, top, x, bottom)
		}
	}
	hLine := func(yy float64) {
		gridPen()
		pdf.Line(x0, yy, x1, yy)
	}

	drawItemsHeader := func() {
		headTop := y
		pdf.SetXY(x0, y)
		pdf.SetFont("Helvetica", "B", 8.5)
		dark()
		for _, c := range cols {
			pdf.CellFormat(c.w, 8, c.label, "", 0, c.align, false, 0, "")
		}
		pdf.Ln(-1)
		y = pdf.GetY()
		hLine(headTop)
		hLine(y)
		vLines(headTop, y)
	}
	drawItemsHeader()

	drawRow := func(item *models.QuoteLineItem, idx int) {
		desc := ""
		if item != nil {
			desc = item.Desc
		}
		pdf.SetFont("Helvetica", "", 8.5)
		desc = tr(desc)
		nLines := len(pdf.SplitText(desc, cols[2].w))
		if nLines < 1 {
			nLines = 1
		}
		rowH := float64(nLines) * 5
		if rowH < 7 {
			rowH = 7
		}
		// Keep the whole row on one page; repeat the column header after a break.
		if y+rowH > bottomLimit {
			pdf.AddPage()
			y = contTop
			drawItemsHeader()
		}
		yy := y
		// Vertically center the description block to match the CellFormat cells
		// (which center within rowH); otherwise a 1-line desc floats to the top.
		descTop := yy + (rowH-float64(nLines)*5)/2
		if descTop < yy {
			descTop = yy
		}
		pdf.SetXY(descX, descTop)
		dark()
		pdf.MultiCell(cols[2].w, 5, desc, "", "L", false)
		if item != nil {
			partNo := item.PartNumber
			if partNo == "" {
				partNo = "-"
			}
			pdf.SetXY(x0, yy)
			muted()
			pdf.CellFormat(cols[0].w, rowH, fmt.Sprintf("%d", idx+1), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[1].w, rowH, tr(partNo), "", 0, "L", false, 0, "")
			pdf.SetX(afterDescX)
			dark()
			pdf.CellFormat(cols[3].w, rowH, fmt.Sprintf("%g", item.Qty), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[4].w, rowH, tr(item.Unit), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[5].w, rowH, fmtMoney(item.UnitPrice), "", 0, "R", false, 0, "")
			pdf.SetFont("Helvetica", "B", 8.5)
			pdf.CellFormat(cols[6].w, rowH, fmtMoney(item.Total), "", 0, "R", false, 0, "")
		}
		by := yy + rowH
		hLine(by)
		vLines(yy, by)
		y = by
		pdf.SetXY(x0, by)
	}
	// Only real line items — no padding blank rows like the old design used to add.
	for i := range q.LineItems {
		drawRow(&q.LineItems[i], i)
	}

	// Totals — trailing rows inside the SAME bordered grid (label spans every
	// column up to the last, value sits in the Total column), matching the
	// reference's Sub Total / VAT % / Grand Total rows.
	vatPct := 0.0
	if q.Totals.Subtotal > 0 {
		vatPct = q.Totals.TaxTotal / q.Totals.Subtotal * 100
	}
	totRows := []struct {
		label string
		val   float64
		bold  bool
	}{
		{"Sub Total " + cur, q.Totals.Subtotal, false},
		{fmt.Sprintf("VAT %g%%", vatPct), q.Totals.TaxTotal, false},
		{"Grand Total", q.Totals.GrandTotal, true},
	}
	labelX0 := colX[0]
	labelX1 := colX[len(colX)-2] // start of the last (Total) column
	valX0 := labelX1
	valX1 := colX[len(colX)-1]
	totalsRowH := 6.5
	for _, r := range totRows {
		breakIfNeeded(&y, totalsRowH)
		top := y
		if r.bold {
			pdf.SetFillColor(241, 245, 249)
			pdf.Rect(labelX0, top, valX1-labelX0, totalsRowH, "F")
			pdf.SetFont("Helvetica", "B", 9.5)
		} else {
			pdf.SetFont("Helvetica", "B", 8.5)
		}
		dark()
		pdf.SetXY(labelX0, top+1.3)
		pdf.CellFormat(labelX1-labelX0-3, 4, r.label, "", 0, "R", false, 0, "")
		pdf.SetXY(valX0, top+1.3)
		pdf.CellFormat(valX1-valX0-3, 4, fmtMoney(r.val), "", 0, "R", false, 0, "")
		y = top + totalsRowH
		hLine(top)
		hLine(y)
		gridPen()
		pdf.Line(labelX0, top, labelX0, y)
		pdf.Line(valX0, top, valX0, y)
		pdf.Line(valX1, top, valX1, y)
	}
	y += 4

	// Note — plain letter-style block, ➢ bullets, no ruled lines (Note comes
	// before Terms, matching the reference layout order).
	noteLines := []string{}
	for _, n := range splitLines(q.Notes.Customer) {
		if strings.TrimSpace(n) != "" {
			noteLines = append(noteLines, strings.TrimSpace(n))
		}
	}
	if len(noteLines) > 0 {
		breakIfNeeded(&y, 12)
		pdf.SetXY(x0, y)
		pdf.SetFont("Helvetica", "BU", 9)
		dark()
		pdf.CellFormat(W, 4.4, "Note:", "", 1, "L", false, 0, "")
		y = pdf.GetY() + 1
		pdf.SetFont("Helvetica", "", 8.5)
		body()
		for _, n := range noteLines {
			nLines := len(pdf.SplitText(n, W-14))
			if nLines < 1 {
				nLines = 1
			}
			h := float64(nLines)*4.4 + 0.5
			breakIfNeeded(&y, h)
			pdf.SetXY(x0, y)
			pdf.CellFormat(6, 4.4, tr("•"), "", 0, "L", false, 0, "")
			pdf.SetXY(x0+7, y)
			pdf.MultiCell(W-7, 4.4, tr(n), "", "L", false)
			y = pdf.GetY() + 0.5
		}
		y += 3
	}

	// Terms and conditions of our offer — numbered list, plain letter style.
	terms := []string{}
	for _, t := range q.TermsAndConditions {
		if strings.TrimSpace(t) != "" {
			terms = append(terms, t)
		}
	}
	if len(terms) > 0 {
		breakIfNeeded(&y, 14)
		pdf.SetXY(x0, y)
		pdf.SetFont("Helvetica", "BU", 9)
		dark()
		pdf.CellFormat(W, 4.4, "Terms and conditions of our offer", "", 1, "L", false, 0, "")
		y = pdf.GetY() + 1
		pdf.SetFont("Helvetica", "", 8.5)
		body()
		for i, t := range terms {
			nLines := len(pdf.SplitText(t, W-9))
			if nLines < 1 {
				nLines = 1
			}
			h := float64(nLines)*4.4 + 1
			breakIfNeeded(&y, h)
			pdf.SetXY(x0, y)
			pdf.CellFormat(7, 4.4, fmt.Sprintf("%d", i+1), "", 0, "L", false, 0, "")
			pdf.SetXY(x0+9, y)
			pdf.MultiCell(W-9, 4.4, tr(t), "", "L", false)
			y = pdf.GetY() + 1
		}
		y += 2
	}

	// Closing — plain letter-style sign-off (no customer-acceptance box), matching
	// the reference: a closing line, "Yours Truly", "For [Company]", the org's
	// stamp/signature image if one's been uploaded, then signatory name/title
	// and contact details. Kept whole on one page.
	closeH := 55.0
	breakIfNeeded(&y, closeH)
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "", 9)
	body()
	pdf.MultiCell(W, 4.6, "Hope the above meets your requirement. We look forward to serving you at the earliest.", "", "L", false)
	y = pdf.GetY() + 4
	pdf.SetX(x0)
	pdf.CellFormat(W, 4.6, "Thanking you and assuring you of our best services, always.", "", 1, "L", false, 0, "")
	y = pdf.GetY() + 6

	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "BI", 9)
	dark()
	pdf.CellFormat(W, 4.6, "Yours Truly", "", 1, "L", false, 0, "")
	pdf.SetX(x0)
	pdf.SetFont("Helvetica", "BI", 9)
	pdf.CellFormat(W, 4.6, "For "+tr(senderName), "", 1, "L", false, 0, "")
	y = pdf.GetY() + 2

	// Stamp/signature image, if the org has one uploaded.
	if stampData, stampType, ok := loadOrgStamp(q.OrgID); ok {
		var sOpt gofpdf.ImageOptions
		sOpt.ImageType = stampType
		pdf.RegisterImageOptionsReader("quote-stamp", sOpt, bytes.NewReader(stampData))
		stampH := 26.0
		breakIfNeeded(&y, stampH+2)
		pdf.ImageOptions("quote-stamp", x0, y, 0, stampH, false, sOpt, 0, "")
		y += stampH + 2
	} else {
		y += 4
	}

	breakIfNeeded(&y, 14)
	if q.Signatory.Name != "" {
		pdf.SetXY(x0, y)
		pdf.SetFont("Helvetica", "B", 9)
		dark()
		pdf.CellFormat(W, 4.5, tr(q.Signatory.Name), "", 1, "L", false, 0, "")
		y = pdf.GetY()
	}
	if q.Signatory.Title != "" {
		pdf.SetX(x0)
		pdf.SetFont("Helvetica", "B", 8.5)
		body()
		pdf.CellFormat(W, 4.5, tr(q.Signatory.Title), "", 1, "L", false, 0, "")
		y = pdf.GetY()
	}
	if company.Phone != "" {
		pdf.SetX(x0)
		pdf.SetFont("Helvetica", "B", 8.5)
		body()
		pdf.CellFormat(W, 4.5, "Tel: "+tr(company.Phone), "", 1, "L", false, 0, "")
		y = pdf.GetY()
	}
	if company.Email != "" {
		pdf.SetX(x0)
		pdf.SetFont("Helvetica", "B", 8.5)
		body()
		pdf.CellFormat(W, 4.5, "Email: "+tr(company.Email), "", 1, "L", false, 0, "")
		y = pdf.GetY()
	}

	// Company contact footer — skip when the letterhead already supplies a footer.
	if !hasLH && (company.Name != "" || company.Phone != "" || company.Email != "" || company.TRN != "") {
		y += 4
		hline(y, false)
		pdf.SetFillColor(248, 250, 252)
		footH := 13.0
		pdf.Rect(x0, y, W, footH, "F")
		pdf.SetXY(x0, y+2)
		pdf.SetFont("Helvetica", "B", 9)
		navy()
		pdf.CellFormat(W, 4, tr(company.Name), "", 1, "C", false, 0, "")
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
		pdf.CellFormat(W, 4, tr(strings.Join(parts, "   |   ")), "", 1, "C", false, 0, "")
		y += footH
		hline(y, false)
	}

	return pdf
}

// writeQuotePDF renders a quote PDF to the response. inline=true serves it for
// in-browser viewing (preview); inline=false forces a download (export).
func writeQuotePDF(c *gin.Context, inline bool) {
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
	pdfWatermark(pdf, watermarkFor(q.Status))

	disposition := "attachment"
	if inline {
		disposition = "inline"
	}
	filename := "quote-" + q.QuoteNumber + ".pdf"
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", disposition+`; filename="`+filename+`"`)
	if err := pdf.Output(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
	}
}

// DownloadQuotePDF forces a file download — gated by the `export` capability
// (path contains "/pdf").
func DownloadQuotePDF() gin.HandlerFunc {
	return func(c *gin.Context) { writeQuotePDF(c, false) }
}

// PreviewQuotePDF serves the same PDF inline for on-screen preview. Its route
// (/preview, no "/pdf" segment) only requires the `view` capability, so view-only
// users can preview a quote without the export gate.
func PreviewQuotePDF() gin.HandlerFunc {
	return func(c *gin.Context) { writeQuotePDF(c, true) }
}

// PublicQuotePDF serves the same PDF for the unauthenticated public share link —
// keyed by the quote's random token, not id+org. Always inline.
func PublicQuotePDF() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		token := c.Param("token")
		if token == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid token"})
			return
		}

		var q models.Quote
		if err := quoteCollection.FindOne(ctx, bson.M{"publicToken": token}).Decode(&q); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Quote not found"})
			return
		}

		pdf := buildQuotePDF(q)
		pdfWatermark(pdf, watermarkFor(q.Status))

		filename := "quote-" + q.QuoteNumber + ".pdf"
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", `inline; filename="`+filename+`"`)
		if err := pdf.Output(c.Writer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
		}
	}
}

// loadOrgName fetches just the org name (projected — never the heavy letterhead).
func loadOrgName(orgID string) string {
	oid, err := primitive.ObjectIDFromHex(orgID)
	if err != nil {
		return ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var org models.Organization
	opts := options.FindOne().SetProjection(bson.M{"name": 1})
	if err := orgCollection.FindOne(ctx, bson.M{"_id": oid}, opts).Decode(&org); err != nil {
		return ""
	}
	return org.Name
}

// buildDeliveryNotePDF renders a delivery note. Same letterhead-per-page machinery
// as buildQuotePDF (header top, footer bottom, content flows inside, overflow →
// next page), but with delivery-note fields and no pricing/totals. There is no
// quote number/date strip — the DN carries its own number/date in the info block.
func buildDeliveryNotePDF(dn models.DeliveryNote) *gofpdf.Fpdf {
	pdf := gofpdf.New("P", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")

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

	orgName := loadOrgName(dn.OrgID)
	dnRef := dn.DNNumber
	dnDate := fmtDateDMY(dn.Date)

	lh, hasLH := loadOrgLetterhead(dn.OrgID)
	baseTop := 14.0
	botMargin := 16.0
	if hasLH {
		baseTop = lh.topPadMM
		botMargin = lh.botPadMM
	}
	const contBandH = 9.0

	var opt gofpdf.ImageOptions
	if hasLH {
		opt = gofpdf.ImageOptions{ImageType: lh.imgType}
		pdf.RegisterImageOptionsReader("letterhead", opt, bytes.NewReader(lh.data))
	}

	pdf.SetHeaderFunc(func() {
		if hasLH {
			pdf.ImageOptions("letterhead", 0, 0, 210, 297, false, opt, 0, "")
		}
		if pdf.PageNo() > 1 {
			pdf.SetXY(x0, baseTop)
			pdf.SetFont("Helvetica", "B", 9)
			navy()
			pdf.CellFormat(W/2, 5, tr("Delivery Note: "+dnRef), "", 0, "L", false, 0, "")
			pdf.CellFormat(W/2, 5, "Date: "+dnDate, "", 1, "R", false, 0, "")
			hline(baseTop+6, false)
		}
	})

	pdf.AliasNbPages("{nb}")
	pdf.SetFooterFunc(func() {
		pdf.SetY(297 - botMargin - 6)
		pdf.SetFont("Helvetica", "", 8)
		muted()
		pdf.CellFormat(W, 4, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "C", false, 0, "")
	})

	contTop := baseTop + contBandH
	bottomLimit := 297 - botMargin - 10
	pdf.SetMargins(15, contTop, 15)
	pdf.SetAutoPageBreak(true, botMargin+10)
	pdf.AddPage()

	breakIfNeeded := func(yp *float64, need float64) {
		if *yp+need > bottomLimit {
			pdf.AddPage()
			*yp = contTop
		}
	}

	var y float64
	if hasLH {
		y = lh.topPadMM
	} else {
		pdf.SetFillColor(30, 58, 95)
		pdf.Rect(0, 0, 210, 22, "F")
		pdf.SetXY(x0, 6)
		pdf.SetFont("Helvetica", "B", 15)
		pdf.SetTextColor(255, 255, 255)
		name := orgName
		if name == "" {
			name = "Company"
		}
		pdf.CellFormat(180, 8, tr(name), "", 1, "L", false, 0, "")
		y = 26
	}

	// Title
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "BU", 14)
	navy()
	pdf.CellFormat(W, 7, "DELIVERY NOTE", "", 1, "C", false, 0, "")
	y = pdf.GetY() + 2
	hline(y, true)
	y += 1

	// ── Customer / delivery details — two columns ──
	custName := dn.CustomerName
	if custName == "" {
		custName = "-"
	}
	leftRows := [][2]string{
		{"To", custName},
		{"Customer Code", orDash(dn.CustomerCode)},
	}
	if strings.TrimSpace(dn.CustomerAddress) != "" {
		leftRows = append(leftRows, [2]string{"Address", dn.CustomerAddress})
	}
	leftRows = append(leftRows,
		[2]string{"Tel", orDash(dn.CustomerPhone)},
		[2]string{"Email", orDash(dn.CustomerEmail)},
	)
	rightRows := [][2]string{
		{"Delivery Note No", dnRef},
		{"Delivery Date", dnDate},
		{"Cust PO No", orDash(dn.CustPoNo)},
		{"Cust PO Date", fmtDateDMY(dn.CustPoDate)},
	}
	if orgName != "" {
		rightRows = append(rightRows, [2]string{"Sales Division", orgName})
	}
	rightRows = append(rightRows,
		[2]string{"Salesperson", orDash(dn.Salesperson)},
		[2]string{"Sale Order Ref", orDash(dn.OrderNumber)},
		[2]string{"Delivery Location", orDash(dn.DeliveryLocation)},
	)

	renderCol := func(startX, ry, labelW, valW float64, rows [][2]string) float64 {
		for _, r := range rows {
			muted()
			pdf.SetFont("Helvetica", "", 8.5)
			pdf.SetXY(startX, ry)
			pdf.CellFormat(labelW, 4.6, r[0], "", 0, "L", false, 0, "")
			dark()
			val := tr(": " + r[1])
			lines := pdf.SplitText(val, valW)
			if len(lines) < 1 {
				lines = []string{val}
			}
			pdf.SetXY(startX+labelW, ry)
			pdf.MultiCell(valW, 4.6, val, "", "L", false)
			ry += float64(len(lines)) * 4.6
		}
		return ry
	}

	blockTop := y + 3
	leftEnd := renderCol(x0+5, blockTop, 28, 55, leftRows)
	rightEnd := renderCol(mid+5, blockTop, 34, 49, rightRows)
	blockBottom := leftEnd
	if rightEnd > blockBottom {
		blockBottom = rightEnd
	}
	blockBottom += 2
	borderPen()
	pdf.Line(mid, y, mid, blockBottom)
	hline(blockBottom, false)
	y = blockBottom

	// ── Items table (no pricing) ──
	cols := []struct {
		label string
		w     float64
		align string
	}{
		{"Sl.No", 12, "C"}, {"Part Number", 35, "L"}, {"Description", 88, "L"},
		{"Qty", 20, "C"}, {"Unit", 25, "C"},
	}
	descX := x0 + cols[0].w + cols[1].w
	afterDescX := descX + cols[2].w

	drawItemsHeader := func() {
		pdf.SetXY(x0, y)
		pdf.SetFillColor(241, 245, 249)
		pdf.SetFont("Helvetica", "B", 8.5)
		navy()
		for _, c := range cols {
			pdf.CellFormat(c.w, 8, c.label, "", 0, c.align, true, 0, "")
		}
		pdf.Ln(-1)
		hline(pdf.GetY(), true)
		y = pdf.GetY()
	}
	drawItemsHeader()

	drawRow := func(item *models.DNItem, idx int) {
		desc, partNo, qtyStr, unit := "", "-", "", ""
		if item != nil {
			desc = item.Name
			if strings.TrimSpace(item.ItemCode) != "" {
				partNo = item.ItemCode
			}
			qtyStr = fmt.Sprintf("%g", item.OutboundQuantity)
			unit = item.Unit
			if unit == "" {
				unit = "Nos"
			}
		}
		desc = tr(desc)
		pdf.SetFont("Helvetica", "", 8.5)
		nLines := len(pdf.SplitText(desc, cols[2].w))
		if nLines < 1 {
			nLines = 1
		}
		rowH := float64(nLines) * 5
		if rowH < 7 {
			rowH = 7
		}
		if y+rowH > bottomLimit {
			pdf.AddPage()
			y = contTop
			drawItemsHeader()
		}
		yy := y
		descTop := yy + (rowH-float64(nLines)*5)/2
		if descTop < yy {
			descTop = yy
		}
		pdf.SetXY(descX, descTop)
		dark()
		pdf.MultiCell(cols[2].w, 5, desc, "", "L", false)
		if item != nil {
			pdf.SetXY(x0, yy)
			muted()
			pdf.CellFormat(cols[0].w, rowH, fmt.Sprintf("%d", idx+1), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[1].w, rowH, tr(partNo), "", 0, "L", false, 0, "")
			pdf.SetX(afterDescX)
			dark()
			pdf.CellFormat(cols[3].w, rowH, qtyStr, "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[4].w, rowH, tr(unit), "", 0, "C", false, 0, "")
		}
		by := yy + rowH
		hline(by, false)
		y = by
		pdf.SetXY(x0, by)
	}
	for i := range dn.Items {
		drawRow(&dn.Items[i], i)
	}
	for i := len(dn.Items); i < 4; i++ {
		drawRow(nil, i)
	}

	// ── Acknowledgment ──
	ackText := "I, the undersigned hereby acknowledge that I have received and inspected the goods as described in this delivery note. I hereby confirm to have received the quantity as mentioned in this delivery note."
	pdf.SetFont("Helvetica", "I", 8)
	ackLines := pdf.SplitText(ackText, W-6)
	ackH := float64(len(ackLines))*4.2 + 4
	breakIfNeeded(&y, ackH+2)
	pdf.SetFillColor(248, 250, 252)
	pdf.Rect(x0, y, W, ackH, "F")
	pdf.SetXY(x0+3, y+2)
	body()
	pdf.MultiCell(W-6, 4.2, tr(ackText), "", "J", false)
	y += ackH
	hline(y, false)

	// ── Signatures ──
	sigH := 42.0
	breakIfNeeded(&y, sigH+2)
	sigY := y
	pdf.SetXY(x0+5, sigY+4)
	pdf.SetFont("Helvetica", "B", 8.5)
	navy()
	pdf.CellFormat(80, 4, "RECEIVER'S SIGN & STAMP", "", 0, "L", false, 0, "")
	pdf.SetXY(mid+5, sigY+4)
	pdf.CellFormat(80, 4, "DO PREPARED BY", "", 0, "L", false, 0, "")

	drawSigLine := func(lx, ry float64, label string, lineW float64) {
		muted()
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetXY(lx, ry)
		pdf.CellFormat(28, 4.4, label+":", "", 0, "L", false, 0, "")
		pdf.SetDrawColor(148, 163, 184)
		pdf.SetLineWidth(0.2)
		pdf.Line(lx+28, ry+4, lx+28+lineW, ry+4)
	}
	ly := sigY + 16
	for _, lab := range []string{"Receiver's Name", "Designation", "Date", "Phone Number"} {
		drawSigLine(x0+5, ly, lab, 42)
		ly += 6.2
	}
	pdf.SetXY(mid+5, sigY+14)
	pdf.SetFont("Helvetica", "B", 8.5)
	navy()
	pdf.CellFormat(80, 4, "DELIVERED BY & DATE", "", 0, "L", false, 0, "")
	ry2 := sigY + 22
	for _, lab := range []string{"Name", "Date"} {
		drawSigLine(mid+5, ry2, lab, 42)
		ry2 += 6.2
	}
	borderPen()
	pdf.Line(mid, sigY, mid, sigY+sigH)
	y = sigY + sigH
	hline(y, true)

	// ── Notes ──
	if strings.TrimSpace(dn.Note) != "" {
		pdf.SetFont("Helvetica", "", 8.5)
		noteLines := pdf.SplitText(dn.Note, W-26)
		need := float64(len(noteLines))*4.4 + 5
		breakIfNeeded(&y, need)
		muted()
		pdf.SetXY(x0+5, y+2.5)
		pdf.CellFormat(20, 4.4, "Notes:", "", 0, "L", false, 0, "")
		dark()
		pdf.SetXY(x0+25, y+2.5)
		pdf.MultiCell(W-26, 4.4, tr(dn.Note), "", "L", false)
		y = pdf.GetY() + 1
		hline(y, false)
	}

	return pdf
}

// writeDeliveryNotePDF renders a DN PDF. inline=true → in-browser preview.
func writeDeliveryNotePDF(c *gin.Context, inline bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	orgID, _ := c.Get("orgId")
	objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid delivery note ID"})
		return
	}

	var dn models.DeliveryNote
	if err := deliveryNotesCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&dn); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Delivery note not found"})
		return
	}

	pdf := buildDeliveryNotePDF(dn)
	pdfWatermark(pdf, watermarkFor(dn.Status))

	disposition := "attachment"
	if inline {
		disposition = "inline"
	}
	filename := "delivery-note-" + dn.DNNumber + ".pdf"
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", disposition+`; filename="`+filename+`"`)
	if err := pdf.Output(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
	}
}

// DownloadDeliveryNotePDF forces a download — gated by `export` (path has "/pdf").
func DownloadDeliveryNotePDF() gin.HandlerFunc {
	return func(c *gin.Context) { writeDeliveryNotePDF(c, false) }
}

// PreviewDeliveryNotePDF serves the PDF inline — its /preview route needs only `view`.
func PreviewDeliveryNotePDF() gin.HandlerFunc {
	return func(c *gin.Context) { writeDeliveryNotePDF(c, true) }
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

// ── Letterhead document PDF (Purchase Orders, Bills, Sales Orders) ─────────────
// Same visual system as the invoice PDF (buildInvoicePDF above): org letterhead
// image as the full-page background when configured (else the navy header band),
// identical title/number strip, two-column party + related-info block, items
// table, totals box with amount-in-words, and signature block. Parameterized so
// PO/Bill/SO share this one implementation instead of drifting from the invoice's
// proven layout. buildInvoicePDF itself is untouched.

type lhDocParty struct {
	Label   string // "SUPPLIER" | "VENDOR" | "CUSTOMER"
	Code    string
	Name    string
	Address string
	Phone   string
	TRN     string
}

type lhDocTotalRow struct {
	Label string
	Value float64
}

type lhDocData struct {
	OrgID       string
	DocLabel    string // "PURCHASE ORDER" | "VENDOR BILL" | "SALES ORDER" — page title
	ValueLabel  string // "Purchase Order" | "Bill" | "Sales Order" — totals-row prefix
	RefPrefix   string // "PO" | "Bill" | "SO" — continuation-page header prefix
	NumberLabel string // "PO NUMBER" | "BILL NUMBER" | "SO NUMBER"
	RefNumber   string
	RefDate     string // pre-formatted "02/01/2006"
	Party       lhDocParty
	RelatedInfo [][2]string
	Items       []models.InvoiceLineItem
	Currency    string
	ProdNet     float64          // "excl. VAT" base line
	ExtraRows   []lhDocTotalRow  // e.g. Shipping, Adjustment — between subtotal and VAT
	TaxTotal    float64
	GrandTotal  float64
	AmountPaid  float64
	BalanceDue  float64
	Notes       string
}

func buildLetterheadDocPDF(d lhDocData) *gofpdf.Fpdf {
	pdf := gofpdf.New("P", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")

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

	cur := d.Currency
	if cur == "" {
		cur = "AED"
	}
	senderName := loadOrgName(d.OrgID)
	if senderName == "" {
		senderName = "Company"
	}
	refNum := d.RefNumber
	refDate := d.RefDate
	docLabel := d.DocLabel

	lh, hasLH := loadOrgLetterhead(d.OrgID)
	baseTop := 14.0
	botMargin := 16.0
	if hasLH {
		baseTop = lh.topPadMM
		botMargin = lh.botPadMM
	}
	const contBandH = 9.0

	var opt gofpdf.ImageOptions
	if hasLH {
		opt = gofpdf.ImageOptions{ImageType: lh.imgType}
		pdf.RegisterImageOptionsReader("letterhead", opt, bytes.NewReader(lh.data))
	}

	pdf.SetHeaderFunc(func() {
		if hasLH {
			pdf.ImageOptions("letterhead", 0, 0, 210, 297, false, opt, 0, "")
		}
		if pdf.PageNo() > 1 {
			pdf.SetXY(x0, baseTop)
			pdf.SetFont("Helvetica", "B", 9)
			navy()
			pdf.CellFormat(W/2, 5, tr(d.RefPrefix+": "+refNum), "", 0, "L", false, 0, "")
			pdf.CellFormat(W/2, 5, "Date: "+refDate, "", 1, "R", false, 0, "")
			hline(baseTop+6, false)
		}
	})

	pdf.AliasNbPages("{nb}")
	pdf.SetFooterFunc(func() {
		pdf.SetY(297 - botMargin - 6)
		pdf.SetFont("Helvetica", "", 8)
		muted()
		pdf.CellFormat(W, 4, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "C", false, 0, "")
	})

	contTop := baseTop + contBandH
	bottomLimit := 297 - botMargin - 10
	pdf.SetMargins(15, contTop, 15)
	pdf.SetAutoPageBreak(true, botMargin+10)
	pdf.AddPage()

	breakIfNeeded := func(yp *float64, need float64) {
		if *yp+need > bottomLimit {
			pdf.AddPage()
			*yp = contTop
		}
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
		pdf.CellFormat(120, 8, tr(senderName), "", 1, "L", false, 0, "")
		y = 28
	}

	// Title
	pdf.SetXY(x0, y)
	pdf.SetFont("Helvetica", "BU", 14)
	navy()
	pdf.CellFormat(W, 7, docLabel, "", 1, "C", false, 0, "")
	y = pdf.GetY() + 3

	// Number / date strip
	stripH := 8.0
	hline(y, false)
	hline(y+stripH, false)
	borderPen()
	pdf.Line(mid, y, mid, y+stripH)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.SetXY(x0+5, y+2.2)
	pdf.CellFormat(45, 4, d.NumberLabel, "", 0, "L", false, 0, "")
	dark()
	pdf.SetXY(mid-50, y+2.2)
	pdf.CellFormat(45, 4, tr(refNum), "", 0, "R", false, 0, "")
	navy()
	pdf.SetXY(mid+5, y+2.2)
	pdf.CellFormat(40, 4, "DATE", "", 0, "L", false, 0, "")
	dark()
	pdf.SetXY(x1-50, y+2.2)
	pdf.CellFormat(45, 4, refDate, "", 0, "R", false, 0, "")
	y += stripH

	// Party / Related Info
	blockY := y
	ly := blockY + 3
	pdf.SetXY(x0+5, ly)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.CellFormat(80, 4, d.Party.Label, "", 0, "L", false, 0, "")
	ly += 5.5
	if d.Party.Code != "" {
		muted()
		pdf.SetFont("Helvetica", "", 8.5)
		pdf.SetXY(x0+5, ly)
		pdf.CellFormat(85, 4.2, tr("Code: "+d.Party.Code), "", 0, "L", false, 0, "")
		ly += 5
	}
	partyName := d.Party.Name
	if partyName == "" {
		partyName = "-"
	}
	dark()
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetXY(x0+5, ly)
	pdf.CellFormat(85, 4.5, tr(partyName), "", 0, "L", false, 0, "")
	ly += 5
	body()
	pdf.SetFont("Helvetica", "", 8.5)
	if d.Party.Address != "" {
		pdf.SetXY(x0+5, ly)
		pdf.MultiCell(85, 4.2, tr(d.Party.Address), "", "L", false)
		ly = pdf.GetY() + 1
	}
	if d.Party.Phone != "" {
		pdf.SetXY(x0+5, ly)
		pdf.CellFormat(85, 4.2, tr("Tel: "+d.Party.Phone), "", 0, "L", false, 0, "")
		ly += 5
	}
	if d.Party.TRN != "" {
		pdf.SetXY(x0+5, ly)
		pdf.CellFormat(85, 4.2, "TRN: "+tr(d.Party.TRN), "", 0, "L", false, 0, "")
		ly += 5
	}

	pdf.SetXY(mid+5, blockY+3)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.CellFormat(80, 4, "RELATED INFO", "", 0, "L", false, 0, "")
	ry := blockY + 8.5
	pdf.SetFont("Helvetica", "", 8.5)
	for _, rr := range d.RelatedInfo {
		muted()
		pdf.SetXY(mid+5, ry)
		pdf.CellFormat(32, 4.4, rr[0], "", 0, "L", false, 0, "")
		dark()
		pdf.SetXY(mid+37, ry)
		pdf.CellFormat(48, 4.4, ": "+tr(orDash(rr[1])), "", 0, "L", false, 0, "")
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

	// Items table
	cols := []struct {
		label string
		w     float64
		align string
	}{
		{"Sl.No", 9, "C"}, {"Material Description", 53, "L"}, {"Qty", 11, "C"},
		{"Unit Price", 19, "R"}, {"Gross Price", 20, "R"}, {"Discount", 16, "R"},
		{"VAT %", 12, "C"}, {"Net Value", 18, "R"}, {"Total Value", 22, "R"},
	}
	descX := x0 + cols[0].w
	afterDescX := descX + cols[1].w

	drawItemsHeader := func() {
		pdf.SetXY(x0, y)
		pdf.SetFillColor(241, 245, 249)
		pdf.SetFont("Helvetica", "B", 7.5)
		navy()
		for _, c := range cols {
			pdf.CellFormat(c.w, 8, c.label, "", 0, c.align, true, 0, "")
		}
		pdf.Ln(-1)
		hline(pdf.GetY(), true)
		y = pdf.GetY()
	}
	drawItemsHeader()

	drawRow := func(item *models.InvoiceLineItem, idx int) {
		desc := ""
		if item != nil {
			desc = item.Desc
		}
		desc = tr(desc)
		pdf.SetFont("Helvetica", "", 8.5)
		nLines := len(pdf.SplitText(desc, cols[1].w))
		if nLines < 1 {
			nLines = 1
		}
		rowH := float64(nLines) * 5
		if rowH < 7 {
			rowH = 7
		}
		if y+rowH > bottomLimit {
			pdf.AddPage()
			y = contTop
			drawItemsHeader()
		}
		yy := y
		descTop := yy + (rowH-float64(nLines)*5)/2
		if descTop < yy {
			descTop = yy
		}
		pdf.SetXY(descX, descTop)
		dark()
		pdf.MultiCell(cols[1].w, 5, desc, "", "L", false)
		if item != nil {
			gross := item.Qty * item.UnitPrice
			net := item.Subtotal
			if net == 0 {
				net = gross - item.DiscAmt
			}
			pdf.SetXY(x0, yy)
			muted()
			pdf.CellFormat(cols[0].w, rowH, fmt.Sprintf("%d", idx+1), "", 0, "C", false, 0, "")
			pdf.SetX(afterDescX)
			dark()
			pdf.CellFormat(cols[2].w, rowH, fmt.Sprintf("%g", item.Qty), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[3].w, rowH, fmtMoney(item.UnitPrice), "", 0, "R", false, 0, "")
			pdf.CellFormat(cols[4].w, rowH, fmtMoney(gross), "", 0, "R", false, 0, "")
			if item.DiscAmt > 0 {
				dark()
			} else {
				muted()
			}
			pdf.CellFormat(cols[5].w, rowH, fmtMoney(item.DiscAmt), "", 0, "R", false, 0, "")
			dark()
			pdf.CellFormat(cols[6].w, rowH, fmt.Sprintf("%g%%", item.TaxRate), "", 0, "C", false, 0, "")
			pdf.CellFormat(cols[7].w, rowH, fmtMoney(net), "", 0, "R", false, 0, "")
			pdf.SetFont("Helvetica", "B", 8.5)
			pdf.CellFormat(cols[8].w, rowH, fmtMoney(item.Total), "", 0, "R", false, 0, "")
		}
		by := yy + rowH
		hline(by, false)
		y = by
		pdf.SetXY(x0, by)
	}
	for i := range d.Items {
		drawRow(&d.Items[i], i)
	}
	for i := len(d.Items); i < 3; i++ {
		drawRow(nil, i)
	}

	// Totals box
	breakIfNeeded(&y, 30)
	hline(y, true)
	rx := 125.0
	rw := x1 - rx
	pdf.SetXY(x0+5, y+3)
	pdf.SetFont("Helvetica", "B", 9)
	navy()
	pdf.CellFormat(100, 4, "TOTAL IN WORDS", "", 0, "L", false, 0, "")
	pdf.SetXY(x0+5, y+8)
	pdf.SetFont("Helvetica", "B", 9)
	dark()
	pdf.MultiCell(rx-x0-8, 4.6, cur+" "+amountInWords(d.GrandTotal), "", "L", false)

	type totRow struct {
		label string
		val   float64
		bold  bool
	}
	totRows := []totRow{{d.ValueLabel + " Value (excl. VAT)", d.ProdNet, false}}
	for _, r := range d.ExtraRows {
		if r.Value != 0 {
			totRows = append(totRows, totRow{r.Label, r.Value, false})
		}
	}
	totRows = append(totRows,
		totRow{"VAT", d.TaxTotal, false},
		totRow{"Total Value (incl. VAT)", d.GrandTotal, true},
	)
	if d.AmountPaid > 0 {
		totRows = append(totRows,
			totRow{"Advance / Paid", d.AmountPaid, false},
			totRow{"Balance Payable", d.BalanceDue, false},
		)
	}
	rowH := 6.0
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
		pdf.CellFormat(rw*0.55, 4, tr(r.label), "", 0, "L", false, 0, "")
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
	totalsH := float64(len(totRows)) * rowH
	if wordsBottom := y + 14; wordsBottom > y+totalsH {
		totalsH = wordsBottom - y
	}
	borderPen()
	pdf.Line(rx, y, rx, y+totalsH)
	y += totalsH

	// Signature block
	sigH := 38.0
	breakIfNeeded(&y, sigH+2)
	hline(y, true)
	sigY := y
	pdf.SetXY(x0+5, sigY+4)
	pdf.SetFont("Helvetica", "B", 8.5)
	navy()
	pdf.CellFormat(85, 4, "RECEIVER NAME, SIGNATURE & STAMP", "", 0, "L", false, 0, "")
	pdf.SetDrawColor(148, 163, 184)
	pdf.SetLineWidth(0.2)
	pdf.Line(x0+5, sigY+26, x0+5+70, sigY+26)
	pdf.SetXY(mid+5, sigY+4)
	pdf.SetFont("Helvetica", "B", 8.5)
	navy()
	pdf.CellFormat(85, 4, "FOR "+tr(strings.ToUpper(senderName)), "", 0, "L", false, 0, "")
	pdf.SetXY(mid+5, sigY+12)
	pdf.SetFont("Helvetica", "", 8.5)
	body()
	pdf.CellFormat(85, 4.5, "Prepared By", "", 1, "L", false, 0, "")
	borderPen()
	pdf.Line(mid, sigY, mid, sigY+sigH)
	y = sigY + sigH
	hline(y, true)

	// Notes
	if strings.TrimSpace(d.Notes) != "" {
		pdf.SetFont("Helvetica", "", 8.5)
		noteLines := pdf.SplitText(d.Notes, W-26)
		need := float64(len(noteLines))*4.4 + 5
		breakIfNeeded(&y, need)
		muted()
		pdf.SetXY(x0+5, y+2.5)
		pdf.SetFont("Helvetica", "B", 8)
		pdf.CellFormat(20, 4.4, "NOTES", "", 1, "L", false, 0, "")
		y = pdf.GetY() + 0.5
		body()
		pdf.SetFont("Helvetica", "", 8.5)
		pdf.SetXY(x0+5, y)
		pdf.MultiCell(W-10, 4.4, tr(d.Notes), "", "L", false)
		y = pdf.GetY() + 1
		hline(y, false)
	}

	return pdf
}

func fmtDatePtr(t *time.Time) string {
	if t == nil {
		return "-"
	}
	return t.Format("02/01/2006")
}

// loadVendorInfo enriches a PO/Bill's supplier block from the vendor record —
// code, composed address, phone, TRN — the same way invoice enriches from the
// customer record.
func loadVendorInfo(ctx context.Context, vendorID string) (code, address, phone, trn string) {
	oid, err := primitive.ObjectIDFromHex(vendorID)
	if err != nil {
		return
	}
	var v models.Vendor
	if err := vendorCollection.FindOne(ctx, bson.M{"_id": oid}).Decode(&v); err != nil {
		return
	}
	code = v.VendorCode
	var parts []string
	if v.StreetAddress != "" {
		parts = append(parts, v.StreetAddress)
	}
	if v.City != "" {
		parts = append(parts, v.City)
	}
	if v.Country != "" {
		parts = append(parts, v.Country)
	}
	address = strings.Join(parts, ", ")
	phone = v.Phone
	trn = v.TRN
	return
}

// loadCustomerInfo enriches a Sales Order's customer block, mirroring how the
// invoice PDF enriches its BILL TO block.
func loadCustomerInfo(ctx context.Context, customerID string) (code, address, phone, trn string) {
	oid, err := primitive.ObjectIDFromHex(customerID)
	if err != nil {
		return
	}
	var cu models.Customer
	if err := customersCollection.FindOne(ctx, bson.M{"_id": oid}).Decode(&cu); err != nil {
		return
	}
	code = cu.CustomerCode
	var parts []string
	if cu.StreetAddress != "" {
		parts = append(parts, cu.StreetAddress)
	}
	if cu.City != "" {
		parts = append(parts, cu.City)
	}
	if cu.Country != "" {
		parts = append(parts, cu.Country)
	}
	address = strings.Join(parts, ", ")
	phone = cu.CustomerPhone
	if phone == "" {
		phone = cu.WorkPhone
	}
	trn = cu.TrnNumber
	return
}

// ── Purchase Order PDF ─────────────────────────────────────────────────────────

type poExtras struct{ vendorCode, vendorAddress, vendorPhone, vendorTRN string }

func buildPurchaseOrderPDF(po models.PurchaseOrder, ex poExtras) *gofpdf.Fpdf {
	items := make([]models.InvoiceLineItem, len(po.Items))
	for i, it := range po.Items {
		gross := it.Quantity * it.Rate
		items[i] = models.InvoiceLineItem{
			Desc: it.Details, Qty: it.Quantity, UnitPrice: it.Rate,
			DiscAmt: gross - it.BaseAmount, TaxRate: it.TaxRate,
			Subtotal: it.BaseAmount, Total: it.Amount,
		}
	}
	var extra []lhDocTotalRow
	if po.ShippingCharges != 0 {
		extra = append(extra, lhDocTotalRow{"Shipping Charges", po.ShippingCharges})
	}
	if po.Adjustment != 0 {
		extra = append(extra, lhDocTotalRow{"Adjustment", po.Adjustment})
	}
	return buildLetterheadDocPDF(lhDocData{
		OrgID:       po.OrgID,
		DocLabel:    "PURCHASE ORDER",
		ValueLabel:  "Purchase Order",
		RefPrefix:   "PO",
		NumberLabel: "PO NUMBER",
		RefNumber:   po.OrderNumber,
		RefDate:     po.OrderDate.Format("02/01/2006"),
		Party: lhDocParty{
			Label: "SUPPLIER", Code: ex.vendorCode, Name: po.VendorName,
			Address: ex.vendorAddress, Phone: ex.vendorPhone, TRN: ex.vendorTRN,
		},
		RelatedInfo: [][2]string{
			{"Currency", "AED"},
			{"Expected By", fmtDatePtr(po.ExpectedDeliveryDate)},
			{"Payment Terms", po.PaymentTerms},
			{"Reference No", po.ReferenceNo},
			{"Deliver To", po.DeliveryAddress},
			{"LPO Number", po.LPONumber},
		},
		Items:      items,
		Currency:   "AED",
		ProdNet:    po.SubTotal,
		ExtraRows:  extra,
		TaxTotal:   po.TotalTax,
		GrandTotal: po.Total,
		Notes:      po.CustomerNotes,
	})
}

func writePurchaseOrderPDF(c *gin.Context, inline bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	orgID, _ := c.Get("orgId")
	objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid purchase order ID"})
		return
	}
	var po models.PurchaseOrder
	if err := purchaseOrderCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&po); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Purchase order not found"})
		return
	}
	var ex poExtras
	if po.VendorID != "" {
		ex.vendorCode, ex.vendorAddress, ex.vendorPhone, ex.vendorTRN = loadVendorInfo(ctx, po.VendorID)
	}
	pdf := buildPurchaseOrderPDF(po, ex)
	pdfWatermark(pdf, watermarkFor(po.Status))
	disposition := "attachment"
	if inline {
		disposition = "inline"
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", disposition+`; filename="po-`+po.OrderNumber+`.pdf"`)
	if err := pdf.Output(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
	}
}

func DownloadPurchaseOrderPDF() gin.HandlerFunc {
	return func(c *gin.Context) { writePurchaseOrderPDF(c, false) }
}
func PreviewPurchaseOrderPDF() gin.HandlerFunc {
	return func(c *gin.Context) { writePurchaseOrderPDF(c, true) }
}

// ── Bill PDF ───────────────────────────────────────────────────────────────────

type billExtras struct{ vendorCode, vendorAddress, vendorPhone string }

func buildBillPDF(b models.Bill, ex billExtras) *gofpdf.Fpdf {
	items := make([]models.InvoiceLineItem, len(b.LineItems))
	for i, it := range b.LineItems {
		items[i] = models.InvoiceLineItem{
			Desc: it.Description, Qty: it.Qty, UnitPrice: it.UnitPrice,
			DiscAmt: it.DiscountAmt, TaxRate: it.TaxRate,
			Subtotal: it.Subtotal, Total: it.Total,
		}
	}
	currency := b.Currency
	if currency == "" {
		currency = "AED"
	}
	var extra []lhDocTotalRow
	if b.Totals.Shipping != 0 {
		extra = append(extra, lhDocTotalRow{"Shipping Charges", b.Totals.Shipping})
	}
	if b.Totals.Adjustment != 0 {
		extra = append(extra, lhDocTotalRow{"Adjustment", b.Totals.Adjustment})
	}
	return buildLetterheadDocPDF(lhDocData{
		OrgID:       b.OrgID,
		DocLabel:    "VENDOR BILL",
		ValueLabel:  "Bill",
		RefPrefix:   "Bill",
		NumberLabel: "BILL NUMBER",
		RefNumber:   b.BillNumber,
		RefDate:     fmtDateDMY(b.BillDate),
		Party: lhDocParty{
			Label: "VENDOR", Code: ex.vendorCode, Name: b.VendorName,
			Address: ex.vendorAddress, Phone: ex.vendorPhone, TRN: b.VendorTRN,
		},
		RelatedInfo: [][2]string{
			{"Currency", currency},
			{"Due Date", fmtDateDMY(b.DueDate)},
			{"Vendor Ref", b.VendorRef},
			{"PO Number", b.PONumber},
			{"GRN Number", b.GRNNumber},
			{"Payment Terms", b.PaymentTerms},
		},
		Items:      items,
		Currency:   currency,
		ProdNet:    b.Totals.Subtotal,
		ExtraRows:  extra,
		TaxTotal:   b.Totals.TaxTotal,
		GrandTotal: b.Totals.GrandTotal,
		AmountPaid: b.AmountPaid,
		BalanceDue: b.BalanceDue,
		Notes:      b.Notes,
	})
}

func writeBillPDF(c *gin.Context, inline bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	orgID, _ := c.Get("orgId")
	objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid bill ID"})
		return
	}
	var b models.Bill
	if err := billCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&b); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Bill not found"})
		return
	}
	var ex billExtras
	if b.VendorID != "" {
		ex.vendorCode, ex.vendorAddress, ex.vendorPhone, _ = loadVendorInfo(ctx, b.VendorID)
	}
	pdf := buildBillPDF(b, ex)
	pdfWatermark(pdf, watermarkFor(b.Status))
	disposition := "attachment"
	if inline {
		disposition = "inline"
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", disposition+`; filename="bill-`+b.BillNumber+`.pdf"`)
	if err := pdf.Output(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
	}
}

func DownloadBillPDF() gin.HandlerFunc {
	return func(c *gin.Context) { writeBillPDF(c, false) }
}
func PreviewBillPDF() gin.HandlerFunc {
	return func(c *gin.Context) { writeBillPDF(c, true) }
}

// PublicBillPDF serves the same PDF for the unauthenticated public share link —
// keyed by the bill's random token, not id+org. Always inline.
func PublicBillPDF() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		token := c.Param("token")
		if token == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid token"})
			return
		}

		var b models.Bill
		if err := billCollection.FindOne(ctx, bson.M{"publicToken": token}).Decode(&b); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Bill not found"})
			return
		}

		var ex billExtras
		if b.VendorID != "" {
			ex.vendorCode, ex.vendorAddress, ex.vendorPhone, _ = loadVendorInfo(ctx, b.VendorID)
		}
		pdf := buildBillPDF(b, ex)
		pdfWatermark(pdf, watermarkFor(b.Status))

		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", `inline; filename="bill-`+b.BillNumber+`.pdf"`)
		if err := pdf.Output(c.Writer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
		}
	}
}

// ── Sales Order PDF ────────────────────────────────────────────────────────────

type soExtras struct{ custCode, custAddress, custPhone, custTRN string }

func buildSalesOrderPDF(so models.SalesOrder, ex soExtras) *gofpdf.Fpdf {
	items := make([]models.InvoiceLineItem, len(so.Items))
	for i, it := range so.Items {
		gross := it.Quantity * it.Rate
		items[i] = models.InvoiceLineItem{
			Desc: it.Details, Qty: it.Quantity, UnitPrice: it.Rate,
			DiscAmt: gross - it.Amount, TaxRate: 0,
			Subtotal: it.Amount, Total: it.Amount,
		}
	}
	var extra []lhDocTotalRow
	if so.ShippingCharges != 0 {
		extra = append(extra, lhDocTotalRow{"Shipping Charges", so.ShippingCharges})
	}
	if so.Adjustment != 0 {
		extra = append(extra, lhDocTotalRow{"Adjustment", so.Adjustment})
	}
	return buildLetterheadDocPDF(lhDocData{
		OrgID:       so.OrgID,
		DocLabel:    "SALES ORDER",
		ValueLabel:  "Sales Order",
		RefPrefix:   "SO",
		NumberLabel: "SO NUMBER",
		RefNumber:   so.OrderNumber,
		RefDate:     so.OrderDate.Format("02/01/2006"),
		Party: lhDocParty{
			Label: "CUSTOMER", Code: ex.custCode, Name: so.CustomerName,
			Address: ex.custAddress, Phone: ex.custPhone, TRN: ex.custTRN,
		},
		RelatedInfo: [][2]string{
			{"Currency", "AED"},
			{"Expected Ship", fmtDatePtr(so.ExpectedShipmentDate)},
			{"Payment Terms", so.PaymentTerms},
			{"LPO Number", so.LpoNumber},
			{"Salesperson", so.Salesperson},
			{"Sales Type", so.SalesType},
		},
		Items:      items,
		Currency:   "AED",
		ProdNet:    so.SubTotal,
		ExtraRows:  extra,
		TaxTotal:   so.VAT,
		GrandTotal: so.Total,
		Notes:      so.CustomerNotes,
	})
}

func writeSalesOrderPDF(c *gin.Context, inline bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	orgID, _ := c.Get("orgId")
	objectID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid sales order ID"})
		return
	}
	var so models.SalesOrder
	if err := salesOrdersCollection.FindOne(ctx, bson.M{"_id": objectID, "orgId": orgID}).Decode(&so); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Sales order not found"})
		return
	}
	var ex soExtras
	if so.CustomerID != "" {
		ex.custCode, ex.custAddress, ex.custPhone, ex.custTRN = loadCustomerInfo(ctx, so.CustomerID)
	}
	pdf := buildSalesOrderPDF(so, ex)
	pdfWatermark(pdf, watermarkFor(so.Status))
	disposition := "attachment"
	if inline {
		disposition = "inline"
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", disposition+`; filename="so-`+so.OrderNumber+`.pdf"`)
	if err := pdf.Output(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "PDF generation failed"})
	}
}

func DownloadSalesOrderPDF() gin.HandlerFunc {
	return func(c *gin.Context) { writeSalesOrderPDF(c, false) }
}
func PreviewSalesOrderPDF() gin.HandlerFunc {
	return func(c *gin.Context) { writeSalesOrderPDF(c, true) }
}
