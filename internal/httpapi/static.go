package httpapi

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// serveStatic serves the embedded Next export. A path that was not generated
// (a record created after the build) falls back to 404.html so the client
// StaticFallback can render it from the live API.
func (s *Server) serveStatic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if name, ok := staticFile(s.static, r.URL.Path); ok {
		http.ServeFileFS(w, r, s.static, name)
		return
	}
	data, err := fs.ReadFile(s.static, "404.html")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	if r.Method != http.MethodHead {
		_, _ = w.Write(data)
	}
}

func staticFile(fsys fs.FS, urlPath string) (string, bool) {
	clean := path.Clean("/" + urlPath)
	rel := strings.TrimPrefix(clean, "/")
	if rel == "" || rel == "." {
		if fileExists(fsys, "index.html") {
			return "index.html", true
		}
		return "", false
	}
	if fileExists(fsys, rel) {
		return rel, true
	}
	index := path.Join(rel, "index.html")
	if fileExists(fsys, index) {
		return index, true
	}
	return "", false
}

func fileExists(fsys fs.FS, name string) bool {
	info, err := fs.Stat(fsys, name)
	return err == nil && !info.IsDir()
}
