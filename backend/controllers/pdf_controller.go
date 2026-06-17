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

	// Enrich related-info from the customer + first linked sales order, mirroring
	// the on-screen preview. Failures are non-fatal — the PDF just shows "-".
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
func loadOrgLetterhead(orgID string) (orgLetterhead, bool) {
	if v, ok := lhCache.Load(orgID); ok {
		if e := v.(lhEntry); time.Since(e.at) < lhCacheTTL {
			return e.lh, e.ok
		}
	}
	lh, ok := loadOrgLetterheadUncached(orgID)
	lhCache.Store(orgID, lhEntry{lh: lh, ok: ok, at: time.Now()})
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
	pdf.AliasNbPages("{nb}")
	pdf.SetFooterFunc(func() {
		pdf.SetY(297 - botMargin - 6)
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
	pdf.CellFormat(45, 4, tr(q.QuoteNumber), "", 0, "R", false, 0, "")
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
	pdf.CellFormat(85, 4.5, tr(toName), "", 0, "L", false, 0, "")
	ly += 5
	body()
	pdf.SetFont("Helvetica", "", 8.5)
	if q.BillTo.Address != "" {
		pdf.SetXY(x0+5, ly)
		pdf.MultiCell(85, 4.2, tr(q.BillTo.Address), "", "L", false)
		ly = pdf.GetY() + 1
	}
	if q.CustomerEmail != "" {
		pdf.SetXY(x0+5, ly)
		pdf.CellFormat(85, 4.2, tr(q.CustomerEmail), "", 0, "L", false, 0, "")
		ly += 5
	}
	if q.BillTo.TRN != "" {
		pdf.SetXY(x0+5, ly)
		pdf.CellFormat(85, 4.2, "TRN: "+tr(q.BillTo.TRN), "", 0, "L", false, 0, "")
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

	// Intro text
	if q.IntroText != "" {
		pdf.SetXY(x0+5, y+2.5)
		pdf.SetFont("Helvetica", "", 8.5)
		body()
		pdf.MultiCell(W-10, 4.4, tr(q.IntroText), "", "L", false)
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
	descX := x0 + cols[0].w + cols[1].w
	afterDescX := descX + cols[2].w

	drawItemsHeader := func() {
		pdf.SetXY(x0, y)
		pdf.SetFillColor(241, 245, 249)
		pdf.SetFont("Helvetica", "B", 8)
		navy()
		for _, c := range cols {
			pdf.CellFormat(c.w, 8, c.label, "", 0, c.align, true, 0, "")
		}
		pdf.Ln(-1)
		hline(pdf.GetY(), true)
		y = pdf.GetY()
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
			gross := item.Qty * item.UnitPrice
			net := item.Subtotal
			if net == 0 {
				net = gross - item.DiscAmt
			}
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
		y = by
		pdf.SetXY(x0, by)
	}
	for i := range q.LineItems {
		drawRow(&q.LineItems[i], i)
	}
	for i := len(q.LineItems); i < 3; i++ {
		drawRow(nil, i)
	}

	// Totals box
	breakIfNeeded(&y, 28)
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
		breakIfNeeded(&y, 14)
		hline(y, true)
		pdf.SetXY(x0+5, y+3)
		pdf.SetFont("Helvetica", "B", 9)
		navy()
		pdf.CellFormat(W, 4, "TERMS & CONDITIONS", "", 1, "L", false, 0, "")
		y = pdf.GetY() + 1
		pdf.SetFont("Helvetica", "", 8.5)
		body()
		for i, t := range terms {
			nLines := len(pdf.SplitText(t, W-16))
			if nLines < 1 {
				nLines = 1
			}
			h := float64(nLines)*4.4 + 1
			breakIfNeeded(&y, h)
			pdf.SetXY(x0+5, y)
			pdf.CellFormat(6, 4.4, fmt.Sprintf("%d", i+1), "", 0, "L", false, 0, "")
			pdf.SetXY(x0+11, y)
			pdf.MultiCell(W-16, 4.4, tr(t), "", "L", false)
			y = pdf.GetY() + 1
		}
		y += 2
	}

	// Notes
	noteLines := []string{}
	for _, n := range splitLines(q.Notes.Customer) {
		if strings.TrimSpace(n) != "" {
			noteLines = append(noteLines, strings.TrimSpace(n))
		}
	}
	if len(noteLines) > 0 {
		breakIfNeeded(&y, 12)
		hline(y, false)
		pdf.SetXY(x0+5, y+2.5)
		pdf.SetFont("Helvetica", "B", 8)
		muted()
		pdf.CellFormat(W, 4, "NOTES", "", 1, "L", false, 0, "")
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
			pdf.SetXY(x0+5, y)
			pdf.CellFormat(4, 4.4, "-", "", 0, "L", false, 0, "")
			pdf.SetXY(x0+9, y)
			pdf.MultiCell(W-14, 4.4, tr(n), "", "L", false)
			y = pdf.GetY() + 0.5
		}
		y += 2
	}

	// Signature block — keep it whole on one page.
	sigH := 38.0
	breakIfNeeded(&y, sigH+2)
	hline(y, true)
	sigY := y
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
	pdf.CellFormat(85, 4, "FOR "+tr(strings.ToUpper(senderName)), "", 0, "L", false, 0, "")
	if q.Signatory.Name != "" {
		pdf.SetXY(mid+5, sigY+18)
		pdf.SetFont("Helvetica", "B", 9)
		dark()
		pdf.CellFormat(85, 4.5, tr(q.Signatory.Name), "", 1, "L", false, 0, "")
	}
	if q.Signatory.Title != "" {
		pdf.SetX(mid + 5)
		pdf.SetFont("Helvetica", "", 8.5)
		body()
		pdf.CellFormat(85, 4.5, tr(q.Signatory.Title), "", 1, "L", false, 0, "")
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
