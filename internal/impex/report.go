package impex

import "fmt"

// Change is one row the importer created or updated.
type Change struct {
	File   string `json:"file"`
	Row    int    `json:"row"`
	Action string `json:"action"`
	Entity string `json:"entity"`
	Name   string `json:"name"`
}

// RowError points at a CSV row. Row 1 is the header.
type RowError struct {
	File    string `json:"file"`
	Row     int    `json:"row"`
	Message string `json:"message"`
}

// Report is the dry-run and import result.
type Report struct {
	Created   []Change   `json:"created"`
	Updated   []Change   `json:"updated"`
	Unchanged int        `json:"unchanged"`
	Errors    []RowError `json:"errors"`
}

func (r *Report) normalize() {
	if r.Created == nil {
		r.Created = []Change{}
	}
	if r.Updated == nil {
		r.Updated = []Change{}
	}
	if r.Errors == nil {
		r.Errors = []RowError{}
	}
}

func (r *Report) add(file string, row int, created, changed bool, entity, name string) {
	switch {
	case created:
		r.Created = append(r.Created, Change{File: file, Row: row, Action: "create", Entity: entity, Name: name})
	case changed:
		r.Updated = append(r.Updated, Change{File: file, Row: row, Action: "update", Entity: entity, Name: name})
	default:
		r.Unchanged++
	}
}

// Text renders the report for the CLI.
func (r Report) Text(dryRun bool) string {
	var b []byte
	if dryRun {
		b = append(b, "乾跑：不會寫入\n"...)
	}
	b = fmt.Appendf(b, "建立 %d、更新 %d、未變更 %d\n", len(r.Created), len(r.Updated), r.Unchanged)
	for _, change := range r.Created {
		b = append(b, formatChange("建立", change)...)
	}
	for _, change := range r.Updated {
		b = append(b, formatChange("更新", change)...)
	}
	for _, err := range r.Errors {
		switch {
		case err.Row > 0:
			b = fmt.Appendf(b, "錯誤 %s 第 %d 列：%s\n", err.File, err.Row, err.Message)
		case err.File != "":
			b = fmt.Appendf(b, "錯誤 %s：%s\n", err.File, err.Message)
		default:
			b = fmt.Appendf(b, "錯誤 %s\n", err.Message)
		}
	}
	return string(b)
}

func formatChange(verb string, change Change) string {
	if change.Row <= 0 {
		return fmt.Sprintf("%s %s %s（自動補上）\n", verb, change.Entity, change.Name)
	}
	return fmt.Sprintf("%s %s %s（%s 第 %d 列）\n", verb, change.Entity, change.Name, change.File, change.Row)
}
