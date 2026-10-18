package impex

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"fpm/internal/domain"
)

type rawRow struct {
	line  int
	cells []string
}

func decodeCSV(file, text string) ([]rawRow, []RowError) {
	text = strings.TrimPrefix(text, "\uFEFF")
	if !utf8.ValidString(text) {
		return nil, []RowError{{File: file, Message: "檔案不是 UTF-8"}}
	}
	if strings.TrimSpace(text) == "" {
		return nil, []RowError{{File: file, Message: "檔案是空的"}}
	}
	reader := csv.NewReader(strings.NewReader(text))
	reader.FieldsPerRecord = -1
	var rows []rawRow
	for {
		rec, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			line := 0
			var parse *csv.ParseError
			if errors.As(err, &parse) {
				line = parse.Line
			}
			return nil, []RowError{{File: file, Row: line, Message: "CSV 格式不正確"}}
		}
		line, _ := reader.FieldPos(0)
		blank := true
		for i := range rec {
			rec[i] = strings.TrimSpace(strings.TrimPrefix(rec[i], "\uFEFF"))
			if rec[i] != "" {
				blank = false
			}
		}
		if blank {
			continue
		}
		rows = append(rows, rawRow{line: line, cells: rec})
	}
	if len(rows) == 0 {
		return nil, []RowError{{File: file, Message: "檔案是空的"}}
	}
	return rows, nil
}

func encodeCSV(headers []string, records [][]string) (string, error) {
	var buf strings.Builder
	w := csv.NewWriter(&buf)
	if err := w.Write(headers); err != nil {
		return "", err
	}
	for _, rec := range records {
		if err := w.Write(rec); err != nil {
			return "", err
		}
	}
	w.Flush()
	return buf.String(), w.Error()
}

func indexHeaders(file string, header []string, required, allowed []string) (map[string]int, []RowError) {
	idx := map[string]int{}
	var errs []RowError
	allow := map[string]bool{}
	for _, name := range allowed {
		allow[name] = true
	}
	for i, name := range header {
		if name == "" {
			continue
		}
		if !allow[name] {
			errs = append(errs, RowError{File: file, Row: 1, Message: fmt.Sprintf("不明的欄位「%s」", name)})
			continue
		}
		if _, dup := idx[name]; dup {
			errs = append(errs, RowError{File: file, Row: 1, Message: fmt.Sprintf("欄位「%s」重複", name)})
			continue
		}
		idx[name] = i
	}
	for _, name := range required {
		if _, ok := idx[name]; !ok {
			errs = append(errs, RowError{File: file, Row: 1, Message: "缺少欄位 " + name})
		}
	}
	return idx, errs
}

func cell(rec []string, idx map[string]int, name string) string {
	i, ok := idx[name]
	if !ok || i < 0 || i >= len(rec) {
		return ""
	}
	return rec[i]
}

func hasCol(idx map[string]int, name string) bool {
	_, ok := idx[name]
	return ok
}

func rowErr(file string, row int, message string) RowError {
	return RowError{File: file, Row: row, Message: message}
}

func parseDate(file string, row int, value, label string, required bool) (string, []RowError) {
	if value == "" {
		if required {
			return "", []RowError{rowErr(file, row, label+"必填")}
		}
		return "", nil
	}
	if _, err := time.Parse("2006-01-02", value); err != nil {
		return "", []RowError{rowErr(file, row, label+"格式須為 YYYY-MM-DD")}
	}
	return value, nil
}

func parseBoolCell(file string, row int, value string, fallback bool) (bool, []RowError) {
	switch strings.ToLower(value) {
	case "":
		return fallback, nil
	case "true":
		return true, nil
	case "false":
		return false, nil
	default:
		return false, []RowError{rowErr(file, row, "布林值須為 true 或 false")}
	}
}

func oneOf(file string, row int, value string, allowed []string, label string) []RowError {
	for _, item := range allowed {
		if value == item {
			return nil
		}
	}
	return []RowError{rowErr(file, row, label)}
}

func parsePositive(file string, row int, value, label string) (int, []RowError) {
	if value == "" {
		return 0, nil
	}
	n, err := strconv.Atoi(value)
	if err != nil || n <= 0 {
		return 0, []RowError{rowErr(file, row, label+"須為正整數")}
	}
	return n, nil
}

func parseNonNeg(file string, row int, value, label string) (int, []RowError) {
	if value == "" {
		return 0, []RowError{rowErr(file, row, label+"必填")}
	}
	n, err := strconv.Atoi(value)
	if err != nil || n < 0 {
		return 0, []RowError{rowErr(file, row, label+"須為非負整數")}
	}
	return n, nil
}

func parseSemver(file string, row int, value string) []RowError {
	if value == "" {
		return nil
	}
	if _, _, _, ok := domain.ParseSemver(value); !ok {
		return []RowError{rowErr(file, row, "版本格式不正確")}
	}
	return nil
}

func parseFeatureChanges(file string, row int, value string) ([]FeatureChange, []RowError) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	var out []FeatureChange
	seen := map[string]bool{}
	for _, part := range strings.Split(value, ";") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		name, rest, ok := strings.Cut(part, "=")
		name = strings.TrimSpace(name)
		if !ok || name == "" {
			return nil, []RowError{rowErr(file, row, "功能變更格式不正確")}
		}
		if seen[name] {
			return nil, []RowError{rowErr(file, row, "功能變更重複「"+name+"」")}
		}
		seen[name] = true
		flag := strings.TrimSpace(rest)
		reason := ""
		if before, after, cut := strings.Cut(flag, "@"); cut {
			flag = strings.TrimSpace(before)
			reason = strings.TrimSpace(after)
		}
		var enabled bool
		switch flag {
		case "on":
			enabled = true
		case "off":
			enabled = false
		default:
			return nil, []RowError{rowErr(file, row, "功能變更須為 on 或 off")}
		}
		out = append(out, FeatureChange{Name: name, Enabled: enabled, Reason: reason})
	}
	return out, nil
}

func parseAdhoc(file string, row int, value string) ([]CustomChange, []RowError) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	var out []CustomChange
	seen := map[string]bool{}
	for _, part := range strings.Split(value, ";") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		title, desc, _ := strings.Cut(part, "@")
		title = strings.TrimSpace(title)
		desc = strings.TrimSpace(desc)
		if title == "" {
			return nil, []RowError{rowErr(file, row, "特殊異動缺少標題")}
		}
		if seen[title] {
			return nil, []RowError{rowErr(file, row, "特殊異動重複「"+title+"」")}
		}
		seen[title] = true
		out = append(out, CustomChange{Title: title, Description: desc})
	}
	return out, nil
}

func formatFeatureChanges(items []FeatureChange) string {
	parts := make([]string, 0, len(items))
	for _, item := range items {
		flag := "off"
		if item.Enabled {
			flag = "on"
		}
		part := item.Name + "=" + flag
		if item.Reason != "" {
			part += "@" + item.Reason
		}
		parts = append(parts, part)
	}
	return strings.Join(parts, ";")
}

func formatAdhoc(items []CustomChange) string {
	parts := make([]string, 0, len(items))
	for _, item := range items {
		if item.Description == "" {
			parts = append(parts, item.Title)
			continue
		}
		parts = append(parts, item.Title+"@"+item.Description)
	}
	return strings.Join(parts, ";")
}

func boolText(v bool) string {
	if v {
		return "true"
	}
	return "false"
}
