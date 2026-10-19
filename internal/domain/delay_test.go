package domain

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestDelaySharedCases(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "testdata", "delay-cases.json"))
	if err != nil {
		t.Fatal(err)
	}
	var file struct {
		Catalog []DelaySpec `json:"catalog"`
		Cases   []struct {
			Name   string     `json:"name"`
			Input  DelayInput `json:"input"`
			Expect []struct {
				Code          string `json:"code"`
				Label         string `json:"label"`
				Kind          string `json:"kind"`
				DaysLate      *int   `json:"daysLate"`
				OwnerPersonID string `json:"ownerPersonId"`
				OwnerRole     string `json:"ownerRole"`
			} `json:"expect"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}
	if len(file.Catalog) != len(DelayCatalog) {
		t.Fatalf("catalog %d want %d", len(DelayCatalog), len(file.Catalog))
	}
	for i, spec := range DelayCatalog {
		got := file.Catalog[i]
		if spec.Code != got.Code || spec.Label != got.Label || spec.Explanation != got.Explanation {
			t.Fatalf("catalog[%d] %+v want %+v", i, spec, got)
		}
	}
	if len(file.Cases) < 30 {
		t.Fatalf("expected the shared table to cover each reason and the date boundaries, got %d", len(file.Cases))
	}
	for _, tc := range file.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			got := DelayReasons(tc.Input)
			if len(got) != len(tc.Expect) {
				t.Fatalf("reasons %d want %d\n got %#v", len(got), len(tc.Expect), codesOf(got))
			}
			for i, reason := range got {
				want := tc.Expect[i]
				if reason.Code != want.Code || reason.Label != want.Label || reason.Kind != want.Kind || reason.OwnerPersonID != want.OwnerPersonID || reason.OwnerRole != want.OwnerRole {
					t.Fatalf("[%d] %+v want %+v", i, reason, want)
				}
				if (reason.DaysLate == nil) != (want.DaysLate == nil) || (reason.DaysLate != nil && *reason.DaysLate != *want.DaysLate) {
					t.Fatalf("[%d] days %+v want %+v", i, reason.DaysLate, want.DaysLate)
				}
				if reason.Explanation != delaySpec(DelayCode(reason.Code)).Explanation {
					t.Fatalf("[%d] explanation %q", i, reason.Explanation)
				}
			}
		})
	}
}

func codesOf(reasons []DelayReason) []string {
	out := make([]string, len(reasons))
	for i, reason := range reasons {
		out[i] = reason.Code
	}
	return out
}
