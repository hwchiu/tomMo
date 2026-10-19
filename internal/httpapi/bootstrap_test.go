package httpapi

import (
	"bytes"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

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
