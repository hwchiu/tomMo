// Package demo embeds the CSV files that are the only demo dataset.
// Server startup, fpmctl, and the Pages fixture all read these bytes.
package demo

import (
	"embed"
	"io/fs"
	"strings"
)

//go:embed *.csv
var FS embed.FS

// Read returns each embedded CSV keyed by its file name.
func Read() (map[string]string, error) {
	entries, err := fs.ReadDir(FS, ".")
	if err != nil {
		return nil, err
	}
	out := make(map[string]string, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".csv") {
			continue
		}
		raw, err := FS.ReadFile(entry.Name())
		if err != nil {
			return nil, err
		}
		out[entry.Name()] = string(raw)
	}
	return out, nil
}
