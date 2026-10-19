package impex

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEndpointRejectsUnsafeTargets(t *testing.T) {
	cases := []string{
		"file:///etc/passwd",
		"http://10.1.2.3/import",
		"http://169.254.169.254/latest",
		"http://metadata.google.internal/",
		"http://user:secret@127.0.0.1:8080/",
		"http://0.0.0.0:8080/",
	}
	for _, base := range cases {
		if _, err := endpoint(base, "/api/v1/login"); err == nil {
			t.Fatalf("allowed %s", base)
		}
	}
	if _, err := endpoint("http://127.0.0.1:8080/ignored", "/api/v1/login"); err != nil {
		t.Fatalf("loopback %v", err)
	}
}

func TestImportDoesNotFollowRedirect(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://169.254.169.254/", http.StatusFound)
	}))
	defer srv.Close()
	_, err := ImportRemote(context.Background(), srv.URL, "admin", "secret", map[string]string{}, false)
	if err == nil || !strings.Contains(err.Error(), "不跟隨重新導向") {
		t.Fatalf("redirect %v", err)
	}
}
