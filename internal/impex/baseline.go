package impex

import (
	"fmt"
	"time"

	demodata "fpm/data/demo"
	"fpm/internal/domain"
)

const (
	// DemoAsOf is the fixed calendar date of the demo dataset.
	DemoAsOf = "2026-10-18"
	// DemoAdminName is the editor's person when SEED_MODE=demo.
	DemoAdminName = "林品均"
	// DemoViewerName is the viewer's person when SEED_MODE=demo.
	DemoViewerName = "陳浩宇"
	// EmptyAdminName is the only person created when SEED_MODE=none.
	EmptyAdminName = "系統管理員"
)

// Baseline is the catalog every database starts from: enumerations and phase templates.
// It does not include factories, products, or people.
func Baseline() domain.Database {
	db := domain.Database{
		Seq:  1000,
		AsOf: DemoAsOf,
		Enumerations: []domain.Enumeration{
			{ID: "en_giga", Set: "factoryCategory", Code: "GIGA", Label: "Giga", Description: "超大型廠，一次進駐多個產品", Order: 1, Active: true},
			{ID: "en_phase", Set: "factoryCategory", Code: "PHASE", Label: "Phase", Description: "分期廠，產品分波進駐", Order: 2, Active: true},
			{ID: "en_hq", Set: "factoryRegion", Code: "HQ", Label: "總部 HQ", Description: "總部廠區", Order: 1, Active: true},
			{ID: "en_os", Set: "factoryRegion", Code: "OVERSEA", Label: "海外 Oversea", Description: "海外廠區", Order: 2, Active: true},
			{ID: "en_n3", Set: "technologyNode", Code: "N3", Label: "N3", Description: "N3 製程節點", Order: 1, Active: true},
			{ID: "en_n2", Set: "technologyNode", Code: "N2", Label: "N2", Description: "N2 製程節點", Order: 2, Active: true},
		},
		PhaseTemplates: []domain.PhaseTemplate{
			{ID: "tpl_1", Code: "HW", Name: "硬體導入 Hardware Onboarding", Description: "廠房、電力、機櫃與網路硬體到位", Order: 1, DefaultDurationDays: 100},
			{ID: "tpl_2", Code: "PLT", Name: "產品建立 Product Build", Description: "各產品進廠、施工、部署到可交給開發者", Order: 2, DefaultDurationDays: 150},
			{ID: "tpl_3", Code: "DEV", Name: "開發者進駐 Developer Onboarding", Description: "開發團隊進駐、環境驗收與權限", Order: 3, DefaultDurationDays: 75},
			{ID: "tpl_4", Code: "OPS", Name: "開始營運 Operations Start", Description: "營運交接、值班與穩態", Order: 4, DefaultDurationDays: 45},
		},
	}
	domain.Normalize(&db)
	return db
}

// LoadEmpty is an empty production database: the catalog plus one admin person.
func LoadEmpty() domain.Database {
	db := Baseline()
	db.AsOf = time.Now().UTC().Format("2006-01-02")
	db.Seq = 1000
	db.People = []domain.Person{{
		ID: "u_admin", Name: EmptyAdminName, Department: "管理", Active: true, Source: "manual",
	}}
	domain.Normalize(&db)
	return db
}

// LoadDemo builds the demo database by importing the embedded CSV files.
func LoadDemo() (domain.Database, error) {
	db := Baseline()
	db.AsOf = DemoAsOf
	db.Seq = 1000
	files, err := demodata.Read()
	if err != nil {
		return db, err
	}
	ds, rep := ParseFiles(files)
	if len(rep.Errors) > 0 {
		return db, fmt.Errorf("%s", rep.Text(false))
	}
	rep = Apply(&db, ds, Options{})
	if len(rep.Errors) > 0 {
		return db, fmt.Errorf("%s", rep.Text(false))
	}
	return db, nil
}
