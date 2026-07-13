package controllers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var backupMetaCollection = config.GetCollection(config.DB, "backups")

const backupSlots = 30 // rolling window — day-of-month % 30

// listAllCollections returns every collection name in the app's database (same
// DB name config.GetCollection always targets: "ERP").
func listAllCollections(ctx context.Context) ([]string, error) {
	return config.DB.Database("ERP").ListCollectionNames(ctx, bson.M{})
}

// orgFilter matches a document belonging to orgID regardless of which BSON type
// that collection happens to store it as — some collections store orgId as a
// plain string, others (e.g. org_members) as an ObjectID. A collection with no
// orgId field at all (global/system collections) simply matches nothing, which
// correctly excludes it from an org-scoped backup.
func orgFilter(orgID string) bson.M {
	or := bson.A{bson.M{"orgId": orgID}}
	if oid, err := primitive.ObjectIDFromHex(orgID); err == nil {
		or = append(or, bson.M{"orgId": oid})
	}
	return bson.M{"$or": or}
}

// backupHour/backupMinute — fixed server-local clock time the daily backup runs at.
const backupHour, backupMinute = 2, 0 // 2:00 AM

// StartBackupScheduler runs an org-scoped backup for every organization every day
// at a fixed clock time (backupHour:backupMinute), not just "24h after whenever
// the server last started". Recomputes the next fire time each cycle (via
// time.AfterFunc) rather than a flat ticker, so it stays aligned across DST
// changes instead of slowly drifting.
//
// This backend runs as a desktop-app sidecar, not an always-on server — the
// process only exists while someone has the app open, so the 2AM firing time
// above only actually runs a backup on the rare day the app happens to be open
// at that exact instant. Every other day silently gets no backup at all, with
// nothing to notice or retry. catchUpMissedBackups covers that: on every
// startup, run any org's backup that isn't already done for today's slot,
// rather than waiting on a 2AM window that may never arrive.
func StartBackupScheduler() {
	go catchUpMissedBackups()

	var schedule func()
	schedule = func() {
		now := time.Now()
		next := time.Date(now.Year(), now.Month(), now.Day(), backupHour, backupMinute, 0, 0, now.Location())
		if !next.After(now) {
			next = next.AddDate(0, 0, 1)
		}
		time.AfterFunc(next.Sub(now), func() {
			runAllOrgBackups()
			schedule()
		})
	}
	schedule()
}

// catchUpMissedBackups runs once per process start. For each org, if today's
// rotation slot doesn't already have a successful backup uploaded today, it
// runs one now instead of leaving that day with no backup at all.
func catchUpMissedBackups() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cur, err := orgCollection.Find(ctx, bson.M{})
	if err != nil {
		log.Printf("[backup] catch-up: failed to list organizations: %v", err)
		return
	}
	var orgs []models.Organization
	cur.All(ctx, &orgs)
	cur.Close(ctx)

	now := time.Now()
	todaySlot := now.Day() % backupSlots
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	for _, org := range orgs {
		orgID := org.ID.Hex()
		var meta models.BackupMeta
		err := backupMetaCollection.FindOne(ctx, bson.M{"orgId": orgID, "slot": todaySlot}).Decode(&meta)
		if err == nil && meta.Status == "success" && !meta.UploadedAt.Before(todayStart) {
			continue // already backed up today
		}
		result, err := runBackupWithRetry(orgID)
		if err != nil {
			log.Printf("[backup] catch-up: org %s failed: %v", orgID, err)
			continue
		}
		log.Printf("[backup] catch-up: org %s slot %d saved — %d collections, %d bytes", orgID, result.Slot, result.Collections, result.SizeBytes)
	}
}

func runAllOrgBackups() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cur, err := orgCollection.Find(ctx, bson.M{})
	if err != nil {
		log.Printf("[backup] failed to list organizations: %v", err)
		return
	}
	var orgs []models.Organization
	cur.All(ctx, &orgs)
	cur.Close(ctx)

	for _, org := range orgs {
		orgID := org.ID.Hex()
		meta, err := runBackupWithRetry(orgID)
		if err != nil {
			log.Printf("[backup] org %s failed: %v", orgID, err)
			continue
		}
		log.Printf("[backup] org %s slot %d saved — %d collections, %d bytes", orgID, meta.Slot, meta.Collections, meta.SizeBytes)
	}
}

// runBackupWithRetry runs the backup once for one org; a failed Cloudinary
// upload gets one retry before the failure is recorded.
func runBackupWithRetry(orgID string) (models.BackupMeta, error) {
	meta, err := RunBackup(orgID)
	if err != nil {
		log.Printf("[backup] org %s run failed, retrying once: %v", orgID, err)
		meta, err = RunBackup(orgID)
	}
	return meta, err
}

// RunBackup dumps every collection's documents belonging to ONE organization —
// its customers, sales orders, invoices, everything scoped to that orgId — into a
// single JSON file, uploads it to Cloudinary at a fixed per-org-per-slot
// public_id (overwrite:true — that's the entire rotation mechanism, no manual
// cleanup needed), and upserts that org+slot's metadata row. Exported so both the
// scheduler and the manual "run now" endpoint share one implementation.
func RunBackup(orgID string) (models.BackupMeta, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	slot := time.Now().Day() % backupSlots
	filter := orgFilter(orgID)

	names, err := listAllCollections(ctx)
	if err != nil {
		return recordBackupFailure(ctx, orgID, slot, fmt.Errorf("list collections: %w", err))
	}

	dump := bson.M{"dumpedAt": time.Now(), "slot": slot, "orgId": orgID}
	collections := bson.M{}
	for _, name := range names {
		if name == "backups" {
			continue // never back up the backup ledger into itself
		}
		col := config.GetCollection(config.DB, name)
		cur, err := col.Find(ctx, filter)
		if err != nil {
			return recordBackupFailure(ctx, orgID, slot, fmt.Errorf("dump %s: %w", name, err))
		}
		var docs []bson.M
		err = cur.All(ctx, &docs)
		cur.Close(ctx)
		if err != nil {
			return recordBackupFailure(ctx, orgID, slot, fmt.Errorf("decode %s: %w", name, err))
		}
		if len(docs) == 0 {
			continue // this collection has nothing for this org — omit it
		}
		collections[name] = docs
	}
	dump["collections"] = collections

	// Extended JSON (relaxed) round-trips ObjectID/Date/etc losslessly, unlike
	// encoding/json on a raw bson.M — required so restore can rebuild real BSON.
	raw, err := bson.MarshalExtJSON(dump, false, true)
	if err != nil {
		return recordBackupFailure(ctx, orgID, slot, fmt.Errorf("marshal dump: %w", err))
	}

	tmp, err := os.CreateTemp("", fmt.Sprintf("erp-backup-%s-slot-%d-*.json", orgID, slot))
	if err != nil {
		return recordBackupFailure(ctx, orgID, slot, fmt.Errorf("temp file: %w", err))
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(raw); err != nil {
		tmp.Close()
		return recordBackupFailure(ctx, orgID, slot, fmt.Errorf("write dump: %w", err))
	}
	tmp.Close()

	// Upload from an io.Reader, not the file path string — the SDK's string-source
	// detection tries to url.Parse() a bare path, and a Windows path like
	// "C:\Users\..." parses with scheme "c", which it then rejects as an
	// "Unsupported source URL". Passing the opened file sidesteps that entirely
	// (same pattern document_controller.go already uses for uploads).
	uploadFile, err := os.Open(tmp.Name())
	if err != nil {
		return recordBackupFailure(ctx, orgID, slot, fmt.Errorf("reopen dump: %w", err))
	}
	defer uploadFile.Close()

	publicID := fmt.Sprintf("backups/%s/backup_slot_%d", orgID, slot)
	result, err := config.CloudinaryClient.Upload.Upload(ctx, uploadFile, uploader.UploadParams{
		PublicID:     publicID,
		ResourceType: "raw",
		Overwrite:    boolPtr(true),
		Invalidate:   boolPtr(true), // bust any CDN cache of the previous file at this org+slot
	})
	if err != nil {
		return recordBackupFailure(ctx, orgID, slot, fmt.Errorf("cloudinary upload: %w", err))
	}
	// The SDK returns a normal (nil-error) HTTP 200 even when Cloudinary rejected the
	// upload at the API level (bad params, quota, etc) — the real reason lands in
	// result.Error.Message instead.
	if result.Error.Message != "" {
		return recordBackupFailure(ctx, orgID, slot, fmt.Errorf("cloudinary upload rejected: %s", result.Error.Message))
	}
	if result.SecureURL == "" {
		return recordBackupFailure(ctx, orgID, slot, fmt.Errorf("cloudinary upload returned no URL"))
	}

	meta := models.BackupMeta{
		OrgID:         orgID,
		Slot:          slot,
		UploadedAt:    time.Now(),
		CloudinaryURL: result.SecureURL,
		PublicID:      result.PublicID,
		SizeBytes:     int64(result.Bytes),
		Status:        "success",
		Collections:   len(collections),
	}
	opts := options.Update().SetUpsert(true)
	_, err = backupMetaCollection.UpdateOne(ctx, bson.M{"orgId": orgID, "slot": slot}, bson.M{"$set": meta}, opts)
	if err != nil {
		return meta, fmt.Errorf("save backup metadata: %w", err)
	}
	return meta, nil
}

func recordBackupFailure(ctx context.Context, orgID string, slot int, err error) (models.BackupMeta, error) {
	meta := models.BackupMeta{
		OrgID:      orgID,
		Slot:       slot,
		UploadedAt: time.Now(),
		Status:     "failed",
		Error:      err.Error(),
	}
	opts := options.Update().SetUpsert(true)
	backupMetaCollection.UpdateOne(ctx, bson.M{"orgId": orgID, "slot": slot}, bson.M{"$set": meta}, opts)
	return meta, err
}

// GetBackups — GET /api/backups. The caller's org's 30 slot rows, most recent first.
func GetBackups() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		cur, err := backupMetaCollection.Find(ctx, bson.M{"orgId": orgID},
			options.Find().SetSort(bson.D{{Key: "uploadedAt", Value: -1}}))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to list backups", "error": err.Error()})
			return
		}
		defer cur.Close(ctx)

		var rows []models.BackupMeta
		cur.All(ctx, &rows)
		if rows == nil {
			rows = []models.BackupMeta{}
		}

		nextSlot := (time.Now().Day() % backupSlots)
		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"backups":            rows,
				"todaySlot":          nextSlot,
				"nextScheduledSlot":  (nextSlot + 1) % backupSlots,
				"nextScheduledLabel": time.Now().Add(24 * time.Hour).Format("02 Jan 2006"),
			},
		})
	}
}

// TriggerBackup — POST /api/backups/run. Backs up only the caller's active org.
func TriggerBackup() gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))
		meta, err := RunBackup(orgID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Backup failed", "error": err.Error(), "data": meta})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Backup completed", "data": meta})
	}
}

// GetBackupDetail — GET /api/backups/:slot (caller's org only)
func GetBackupDetail() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		slot, err := parseSlot(c.Param("slot"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid slot"})
			return
		}
		var meta models.BackupMeta
		if err := backupMetaCollection.FindOne(ctx, bson.M{"orgId": orgID, "slot": slot}).Decode(&meta); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "No backup found for this slot"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": meta})
	}
}

// RestoreBackup — POST /api/backups/:slot/restore. Downloads the slot's JSON dump
// from Cloudinary and REPLACES that org's documents in every collection it
// contains (delete this org's docs, then re-insert). Never touches other orgs'
// data in the same collection. Destructive and irreversible — requires
// {"confirm": true} in the body so it can never fire from a stray click.
func RestoreBackup() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		slot, err := parseSlot(c.Param("slot"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid slot"})
			return
		}

		var body struct {
			Confirm bool `json:"confirm"`
		}
		c.ShouldBindJSON(&body)
		if !body.Confirm {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Restore is destructive — resend with {\"confirm\": true} to proceed."})
			return
		}

		var meta models.BackupMeta
		if err := backupMetaCollection.FindOne(ctx, bson.M{"orgId": orgID, "slot": slot}).Decode(&meta); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "No backup found for this slot"})
			return
		}
		if meta.Status != "success" || meta.CloudinaryURL == "" {
			c.JSON(http.StatusConflict, gin.H{"message": "This slot has no successful backup to restore from"})
			return
		}

		httpClient := &http.Client{Timeout: 2 * time.Minute}
		resp, err := httpClient.Get(meta.CloudinaryURL)
		if err != nil || resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to download backup file"})
			return
		}
		defer resp.Body.Close()

		var dump bson.M
		dec := json.NewDecoder(resp.Body)
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to read backup file"})
			return
		}
		if err := bson.UnmarshalExtJSON(raw, false, &dump); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to parse backup file", "error": err.Error()})
			return
		}

		collectionsRaw, ok := dump["collections"].(bson.M)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Backup file has no collections"})
			return
		}

		filter := orgFilter(orgID)
		restored := gin.H{}
		for name, docsRaw := range collectionsRaw {
			docs, ok := docsRaw.(bson.A)
			if !ok {
				continue
			}
			col := config.GetCollection(config.DB, name)
			col.DeleteMany(ctx, filter) // only THIS org's rows in this collection — other orgs untouched
			if len(docs) == 0 {
				restored[name] = 0
				continue
			}
			toInsert := make([]interface{}, len(docs))
			for i, d := range docs {
				toInsert[i] = d
			}
			res, err := col.InsertMany(ctx, toInsert)
			if err != nil {
				restored[name] = fmt.Sprintf("error: %v", err)
				continue
			}
			restored[name] = len(res.InsertedIDs)
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": fmt.Sprintf("Restored from slot %d (backed up %s)", slot, meta.UploadedAt.Format(time.RFC3339)),
			"data":    gin.H{"restored": restored},
		})
	}
}

// DownloadBackupExcel — GET /api/backups/:slot/download. Converts that slot's
// JSON dump into a real .xlsx file (one sheet per collection) and streams it
// back with Content-Disposition: attachment, so the browser saves a file
// instead of navigating to/rendering the raw JSON inline.
func DownloadBackupExcel() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		slot, err := parseSlot(c.Param("slot"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid slot"})
			return
		}

		var meta models.BackupMeta
		if err := backupMetaCollection.FindOne(ctx, bson.M{"orgId": orgID, "slot": slot}).Decode(&meta); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "No backup found for this slot"})
			return
		}
		if meta.Status != "success" || meta.CloudinaryURL == "" {
			c.JSON(http.StatusConflict, gin.H{"message": "This slot has no successful backup to download"})
			return
		}

		httpClient := &http.Client{Timeout: 90 * time.Second}
		resp, err := httpClient.Get(meta.CloudinaryURL)
		if err != nil || resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to download backup file"})
			return
		}
		defer resp.Body.Close()

		var dump bson.M
		dec := json.NewDecoder(resp.Body)
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to read backup file"})
			return
		}
		if err := bson.UnmarshalExtJSON(raw, false, &dump); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to parse backup file", "error": err.Error()})
			return
		}
		collectionsRaw, ok := dump["collections"].(bson.M)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Backup file has no collections"})
			return
		}

		xlsxBuf, err := buildBackupWorkbook(collectionsRaw)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to build Excel file", "error": err.Error()})
			return
		}

		filename := fmt.Sprintf("backup-org-%s-slot-%d.xlsx", orgID, slot)
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
		c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsxBuf)
	}
}

// buildBackupWorkbook renders one sheet per collection: header row = union of
// every field seen across that collection's documents (alphabetical, so output
// is deterministic even if docs have slightly different shapes), one row per doc.
func buildBackupWorkbook(collectionsRaw bson.M) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	names := make([]string, 0, len(collectionsRaw))
	for name := range collectionsRaw {
		names = append(names, name)
	}
	sort.Strings(names)

	firstSheet := true
	usedNames := map[string]bool{}
	for _, name := range names {
		docsRaw, ok := collectionsRaw[name]
		if !ok {
			continue
		}
		docs, ok := docsRaw.(bson.A)
		if !ok || len(docs) == 0 {
			continue
		}

		sheet := uniqueSheetName(name, usedNames)
		if firstSheet {
			f.SetSheetName("Sheet1", sheet)
			firstSheet = false
		} else {
			f.NewSheet(sheet)
		}

		keys := unionKeys(docs)
		for i, k := range keys {
			cell, _ := excelize.CoordinatesToCellName(i+1, 1)
			f.SetCellValue(sheet, cell, k)
		}
		for r, d := range docs {
			doc, ok := d.(bson.M)
			if !ok {
				continue
			}
			for i, k := range keys {
				cell, _ := excelize.CoordinatesToCellName(i+1, r+2)
				f.SetCellValue(sheet, cell, excelCellValue(doc[k]))
			}
		}
	}

	if firstSheet {
		// No collections had any data — leave the default empty Sheet1 as-is.
		f.SetCellValue("Sheet1", "A1", "No data")
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// unionKeys collects every field name across all docs in a collection so the
// sheet has a stable, complete header even when documents vary slightly in shape.
func unionKeys(docs bson.A) []string {
	seen := map[string]bool{}
	for _, d := range docs {
		doc, ok := d.(bson.M)
		if !ok {
			continue
		}
		for k := range doc {
			seen[k] = true
		}
	}
	keys := make([]string, 0, len(seen))
	for k := range seen {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// excelCellValue converts a BSON-decoded value into something excelize can
// write directly — ObjectID/time.Time become readable strings, nested
// maps/arrays become compact JSON text (a cell can't hold a nested structure).
func excelCellValue(v interface{}) interface{} {
	switch t := v.(type) {
	case nil:
		return ""
	case primitive.ObjectID:
		return t.Hex()
	case time.Time:
		return t.Format(time.RFC3339)
	case bson.M, bson.A, map[string]interface{}:
		b, err := json.Marshal(t)
		if err != nil {
			return fmt.Sprintf("%v", t)
		}
		return string(b)
	default:
		return v
	}
}

// uniqueSheetName sanitizes a collection name into a valid, unique Excel sheet
// name (≤31 chars, no : \ / ? * [ ]).
func uniqueSheetName(name string, used map[string]bool) string {
	repl := strings.NewReplacer(":", "_", "\\", "_", "/", "_", "?", "_", "*", "_", "[", "_", "]", "_")
	clean := repl.Replace(name)
	if len(clean) > 31 {
		clean = clean[:31]
	}
	base := clean
	n := 2
	for used[clean] {
		suffix := fmt.Sprintf("_%d", n)
		max := 31 - len(suffix)
		if len(base) > max {
			clean = base[:max] + suffix
		} else {
			clean = base + suffix
		}
		n++
	}
	used[clean] = true
	return clean
}

func parseSlot(s string) (int, error) {
	var slot int
	_, err := fmt.Sscanf(s, "%d", &slot)
	if err != nil || slot < 0 || slot >= backupSlots {
		return 0, fmt.Errorf("slot out of range")
	}
	return slot, nil
}

