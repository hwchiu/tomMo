package impex

import (
	"bytes"
	"path/filepath"
	"testing"
)

func TestXLSXRoundTrip(t *testing.T) {
	files, err := ReadDir(filepath.Join(moduleRoot(t), "data", "templates"))
	if err != nil {
		t.Fatal(err)
	}
	raw, err := WriteXLSX(files)
	if err != nil {
		t.Fatal(err)
	}
	back, rep := XLSXFiles(bytes.NewReader(raw))
	if len(rep.Errors) > 0 {
		t.Fatal(rep.Text(false))
	}
	ds, rep := ParseFiles(back)
	if len(rep.Errors) > 0 {
		t.Fatal(rep.Text(false))
	}
	if len(ds.People) != 3 || len(ds.Factories) != 1 || len(ds.Plans) != 1 || len(ds.Issues) != 1 {
		t.Fatalf("people=%d factories=%d plans=%d issues=%d", len(ds.People), len(ds.Factories), len(ds.Plans), len(ds.Issues))
	}
	if ds.Plans[0].FeatureChanges[0].Name != "液冷支援" || !ds.Plans[0].FeatureChanges[0].Enabled || ds.Plans[0].FeatureChanges[0].Reason != "提前試點" {
		t.Fatalf("feature change %+v", ds.Plans[0].FeatureChanges)
	}
	db, err := LoadDemo()
	if err != nil {
		t.Fatal(err)
	}
	exported, err := ExportDatabase(&db)
	if err != nil {
		t.Fatal(err)
	}
	book, err := WriteXLSX(exported)
	if err != nil {
		t.Fatal(err)
	}
	again, rep := XLSXFiles(bytes.NewReader(book))
	if len(rep.Errors) > 0 {
		t.Fatal(rep.Text(false))
	}
	parsed, rep := ParseFiles(again)
	if len(rep.Errors) > 0 {
		t.Fatal(rep.Text(false))
	}
	fresh := Baseline()
	fresh.AsOf = DemoAsOf
	fresh.Seq = 1000
	rep = Apply(&fresh, parsed, Options{})
	if len(rep.Errors) > 0 {
		t.Fatal(rep.Text(false))
	}
	if len(fresh.Factories) != 12 || len(fresh.People) != 25 || len(fresh.Issues) != 22 {
		t.Fatalf("xlsx demo factories=%d people=%d issues=%d", len(fresh.Factories), len(fresh.People), len(fresh.Issues))
	}
}
