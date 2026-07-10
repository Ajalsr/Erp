package models

// TransactionRow is the normalized shape every transaction type is mapped into
// for export — same columns regardless of source collection, so every sheet in
// the exported workbook reads consistently.
type TransactionRow struct {
	Date   string  `json:"date"`
	RefNo  string  `json:"refNo"`
	Party  string  `json:"party"`
	Amount float64 `json:"amount"`
	Status string  `json:"status"`
	Notes  string  `json:"notes"`
}
