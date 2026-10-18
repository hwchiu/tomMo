package impex

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ReadDir loads known CSV files from a directory.
func ReadDir(dir string) (map[string]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(strings.ToLower(name), ".csv") {
			continue
		}
		if !KnownFile(name) {
			return nil, fmt.Errorf("不支援的檔案 %s", name)
		}
		raw, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return nil, err
		}
		out[name] = string(raw)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("目錄裡沒有可匯入的 CSV")
	}
	return out, nil
}

// WriteDir writes CSV texts into dir, creating it if needed.
func WriteDir(dir string, files map[string]string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	for _, name := range FileOrder {
		text, ok := files[name]
		if !ok {
			continue
		}
		if err := os.WriteFile(filepath.Join(dir, name), []byte(text), 0o644); err != nil {
			return err
		}
	}
	return nil
}
