package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"fpm/internal/domain"
	"fpm/internal/views"
)

func TestPermissionsStaticAndFeatureDiff(t *testing.T) {
	srv := testServer(t)
	admin := login(t, srv, "admin", "admin")
	viewer := login(t, srv, "viewer", "viewer")

	if rec := do(srv, http.MethodGet, "/api/v1/portfolio", "", nil); rec.Code != 401 || !bytes.Contains(rec.Body.Bytes(), []byte("請先登入")) {
		t.Fatalf("anon %d %s", rec.Code, rec.Body.String())
	}
	forbidden := do(srv, http.MethodPost, "/api/v1/people", viewer, map[string]string{"name": "不行", "department": "廠務處"})
	if forbidden.Code != 403 || !bytes.Contains(forbidden.Body.Bytes(), []byte("使用者只能閱讀")) {
		t.Fatalf("viewer %d %s", forbidden.Code, forbidden.Body.String())
	}
	unknown := do(srv, http.MethodGet, "/api/v1/does-not-exist", admin, nil)
	if unknown.Code != 404 || !bytes.Contains(unknown.Body.Bytes(), []byte("沒有這個 API：")) {
		t.Fatalf("unknown %d %s", unknown.Code, unknown.Body.String())
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/people", bytes.NewBufferString("{"))
	req.Header.Set("Cookie", admin)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != 400 || !bytes.Contains(rec.Body.Bytes(), []byte("請求格式不正確")) {
		t.Fatalf("json %d %s", rec.Code, rec.Body.String())
	}

	boot := do(srv, http.MethodGet, "/api/v1/bootstrap", admin, nil)
	var session views.Bootstrap
	if err := json.Unmarshal(boot.Body.Bytes(), &session); err != nil || session.Actor.ID == "" {
		t.Fatalf("bootstrap %s", boot.Body.String())
	}
	created := do(srv, http.MethodPost, "/api/v1/products", admin, map[string]string{
		"name": "測試產品", "mode": "FEATURE_ONLY", "primaryOwnerId": session.Actor.ID,
		"devDepartment": "開發", "projectDepartment": "專案",
	})
	if created.Code != 200 || !bytes.Contains(created.Body.Bytes(), []byte(`"id"`)) {
		t.Fatalf("create product %d %s", created.Code, created.Body.String())
	}
	history := do(srv, http.MethodGet, "/api/v1/activity?q="+url.QueryEscape("測試產品"), admin, nil)
	if history.Code != 200 || !bytes.Contains(history.Body.Bytes(), []byte("測試產品")) {
		t.Fatalf("history %d %s", history.Code, history.Body.String())
	}

	var from, to string
	if err := srv.store.Read(func(db *domain.Database) error {
		var product string
		for _, item := range db.Products {
			if item.Name == "運算產品 Compute" {
				product = item.ID
			}
		}
		for _, version := range db.Versions {
			if version.ProductID != product {
				continue
			}
			if version.Version == "2.3.0" {
				from = version.ID
			}
			if version.Version == "2.4.0" {
				to = version.ID
			}
		}
		return nil
	}); err != nil || from == "" || to == "" {
		t.Fatalf("versions %s %s %v", from, to, err)
	}
	diff := do(srv, http.MethodGet, "/api/v1/feature-diff?from="+from+"&to="+to, admin, nil)
	if diff.Code != 200 || !bytes.Contains(diff.Body.Bytes(), []byte(`"changes"`)) {
		t.Fatalf("diff %d %s", diff.Code, diff.Body.String())
	}
	open := do(srv, http.MethodGet, "/api/v1/feature-diff?to="+to, admin, nil)
	if open.Code != 200 {
		t.Fatalf("open diff %d %s", open.Code, open.Body.String())
	}

	home := do(srv, http.MethodGet, "/", "", nil)
	if home.Code != 200 || !bytes.Contains(home.Body.Bytes(), []byte("<html")) {
		t.Fatalf("home %d", home.Code)
	}
	missing := do(srv, http.MethodGet, "/factories/not-a-real-id/", "", nil)
	if _, err := fs.Stat(srv.static, "404.html"); err != nil {
		if missing.Code != http.StatusNotFound {
			t.Fatalf("missing dist fallback %d", missing.Code)
		}
	} else if missing.Code != 200 || !bytes.Contains(missing.Body.Bytes(), []byte("<html")) {
		body := missing.Body.String()
		if len(body) > 80 {
			body = body[:80]
		}
		t.Fatalf("fallback %d %s", missing.Code, body)
	}
	head := do(srv, http.MethodPost, "/login/", "", nil)
	if head.Code != http.StatusMethodNotAllowed {
		t.Fatalf("method %d", head.Code)
	}
}

func TestListenAndRecorder(t *testing.T) {
	srv := testServer(t)
	ctx, cancel := context.WithCancel(context.Background())
	errCh := make(chan error, 1)
	go func() { errCh <- srv.Listen(ctx, "127.0.0.1:0") }()
	time.Sleep(200 * time.Millisecond)
	cancel()
	select {
	case err := <-errCh:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("listen shutdown timed out")
	}

	inner := httptest.NewRecorder()
	rec := &statusRecorder{ResponseWriter: inner}
	if rec.Unwrap() != inner {
		t.Fatal("unwrap")
	}
	if _, err := rec.Write([]byte("ok")); err != nil || rec.status != http.StatusOK || !rec.wrote {
		t.Fatal(err)
	}
	rec.WriteHeader(http.StatusTeapot)
	if rec.status != http.StatusOK {
		t.Fatalf("second header %d", rec.status)
	}
}
