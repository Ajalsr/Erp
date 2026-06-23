package controllers

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ── Returns: GL + inventory side-effects ─────────────────────────────────────
//
// A return mirrors the original transaction in reverse:
//
//   Sales return (Credit Note, return_of_goods)
//     Revenue leg : Dr Revenue 4000 + Dr VAT Payable 2100  →  Cr Accounts Receivable 1100
//     Cost leg    : restock items + Dr Inventory 1200      →  Cr COGS 5000   (at item cost)
//
//   Purchase return (Debit Note)
//     Dr Accounts Payable 2000  →  Cr Inventory 1200 + Cr VAT Input 5500
//
// Both are guarded by a glPosted flag so create/approve/void never double-post.

func descKey(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

// restockReturnedGoods puts returned goods back on hand (default warehouse) and writes
// an audit row. Returns the COGS value to reverse (Σ qty × item cost).
func restockReturnedGoods(ctx context.Context, orgID, reference, reason string, lines []models.CNLineItem, srcInvoiceID string) float64 {
	if srcInvoiceID == "" {
		return 0
	}
	invOID, err := primitive.ObjectIDFromHex(srcInvoiceID)
	if err != nil {
		return 0
	}
	var inv models.Invoice
	if invoiceCollection.FindOne(ctx, bson.M{"_id": invOID, "orgId": orgID}).Decode(&inv) != nil {
		return 0
	}
	// Map source invoice goods lines by description → stockId (the CN lines carry no
	// stockId of their own, so we resolve them against the invoice they credit).
	stockByDesc := map[string]string{}
	for _, li := range inv.LineItems {
		if li.StockID != "" && li.LineItemType != "expense" {
			stockByDesc[descKey(li.Desc)] = li.StockID
		}
	}

	defWh, _ := defaultWarehouse(ctx, orgID)
	totalCOGS := 0.0
	for _, ln := range lines {
		if ln.Qty <= 0 {
			continue
		}
		stockID := stockByDesc[descKey(ln.Description)]
		if stockID == "" {
			continue
		}
		itemObjID, e := primitive.ObjectIDFromHex(stockID)
		if e != nil {
			continue
		}
		var stock models.Stock
		if stockCollection.FindOne(ctx, bson.M{"_id": itemObjID, "orgId": orgID}).Decode(&stock) != nil {
			continue
		}
		cur, unitCost := 0.0, 0.0
		fmt.Sscanf(stock.Quantity, "%f", &cur)
		fmt.Sscanf(stock.CostPrice, "%f", &unitCost)
		newQty := cur + ln.Qty
		whMap := addToWarehouse(seedWarehouseMap(stock.WarehouseStock, cur, defWh), defWh, ln.Qty)
		stockCollection.UpdateOne(ctx,
			bson.M{"_id": itemObjID, "orgId": orgID},
			bson.M{"$set": bson.M{"quantity": fmt.Sprintf("%g", newQty), "warehouseStock": whMap, "updated_at": time.Now()}},
		)
		adjustmentCollection.InsertOne(ctx, models.StockAdjustment{
			ID:          primitive.NewObjectID(),
			OrgID:       orgID,
			ItemID:      stockID,
			ItemName:    ln.Description,
			Quantity:    ln.Qty,
			Type:        "increase",
			Reason:      reason,
			Reference:   reference,
			PreviousQty: cur,
			NewQty:      newQty,
			AdjustedAt:  time.Now(),
			CreatedAt:   time.Now(),
		})
		totalCOGS += ln.Qty * unitCost
	}
	return round2(totalCOGS)
}

// postCreditNoteGL posts the sales-return journal entry (+ restock for return_of_goods)
// once. No-op if already posted. Safe to call from create/approve.
func postCreditNoteGL(ctx context.Context, orgID, cnID string) {
	objID, err := primitive.ObjectIDFromHex(cnID)
	if err != nil {
		return
	}
	var cn models.CreditNote
	if creditNoteCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&cn) != nil {
		return
	}
	if cn.GLPosted || cn.Status == "void" || cn.Status == "draft" || cn.Totals.GrandTotal <= 0 {
		return
	}

	// Revenue reversal: Dr Revenue + Dr VAT  →  Cr Accounts Receivable.
	lines := []jeLineInput{
		{AccountCode: "4000", Debit: round2(cn.Totals.Subtotal)},
		{AccountCode: "2100", Debit: round2(cn.Totals.VATTotal)},
		{AccountCode: "1100", Credit: round2(cn.Totals.GrandTotal)},
	}
	autoJE(orgID, "credit_note", cn.ID, cn.CreditNoteNumber, cn.Date,
		"Sales return - "+cn.CreditNoteNumber, lines)

	// Cost reversal — only when goods physically come back.
	if cn.CnType == "return_of_goods" {
		cogs := restockReturnedGoods(ctx, orgID, cn.CreditNoteNumber, "sales_return", cn.LineItems, cn.SourceDocID)
		if cogs > 0 {
			autoJE(orgID, "credit_note", cn.ID, cn.CreditNoteNumber, cn.Date,
				"Sales return cost - "+cn.CreditNoteNumber,
				[]jeLineInput{
					{AccountCode: "1200", Debit: cogs},
					{AccountCode: "5000", Credit: cogs},
				})
		}
	}

	creditNoteCollection.UpdateOne(ctx, bson.M{"_id": objID},
		bson.M{"$set": bson.M{"glPosted": true, "updatedAt": time.Now()}})
}

// reverseCreditNoteGL backs out a posted sales return (used on void): swaps the
// revenue legs and removes the restocked goods again.
func reverseCreditNoteGL(ctx context.Context, orgID string, cn models.CreditNote) {
	if !cn.GLPosted {
		return
	}
	autoJE(orgID, "credit_note_void", cn.ID, cn.CreditNoteNumber, time.Now().Format("2006-01-02"),
		"Sales return void - "+cn.CreditNoteNumber,
		[]jeLineInput{
			{AccountCode: "1100", Debit: round2(cn.Totals.GrandTotal)},
			{AccountCode: "4000", Credit: round2(cn.Totals.Subtotal)},
			{AccountCode: "2100", Credit: round2(cn.Totals.VATTotal)},
		})

	if cn.CnType == "return_of_goods" {
		// Remove the goods we put back (negative qty restock = deduct), reversing COGS.
		neg := make([]models.CNLineItem, len(cn.LineItems))
		for i, l := range cn.LineItems {
			neg[i] = l
			neg[i].Qty = -l.Qty
		}
		cogs := restockReturnedGoods(ctx, orgID, cn.CreditNoteNumber, "sales_return_void", neg, cn.SourceDocID)
		if cogs < 0 {
			autoJE(orgID, "credit_note_void", cn.ID, cn.CreditNoteNumber, time.Now().Format("2006-01-02"),
				"Sales return void cost - "+cn.CreditNoteNumber,
				[]jeLineInput{
					{AccountCode: "5000", Debit: -cogs},
					{AccountCode: "1200", Credit: -cogs},
				})
		}
	}
}

// movePurchaseReturnStock takes returned goods out of stock (deduct=true) or puts them
// back on a void (deduct=false). The debit-note lines carry no stockId, so we trace
//
//	debit note → source bill → its GRN → received items (stockId + receiving warehouse)
//
// and match by description. No-op when the bill isn't GRN-linked or nothing matches.
func movePurchaseReturnStock(ctx context.Context, orgID, reference, reason string, lines []models.CNLineItem, billID string, deduct bool) {
	if billID == "" {
		return
	}
	billOID, err := primitive.ObjectIDFromHex(billID)
	if err != nil {
		return
	}
	var bill models.Bill
	if billCollection.FindOne(ctx, bson.M{"_id": billOID, "orgId": orgID}).Decode(&bill) != nil || bill.GRNID == "" {
		return
	}
	grnOID, err := primitive.ObjectIDFromHex(bill.GRNID)
	if err != nil {
		return
	}
	var grn models.GRN
	if grnCollection.FindOne(ctx, bson.M{"_id": grnOID, "orgId": orgID}).Decode(&grn) != nil {
		return
	}

	// Map GRN received items by description → stockId (+ the warehouse they landed in).
	type recv struct{ stockID, wh string }
	byDesc := map[string]recv{}
	for _, it := range grn.Items {
		if it.ItemID != "" {
			byDesc[descKey(it.Details)] = recv{it.ItemID, grn.WarehouseID}
		}
	}

	defWh, _ := defaultWarehouse(ctx, orgID)
	for _, ln := range lines {
		if ln.Qty <= 0 {
			continue
		}
		r, ok := byDesc[descKey(ln.Description)]
		if !ok || r.stockID == "" {
			continue
		}
		itemObjID, e := primitive.ObjectIDFromHex(r.stockID)
		if e != nil {
			continue
		}
		var stock models.Stock
		if stockCollection.FindOne(ctx, bson.M{"_id": itemObjID, "orgId": orgID}).Decode(&stock) != nil {
			continue
		}
		cur := 0.0
		fmt.Sscanf(stock.Quantity, "%f", &cur)

		wh := r.wh
		if wh == "" {
			wh = defWh
		}
		delta := ln.Qty
		adjType := "decrease"
		if deduct {
			delta = -ln.Qty
		} else {
			adjType = "increase"
		}
		newQty := cur + delta
		if newQty < 0 {
			newQty = 0
		}
		whMap := seedWarehouseMap(stock.WarehouseStock, cur, defWh)
		newWh := whMap[wh] + delta
		if newWh < 0 {
			newWh = 0
		}
		whMap[wh] = newWh

		stockCollection.UpdateOne(ctx,
			bson.M{"_id": itemObjID, "orgId": orgID},
			bson.M{"$set": bson.M{"quantity": fmt.Sprintf("%g", newQty), "warehouseStock": whMap, "updated_at": time.Now()}},
		)
		adjustmentCollection.InsertOne(ctx, models.StockAdjustment{
			ID:          primitive.NewObjectID(),
			OrgID:       orgID,
			ItemID:      r.stockID,
			ItemName:    ln.Description,
			Quantity:    ln.Qty,
			Type:        adjType,
			Reason:      reason,
			Reference:   reference,
			PreviousQty: cur,
			NewQty:      newQty,
			AdjustedAt:  time.Now(),
			CreatedAt:   time.Now(),
		})
	}
}

// postDebitNoteGL posts the purchase-return journal entry once.
//
//	Dr Accounts Payable 2000  →  Cr Inventory 1200 + Cr VAT Input 5500
//
// Note: goods are credited to Inventory (1200) on the assumption the original bill
// capitalised them there (GRN-linked goods). Non-inventory expense returns would need
// a different credit account — handle via a manual journal entry for now.
func postDebitNoteGL(ctx context.Context, orgID, dnID string) {
	objID, err := primitive.ObjectIDFromHex(dnID)
	if err != nil {
		return
	}
	var dn models.DebitNote
	if debitNoteCollection.FindOne(ctx, bson.M{"_id": objID, "orgId": orgID}).Decode(&dn) != nil {
		return
	}
	if dn.GLPosted || dn.Status == "void" || dn.Status == "draft" || dn.Totals.GrandTotal <= 0 {
		return
	}

	autoJE(orgID, "debit_note", dn.ID, dn.DebitNoteNumber, dn.Date,
		"Purchase return - "+dn.DebitNoteNumber,
		[]jeLineInput{
			{AccountCode: "2000", Debit: round2(dn.Totals.GrandTotal)},
			{AccountCode: "1200", Credit: round2(dn.Totals.Subtotal)},
			{AccountCode: "5500", Credit: round2(dn.Totals.VATTotal)},
		})

	// Take the returned goods out of stock, traced through the bill's GRN.
	movePurchaseReturnStock(ctx, orgID, dn.DebitNoteNumber, "purchase_return", dn.LineItems, dn.SourceDocID, true)

	debitNoteCollection.UpdateOne(ctx, bson.M{"_id": objID},
		bson.M{"$set": bson.M{"glPosted": true, "updatedAt": time.Now()}})
}

// reverseDebitNoteGL backs out a posted purchase return (used on void).
func reverseDebitNoteGL(ctx context.Context, orgID string, dn models.DebitNote) {
	if !dn.GLPosted {
		return
	}
	autoJE(orgID, "debit_note_void", dn.ID, dn.DebitNoteNumber, time.Now().Format("2006-01-02"),
		"Purchase return void - "+dn.DebitNoteNumber,
		[]jeLineInput{
			{AccountCode: "1200", Debit: round2(dn.Totals.Subtotal)},
			{AccountCode: "5500", Debit: round2(dn.Totals.VATTotal)},
			{AccountCode: "2000", Credit: round2(dn.Totals.GrandTotal)},
		})

	// Put the returned goods back on hand.
	movePurchaseReturnStock(ctx, orgID, dn.DebitNoteNumber, "purchase_return_void", dn.LineItems, dn.SourceDocID, false)
}
