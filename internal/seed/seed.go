package seed

import (
	_ "embed"
	"encoding/json"

	"fpm/internal/domain"
)

//go:embed seed.json
var raw []byte

// Load returns a fresh copy of the TypeScript buildSeed() database.
func Load() (domain.Database, error) {
	var db domain.Database
	if err := json.Unmarshal(raw, &db); err != nil {
		return db, err
	}
	domain.Normalize(&db)
	return db, nil
}
