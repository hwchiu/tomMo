package httpapi

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSecurityHeaders(t *testing.T) {
	srv := testServer(t)
	rec := do(srv, http.MethodGet, "/healthz", "", nil)
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" || rec.Header().Get("X-Frame-Options") != "DENY" {
		t.Fatalf("headers %v", rec.Header())
	}
	if rec.Header().Get("Strict-Transport-Security") != "" {
		t.Fatal("hsts on plain http")
	}
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	httpsRec := httptest.NewRecorder()
	srv.ServeHTTP(httpsRec, req)
	if httpsRec.Header().Get("Strict-Transport-Security") == "" {
		t.Fatal("missing hsts")
	}
}

func TestCrossSitePostRejected(t *testing.T) {
	srv := testServer(t)
	body := bytes.NewReader([]byte(`{"username":"admin","password":"admin"}`))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/login", body)
	req.Host = "app.example"
	req.Header.Set("Origin", "https://evil.example")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden || !bytes.Contains(rec.Body.Bytes(), []byte("不允許的來源")) {
		t.Fatalf("csrf %d %s", rec.Code, rec.Body.String())
	}

	same := httptest.NewRequest(http.MethodPost, "/api/v1/login", bytes.NewReader([]byte(`{"username":"admin","password":"admin"}`)))
	same.Host = "app.example"
	same.Header.Set("Origin", "http://app.example")
	same.Header.Set("Content-Type", "application/json")
	okRec := httptest.NewRecorder()
	srv.ServeHTTP(okRec, same)
	if okRec.Code != http.StatusOK {
		t.Fatalf("same origin %d %s", okRec.Code, okRec.Body.String())
	}
}

func TestLoginFailureLimit(t *testing.T) {
	srv := testServer(t)
	for i := 0; i < loginFailureLimit; i++ {
		rec := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": "admin", "password": "wrong-password"})
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d %d %s", i, rec.Code, rec.Body.String())
		}
	}
	blocked := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": "admin", "password": "wrong-password"})
	if blocked.Code != http.StatusTooManyRequests || !bytes.Contains(blocked.Body.Bytes(), []byte("嘗試次數過多")) {
		t.Fatalf("limit %d %s", blocked.Code, blocked.Body.String())
	}
}

func TestLogoutRevokesSession(t *testing.T) {
	srv := testServer(t)
	admin := login(t, srv, "admin", "admin")
	out := do(srv, http.MethodPost, "/api/v1/logout", admin, nil)
	if out.Code != http.StatusOK {
		t.Fatalf("logout %d %s", out.Code, out.Body.String())
	}
	again := do(srv, http.MethodGet, "/api/v1/portfolio", admin, nil)
	if again.Code != http.StatusUnauthorized {
		t.Fatalf("revoked cookie still worked %d %s", again.Code, again.Body.String())
	}
}
