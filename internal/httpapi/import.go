package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"fpm/internal/auth"
	"fpm/internal/domain"
	"fpm/internal/impex"
)

var errImportRejected = errors.New("import rejected")

func (s *Server) serveExport(w http.ResponseWriter, r *http.Request) {
	var files map[string]string
	err := s.store.ReadContext(r.Context(), func(db *domain.Database) error {
		var ferr error
		files, ferr = impex.ExportDatabase(db)
		return ferr
	})
	if err != nil {
		s.writeErr(w, err)
		return
	}
	if files == nil {
		files = map[string]string{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"files": files})
}

func (s *Server) serveImport(w http.ResponseWriter, r *http.Request, principal auth.Principal) {
	raw, err := io.ReadAll(io.LimitReader(r.Body, 8<<20+1))
	if err != nil {
		s.writeErr(w, err)
		return
	}
	if len(raw) > 8<<20 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "檔案過大"})
		return
	}
	var body struct {
		DryRun bool              `json:"dryRun"`
		Files  map[string]string `json:"files"`
	}
	if err := json.Unmarshal(raw, &body); err != nil || body.Files == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "請求格式不正確"})
		return
	}
	if len(body.Files) > len(impex.FileOrder) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "檔案過多"})
		return
	}
	for _, text := range body.Files {
		if len(text) > 1<<20 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "檔案過大"})
			return
		}
	}
	ds, rep := impex.ParseFiles(body.Files)
	if len(rep.Errors) > 0 {
		writeJSON(w, http.StatusBadRequest, rep)
		return
	}
	if body.DryRun {
		err = s.store.ReadContext(r.Context(), func(db *domain.Database) error {
			clone, ferr := cloneDatabase(db)
			if ferr != nil {
				return ferr
			}
			rep = impex.Apply(&clone, ds, impex.Options{ActorID: principal.PersonID})
			return nil
		})
	} else {
		err = s.store.WriteContext(r.Context(), func(db *domain.Database) error {
			rep = impex.Apply(db, ds, impex.Options{ActorID: principal.PersonID})
			if len(rep.Errors) > 0 {
				return errImportRejected
			}
			return nil
		})
	}
	if err != nil && !errors.Is(err, errImportRejected) {
		s.writeErr(w, err)
		return
	}
	status := http.StatusOK
	if len(rep.Errors) > 0 {
		status = http.StatusBadRequest
	}
	writeJSON(w, status, rep)
}

func cloneDatabase(db *domain.Database) (domain.Database, error) {
	raw, err := json.Marshal(db)
	if err != nil {
		return domain.Database{}, err
	}
	var clone domain.Database
	if err := json.Unmarshal(raw, &clone); err != nil {
		return domain.Database{}, err
	}
	domain.Normalize(&clone)
	return clone, nil
}
