package controllers

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"go.mongodb.org/mongo-driver/bson"
)

// exportFetchFn returns the normalized rows for one transaction type, scoped to
// one org and a date range (both "2006-01-02" strings, inclusive on both ends).
type exportFetchFn func(ctx context.Context, orgID, startDate, endDate string) ([]models.TransactionRow, error)

type exportTypeDef struct {
	Label string
	Fetch exportFetchFn
}

// exportEndOfDay parses "2006-01-02" and returns the instant just past the end
// of that day, so a $lt comparison against a time.Time field includes every
// document dated on endDate.
func exportEndOfDay(dateStr string) time.Time {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return time.Now().AddDate(0, 0, 1)
	}
	return t.AddDate(0, 0, 1)
}

func exportStartOfDay(dateStr string) time.Time {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return time.Time{}
	}
	return t
}

// exportRegistry is the single source of truth for which transaction types can
// be exported — the frontend's checkbox list is populated straight from
// GET /api/export/types, so there is nothing to keep in sync by hand.
var exportRegistry = map[string]exportTypeDef{
	"invoice": {
		Label: "Invoices",
		Fetch: func(ctx context.Context, orgID, startDate, endDate string) ([]models.TransactionRow, error) {
			cur, err := invoiceCollection.Find(ctx, bson.M{
				"orgId": orgID, "issueDate": bson.M{"$gte": startDate, "$lte": endDate},
			})
			if err != nil {
				return nil, err
			}
			var docs []models.Invoice
			if err := cur.All(ctx, &docs); err != nil {
				return nil, err
			}
			rows := make([]models.TransactionRow, len(docs))
			for i, d := range docs {
				rows[i] = models.TransactionRow{
					Date: d.IssueDate, RefNo: d.InvoiceNumber, Party: d.BillTo.Name,
					Amount: d.Totals.GrandTotal, Status: d.Status, Notes: d.Notes.Customer,
				}
			}
			return rows, nil
		},
	},
	"bill": {
		Label: "Bills",
		Fetch: func(ctx context.Context, orgID, startDate, endDate string) ([]models.TransactionRow, error) {
			cur, err := billCollection.Find(ctx, bson.M{
				"orgId": orgID, "billDate": bson.M{"$gte": startDate, "$lte": endDate},
			})
			if err != nil {
				return nil, err
			}
			var docs []models.Bill
			if err := cur.All(ctx, &docs); err != nil {
				return nil, err
			}
			rows := make([]models.TransactionRow, len(docs))
			for i, d := range docs {
				rows[i] = models.TransactionRow{
					Date: d.BillDate, RefNo: d.BillNumber, Party: d.VendorName,
					Amount: d.Totals.GrandTotal, Status: d.Status, Notes: d.Notes,
				}
			}
			return rows, nil
		},
	},
	"credit_note": {
		Label: "Credit Notes",
		Fetch: func(ctx context.Context, orgID, startDate, endDate string) ([]models.TransactionRow, error) {
			cur, err := creditNoteCollection.Find(ctx, bson.M{
				"orgId": orgID, "date": bson.M{"$gte": startDate, "$lte": endDate},
			})
			if err != nil {
				return nil, err
			}
			var docs []models.CreditNote
			if err := cur.All(ctx, &docs); err != nil {
				return nil, err
			}
			rows := make([]models.TransactionRow, len(docs))
			for i, d := range docs {
				rows[i] = models.TransactionRow{
					Date: d.Date, RefNo: d.CreditNoteNumber, Party: d.CustomerName,
					Amount: d.Totals.GrandTotal, Status: d.Status, Notes: d.Notes,
				}
			}
			return rows, nil
		},
	},
	"debit_note": {
		Label: "Debit Notes",
		Fetch: func(ctx context.Context, orgID, startDate, endDate string) ([]models.TransactionRow, error) {
			cur, err := debitNoteCollection.Find(ctx, bson.M{
				"orgId": orgID, "date": bson.M{"$gte": startDate, "$lte": endDate},
			})
			if err != nil {
				return nil, err
			}
			var docs []models.DebitNote
			if err := cur.All(ctx, &docs); err != nil {
				return nil, err
			}
			rows := make([]models.TransactionRow, len(docs))
			for i, d := range docs {
				rows[i] = models.TransactionRow{
					Date: d.Date, RefNo: d.DebitNoteNumber, Party: d.VendorName,
					Amount: d.Totals.GrandTotal, Status: d.Status, Notes: d.Notes,
				}
			}
			return rows, nil
		},
	},
	"payment_received": {
		Label: "Payments Received",
		Fetch: func(ctx context.Context, orgID, startDate, endDate string) ([]models.TransactionRow, error) {
			cur, err := paymentCollection.Find(ctx, bson.M{
				"orgId": orgID, "date": bson.M{"$gte": startDate, "$lte": endDate},
			})
			if err != nil {
				return nil, err
			}
			var docs []models.Payment
			if err := cur.All(ctx, &docs); err != nil {
				return nil, err
			}
			rows := make([]models.TransactionRow, len(docs))
			for i, d := range docs {
				status := "received"
				if d.IsRefunded {
					status = "refunded"
				}
				rows[i] = models.TransactionRow{
					Date: d.Date, RefNo: d.PaymentNumber, Party: d.CustomerName,
					Amount: d.Amount, Status: status, Notes: d.Notes,
				}
			}
			return rows, nil
		},
	},
	"payment_made": {
		Label: "Payments Made",
		Fetch: func(ctx context.Context, orgID, startDate, endDate string) ([]models.TransactionRow, error) {
			cur, err := vendorPaymentCollection.Find(ctx, bson.M{
				"orgId": orgID, "date": bson.M{"$gte": startDate, "$lte": endDate},
			})
			if err != nil {
				return nil, err
			}
			var docs []models.VendorPayment
			if err := cur.All(ctx, &docs); err != nil {
				return nil, err
			}
			rows := make([]models.TransactionRow, len(docs))
			for i, d := range docs {
				status := "paid"
				if d.IsReversed {
					status = "reversed"
				}
				rows[i] = models.TransactionRow{
					Date: d.Date, RefNo: d.PaymentNumber, Party: d.VendorName,
					Amount: d.Amount, Status: status, Notes: d.Notes,
				}
			}
			return rows, nil
		},
	},
	"sales_order": {
		Label: "Sales Orders",
		Fetch: func(ctx context.Context, orgID, startDate, endDate string) ([]models.TransactionRow, error) {
			cur, err := salesOrdersCollection.Find(ctx, bson.M{
				"orgId": orgID, "orderDate": bson.M{"$gte": exportStartOfDay(startDate), "$lt": exportEndOfDay(endDate)},
			})
			if err != nil {
				return nil, err
			}
			var docs []models.SalesOrder
			if err := cur.All(ctx, &docs); err != nil {
				return nil, err
			}
			rows := make([]models.TransactionRow, len(docs))
			for i, d := range docs {
				rows[i] = models.TransactionRow{
					Date: d.OrderDate.Format("2006-01-02"), RefNo: d.OrderNumber, Party: d.CustomerName,
					Amount: d.Total, Status: d.Status, Notes: d.CustomerNotes,
				}
			}
			return rows, nil
		},
	},
	"purchase_order": {
		Label: "Purchase Orders",
		Fetch: func(ctx context.Context, orgID, startDate, endDate string) ([]models.TransactionRow, error) {
			cur, err := purchaseOrderCollection.Find(ctx, bson.M{
				"orgId": orgID, "orderDate": bson.M{"$gte": exportStartOfDay(startDate), "$lt": exportEndOfDay(endDate)},
			})
			if err != nil {
				return nil, err
			}
			var docs []models.PurchaseOrder
			if err := cur.All(ctx, &docs); err != nil {
				return nil, err
			}
			rows := make([]models.TransactionRow, len(docs))
			for i, d := range docs {
				rows[i] = models.TransactionRow{
					Date: d.OrderDate.Format("2006-01-02"), RefNo: d.OrderNumber, Party: d.VendorName,
					Amount: d.Total, Status: d.Status, Notes: d.CustomerNotes,
				}
			}
			return rows, nil
		},
	},
	"quote": {
		Label: "Quotes",
		Fetch: func(ctx context.Context, orgID, startDate, endDate string) ([]models.TransactionRow, error) {
			cur, err := quoteCollection.Find(ctx, bson.M{
				"orgId": orgID, "createdAt": bson.M{"$gte": exportStartOfDay(startDate), "$lt": exportEndOfDay(endDate)},
			})
			if err != nil {
				return nil, err
			}
			var docs []models.Quote
			if err := cur.All(ctx, &docs); err != nil {
				return nil, err
			}
			rows := make([]models.TransactionRow, len(docs))
			for i, d := range docs {
				rows[i] = models.TransactionRow{
					Date: d.CreatedAt.Format("2006-01-02"), RefNo: d.QuoteNumber, Party: d.CustomerName,
					Amount: d.Totals.GrandTotal, Status: d.Status,
				}
			}
			return rows, nil
		},
	},
}

// GetExportTypes — GET /api/export/types. Single source of truth for the
// frontend's checkbox list, sorted for a stable display order.
func GetExportTypes() gin.HandlerFunc {
	return func(c *gin.Context) {
		keys := make([]string, 0, len(exportRegistry))
		for k := range exportRegistry {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		out := make([]gin.H, 0, len(keys))
		for _, k := range keys {
			out = append(out, gin.H{"value": k, "label": exportRegistry[k].Label})
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": out})
	}
}

type exportRequest struct {
	Types     []string `json:"types"`
	StartDate string   `json:"startDate"`
	EndDate   string   `json:"endDate"`
}

func (r exportRequest) validate() error {
	if len(r.Types) == 0 {
		return fmt.Errorf("select at least one transaction type")
	}
	for _, t := range r.Types {
		if _, ok := exportRegistry[t]; !ok {
			return fmt.Errorf("unknown transaction type: %s", t)
		}
	}
	if _, err := time.Parse("2006-01-02", r.StartDate); err != nil {
		return fmt.Errorf("invalid startDate")
	}
	if _, err := time.Parse("2006-01-02", r.EndDate); err != nil {
		return fmt.Errorf("invalid endDate")
	}
	if r.EndDate < r.StartDate {
		return fmt.Errorf("endDate must be on or after startDate")
	}
	return nil
}

// fetchExportRows runs the requested types' fetchers for the caller's org,
// scoped by orgId — orgID always comes from the auth context, never the
// request body, so an export can never cross a tenant boundary.
func fetchExportRows(ctx context.Context, orgID string, req exportRequest) (map[string][]models.TransactionRow, error) {
	out := make(map[string][]models.TransactionRow, len(req.Types))
	for _, t := range req.Types {
		def := exportRegistry[t]
		rows, err := def.Fetch(ctx, orgID, req.StartDate, req.EndDate)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", t, err)
		}
		out[t] = rows
	}
	return out, nil
}

// PreviewExportCount — GET /api/export/preview-count?types=a,b&startDate=&endDate=
func PreviewExportCount() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		req := exportRequest{
			Types:     splitCSV(c.Query("types")),
			StartDate: c.Query("startDate"),
			EndDate:   c.Query("endDate"),
		}
		if err := req.validate(); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
			return
		}
		byType, err := fetchExportRows(ctx, orgID, req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to count records", "error": err.Error()})
			return
		}
		total := 0
		counts := gin.H{}
		var amountTotal float64
		for t, rows := range byType {
			counts[t] = len(rows)
			total += len(rows)
			for _, r := range rows {
				amountTotal += r.Amount
			}
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": gin.H{"total": total, "byType": counts, "amountTotal": amountTotal}})
	}
}

func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	var out []string
	cur := ""
	for _, ch := range s {
		if ch == ',' {
			if cur != "" {
				out = append(out, cur)
			}
			cur = ""
		} else {
			cur += string(ch)
		}
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}

// ExportTransactions — POST /api/export/transactions. Body: {types, startDate,
// endDate}. Builds one sheet per selected type plus a Summary sheet, bold +
// frozen header rows, and streams the workbook as an attachment.
func ExportTransactions() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		var req exportRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body"})
			return
		}
		if err := req.validate(); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
			return
		}

		byType, err := fetchExportRows(ctx, orgID, req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch records", "error": err.Error()})
			return
		}

		totalRows := 0
		for _, rows := range byType {
			totalRows += len(rows)
		}
		if totalRows == 0 {
			c.JSON(http.StatusNotFound, gin.H{"message": "No transactions found for the selected types and date range"})
			return
		}
		const rowLimit = 100_000
		if totalRows > rowLimit {
			c.JSON(http.StatusBadRequest, gin.H{"message": fmt.Sprintf("%d rows matched — narrow the date range (limit %d)", totalRows, rowLimit)})
			return
		}

		xlsxBuf, err := buildTransactionWorkbook(req.Types, byType)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to build Excel file", "error": err.Error()})
			return
		}

		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="transactions_export.xlsx"`)
		c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsxBuf)
	}
}

var exportColumns = []string{"Date", "Ref No", "Party", "Amount", "Status", "Notes"}

// buildTransactionWorkbook renders one sheet per selected type (in the order the
// caller selected them) plus a Summary sheet (count + total amount per type).
// Header row is bold and frozen; columns are auto-widened to fit their content.
func buildTransactionWorkbook(types []string, byType map[string][]models.TransactionRow) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#F1F5F9"}, Pattern: 1},
	})
	if err != nil {
		return nil, err
	}

	// Summary sheet claims the default "Sheet1" slot immediately, so it's always
	// first in the workbook without needing to move sheets around afterward.
	summarySheet := "Summary"
	f.SetSheetName("Sheet1", summarySheet)

	amountByType := map[string]float64{}
	countByType := map[string]int{}

	for _, t := range types {
		rows := byType[t]
		def := exportRegistry[t]
		countByType[t] = len(rows)
		for _, r := range rows {
			amountByType[t] += r.Amount
		}
		if len(rows) == 0 {
			continue // omit empty sheets, same as the backup export
		}

		sheet := def.Label
		f.NewSheet(sheet)

		for i, h := range exportColumns {
			cell, _ := excelize.CoordinatesToCellName(i+1, 1)
			f.SetCellValue(sheet, cell, h)
		}
		f.SetRowStyle(sheet, 1, 1, headerStyle)
		f.SetPanes(sheet, &excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft"})

		for r, row := range rows {
			vals := []interface{}{row.Date, row.RefNo, row.Party, row.Amount, row.Status, row.Notes}
			for i, v := range vals {
				cell, _ := excelize.CoordinatesToCellName(i+1, r+2)
				f.SetCellValue(sheet, cell, v)
			}
		}
		autoFitColumns(f, sheet, len(exportColumns), rows)
	}

	f.SetCellValue(summarySheet, "A1", "Transaction Type")
	f.SetCellValue(summarySheet, "B1", "Count")
	f.SetCellValue(summarySheet, "C1", "Total Amount")
	f.SetRowStyle(summarySheet, 1, 1, headerStyle)
	row := 2
	var grandCount int
	var grandAmount float64
	for _, t := range types {
		def := exportRegistry[t]
		f.SetCellValue(summarySheet, fmt.Sprintf("A%d", row), def.Label)
		f.SetCellValue(summarySheet, fmt.Sprintf("B%d", row), countByType[t])
		f.SetCellValue(summarySheet, fmt.Sprintf("C%d", row), amountByType[t])
		grandCount += countByType[t]
		grandAmount += amountByType[t]
		row++
	}
	f.SetCellValue(summarySheet, fmt.Sprintf("A%d", row), "Total")
	f.SetCellValue(summarySheet, fmt.Sprintf("B%d", row), grandCount)
	f.SetCellValue(summarySheet, fmt.Sprintf("C%d", row), grandAmount)
	f.SetRowStyle(summarySheet, row, row, headerStyle)
	f.SetColWidth(summarySheet, "A", "A", 22)
	f.SetColWidth(summarySheet, "B", "C", 16)
	f.SetActiveSheet(0) // open on Summary

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// autoFitColumns widens each column to roughly fit its longest cell (header or
// value), capped so one huge notes field can't blow out the sheet width.
func autoFitColumns(f *excelize.File, sheet string, numCols int, rows []models.TransactionRow) {
	widths := make([]int, numCols)
	for i, h := range exportColumns {
		widths[i] = len(h)
	}
	for _, r := range rows {
		vals := []string{r.Date, r.RefNo, r.Party, fmt.Sprintf("%.2f", r.Amount), r.Status, r.Notes}
		for i, v := range vals {
			if l := len(v); l > widths[i] {
				widths[i] = l
			}
		}
	}
	for i, w := range widths {
		if w > 48 {
			w = 48
		}
		if w < 8 {
			w = 8
		}
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheet, col, col, float64(w+2))
	}
}
