package store

import (
	"database/sql"
	"path/filepath"
	"testing"

	"fpm/internal/domain"
)

func TestLegacyMachineTypeNamesKeepQuantities(t *testing.T) {
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
	if _, err := sqlDB.Exec(`INSERT INTO machine_types(id, name, ord, active, code) VALUES ('mt_old', '機種A', 1, 1, 'A')`); err != nil {
		t.Fatal(err)
	}
	if _, err := sqlDB.Exec(`INSERT INTO machine_quantities(id, deployment_id, machine_type_id, planned) VALUES ('mq1', 'dep1', 'mt_old', 12)`); err != nil {
		t.Fatal(err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatal(err)
	}

	st, err := OpenWith(dir, SeedNone)
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Read(func(db *domain.Database) error {
		if len(db.MachineTypes) != 1 || db.MachineTypes[0].ID != "mt_old" || db.MachineTypes[0].Name != "EIA-1" {
			t.Fatalf("types %+v", db.MachineTypes)
		}
		if len(db.MachineQuantities) != 1 || db.MachineQuantities[0].MachineTypeID != "mt_old" || db.MachineQuantities[0].Planned != 12 {
			t.Fatalf("quantities %+v", db.MachineQuantities)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	var codeCols int
	if err := st.sql.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('machine_types') WHERE name = 'code'`).Scan(&codeCols); err != nil {
		t.Fatal(err)
	}
	if codeCols != 0 {
		t.Fatal("code column remains")
	}
}
