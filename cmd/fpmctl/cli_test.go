package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"fpm/internal/httpapi"
	"golang.org/x/crypto/bcrypt"
	"net/http/httptest"
)

// cliPassword is a test-only secret. Tests must not print it.
const cliPassword = "cli-test-secret"

func TestCLIImportExportFixture(t *testing.T) {
	t.Setenv("FPM_PASSWORD", "")
	root := moduleRoot(t)
	srv := testAPI(t)
	remote := httptest.NewServer(srv)
	t.Cleanup(remote.Close)

	if code, _, errText := run(t, func() int { return runImport([]string{"--dir", filepath.Join(root, "data", "templates")}) }); code != 2 || !strings.Contains(errText, "密碼") {
		t.Fatalf("missing password %d %s", code, redact(errText))
	}
	if code, _, _ := run(t, func() int {
		return runImport([]string{"--dir", filepath.Join(root, "data", "templates"), "--xlsx", "both.xlsx", "--password", cliPassword})
	}); code != 2 {
		t.Fatalf("both inputs %d", code)
	}
	badDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(badDir, "people.csv"), []byte("name,department\n,廠務處\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if code, out, _ := run(t, func() int {
		return runImport([]string{"--dir", badDir, "--password", cliPassword, "--base", remote.URL})
	}); code != 1 || !strings.Contains(out, "姓名與部門必填") {
		t.Fatalf("bad csv %d %s", code, redact(out))
	}

	templates := filepath.Join(root, "data", "templates")
	args := []string{"--dir", templates, "--base", remote.URL, "--user", "admin", "--password", cliPassword}
	if code, out, errText := run(t, func() int { return runImport(args) }); code != 0 || !strings.Contains(out, "建立") {
		t.Fatalf("import %d %s %s", code, redact(out), redact(errText))
	}
	if code, _, errText := run(t, func() int { return runImport(append(args, "--dry-run")) }); code != 0 {
		t.Fatalf("dry-run %d %s", code, redact(errText))
	}
	if code, _, errText := run(t, func() int { return runImport(args) }); code != 0 {
		t.Fatalf("second import %d %s", code, redact(errText))
	}

	outDir := t.TempDir()
	if code, out, errText := run(t, func() int {
		return runExport([]string{"--dir", outDir, "--base", remote.URL, "--user", "admin", "--password", cliPassword})
	}); code != 0 || !strings.Contains(out, "已寫出") {
		t.Fatalf("export %d %s %s", code, redact(out), redact(errText))
	}
	raw, err := os.ReadFile(filepath.Join(outDir, "factories.csv"))
	if err != nil || !strings.Contains(string(raw), "新竹一廠") {
		t.Fatalf("factories csv %v", err)
	}
	xlsx := filepath.Join(t.TempDir(), "backup.xlsx")
	if code, _, errText := run(t, func() int {
		return runExport([]string{"--xlsx", xlsx, "--base", remote.URL, "--user", "admin", "--password", cliPassword})
	}); code != 0 {
		t.Fatalf("xlsx %d %s", code, redact(errText))
	}
	info, err := os.Stat(xlsx)
	if err != nil || info.Size() == 0 {
		t.Fatal(err)
	}
	if code, _, _ := run(t, func() int { return runExport([]string{"--dir", outDir}) }); code != 2 {
		t.Fatalf("export password %d", code)
	}

	fixture := filepath.Join(t.TempDir(), "demo.json")
	if code, out, errText := run(t, func() int { return runFixture([]string{"-out", fixture}) }); code != 0 || !strings.Contains(out, "已寫出") {
		t.Fatalf("fixture %d %s %s", code, redact(out), redact(errText))
	}
	body, err := os.ReadFile(fixture)
	if err != nil || !strings.Contains(string(body), "新竹一廠") || !strings.Contains(string(body), `"factories"`) {
		t.Fatal("fixture json")
	}
	if code, _, _ := run(t, func() int { return runFixture(nil) }); code != 2 {
		t.Fatal("fixture usage")
	}
	if code, _, _ := run(t, func() int { usage(); return 0 }); code != 0 {
		t.Fatal("usage")
	}
}

func testAPI(t *testing.T) *httpapi.Server {
	t.Helper()
	srv, err := httpapi.New(httpapi.Config{
		DataDir: t.TempDir(), SessionSecret: "cli-session", SeedMode: "none",
		AdminUsername: "admin", AdminPassword: cliPassword, BcryptCost: bcrypt.MinCost,
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = srv.Close() })
	return srv
}

func run(t *testing.T, fn func() int) (int, string, string) {
	t.Helper()
	outR, outW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	errR, errW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	oldOut, oldErr := os.Stdout, os.Stderr
	os.Stdout, os.Stderr = outW, errW
	code := fn()
	_ = outW.Close()
	_ = errW.Close()
	os.Stdout, os.Stderr = oldOut, oldErr
	stdout := readAll(t, outR)
	stderr := readAll(t, errR)
	return code, stdout, stderr
}

func readAll(t *testing.T, f *os.File) string {
	t.Helper()
	buf := make([]byte, 0, 4096)
	tmp := make([]byte, 1024)
	for {
		n, err := f.Read(tmp)
		buf = append(buf, tmp[:n]...)
		if err != nil {
			break
		}
	}
	_ = f.Close()
	return string(buf)
}

func redact(s string) string {
	return strings.ReplaceAll(s, cliPassword, "[redacted]")
}

func moduleRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("go.mod not found")
		}
		dir = parent
	}
}
