package store

import (
	"encoding/json"
	"testing"

	"fpm/internal/domain"
	"fpm/internal/impex"
)

func TestSeedRoundTrip(t *testing.T) {
	orig, err := impex.LoadDemo()
	if err != nil {
		t.Fatal(err)
	}
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	var got domain.Database
	if err := s.Read(func(db *domain.Database) error {
		raw, err := json.Marshal(db)
		if err != nil {
			return err
		}
		return json.Unmarshal(raw, &got)
	}); err != nil {
		t.Fatal(err)
	}
	want, _ := json.Marshal(orig)
	have, _ := json.Marshal(got)
	if string(want) != string(have) {
		t.Fatalf("seed round trip changed the database\nwant %d bytes got %d bytes", len(want), len(have))
	}
}
