package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInitialPasswordSources(t *testing.T) {
	t.Setenv("INITIAL_ADMIN_PASSWORD", "")
	t.Setenv("INITIAL_ADMIN_PASSWORD_FILE", "")
	t.Setenv("ADMIN_PASSWORD", "")
	if v, _ := initialPassword("INITIAL_ADMIN_PASSWORD", "ADMIN_PASSWORD"); v != "" {
		t.Fatalf("want empty, got %q", v)
	}
	t.Setenv("ADMIN_PASSWORD", "legacy")
	if v, _ := initialPassword("INITIAL_ADMIN_PASSWORD", "ADMIN_PASSWORD"); v != "legacy" {
		t.Fatalf("legacy %q", v)
	}
	file := filepath.Join(t.TempDir(), "pw")
	if err := os.WriteFile(file, []byte("from-file\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("INITIAL_ADMIN_PASSWORD_FILE", file)
	if v, _ := initialPassword("INITIAL_ADMIN_PASSWORD", "ADMIN_PASSWORD"); v != "from-file" {
		t.Fatalf("file %q", v)
	}
	t.Setenv("INITIAL_ADMIN_PASSWORD", "direct")
	if v, _ := initialPassword("INITIAL_ADMIN_PASSWORD", "ADMIN_PASSWORD"); v != "direct" {
		t.Fatalf("direct %q", v)
	}
	t.Setenv("INITIAL_ADMIN_PASSWORD", "")
	t.Setenv("INITIAL_ADMIN_PASSWORD_FILE", "/nonexistent")
	if _, err := initialPassword("INITIAL_ADMIN_PASSWORD", "ADMIN_PASSWORD"); err == nil {
		t.Fatal("missing file should error")
	}
	t.Setenv("INITIAL_ADMIN_PASSWORD_FILE", t.TempDir()+"/../pw")
	if _, err := initialPassword("INITIAL_ADMIN_PASSWORD", "ADMIN_PASSWORD"); err == nil || !strings.Contains(err.Error(), "..") {
		t.Fatalf("traversal %v", err)
	}
}
