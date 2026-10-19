package safeio

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUserPathRejectsTraversal(t *testing.T) {
	if _, err := UserPath(""); err == nil {
		t.Fatal("empty")
	}
	if _, err := UserPath("a/../../etc/passwd"); err == nil || !strings.Contains(err.Error(), "..") {
		t.Fatalf("dotdot %v", err)
	}
	got, err := UserPath(filepath.Join("data", "app.db"))
	if err != nil || got != filepath.Clean(filepath.Join("data", "app.db")) {
		t.Fatalf("clean %q %v", got, err)
	}
}

func TestReadFileUnderStaysInRoot(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	secret := filepath.Join(outside, "secret.txt")
	if err := os.WriteFile(secret, []byte("nope"), 0o600); err != nil {
		t.Fatal(err)
	}
	inside := filepath.Join(root, "people.csv")
	if err := os.WriteFile(inside, []byte("ok"), 0o600); err != nil {
		t.Fatal(err)
	}
	raw, err := ReadFileUnder(root, "people.csv")
	if err != nil || string(raw) != "ok" {
		t.Fatalf("read %q %v", raw, err)
	}
	if _, err := ReadFileUnder(root, "../secret.txt"); err == nil {
		t.Fatal("name escaped root")
	}
	if _, err := ReadFileUnder(root, "nested/people.csv"); err == nil {
		t.Fatal("nested name")
	}
	if err := os.Symlink(secret, filepath.Join(root, "link.csv")); err != nil {
		t.Fatal(err)
	}
	if _, err := ReadFileUnder(root, "link.csv"); err == nil || !strings.Contains(err.Error(), "超出允許目錄") {
		t.Fatalf("symlink %v", err)
	}
}

func TestWriteModes(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "out")
	if err := MkdirAll(dir); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(dir)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != DirMode {
		t.Fatalf("dir mode %o", info.Mode().Perm())
	}
	if err := WriteFileUnder(dir, "people.csv", []byte("name\n")); err != nil {
		t.Fatal(err)
	}
	file, err := os.Stat(filepath.Join(dir, "people.csv"))
	if err != nil {
		t.Fatal(err)
	}
	if file.Mode().Perm() != FileMode {
		t.Fatalf("file mode %o", file.Mode().Perm())
	}
	if _, err := ReadFile(filepath.Join(dir, "..", "people.csv")); err == nil {
		t.Fatal("read escaped")
	}
}
