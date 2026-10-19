package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"fpm/internal/apierr"
	"fpm/internal/domain"
	"fpm/internal/impex"
	"fpm/internal/safeio"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaSQL string

// Store keeps the relational SQLite database and an in-memory copy of the domain model.
type Store struct {
	sql      *sql.DB
	mu       chan struct{}
	db       domain.Database
	seedMode string
}

const (
	// SeedDemo loads data/demo through the shared importer when the database is empty.
	SeedDemo = "demo"
	// SeedNone leaves an empty database with the admin and viewer directory rows.
	SeedNone = "none"
)

// AccountConfig is applied on startup. Passwords are only used when an account is
// first created; an existing account keeps its stored hash. An empty password means
// "generate a random one" and the generated value is returned by EnsureAccounts.
// AdminPerson and ViewerPerson are directory names. An empty ViewerPerson skips the viewer account.
type AccountConfig struct {
	AdminUsername  string
	AdminPassword  string
	AdminPerson    string
	ViewerUsername string
	ViewerPassword string
	ViewerPerson   string
	BcryptCost     int
}

// Open loads a demo database. Tests and local startup use this.
func Open(dataDir string) (*Store, error) {
	return OpenWith(dataDir, SeedDemo)
}

// OpenWith loads demo CSV or an empty catalog when meta is empty. An existing database is left as-is.
func OpenWith(dataDir, mode string) (*Store, error) {
	if mode != SeedDemo && mode != SeedNone {
		return nil, fmt.Errorf("SEED_MODE 必須是 none 或 demo")
	}
	dataDir, err := safeio.UserPath(dataDir)
	if err != nil {
		return nil, err
	}
	if err := safeio.MkdirAll(dataDir); err != nil {
		return nil, err
	}
	path := filepath.Join(dataDir, "app.db")
	sqlDB, err := sql.Open("sqlite", "file:"+path+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(1)
	s := &Store{sql: sqlDB, mu: make(chan struct{}, 1), seedMode: mode}
	s.mu <- struct{}{}
	if err := s.migrate(); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	var n int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM meta`).Scan(&n); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	if n == 0 {
		var db domain.Database
		if mode == SeedNone {
			db = impex.LoadEmpty()
		} else {
			db, err = impex.LoadDemo()
			if err != nil {
				_ = sqlDB.Close()
				return nil, err
			}
		}
		s.db = db
		if err := s.persist(context.Background()); err != nil {
			_ = sqlDB.Close()
			return nil, err
		}
	}
	loaded, err := s.load()
	if err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	s.db = loaded
	return s, nil
}

func (s *Store) Close() error { return s.sql.Close() }

func (s *Store) lock()   { <-s.mu }
func (s *Store) unlock() { s.mu <- struct{}{} }

func (s *Store) Read(fn func(*domain.Database) error) error {
	return s.ReadContext(context.Background(), fn)
}

// ReadContext runs fn while the caller holds the store lock. It returns ctx.Err when the request is already done.
func (s *Store) ReadContext(ctx context.Context, fn func(*domain.Database) error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.lock()
	defer s.unlock()
	if err := ctx.Err(); err != nil {
		return err
	}
	return fn(&s.db)
}

// Write runs fn against the in-memory model and, on success, rewrites the relational tables in one transaction.
// A failed fn or a failed commit restores the previous memory snapshot.
func (s *Store) Write(fn func(*domain.Database) error) error {
	return s.WriteContext(context.Background(), fn)
}

// WriteContext is Write bound to a request context. The multi-row rewrite commits or rolls back together.
func (s *Store) WriteContext(ctx context.Context, fn func(*domain.Database) error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.lock()
	defer s.unlock()
	snap, err := json.Marshal(s.db)
	if err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := fn(&s.db); err != nil {
		s.restore(snap)
		return err
	}
	if err := s.persist(ctx); err != nil {
		s.restore(snap)
		return err
	}
	return nil
}

func (s *Store) restore(snap []byte) {
	var db domain.Database
	if err := json.Unmarshal(snap, &db); err != nil {
		return
	}
	domain.Normalize(&db)
	s.db = db
}

// Reset replaces domain rows with the embedded seed and leaves accounts in place.
func (s *Store) Reset() error {
	return s.ResetContext(context.Background())
}

// ResetContext is Reset bound to a request context. The rewrite commits or rolls back together.
func (s *Store) ResetContext(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if s.seedMode == SeedNone {
		return apierr.New(400, "這個環境沒有示範資料可重設")
	}
	s.lock()
	defer s.unlock()
	db, err := impex.LoadDemo()
	if err != nil {
		return err
	}
	snap, err := json.Marshal(s.db)
	if err != nil {
		return err
	}
	s.db = db
	if err := s.persist(ctx); err != nil {
		s.restore(snap)
		return err
	}
	return nil
}

// FactoryMachineSum is the SQL sum of machine_quantities for one factory.
func (s *Store) FactoryMachineSum(ctx context.Context, factoryID string) (int, error) {
	var sum int
	err := s.sql.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(mq.planned), 0)
		FROM machine_quantities mq
		JOIN deployments d ON d.id = mq.deployment_id
		WHERE d.factory_id = ?`, factoryID).Scan(&sum)
	return sum, err
}

func (s *Store) FindAccount(ctx context.Context, username string) (id, hash, role, personID string, ok bool, err error) {
	err = s.sql.QueryRowContext(ctx, `SELECT id, password_hash, role, person_id FROM accounts WHERE username = ?`, username).
		Scan(&id, &hash, &role, &personID)
	if err == sql.ErrNoRows {
		return "", "", "", "", false, nil
	}
	if err != nil {
		return "", "", "", "", false, err
	}
	return id, hash, role, personID, true, nil
}

// GeneratedCredential is a password created at bootstrap because none was configured.
type GeneratedCredential struct {
	Username string
	Role     string
	Password string
}

func (s *Store) EnsureAccounts(cfg AccountConfig) ([]GeneratedCredential, error) {
	cost := cfg.BcryptCost
	if cost == 0 {
		cost = bcrypt.DefaultCost
	}
	var out []GeneratedCredential
	gen, err := s.ensureAccount(cfg.AdminUsername, cfg.AdminPassword, "editor", cfg.AdminPerson, cost)
	if err != nil {
		return nil, err
	}
	if gen != "" {
		out = append(out, GeneratedCredential{Username: cfg.AdminUsername, Role: "editor", Password: gen})
	}
	if cfg.ViewerPerson == "" || cfg.ViewerUsername == "" {
		return out, nil
	}
	gen, err = s.ensureAccount(cfg.ViewerUsername, cfg.ViewerPassword, "viewer", cfg.ViewerPerson, cost)
	if err != nil {
		return nil, err
	}
	if gen != "" {
		out = append(out, GeneratedCredential{Username: cfg.ViewerUsername, Role: "viewer", Password: gen})
	}
	return out, nil
}

// RandomPassword returns a URL-safe random password with 192 bits of entropy.
func RandomPassword() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// PasswordMatches reports whether username exists and its stored hash matches password.
func (s *Store) PasswordMatches(username, password string) bool {
	var hash string
	if err := s.sql.QueryRow(`SELECT password_hash FROM accounts WHERE username = ?`, username).Scan(&hash); err != nil {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// ensureAccount creates the account when missing (generating a password if none is
// given, returned as generated) and otherwise only reconciles role and person.
// It never rewrites the password of an existing account.
func (s *Store) ensureAccount(username, password, role, personName string, cost int) (generated string, err error) {
	personID, found := s.lookupPerson(personName)
	var id, hash, curRole, curPerson string
	err = s.sql.QueryRow(`SELECT id, password_hash, role, person_id FROM accounts WHERE username = ?`, username).
		Scan(&id, &hash, &curRole, &curPerson)
	if err == sql.ErrNoRows {
		if !found {
			return "", fmt.Errorf("找不到人員「%s」，無法建立帳號 %s", personName, username)
		}
		if password == "" {
			if password, err = RandomPassword(); err != nil {
				return "", err
			}
			generated = password
		}
		raw, err := bcrypt.GenerateFromPassword([]byte(password), cost)
		if err != nil {
			return "", err
		}
		_, err = s.sql.Exec(`INSERT INTO accounts(id, username, password_hash, role, person_id) VALUES (?, ?, ?, ?, ?)`,
			"acct_"+username, username, string(raw), role, personID)
		if err != nil {
			return "", err
		}
		return generated, nil
	}
	if err != nil {
		return "", err
	}
	if !found {
		personID = curPerson
	}
	if curRole != role || curPerson != personID {
		_, err = s.sql.Exec(`UPDATE accounts SET role = ?, person_id = ? WHERE id = ?`, role, personID, id)
	}
	return "", err
}

func (s *Store) lookupPerson(name string) (string, bool) {
	for _, person := range s.db.People {
		if person.Name == name {
			return person.ID, true
		}
	}
	return "", false
}

// EnsurePerson inserts a manual directory row when name is missing.
// Databases created before the empty-catalog viewer existed still need that row
// before the viewer account can be created.
func (s *Store) EnsurePerson(id, name, department string) error {
	var exists bool
	if err := s.Read(func(db *domain.Database) error {
		for _, person := range db.People {
			if person.Name == name {
				exists = true
				break
			}
		}
		return nil
	}); err != nil {
		return err
	}
	if exists {
		return nil
	}
	return s.Write(func(db *domain.Database) error {
		for _, person := range db.People {
			if person.Name == name {
				return nil
			}
		}
		chosen := id
		for _, person := range db.People {
			if person.ID == chosen {
				chosen = fmt.Sprintf("per_%d", db.Seq)
				db.Seq++
				break
			}
		}
		db.People = append(db.People, domain.Person{
			ID: chosen, Name: name, Department: department, Active: true, Source: "manual",
		})
		return nil
	})
}

func (s *Store) migrate() error {
	if _, err := s.sql.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`); err != nil {
		return err
	}
	var n int
	if err := s.sql.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = 1`).Scan(&n); err != nil {
		return err
	}
	if n == 0 {
		tx, err := s.sql.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback()
		if err := execScript(tx, schemaSQL); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations(version, applied_at) VALUES (1, ?)`, time.Now().UTC().Format(time.RFC3339)); err != nil {
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	if err := s.migrateMachineTypeNames(); err != nil {
		return err
	}
	if err := s.migrateFactoryAttrs(); err != nil {
		return err
	}
	return s.migrateProductAudience()
}

// migrateMachineTypeNames drops the legacy code column and renames the demo types.
func (s *Store) migrateMachineTypeNames() error {
	var n int
	if err := s.sql.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = 2`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	rows, err := s.sql.Query(`PRAGMA table_info(machine_types)`)
	if err != nil {
		return err
	}
	hasCode := false
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			_ = rows.Close()
			return err
		}
		if name == "code" {
			hasCode = true
		}
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return err
	}
	_ = rows.Close()
	tx, err := s.sql.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if hasCode {
		renames := [][2]string{{"機種A", "EIA-1"}, {"機種B", "EIA-2"}, {"機種C", "EIA-3"}, {"機種D", "EIA-4"}}
		for _, pair := range renames {
			if _, err := tx.Exec(`UPDATE machine_types SET name = ? WHERE name = ? AND NOT EXISTS (SELECT 1 FROM machine_types existing WHERE lower(existing.name) = lower(?))`, pair[1], pair[0], pair[1]); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(`CREATE TABLE machine_types_v2 (id TEXT PRIMARY KEY, name TEXT NOT NULL, ord INTEGER NOT NULL, active INTEGER NOT NULL)`); err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT INTO machine_types_v2(id, name, ord, active) SELECT id, name, ord, active FROM machine_types`); err != nil {
			return err
		}
		if _, err := tx.Exec(`DROP TABLE machine_types`); err != nil {
			return err
		}
		if _, err := tx.Exec(`ALTER TABLE machine_types_v2 RENAME TO machine_types`); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(`INSERT INTO schema_migrations(version, applied_at) VALUES (2, ?)`, time.Now().UTC().Format(time.RFC3339)); err != nil {
		return err
	}
	return tx.Commit()
}

// migrateFactoryAttrs drops the technology column and the editable enumerations table.
// OVERSEA rows are remapped from the factory name and location.
func (s *Store) migrateFactoryAttrs() error {
	var n int
	if err := s.sql.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = 3`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	rows, err := s.sql.Query(`PRAGMA table_info(factories)`)
	if err != nil {
		return err
	}
	hasTechnology := false
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			_ = rows.Close()
			return err
		}
		if name == "technology" {
			hasTechnology = true
		}
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return err
	}
	_ = rows.Close()
	tx, err := s.sql.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if hasTechnology {
		if err := rebuildFactoriesWithoutTechnology(tx); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(`DROP TABLE IF EXISTS enumerations`); err != nil {
		return err
	}
	if _, err := tx.Exec(`INSERT INTO schema_migrations(version, applied_at) VALUES (3, ?)`, time.Now().UTC().Format(time.RFC3339)); err != nil {
		return err
	}
	return tx.Commit()
}

// migrateProductAudience adds 對外/對內. Existing rows default to 對外.
// The four demo dependency products are marked 對內 when the column is new.
func (s *Store) migrateProductAudience() error {
	var n int
	if err := s.sql.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = 4`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	rows, err := s.sql.Query(`PRAGMA table_info(products)`)
	if err != nil {
		return err
	}
	hasAudience := false
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			_ = rows.Close()
			return err
		}
		if name == "audience" {
			hasAudience = true
		}
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return err
	}
	_ = rows.Close()
	tx, err := s.sql.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if !hasAudience {
		if _, err := tx.Exec(`ALTER TABLE products ADD COLUMN audience TEXT NOT NULL DEFAULT 'EXTERNAL'`); err != nil {
			return err
		}
		if _, err := tx.Exec(`UPDATE products SET audience = 'INTERNAL' WHERE name IN ('開發產品 Developer', '監控產品 Monitoring', '網路產品 Network', '安全產品 Security')`); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(`INSERT INTO schema_migrations(version, applied_at) VALUES (4, ?)`, time.Now().UTC().Format(time.RFC3339)); err != nil {
		return err
	}
	return tx.Commit()
}

func rebuildFactoriesWithoutTechnology(tx *sql.Tx) error {
	type legacyFactory struct {
		id, code, name, location, description, category, region, pm, plannedStart, plannedEnd, status string
		actualStart, actualEnd                                                                        sql.NullString
	}
	rows, err := tx.Query(`SELECT id, code, name, location, description, category, region, pm_id, planned_start, planned_end, actual_start, actual_end, status FROM factories`)
	if err != nil {
		return err
	}
	var items []legacyFactory
	for rows.Next() {
		var item legacyFactory
		if err := rows.Scan(&item.id, &item.code, &item.name, &item.location, &item.description, &item.category, &item.region, &item.pm, &item.plannedStart, &item.plannedEnd, &item.actualStart, &item.actualEnd, &item.status); err != nil {
			_ = rows.Close()
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return err
	}
	_ = rows.Close()
	if _, err := tx.Exec(`CREATE TABLE factories_v3 (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  region TEXT NOT NULL,
  pm_id TEXT NOT NULL,
  planned_start TEXT NOT NULL,
  planned_end TEXT NOT NULL,
  actual_start TEXT,
  actual_end TEXT,
  status TEXT NOT NULL
)`); err != nil {
		return err
	}
	for _, item := range items {
		category, err := domain.NormalizeFactoryCategory(item.category)
		if err != nil {
			category = "GIGA"
		}
		region := item.region
		if strings.EqualFold(strings.TrimSpace(region), "OVERSEA") {
			region = domain.LegacyOverseaRegion(item.name, item.location)
		} else if normalized, err := domain.NormalizeFactoryRegion(region); err == nil {
			region = normalized
		} else {
			region = "HQ"
		}
		if _, err := tx.Exec(`INSERT INTO factories_v3(id, code, name, location, description, category, region, pm_id, planned_start, planned_end, actual_start, actual_end, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			item.id, item.code, item.name, item.location, item.description, category, region, item.pm, item.plannedStart, item.plannedEnd, item.actualStart, item.actualEnd, item.status); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(`DROP TABLE factories`); err != nil {
		return err
	}
	_, err = tx.Exec(`ALTER TABLE factories_v3 RENAME TO factories`)
	return err
}

func (s *Store) persist(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	tx, err := s.sql.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, table := range []string{
		"activity", "topics", "issues", "plan_revisions", "plans", "feature_configs", "phase_links",
		"machine_quantities", "deployments", "version_features", "features", "product_versions", "products",
		"milestones", "phases", "factories", "phase_templates", "people", "machine_types", "meta",
	} {
		if _, err := tx.Exec("DELETE FROM " + table); err != nil {
			return err
		}
	}
	db := &s.db
	domain.Normalize(db)
	if _, err := tx.Exec(`INSERT INTO meta(seq, as_of) VALUES (?, ?)`, db.Seq, db.AsOf); err != nil {
		return err
	}
	for _, row := range db.MachineTypes {
		if _, err := tx.Exec(`INSERT INTO machine_types(id, name, ord, active) VALUES (?, ?, ?, ?)`,
			row.ID, row.Name, row.Order, bint(row.Active)); err != nil {
			return err
		}
	}
	for _, row := range db.People {
		if _, err := tx.Exec(`INSERT INTO people(id, name, department, active, source, external_id) VALUES (?, ?, ?, ?, ?, ?)`,
			row.ID, row.Name, row.Department, bint(row.Active), row.Source, ns(row.ExternalID)); err != nil {
			return err
		}
	}
	for _, row := range db.PhaseTemplates {
		if _, err := tx.Exec(`INSERT INTO phase_templates(id, code, name, description, ord, default_duration_days) VALUES (?, ?, ?, ?, ?, ?)`,
			row.ID, row.Code, row.Name, row.Description, row.Order, row.DefaultDurationDays); err != nil {
			return err
		}
	}
	for _, row := range db.Factories {
		if _, err := tx.Exec(`INSERT INTO factories(id, code, name, location, description, category, region, pm_id, planned_start, planned_end, actual_start, actual_end, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			row.ID, row.Code, row.Name, row.Location, row.Description, row.Category, row.Region, row.PMID, row.PlannedStart, row.PlannedEnd, ns(row.ActualStart), ns(row.ActualEnd), row.Status); err != nil {
			return err
		}
	}
	for _, row := range db.Phases {
		deps, err := jsonText(row.DependsOnPhaseIds)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT INTO phases(id, factory_id, template_id, name, ord, owner_id, planned_start, planned_end, actual_start, actual_end, status, risk_note, depends_on_phase_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			row.ID, row.FactoryID, ns(row.TemplateID), row.Name, row.Order, row.OwnerID, row.PlannedStart, row.PlannedEnd, ns(row.ActualStart), ns(row.ActualEnd), row.Status, row.RiskNote, deps); err != nil {
			return err
		}
	}
	for _, row := range db.Milestones {
		if _, err := tx.Exec(`INSERT INTO milestones(id, phase_id, name, due_date, deliverables, done, completed_at, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			row.ID, row.PhaseID, row.Name, row.DueDate, row.Deliverables, bint(row.Done), ns(row.CompletedAt), row.OwnerID); err != nil {
			return err
		}
	}
	for _, row := range db.Products {
		if _, err := tx.Exec(`INSERT INTO products(id, name, description, dev_department, project_department, primary_owner_id, mode, audience) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			row.ID, row.Name, row.Description, row.DevDepartment, row.ProjectDepartment, row.PrimaryOwnerID, row.Mode, row.Audience); err != nil {
			return err
		}
	}
	for _, row := range db.Versions {
		if _, err := tx.Exec(`INSERT INTO product_versions(id, product_id, version, released_at, notes) VALUES (?, ?, ?, ?, ?)`,
			row.ID, row.ProductID, row.Version, ns(row.ReleasedAt), row.Notes); err != nil {
			return err
		}
	}
	for _, row := range db.Features {
		if _, err := tx.Exec(`INSERT INTO features(id, product_id, code, name, description, default_enabled) VALUES (?, ?, ?, ?, ?, ?)`,
			row.ID, row.ProductID, row.Code, row.Name, row.Description, bint(row.DefaultEnabled)); err != nil {
			return err
		}
	}
	for _, row := range db.VersionFeatures {
		if _, err := tx.Exec(`INSERT INTO version_features(version_id, feature_id, supported) VALUES (?, ?, ?)`,
			row.VersionID, row.FeatureID, bint(row.Supported)); err != nil {
			return err
		}
	}
	for _, row := range db.Deployments {
		if _, err := tx.Exec(`INSERT INTO deployments(id, factory_id, product_id, planned_version_id, actual_version_id, status, secondary_owner_id, planned_date, deployed_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			row.ID, row.FactoryID, row.ProductID, ns(row.PlannedVersionID), ns(row.ActualVersionID), row.Status, row.SecondaryOwnerID, ns(row.PlannedDate), ns(row.DeployedAt), row.Notes); err != nil {
			return err
		}
	}
	for _, row := range db.MachineQuantities {
		if _, err := tx.Exec(`INSERT INTO machine_quantities(id, deployment_id, machine_type_id, planned) VALUES (?, ?, ?, ?)`,
			row.ID, row.DeploymentID, row.MachineTypeID, row.Planned); err != nil {
			return err
		}
	}
	for _, row := range db.PhaseLinks {
		if _, err := tx.Exec(`INSERT INTO phase_links(id, deployment_id, phase_id, relation) VALUES (?, ?, ?, ?)`,
			row.ID, row.DeploymentID, row.PhaseID, row.Relation); err != nil {
			return err
		}
	}
	for _, row := range db.FeatureConfigs {
		if _, err := tx.Exec(`INSERT INTO feature_configs(id, deployment_id, feature_id, desired, actual) VALUES (?, ?, ?, ?, ?)`,
			row.ID, row.DeploymentID, row.FeatureID, bint(row.Desired), nb(row.Actual)); err != nil {
			return err
		}
	}
	for _, row := range db.Plans {
		planned, err := jsonText(row.PlannedFeatures)
		if err != nil {
			return err
		}
		adhoc, err := jsonText(row.AdHocChanges)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT INTO plans(id, factory_id, product_id, deployment_id, status, provided_version_id, planned_features, ad_hoc_changes, construction_start, construction_end, note, submitted_by_id, submitted_at, approved_by_id, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			row.ID, row.FactoryID, row.ProductID, row.DeploymentID, row.Status, ns(row.ProvidedVersionID), planned, adhoc, ns(row.ConstructionStart), ns(row.ConstructionEnd), row.Note, ns(row.SubmittedByID), ns(row.SubmittedAt), ns(row.ApprovedByID), ns(row.ApprovedAt)); err != nil {
			return err
		}
	}
	for _, row := range db.Revisions {
		planned, err := jsonText(row.PlannedFeatures)
		if err != nil {
			return err
		}
		adhoc, err := jsonText(row.AdHocChanges)
		if err != nil {
			return err
		}
		machines, err := jsonText(row.Machines)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT INTO plan_revisions(id, plan_id, number, action, provided_version_id, planned_features, ad_hoc_changes, construction_start, construction_end, machines, actor_id, created_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			row.ID, row.PlanID, row.Number, row.Action, ns(row.ProvidedVersionID), planned, adhoc, ns(row.ConstructionStart), ns(row.ConstructionEnd), machines, row.ActorID, row.CreatedAt, row.Note); err != nil {
			return err
		}
	}
	for _, row := range db.Issues {
		if _, err := tx.Exec(`INSERT INTO issues(id, code, title, description, factory_id, phase_id, milestone_id, product_id, owner_id, severity, priority, status, due_date, resolution, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			row.ID, row.Code, row.Title, row.Description, row.FactoryID, ns(row.PhaseID), ns(row.MilestoneID), ns(row.ProductID), row.OwnerID, row.Severity, row.Priority, row.Status, ns(row.DueDate), row.Resolution, row.UpdatedAt); err != nil {
			return err
		}
	}
	for _, row := range db.Topics {
		if _, err := tx.Exec(`INSERT INTO topics(id, factory_id, title, description, owner_id, status, raised_on) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			row.ID, row.FactoryID, row.Title, row.Description, row.OwnerID, row.Status, row.RaisedOn); err != nil {
			return err
		}
	}
	for _, row := range db.Activity {
		if _, err := tx.Exec(`INSERT INTO activity(id, entity_type, entity_id, action, summary, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			row.ID, row.EntityType, row.EntityID, row.Action, row.Summary, row.ActorID, row.CreatedAt); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) load() (domain.Database, error) {
	var db domain.Database
	if err := s.sql.QueryRow(`SELECT seq, as_of FROM meta LIMIT 1`).Scan(&db.Seq, &db.AsOf); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, name, ord, active FROM machine_types ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.MachineType
		var active int
		if err := rows.Scan(&row.ID, &row.Name, &row.Order, &active); err != nil {
			return err
		}
		row.Active = active != 0
		db.MachineTypes = append(db.MachineTypes, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, name, department, active, source, external_id FROM people ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.Person
		var active int
		var external sql.NullString
		if err := rows.Scan(&row.ID, &row.Name, &row.Department, &active, &row.Source, &external); err != nil {
			return err
		}
		row.Active = active != 0
		row.ExternalID = strPtr(external)
		db.People = append(db.People, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, code, name, description, ord, default_duration_days FROM phase_templates ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.PhaseTemplate
		if err := rows.Scan(&row.ID, &row.Code, &row.Name, &row.Description, &row.Order, &row.DefaultDurationDays); err != nil {
			return err
		}
		db.PhaseTemplates = append(db.PhaseTemplates, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, code, name, location, description, category, region, pm_id, planned_start, planned_end, actual_start, actual_end, status FROM factories ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.Factory
		var actualStart, actualEnd sql.NullString
		if err := rows.Scan(&row.ID, &row.Code, &row.Name, &row.Location, &row.Description, &row.Category, &row.Region, &row.PMID, &row.PlannedStart, &row.PlannedEnd, &actualStart, &actualEnd, &row.Status); err != nil {
			return err
		}
		row.ActualStart = strPtr(actualStart)
		row.ActualEnd = strPtr(actualEnd)
		db.Factories = append(db.Factories, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, factory_id, template_id, name, ord, owner_id, planned_start, planned_end, actual_start, actual_end, status, risk_note, depends_on_phase_ids FROM phases ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.Phase
		var template, actualStart, actualEnd sql.NullString
		var deps string
		if err := rows.Scan(&row.ID, &row.FactoryID, &template, &row.Name, &row.Order, &row.OwnerID, &row.PlannedStart, &row.PlannedEnd, &actualStart, &actualEnd, &row.Status, &row.RiskNote, &deps); err != nil {
			return err
		}
		row.TemplateID = strPtr(template)
		row.ActualStart = strPtr(actualStart)
		row.ActualEnd = strPtr(actualEnd)
		if err := json.Unmarshal([]byte(deps), &row.DependsOnPhaseIds); err != nil {
			return err
		}
		db.Phases = append(db.Phases, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, phase_id, name, due_date, deliverables, done, completed_at, owner_id FROM milestones ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.Milestone
		var done int
		var completed sql.NullString
		if err := rows.Scan(&row.ID, &row.PhaseID, &row.Name, &row.DueDate, &row.Deliverables, &done, &completed, &row.OwnerID); err != nil {
			return err
		}
		row.Done = done != 0
		row.CompletedAt = strPtr(completed)
		db.Milestones = append(db.Milestones, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, name, description, dev_department, project_department, primary_owner_id, mode, audience FROM products ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.Product
		if err := rows.Scan(&row.ID, &row.Name, &row.Description, &row.DevDepartment, &row.ProjectDepartment, &row.PrimaryOwnerID, &row.Mode, &row.Audience); err != nil {
			return err
		}
		db.Products = append(db.Products, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, product_id, version, released_at, notes FROM product_versions ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.ProductVersion
		var released sql.NullString
		if err := rows.Scan(&row.ID, &row.ProductID, &row.Version, &released, &row.Notes); err != nil {
			return err
		}
		row.ReleasedAt = strPtr(released)
		db.Versions = append(db.Versions, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, product_id, code, name, description, default_enabled FROM features ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.FeatureDefinition
		var enabled int
		if err := rows.Scan(&row.ID, &row.ProductID, &row.Code, &row.Name, &row.Description, &enabled); err != nil {
			return err
		}
		row.DefaultEnabled = enabled != 0
		db.Features = append(db.Features, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT version_id, feature_id, supported FROM version_features ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.VersionFeature
		var supported int
		if err := rows.Scan(&row.VersionID, &row.FeatureID, &supported); err != nil {
			return err
		}
		row.Supported = supported != 0
		db.VersionFeatures = append(db.VersionFeatures, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, factory_id, product_id, planned_version_id, actual_version_id, status, secondary_owner_id, planned_date, deployed_at, notes FROM deployments ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.ProductDeployment
		var planned, actual, plannedDate, deployed sql.NullString
		if err := rows.Scan(&row.ID, &row.FactoryID, &row.ProductID, &planned, &actual, &row.Status, &row.SecondaryOwnerID, &plannedDate, &deployed, &row.Notes); err != nil {
			return err
		}
		row.PlannedVersionID = strPtr(planned)
		row.ActualVersionID = strPtr(actual)
		row.PlannedDate = strPtr(plannedDate)
		row.DeployedAt = strPtr(deployed)
		db.Deployments = append(db.Deployments, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, deployment_id, machine_type_id, planned FROM machine_quantities ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.MachineQuantity
		if err := rows.Scan(&row.ID, &row.DeploymentID, &row.MachineTypeID, &row.Planned); err != nil {
			return err
		}
		db.MachineQuantities = append(db.MachineQuantities, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, deployment_id, phase_id, relation FROM phase_links ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.DeploymentPhaseLink
		if err := rows.Scan(&row.ID, &row.DeploymentID, &row.PhaseID, &row.Relation); err != nil {
			return err
		}
		db.PhaseLinks = append(db.PhaseLinks, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, deployment_id, feature_id, desired, actual FROM feature_configs ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.FeatureConfiguration
		var desired int
		var actual sql.NullInt64
		if err := rows.Scan(&row.ID, &row.DeploymentID, &row.FeatureID, &desired, &actual); err != nil {
			return err
		}
		row.Desired = desired != 0
		row.Actual = boolPtr(actual)
		db.FeatureConfigs = append(db.FeatureConfigs, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, factory_id, product_id, deployment_id, status, provided_version_id, planned_features, ad_hoc_changes, construction_start, construction_end, note, submitted_by_id, submitted_at, approved_by_id, approved_at FROM plans ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.ProductFactoryPlan
		var provided, start, end, submittedBy, submittedAt, approvedBy, approvedAt sql.NullString
		var planned, adhoc string
		if err := rows.Scan(&row.ID, &row.FactoryID, &row.ProductID, &row.DeploymentID, &row.Status, &provided, &planned, &adhoc, &start, &end, &row.Note, &submittedBy, &submittedAt, &approvedBy, &approvedAt); err != nil {
			return err
		}
		row.ProvidedVersionID = strPtr(provided)
		row.ConstructionStart = strPtr(start)
		row.ConstructionEnd = strPtr(end)
		row.SubmittedByID = strPtr(submittedBy)
		row.SubmittedAt = strPtr(submittedAt)
		row.ApprovedByID = strPtr(approvedBy)
		row.ApprovedAt = strPtr(approvedAt)
		if err := json.Unmarshal([]byte(planned), &row.PlannedFeatures); err != nil {
			return err
		}
		if err := json.Unmarshal([]byte(adhoc), &row.AdHocChanges); err != nil {
			return err
		}
		db.Plans = append(db.Plans, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, plan_id, number, action, provided_version_id, planned_features, ad_hoc_changes, construction_start, construction_end, machines, actor_id, created_at, note FROM plan_revisions ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.PlanRevision
		var provided, start, end sql.NullString
		var planned, adhoc, machines string
		if err := rows.Scan(&row.ID, &row.PlanID, &row.Number, &row.Action, &provided, &planned, &adhoc, &start, &end, &machines, &row.ActorID, &row.CreatedAt, &row.Note); err != nil {
			return err
		}
		row.ProvidedVersionID = strPtr(provided)
		row.ConstructionStart = strPtr(start)
		row.ConstructionEnd = strPtr(end)
		if err := json.Unmarshal([]byte(planned), &row.PlannedFeatures); err != nil {
			return err
		}
		if err := json.Unmarshal([]byte(adhoc), &row.AdHocChanges); err != nil {
			return err
		}
		if err := json.Unmarshal([]byte(machines), &row.Machines); err != nil {
			return err
		}
		db.Revisions = append(db.Revisions, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, code, title, description, factory_id, phase_id, milestone_id, product_id, owner_id, severity, priority, status, due_date, resolution, updated_at FROM issues ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.Issue
		var phase, milestone, product, due sql.NullString
		if err := rows.Scan(&row.ID, &row.Code, &row.Title, &row.Description, &row.FactoryID, &phase, &milestone, &product, &row.OwnerID, &row.Severity, &row.Priority, &row.Status, &due, &row.Resolution, &row.UpdatedAt); err != nil {
			return err
		}
		row.PhaseID = strPtr(phase)
		row.MilestoneID = strPtr(milestone)
		row.ProductID = strPtr(product)
		row.DueDate = strPtr(due)
		db.Issues = append(db.Issues, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, factory_id, title, description, owner_id, status, raised_on FROM topics ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.DiscussionTopic
		if err := rows.Scan(&row.ID, &row.FactoryID, &row.Title, &row.Description, &row.OwnerID, &row.Status, &row.RaisedOn); err != nil {
			return err
		}
		db.Topics = append(db.Topics, row)
		return nil
	}); err != nil {
		return db, err
	}
	if err := query(s.sql, `SELECT id, entity_type, entity_id, action, summary, actor_id, created_at FROM activity ORDER BY rowid`, func(rows *sql.Rows) error {
		var row domain.Activity
		if err := rows.Scan(&row.ID, &row.EntityType, &row.EntityID, &row.Action, &row.Summary, &row.ActorID, &row.CreatedAt); err != nil {
			return err
		}
		db.Activity = append(db.Activity, row)
		return nil
	}); err != nil {
		return db, err
	}
	domain.Normalize(&db)
	return db, nil
}

func execScript(tx *sql.Tx, script string) error {
	for _, stmt := range strings.Split(script, ";") {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := tx.Exec(stmt); err != nil {
			return fmt.Errorf("%s: %w", stmt, err)
		}
	}
	return nil
}

func query(db *sql.DB, q string, scan func(*sql.Rows) error) error {
	rows, err := db.Query(q)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		if err := scan(rows); err != nil {
			return err
		}
	}
	return rows.Err()
}

func jsonText(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	if string(b) == "null" {
		return "[]", nil
	}
	return string(b), nil
}

func ns(p *string) any {
	if p == nil {
		return nil
	}
	return *p
}

func nb(p *bool) any {
	if p == nil {
		return nil
	}
	return bint(*p)
}

func bint(v bool) int {
	if v {
		return 1
	}
	return 0
}

func strPtr(v sql.NullString) *string {
	if !v.Valid {
		return nil
	}
	s := v.String
	return &s
}

func boolPtr(v sql.NullInt64) *bool {
	if !v.Valid {
		return nil
	}
	b := v.Int64 != 0
	return &b
}
