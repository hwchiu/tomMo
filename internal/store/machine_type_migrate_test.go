package store

import (
	"database/sql"
	"path/filepath"
	"testing"

	"fpm/internal/domain"
)

func TestLegacyMachineTypeNamesKeepQuantities(t *testing.T) {
	dir := legacyMachineDir(t, []legacyType{
		{"mt_a", "機種A", 1, "A"},
		{"mt_b", "機種B", 2, "B"},
		{"mt_c", "機種C", 3, "C"},
		{"mt_d", "機種D", 4, "D"},
	}, map[string]int{"mt_a": 12, "mt_b": 8, "mt_c": 4, "mt_d": 2})
	st := openLegacy(t, dir)
	defer st.Close()
	want := map[string]string{"mt_a": "EIA-1", "mt_b": "EIA-2", "mt_c": "EIA-3", "mt_d": "EIA-4"}
	planned := map[string]int{"mt_a": 12, "mt_b": 8, "mt_c": 4, "mt_d": 2}
	if err := st.Read(func(db *domain.Database) error {
		if len(db.MachineTypes) != 4 {
			t.Fatalf("types %+v", db.MachineTypes)
		}
		for _, item := range db.MachineTypes {
			if item.Name != want[item.ID] {
				t.Fatalf("type %+v", item)
			}
		}
		if len(db.MachineQuantities) != 4 {
			t.Fatalf("quantities %+v", db.MachineQuantities)
		}
		for _, row := range db.MachineQuantities {
			if row.Planned != planned[row.MachineTypeID] {
				t.Fatalf("quantity %+v", row)
			}
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	assertNoMachineCode(t, st)
}

func TestLegacyMachineTypeKeepsTakenEnglishName(t *testing.T) {
	dir := legacyMachineDir(t, []legacyType{
		{"mt_en", "EIA-1", 1, "E1"},
		{"mt_old", "機種A", 2, "A"},
	}, map[string]int{"mt_old": 12})
	st := openLegacy(t, dir)
	defer st.Close()
	if err := st.Read(func(db *domain.Database) error {
		names := map[string]string{}
		for _, item := range db.MachineTypes {
			names[item.ID] = item.Name
		}
		if names["mt_en"] != "EIA-1" || names["mt_old"] != "機種A" {
			t.Fatalf("names %+v", names)
		}
		if len(db.MachineQuantities) != 1 || db.MachineQuantities[0].MachineTypeID != "mt_old" || db.MachineQuantities[0].Planned != 12 {
			t.Fatalf("quantities %+v", db.MachineQuantities)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	assertNoMachineCode(t, st)
}

type legacyType struct {
	id, name string
	ord      int
	code     string
}

func legacyMachineDir(t *testing.T, types []legacyType, planned map[string]int) string {
	t.Helper()
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
	if _, err := sqlDB.Exec(`ALTER TABLE machine_types ADD COLUMN code TEXT NOT NULL DEFAULT ''`); err != nil {
		t.Fatal(err)
	}
	if _, err := sqlDB.Exec(`INSERT INTO schema_migrations(version, applied_at) VALUES (1, '2020-01-01T00:00:00Z')`); err != nil {
		t.Fatal(err)
	}
	if _, err := sqlDB.Exec(`INSERT INTO meta(seq, as_of) VALUES (1000, '2026-10-18')`); err != nil {
		t.Fatal(err)
	}
	for _, item := range types {
		if _, err := sqlDB.Exec(`INSERT INTO machine_types(id, name, ord, active, code) VALUES (?, ?, ?, 1, ?)`, item.id, item.name, item.ord, item.code); err != nil {
			t.Fatal(err)
		}
	}
	for id, count := range planned {
		if _, err := sqlDB.Exec(`INSERT INTO machine_quantities(id, deployment_id, machine_type_id, planned) VALUES (?, ?, ?, ?)`, "mq"+id, "dep1", id, count); err != nil {
			t.Fatal(err)
		}
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatal(err)
	}
	return dir
}

func openLegacy(t *testing.T, dir string) *Store {
	t.Helper()
	st, err := OpenWith(dir, SeedNone)
	if err != nil {
		t.Fatal(err)
	}
	return st
}

func assertNoMachineCode(t *testing.T, st *Store) {
	t.Helper()
	var codeCols int
	if err := st.sql.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('machine_types') WHERE name = 'code'`).Scan(&codeCols); err != nil {
		t.Fatal(err)
	}
	if codeCols != 0 {
		t.Fatal("code column remains")
	}
}
