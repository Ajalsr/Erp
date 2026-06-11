package utils

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// NumberSegment is one piece of a document/entity number.
//
// Type:
//   - "literal"  → fixed text (the Value field), e.g. "-" or "CUST"
//   - "month"    → current month, zero-padded to Digits (2 → "04", 3 → "004")
//   - "year"     → current year, last Digits digits (2 → "26", 4 → "2026")
//   - "day"      → current day of month, zero-padded to Digits
//   - "sequence" → the running counter (exactly one per format)
//
// For a "sequence" segment:
//   - Mode  "digit" → numeric counter, zero-padded to Digits (e.g. "0007")
//   - Mode  "alpha" → letter counter base-26 (A, B … Z, AA …), padded to Digits
//   - Start → first value the counter takes (defaults to 1)
type NumberSegment struct {
	Type   string `json:"type"   bson:"type"`
	Value  string `json:"value"  bson:"value"`
	Digits int    `json:"digits" bson:"digits"`
	Mode   string `json:"mode"   bson:"mode"`
	Start  int    `json:"start"  bson:"start"`
}

// NumberFormat is an ordered list of segments describing how to build a number.
type NumberFormat struct {
	Segments []NumberSegment `json:"segments" bson:"segments"`
}

// renderPart renders a non-sequence segment for the given time.
func renderPart(seg NumberSegment, now time.Time) string {
	d := seg.Digits
	switch seg.Type {
	case "literal":
		return seg.Value
	case "month":
		if d <= 0 {
			d = 2
		}
		return fmt.Sprintf("%0*d", d, int(now.Month()))
	case "year":
		if d <= 0 {
			d = 4
		}
		mod := 1
		for i := 0; i < d; i++ {
			mod *= 10
		}
		return fmt.Sprintf("%0*d", d, now.Year()%mod)
	case "day":
		if d <= 0 {
			d = 2
		}
		return fmt.Sprintf("%0*d", d, now.Day())
	}
	return ""
}

// renderRange renders every (non-sequence) segment in the slice.
func renderRange(segs []NumberSegment, now time.Time) string {
	var b strings.Builder
	for _, s := range segs {
		b.WriteString(renderPart(s, now))
	}
	return b.String()
}

// toBase26 renders n (0-based) as base-26 letters (A=0), left-padded to width.
func toBase26(n, width int) string {
	if n < 0 {
		n = 0
	}
	if width <= 0 {
		width = 1
	}
	buf := make([]byte, width)
	for i := width - 1; i >= 0; i-- {
		buf[i] = byte('A' + n%26)
		n /= 26
	}
	// Counter grew past the configured width — widen rather than wrap.
	for n > 0 {
		buf = append([]byte{byte('A' + n%26)}, buf...)
		n /= 26
	}
	return string(buf)
}

// fromBase26 parses base-26 letters (A=0) back to an int.
func fromBase26(s string) (int, bool) {
	if s == "" {
		return 0, false
	}
	n := 0
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'a' && c <= 'z' {
			c -= 32
		}
		if c < 'A' || c > 'Z' {
			return 0, false
		}
		n = n*26 + int(c-'A')
	}
	return n, true
}

// renderSeq renders the counter value for a sequence segment.
func renderSeq(seq int, seg NumberSegment, start int) string {
	digits := seg.Digits
	if digits <= 0 {
		digits = 4
	}
	if seg.Mode == "alpha" {
		return toBase26(seq-start, digits)
	}
	return fmt.Sprintf("%0*d", digits, seq)
}

// parseSeq reads a counter value out of the token between prefix and suffix.
func parseSeq(token string, seg NumberSegment, start int) (int, bool) {
	if seg.Mode == "alpha" {
		idx, ok := fromBase26(token)
		if !ok {
			return 0, false
		}
		return idx + start, true
	}
	n, err := strconv.Atoi(token)
	if err != nil {
		return 0, false
	}
	return n, true
}

// GenerateFormattedNumber builds the next number for the given format.
//
// It renders the static prefix (segments before the counter) for `now`,
// queries `coll` for the highest existing value in `field` that shares that
// prefix (scoped by `baseFilter`, e.g. {"orgId": orgID}), increments the
// counter and returns the assembled string. When the prefix contains a
// month/year/day the counter naturally resets each period, because only codes
// from the current period match the prefix.
func GenerateFormattedNumber(ctx context.Context, coll *mongo.Collection, field string, baseFilter bson.M, f NumberFormat, now time.Time) (string, error) {
	seqIdx := -1
	for i, s := range f.Segments {
		if s.Type == "sequence" {
			seqIdx = i
			break
		}
	}
	// No counter configured → purely static (still valid, just not unique).
	if seqIdx == -1 {
		return renderRange(f.Segments, now), nil
	}

	seqSeg := f.Segments[seqIdx]
	start := seqSeg.Start
	if start <= 0 {
		start = 1
	}

	prefix := renderRange(f.Segments[:seqIdx], now)
	suffix := renderRange(f.Segments[seqIdx+1:], now)

	filter := bson.M{}
	for k, v := range baseFilter {
		filter[k] = v
	}
	rx := "^" + regexp.QuoteMeta(prefix)
	if suffix != "" {
		rx += ".*" + regexp.QuoteMeta(suffix) + "$"
	}
	filter[field] = bson.M{"$regex": rx}

	opts := options.FindOne().SetSort(bson.D{{Key: field, Value: -1}})
	var last bson.M
	seq := start
	err := coll.FindOne(ctx, filter, opts).Decode(&last)
	if err == nil {
		if code, ok := last[field].(string); ok {
			token := strings.TrimSuffix(strings.TrimPrefix(code, prefix), suffix)
			if parsed, ok := parseSeq(token, seqSeg, start); ok && parsed >= start {
				seq = parsed + 1
			}
		}
	} else if err != mongo.ErrNoDocuments {
		// Best-effort: still return a usable number (the start value) alongside
		// the error so callers can log without losing the document number.
		return prefix + renderSeq(start, seqSeg, start) + suffix, err
	}

	return prefix + renderSeq(seq, seqSeg, start) + suffix, nil
}
