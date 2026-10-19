package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func TestLoginConfigDoesNotAdvertiseDemoPassword(t *testing.T) {
	srv := testServer(t)
	rec := do(srv, http.MethodGet, "/api/v1/login-config", "", nil)
	if rec.Code != 200 || !bytes.Contains(rec.Body.Bytes(), []byte(`"showDemoHint":false`)) {
		t.Fatalf("hint %d %s", rec.Code, rec.Body.String())
	}
}

func TestWriteValidationAndHistory(t *testing.T) {
	srv := testServer(t)
	admin := login(t, srv, "admin", "admin")
	viewer := login(t, srv, "viewer", "viewer")

	emptyLogin := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": " ", "password": ""})
	if emptyLogin.Code != 400 || !bytes.Contains(emptyLogin.Body.Bytes(), []byte("請輸入帳號與密碼")) {
		t.Fatalf("empty login %d %s", emptyLogin.Code, emptyLogin.Body.String())
	}

	forbidden := do(srv, http.MethodPatch, "/api/v1/factories/f_hsc", viewer, map[string]string{"name": "不行"})
	if forbidden.Code != 403 || !bytes.Contains(forbidden.Body.Bytes(), []byte("使用者只能閱讀")) {
		t.Fatalf("viewer patch %d %s", forbidden.Code, forbidden.Body.String())
	}

	badIssue := do(srv, http.MethodPost, "/api/v1/issues", admin, map[string]string{
		"title": "壞資料", "factoryId": "f_hsc", "ownerId": "u_lin",
		"severity": "URGENT", "priority": "P1", "status": "OPEN",
	})
	if badIssue.Code != 400 || !bytes.Contains(badIssue.Body.Bytes(), []byte("嚴重度不正確")) {
		t.Fatalf("bad issue %d %s", badIssue.Code, badIssue.Body.String())
	}

	emptyPerson := do(srv, http.MethodPost, "/api/v1/people", admin, map[string]string{"name": " ", "department": ""})
	if emptyPerson.Code != 400 || !bytes.Contains(emptyPerson.Body.Bytes(), []byte("姓名與部門必填")) {
		t.Fatalf("empty person %d %s", emptyPerson.Code, emptyPerson.Body.String())
	}

	ref := demoRefOf(t, srv, admin)
	emptyMilestone := do(srv, http.MethodPost, "/api/v1/phases/"+ref.phase+"/milestones", admin, map[string]any{
		"name": " ", "dueDate": "2026-11-01", "ownerId": ref.actor, "done": false,
	})
	if emptyMilestone.Code != 400 || !bytes.Contains(emptyMilestone.Body.Bytes(), []byte("請填里程碑名稱")) {
		t.Fatalf("empty milestone %d %s", emptyMilestone.Code, emptyMilestone.Body.String())
	}

	created := do(srv, http.MethodPost, "/api/v1/people", admin, map[string]string{"name": "品管測試員", "department": "廠務處"})
	if created.Code != 200 {
		t.Fatalf("create %d %s", created.Code, created.Body.String())
	}
	history := do(srv, http.MethodGet, "/api/v1/activity?entityType=PERSON&q="+url.QueryEscape("品管測試員")+"&limit=5", admin, nil)
	if history.Code != 200 || !bytes.Contains(history.Body.Bytes(), []byte("品管測試員")) {
		t.Fatalf("activity %d %s", history.Code, history.Body.String())
	}

	page := do(srv, http.MethodGet, "/api/v1/issues?limit=1&offset=0&severity=CRITICAL", admin, nil)
	if page.Code != 200 {
		t.Fatalf("issues %d %s", page.Code, page.Body.String())
	}
	var list struct {
		Items  []map[string]any `json:"items"`
		Total  int              `json:"total"`
		Limit  int              `json:"limit"`
		Offset int              `json:"offset"`
	}
	if err := json.Unmarshal(page.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if list.Limit != 1 || list.Offset != 0 || list.Total < 1 || len(list.Items) != 1 {
		t.Fatalf("page %+v", list)
	}
	if list.Items[0]["severity"] != "CRITICAL" {
		t.Fatalf("severity filter %+v", list.Items[0])
	}
}

func TestCancelledRequestAndRequestLog(t *testing.T) {
	var buf bytes.Buffer
	srv, err := New(Config{
		DataDir: t.TempDir(), SessionSecret: "test-secret",
		AdminUsername: "admin", AdminPassword: "admin",
		ViewerUsername: "viewer", ViewerPassword: "viewer",
		BcryptCost: bcrypt.MinCost,
		Logger:     slog.New(slog.NewJSONHandler(&buf, nil)),
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = srv.Close() })
	admin := login(t, srv, "admin", "admin")

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/portfolio", nil).WithContext(ctx)
	req.Header.Set("Cookie", admin)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable || !bytes.Contains(rec.Body.Bytes(), []byte("請求已取消")) {
		t.Fatalf("cancelled %d %s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(buf.Bytes(), []byte(`"method":"GET"`)) || !bytes.Contains(buf.Bytes(), []byte(`"path":"/api/v1/portfolio"`)) {
		t.Fatalf("request log missing method/path: %s", buf.String())
	}
}

func TestListenShutsDown(t *testing.T) {
	srv := testServer(t)
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- srv.Serve(ctx, ln) }()

	resp, err := http.Get("http://" + ln.Addr().String() + "/healthz")
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 || !bytes.Contains(body, []byte(`"ok":true`)) {
		t.Fatalf("health %d %s", resp.StatusCode, body)
	}
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("shutdown timed out")
	}
}

func login(t *testing.T, srv *Server, username, password string) string {
	t.Helper()
	rec := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": username, "password": password})
	if rec.Code != 200 {
		t.Fatalf("login %s %d %s", username, rec.Code, rec.Body.String())
	}
	return cookieHeader(t, rec)
}
