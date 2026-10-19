package domain

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestScheduleOverlapsSharedCases(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "testdata", "schedule-cases.json"))
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name    string `json:"name"`
		Start   string `json:"start"`
		End     string `json:"end"`
		From    string `json:"from"`
		To      string `json:"to"`
		Overlap bool   `json:"overlap"`
	}
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	if len(cases) < 8 {
		t.Fatalf("cases %d", len(cases))
	}
	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			if got := Overlaps(tc.Start, tc.End, tc.From, tc.To); got != tc.Overlap {
				t.Fatalf("overlap %v want %v", got, tc.Overlap)
			}
		})
	}
}

func TestParseSchedule(t *testing.T) {
	got, err := ParseSchedule("", "", "")
	if err != nil || got.Active() {
		t.Fatalf("empty %+v %v", got, err)
	}
	got, err = ParseSchedule("2026-10", "", "")
	if err != nil || got.From != "2026-10-01" || got.To != "2026-10-31" {
		t.Fatalf("month %+v %v", got, err)
	}
	start, end, err := MonthBounds("2024-02")
	if err != nil || start != "2024-02-01" || end != "2024-02-29" {
		t.Fatal(start, end, err)
	}
	_, end, err = MonthBounds("2026-02")
	if err != nil || end != "2026-02-28" {
		t.Fatal(end, err)
	}
	if _, err := ParseSchedule("2026-13", "", ""); err == nil || err.Error() != ScheduleMonthInvalid {
		t.Fatal(err)
	}
	if _, err := ParseSchedule("", "2026/10/01", "2026-10-31"); err == nil || err.Error() != ScheduleDateInvalid {
		t.Fatal(err)
	}
	if _, err := ParseSchedule("", "2026-11-01", "2026-10-01"); err == nil || err.Error() != ScheduleOrderInvalid {
		t.Fatal(err)
	}
	got, err = ParseSchedule("2026-01", "2026-10-01", "2026-10-31")
	if err != nil || got.From != "2026-10-01" || got.To != "2026-10-31" {
		t.Fatalf("from/to wins %+v %v", got, err)
	}
}
