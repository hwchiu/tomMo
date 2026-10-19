package safeio

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// DirMode is the directory mode for data and export directories (owner rwx, group rx).
const DirMode os.FileMode = 0o750

// FileMode is the file mode for exported files and generated credentials.
const FileMode os.FileMode = 0o600

// UserPath cleans an operator-supplied path and rejects empty paths and "..".
func UserPath(path string) (string, error) {
	if strings.TrimSpace(path) == "" || strings.ContainsRune(path, 0) {
		return "", fmt.Errorf("路徑不可為空")
	}
	if err := rejectDotDot(path); err != nil {
		return "", err
	}
	cleaned := filepath.Clean(path)
	if cleaned == "." || strings.TrimSpace(cleaned) == "" {
		return "", fmt.Errorf("路徑不可為空")
	}
	if err := rejectDotDot(cleaned); err != nil {
		return "", err
	}
	return cleaned, nil
}

// MkdirAll creates a directory at 0750. The path may not contain "..".
func MkdirAll(path string) error {
	if err := rejectDotDot(path); err != nil {
		return err
	}
	cleaned := filepath.Clean(path)
	if cleaned == "." || strings.ContainsRune(cleaned, 0) {
		return fmt.Errorf("路徑不可為空")
	}
	return os.MkdirAll(cleaned, 0o750)
}

// ReadFile reads a cleaned operator path that does not contain "..".
func ReadFile(path string) ([]byte, error) {
	if err := rejectDotDot(path); err != nil {
		return nil, err
	}
	cleaned := filepath.Clean(path)
	if cleaned == "." || strings.ContainsRune(cleaned, 0) {
		return nil, fmt.Errorf("路徑不可為空")
	}
	return os.ReadFile(cleaned)
}

// WriteFile writes data at 0600 to a cleaned operator path that does not contain "..".
func WriteFile(path string, data []byte) error {
	if err := rejectDotDot(path); err != nil {
		return err
	}
	cleaned := filepath.Clean(path)
	if cleaned == "." || strings.ContainsRune(cleaned, 0) {
		return fmt.Errorf("路徑不可為空")
	}
	return os.WriteFile(cleaned, data, 0o600)
}

// ReadFileUnder reads one file name inside root. The name must be a single
// path segment, and the resolved file must stay inside root.
func ReadFileUnder(root, name string) ([]byte, error) {
	full, rootReal, err := confined(root, name)
	if err != nil {
		return nil, err
	}
	real, err := filepath.EvalSymlinks(full)
	if err != nil {
		return nil, err
	}
	if err := within(rootReal, real); err != nil {
		return nil, err
	}
	cleaned := filepath.Clean(real)
	return os.ReadFile(cleaned)
}

// WriteFileUnder writes one file name inside root at 0600.
func WriteFileUnder(root, name string, data []byte) error {
	target, err := newFileUnder(root, name)
	if err != nil {
		return err
	}
	cleaned := filepath.Clean(target)
	return os.WriteFile(cleaned, data, 0o600)
}

// OpenAppendUnder opens one file name inside root for append, creating it at 0600.
func OpenAppendUnder(root, name string) (*os.File, error) {
	target, err := newFileUnder(root, name)
	if err != nil {
		return nil, err
	}
	cleaned := filepath.Clean(target)
	return os.OpenFile(cleaned, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0o600)
}

func newFileUnder(root, name string) (string, error) {
	full, rootReal, err := confined(root, name)
	if err != nil {
		return "", err
	}
	parentReal, err := filepath.EvalSymlinks(filepath.Dir(full))
	if err != nil {
		return "", err
	}
	if err := within(rootReal, parentReal); err != nil {
		return "", err
	}
	target := filepath.Clean(filepath.Join(parentReal, filepath.Base(name)))
	if err := within(rootReal, filepath.Dir(target)); err != nil {
		return "", err
	}
	return target, nil
}

func confined(root, name string) (string, string, error) {
	if err := rejectDotDot(root); err != nil {
		return "", "", err
	}
	if name == "" || name == "." || name == ".." || name != filepath.Base(name) || strings.ContainsRune(name, 0) {
		return "", "", fmt.Errorf("不允許的檔案名稱")
	}
	rootClean := filepath.Clean(root)
	full := filepath.Join(rootClean, name)
	if err := within(rootClean, full); err != nil {
		return "", "", err
	}
	rootReal, err := filepath.EvalSymlinks(rootClean)
	if err != nil {
		return "", "", err
	}
	return full, rootReal, nil
}

func within(root, target string) error {
	rel, err := filepath.Rel(root, target)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return fmt.Errorf("路徑超出允許目錄")
	}
	return nil
}

func rejectDotDot(path string) error {
	if strings.ContainsRune(path, 0) {
		return fmt.Errorf("路徑不可為空")
	}
	for _, part := range strings.Split(filepath.ToSlash(path), "/") {
		if part == ".." {
			return fmt.Errorf("路徑不可包含 ..")
		}
	}
	return nil
}
