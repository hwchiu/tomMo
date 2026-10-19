package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"fpm/internal/domain"
	"fpm/internal/impex"
	"fpm/internal/store"
	"fpm/internal/views"
	"golang.org/x/crypto/bcrypt"
)

func TestEmptySessionSecretIsNotShared(t *testing.T) {
	newServer := func() *Server {
		t.Helper()
		srv, err := New(Config{
			DataDir: t.TempDir(), AdminUsername: "admin", AdminPassword: "ephemeral-admin",
			ViewerUsername: "viewer", ViewerPassword: "ephemeral-viewer", BcryptCost: bcrypt.MinCost,
		})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = srv.Close() })
		return srv
	}
	first := newServer()
	second := newServer()
	cookie := login(t, first, "admin", "ephemeral-admin")
	rec := do(second, http.MethodGet, "/api/v1/portfolio", cookie, nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("cookie from another process secret was accepted: %d %s", rec.Code, rec.Body.String())
	}
}

func TestGeneratedPasswordsWrittenToFileNotLog(t *testing.T) {
	dir := t.TempDir()
	var buf bytes.Buffer
	srv, err := New(Config{
		DataDir: dir, SessionSecret: "s", AdminUsername: "admin", ViewerUsername: "viewer",
		BcryptCost: bcrypt.MinCost, Logger: slog.New(slog.NewJSONHandler(&buf, nil)),
	})
	if err != nil {
		t.Fatal(err)
	}
	defer srv.Close()
	path := filepath.Join(dir, CredentialsFileName)
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("perm %v", info.Mode().Perm())
	}
	raw, _ := os.ReadFile(path)
	pw := map[string]string{}
	for _, line := range strings.Split(strings.TrimSpace(string(raw)), "\n") {
		f := strings.Fields(line)
		pw[f[1]] = f[3]
	}
	if len(pw["admin"]) < 24 || len(pw["viewer"]) < 24 {
		t.Fatalf("passwords missing: %q", raw)
	}
	for _, p := range pw {
		if strings.Contains(buf.String(), p) {
			t.Fatal("generated password leaked to log")
		}
	}
	if !strings.Contains(buf.String(), path) {
		t.Fatalf("log should name the file: %s", buf.String())
	}
	login(t, srv, "admin", pw["admin"])
	login(t, srv, "viewer", pw["viewer"])
	if rec := do(srv, http.MethodGet, "/api/v1/login-config", "", nil); !bytes.Contains(rec.Body.Bytes(), []byte(`"showDemoHint":false`)) {
		t.Fatalf("hint shown with random passwords: %s", rec.Body.String())
	}
}

func TestLogGeneratedPasswordsOptIn(t *testing.T) {
	var buf bytes.Buffer
	srv, err := New(Config{
		DataDir: t.TempDir(), SessionSecret: "s", AdminUsername: "admin", ViewerUsername: "viewer",
		BcryptCost: bcrypt.MinCost, LogGeneratedPasswords: true, Logger: slog.New(slog.NewJSONHandler(&buf, nil)),
	})
	if err != nil {
		t.Fatal(err)
	}
	defer srv.Close()
	if !strings.Contains(buf.String(), `"password":`) {
		t.Fatalf("opt-in should log password: %s", buf.String())
	}
}

func TestExistingPasswordNotOverwritten(t *testing.T) {
	dir := t.TempDir()
	cfg := Config{DataDir: dir, SessionSecret: "s", AdminUsername: "admin", AdminPassword: "first-secret",
		ViewerUsername: "viewer", ViewerPassword: "viewer-secret", BcryptCost: bcrypt.MinCost}
	srv, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, CredentialsFileName)); !os.IsNotExist(err) {
		t.Fatal("credentials file must not be written when passwords are provided")
	}
	_ = srv.Close()
	cfg.AdminPassword = "rotated-secret"
	cfg.ViewerPassword = ""
	srv, err = New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer srv.Close()
	login(t, srv, "admin", "first-secret")
	login(t, srv, "viewer", "viewer-secret")
	if rec := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": "admin", "password": "rotated-secret"}); rec.Code == http.StatusOK {
		t.Fatal("existing password was overwritten")
	}
	if _, err := os.Stat(filepath.Join(dir, CredentialsFileName)); !os.IsNotExist(err) {
		t.Fatal("no password should be generated for existing accounts")
	}
}

func TestNoneModeViewerPasswordLogsIn(t *testing.T) {
	dir := t.TempDir()
	var buf bytes.Buffer
	const adminPassword = "none-admin-secret"
	const viewerPassword = "none-viewer-secret"
	cfg := Config{
		DataDir: dir, SessionSecret: "s", AdminUsername: "admin", AdminPassword: adminPassword,
		ViewerUsername: "viewer", ViewerPassword: viewerPassword, BcryptCost: bcrypt.MinCost,
		SeedMode: store.SeedNone, Logger: slog.New(slog.NewJSONHandler(&buf, nil)),
	}
	srv, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	login(t, srv, "admin", adminPassword)
	viewer := login(t, srv, "viewer", viewerPassword)
	if rec := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": "viewer", "password": "wrong-password"}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong password status %d", rec.Code)
	}
	boot := do(srv, http.MethodGet, "/api/v1/bootstrap", viewer, nil)
	var session views.Bootstrap
	if err := json.Unmarshal(boot.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	if session.Role != "viewer" || session.Actor.Name != impex.EmptyViewerName || session.Actor.ID != "u_viewer" {
		t.Fatalf("viewer actor %s %s %s", session.Role, session.Actor.ID, session.Actor.Name)
	}
	if strings.Contains(buf.String(), adminPassword) || strings.Contains(buf.String(), viewerPassword) {
		t.Fatal("configured password leaked to log")
	}
	_ = srv.Close()

	cfg.AdminPassword = "rotated-admin"
	cfg.ViewerPassword = "rotated-viewer"
	srv, err = New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer srv.Close()
	login(t, srv, "admin", adminPassword)
	login(t, srv, "viewer", viewerPassword)
	if rec := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": "viewer", "password": "rotated-viewer"}); rec.Code == http.StatusOK {
		t.Fatal("existing viewer password was overwritten")
	}
}

func TestNoneModeSkipsViewerWhenPasswordUnset(t *testing.T) {
	dir := t.TempDir()
	var buf bytes.Buffer
	const adminPassword = "none-admin-only"
	srv, err := New(Config{
		DataDir: dir, SessionSecret: "s", AdminUsername: "admin", AdminPassword: adminPassword,
		ViewerUsername: "viewer", ViewerPassword: "", BcryptCost: bcrypt.MinCost,
		SeedMode: store.SeedNone, Logger: slog.New(slog.NewJSONHandler(&buf, nil)),
	})
	if err != nil {
		t.Fatal(err)
	}
	login(t, srv, "admin", adminPassword)
	if rec := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": "viewer", "password": "viewer"}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("unset viewer status %d", rec.Code)
	}
	if strings.Contains(buf.String(), adminPassword) {
		t.Fatal("admin password leaked to log")
	}
	_ = srv.Close()

	st, err := store.OpenWith(dir, store.SeedNone)
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	_, _, _, _, ok, err := st.FindAccount(context.Background(), "viewer")
	if err != nil || ok {
		t.Fatalf("viewer account exists %v %v", ok, err)
	}
}

func TestNoneModeViewerHealsMissingPerson(t *testing.T) {
	dir := t.TempDir()
	st, err := store.OpenWith(dir, store.SeedNone)
	if err != nil {
		t.Fatal(err)
	}
	if err := st.Write(func(db *domain.Database) error {
		kept := make([]domain.Person, 0, len(db.People))
		for _, person := range db.People {
			if person.Name != impex.EmptyViewerName {
				kept = append(kept, person)
			}
		}
		db.People = kept
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	_ = st.Close()

	const viewerPassword = "healed-viewer-secret"
	srv, err := New(Config{
		DataDir: dir, SessionSecret: "s", AdminUsername: "admin", AdminPassword: "healed-admin-secret",
		ViewerUsername: "viewer", ViewerPassword: viewerPassword, BcryptCost: bcrypt.MinCost,
		SeedMode: store.SeedNone,
	})
	if err != nil {
		t.Fatal(err)
	}
	defer srv.Close()
	viewer := login(t, srv, "viewer", viewerPassword)
	boot := do(srv, http.MethodGet, "/api/v1/bootstrap", viewer, nil)
	var session views.Bootstrap
	if err := json.Unmarshal(boot.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	if session.Actor.Name != impex.EmptyViewerName || session.Actor.ID != "u_viewer" {
		t.Fatalf("healed actor %s %s", session.Actor.ID, session.Actor.Name)
	}
}
