package impex

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"strings"

	"github.com/xuri/excelize/v2"
)

// WriteXLSX encodes CSV texts into one workbook, one sheet per file.
func WriteXLSX(files map[string]string) ([]byte, error) {
	book := excelize.NewFile()
	defer book.Close()
	used := false
	for _, name := range FileOrder {
		text, ok := files[name]
		if !ok {
			continue
		}
		rows, errs := decodeCSV(name, text)
		if len(errs) > 0 {
			return nil, fmt.Errorf("%s", errs[0].Message)
		}
		sheet := strings.TrimSuffix(name, ".csv")
		if !used {
			if err := book.SetSheetName("Sheet1", sheet); err != nil {
				return nil, err
			}
			used = true
		} else if _, err := book.NewSheet(sheet); err != nil {
			return nil, err
		}
		for r, row := range rows {
			for c, value := range row.cells {
				cell, err := excelize.CoordinatesToCellName(c+1, r+1)
				if err != nil {
					return nil, err
				}
				if err := book.SetCellStr(sheet, cell, value); err != nil {
					return nil, err
				}
			}
		}
	}
	if !used {
		return nil, fmt.Errorf("沒有可寫出的資料")
	}
	var buf bytes.Buffer
	if err := book.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// XLSXFiles converts known sheets into CSV texts keyed by people.csv and the other file names.
func XLSXFiles(r io.Reader) (map[string]string, Report) {
	book, err := excelize.OpenReader(r)
	if err != nil {
		rep := Report{Errors: []RowError{{Message: "無法讀取 xlsx"}}}
		rep.normalize()
		return nil, rep
	}
	defer book.Close()
	present := map[string]bool{}
	for _, sheet := range book.GetSheetList() {
		present[sheet] = true
	}
	out := map[string]string{}
	var rep Report
	for _, name := range FileOrder {
		sheet := strings.TrimSuffix(name, ".csv")
		if !present[sheet] {
			continue
		}
		grid, err := book.GetRows(sheet)
		if err != nil {
			rep.Errors = append(rep.Errors, RowError{File: sheet, Message: "無法讀取工作表"})
			continue
		}
		text, err := gridCSV(grid)
		if err != nil {
			rep.Errors = append(rep.Errors, RowError{File: name, Message: err.Error()})
			continue
		}
		out[name] = text
	}
	rep.normalize()
	return out, rep
}

func gridCSV(grid [][]string) (string, error) {
	var buf strings.Builder
	w := csv.NewWriter(&buf)
	for _, row := range grid {
		if err := w.Write(row); err != nil {
			return "", err
		}
	}
	w.Flush()
	return buf.String(), w.Error()
}

// ParseXLSX reads a workbook. Sheet names match the CSV file names without ".csv".
func ParseXLSX(filename string, r io.Reader) (Dataset, Report) {
	book, err := excelize.OpenReader(r)
	if err != nil {
		rep := Report{Errors: []RowError{{File: filename, Message: "無法讀取 xlsx"}}}
		rep.normalize()
		return Dataset{}, rep
	}
	defer book.Close()
	sheets := map[string][]rawRow{}
	for _, sheet := range book.GetSheetList() {
		grid, err := book.GetRows(sheet)
		if err != nil {
			rep := Report{Errors: []RowError{{File: filename + ":" + sheet, Message: "無法讀取工作表"}}}
			rep.normalize()
			return Dataset{}, rep
		}
		var rows []rawRow
		for i, cells := range grid {
			blank := true
			for c := range cells {
				cells[c] = strings.TrimSpace(cells[c])
				if cells[c] != "" {
					blank = false
				}
			}
			if blank {
				continue
			}
			rows = append(rows, rawRow{line: i + 1, cells: cells})
		}
		sheets[sheet] = rows
	}
	var ds Dataset
	var rep Report
	seen := false
	for _, name := range FileOrder {
		sheet := strings.TrimSuffix(name, ".csv")
		rows, ok := sheets[sheet]
		if !ok {
			continue
		}
		seen = true
		label := filename + ":" + sheet
		if len(rows) == 0 {
			rep.Errors = append(rep.Errors, RowError{File: label, Message: "工作表是空的"})
			continue
		}
		errs := parseRecords(name, rows, &ds)
		for _, err := range errs {
			if err.File == name {
				err.File = label
			}
			rep.Errors = append(rep.Errors, err)
		}
	}
	var unknown []string
	for sheet := range sheets {
		if !KnownFile(sheet + ".csv") {
			unknown = append(unknown, sheet)
		}
	}
	sortStrings(unknown)
	for _, sheet := range unknown {
		rep.Errors = append(rep.Errors, RowError{File: filename + ":" + sheet, Message: "不支援的工作表"})
	}
	if !seen && len(rep.Errors) == 0 {
		rep.Errors = append(rep.Errors, RowError{File: filename, Message: "沒有可匯入的工作表"})
	}
	rep.normalize()
	return ds, rep
}
