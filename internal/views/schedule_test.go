package views

import (
	"testing"

	"fpm/internal/domain"
	"fpm/internal/impex"
)

func TestOctoberScheduleKeepsFactoriesWithWork(t *testing.T) {
	db, err := impex.LoadDemo()
	if err != nil {
		t.Fatal(err)
	}
	sched, err := domain.ParseSchedule("2026-10", "", "")
	if err != nil {
		t.Fatal(err)
	}
	build, err := BuildProductBuild(&db, sched)
	if err != nil {
		t.Fatal(err)
	}
	if build.Schedule == nil || build.Schedule.From != "2026-10-01" || build.Schedule.To != "2026-10-31" {
		t.Fatalf("window %+v", build.Schedule)
	}
	names := map[string]BuildRow{}
	for _, row := range build.Rows {
		names[row.FactoryName] = row
	}
	for _, name := range []string{"新竹一廠", "台中二廠", "高雄三廠", "熊本一廠"} {
		if _, ok := names[name]; !ok {
			t.Fatalf("missing %s", name)
		}
	}
	for _, name := range []string{"新竹二廠", "台南二廠"} {
		if _, ok := names[name]; ok {
			t.Fatalf("%s should be outside October", name)
		}
	}
	khh := names["高雄三廠"]
	var storage, compute *BuildCell
	for i := range khh.Cells {
		cell := &khh.Cells[i]
		product := productName(&db, cell.ProductID)
		if product == "儲存產品 Storage" {
			storage = cell
		}
		if product == "運算產品 Compute" {
			compute = cell
		}
	}
	if storage == nil || !storage.InSchedule || compute == nil || compute.InSchedule {
		t.Fatalf("kaohsiung storage=%v compute=%v", storage, compute)
	}

	versions, err := BuildCapabilities(&db, sched)
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range versions.Rows {
		if row.FactoryName == "新竹二廠" || row.FactoryName == "台南二廠" {
			t.Fatalf("version row %s", row.FactoryName)
		}
	}
	if len(versions.Factories) != len(db.Factories) {
		t.Fatalf("factory picker %d", len(versions.Factories))
	}
}

func productName(db *domain.Database, id string) string {
	for _, product := range db.Products {
		if product.ID == id {
			return product.Name
		}
	}
	return ""
}
