package impex

import (
	"bytes"
	"encoding/json"
	"testing"

	"fpm/internal/domain"
)

func TestDemoExportRoundTrip(t *testing.T) {
	first, err := LoadDemo()
	if err != nil {
		t.Fatal(err)
	}
	files, err := ExportDatabase(&first)
	if err != nil {
		t.Fatal(err)
	}
	second := Baseline()
	second.AsOf = DemoAsOf
	second.Seq = 1000
	ds, rep := ParseFiles(files)
	if len(rep.Errors) > 0 {
		t.Fatal(rep.Text(false))
	}
	rep = Apply(&second, ds, Options{})
	if len(rep.Errors) > 0 {
		t.Fatal(rep.Text(false))
	}
	domain.Normalize(&first)
	domain.Normalize(&second)
	a, _ := json.Marshal(first)
	b, _ := json.Marshal(second)
	if !bytes.Equal(a, b) {
		t.Fatalf("export/apply diverged\n%s", jsonDiff(a, b))
	}

	again, err := ExportDatabase(&second)
	if err != nil {
		t.Fatal(err)
	}
	ds, rep = ParseFiles(again)
	if len(rep.Errors) > 0 {
		t.Fatal(rep.Text(false))
	}
	before := second.Seq
	rep = Apply(&second, ds, Options{})
	if len(rep.Errors) > 0 {
		t.Fatal(rep.Text(false))
	}
	if len(rep.Created) != 0 || len(rep.Updated) != 0 || second.Seq != before {
		t.Fatalf("second apply created=%d updated=%d seq %d→%d\n%s", len(rep.Created), len(rep.Updated), before, second.Seq, rep.Text(false))
	}
}

func jsonDiff(a, b []byte) string {
	var left, right any
	_ = json.Unmarshal(a, &left)
	_ = json.Unmarshal(b, &right)
	return walkDiff("$", left, right, 12)
}

func walkDiff(path string, left, right any, budget int) string {
	if budget <= 0 {
		return ""
	}
	switch l := left.(type) {
	case map[string]any:
		r, ok := right.(map[string]any)
		if !ok {
			return path + " type\n"
		}
		out := ""
		seen := map[string]bool{}
		for k, lv := range l {
			seen[k] = true
			out += walkDiff(path+"."+k, lv, r[k], budget)
			if countLines(out) >= budget {
				return out
			}
		}
		for k, rv := range r {
			if !seen[k] {
				out += walkDiff(path+"."+k, nil, rv, budget)
			}
		}
		return out
	case []any:
		r, ok := right.([]any)
		if !ok {
			return path + " type\n"
		}
		if len(l) != len(r) {
			return path + " len " + itoa(len(l)) + " vs " + itoa(len(r)) + "\n"
		}
		out := ""
		for i := range l {
			out += walkDiff(path+"["+itoa(i)+"]", l[i], r[i], budget-countLines(out))
			if countLines(out) >= budget {
				return out
			}
		}
		return out
	default:
		lb, _ := json.Marshal(left)
		rb, _ := json.Marshal(right)
		if !bytes.Equal(lb, rb) {
			return path + " " + string(lb) + " vs " + string(rb) + "\n"
		}
		return ""
	}
}

func countLines(s string) int {
	n := 0
	for _, c := range s {
		if c == '\n' {
			n++
		}
	}
	return n
}
