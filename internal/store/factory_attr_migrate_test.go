package store

import (
	"database/sql"
	"path/filepath"
	"testing"

	"fpm/internal/domain"
)

func TestLegacyFactoryAttrsDropTechnology(t *testing.T) {
	dir := t.TempDir()
	sqlDB, err := sql.Open("sqlite", "file:"+filepath.Join(dir, "app.db"))
	if err != nil {
		t.Fatal(err)
	}
	tx, err := sqlDB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	if err := execScript(tx, schemaSQL); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	if _, err := sqlDB.Exec(`ALTER TABLE factories ADD COLUMN technology TEXT NOT NULL DEFAULT ''`); err != nil {
		t.Fatal(err)
	}
	if _, err := sqlDB.Exec(`CREATE TABLE enumerations (
		id TEXT PRIMARY KEY,
		set_name TEXT NOT NULL,
		code TEXT NOT NULL,
		label TEXT NOT NULL,
		description TEXT NOT NULL,
		ord INTEGER NOT NULL,
		active INTEGER NOT NULL
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := sqlDB.Exec(`INSERT INTO meta(seq, as_of) VALUES (1000, '2026-10-18')`); err != nil {
		t.Fatal(err)
	}
	if _, err := sqlDB.Exec(`INSERT INTO enumerations(id, set_name, code, label, description, ord, active) VALUES ('en_os', 'factoryRegion', 'OVERSEA', '海外', '', 1, 1)`); err != nil {
		t.Fatal(err)
	}
	rows := []struct {
		id, code, name, location, category, region string
	}{
		{"fac_hq", "FAB-HSC", "新竹一廠", "新竹", "GIGA", "HQ"},
		{"fac_kum", "FAB-KUM", "熊本一廠", "熊本", "GIGA", "OVERSEA"},
		{"fac_os", "FAB-OS1", "大阪一廠", "大阪", "Phase", "OVERSEA"},
		{"fac_az", "FAB-AZ1", "亞利桑那一廠", "亞利桑那", "PHASE", "OVERSEA"},
		{"fac_sg", "FAB-SG1", "新加坡一廠", "新加坡", "NOPE", "OVERSEA"},
		{"fac_lab", "FAB-LAB", "實驗室", "新竹", "GIGA", "LAB"},
	}
	for _, row := range rows {
		if _, err := sqlDB.Exec(`INSERT INTO factories(id, code, name, location, description, category, region, technology, pm_id, planned_start, planned_end, status) VALUES (?, ?, ?, ?, '', ?, ?, 'N3', 'u_admin', '2026-01-01', '2026-12-31', 'ON_TRACK')`,
			row.id, row.code, row.name, row.location, row.category, row.region); err != nil {
			t.Fatal(err)
		}
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatal(err)
	}

	st, err := OpenWith(dir, SeedNone)
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	want := map[string][2]string{
		"新竹一廠":   {"GIGA", "HQ"},
		"熊本一廠":   {"GIGA", "JP"},
		"大阪一廠":   {"PHASE", "JP"},
		"亞利桑那一廠": {"PHASE", "AZ"},
		"新加坡一廠":  {"GIGA", "EU"},
		"實驗室":    {"GIGA", "HQ"},
	}
	if err := st.Read(func(db *domain.Database) error {
		if len(db.Factories) != len(want) {
			t.Fatalf("factories %d", len(db.Factories))
		}
		for _, factory := range db.Factories {
			pair, ok := want[factory.Name]
			if !ok || factory.Category != pair[0] || factory.Region != pair[1] {
				t.Fatalf("%s category %s region %s", factory.Name, factory.Category, factory.Region)
			}
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	var techCols, enumTables int
	if err := st.sql.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('factories') WHERE name = 'technology'`).Scan(&techCols); err != nil {
		t.Fatal(err)
	}
	if techCols != 0 {
		t.Fatal("technology column remains")
	}
	if err := st.sql.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'enumerations'`).Scan(&enumTables); err != nil {
		t.Fatal(err)
	}
	if enumTables != 0 {
		t.Fatal("enumerations table remains")
	}
}
