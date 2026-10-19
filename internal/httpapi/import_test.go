package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	demodata "fpm/data/demo"
	"fpm/internal/impex"
	"fpm/internal/store"
	"fpm/internal/views"
	"golang.org/x/crypto/bcrypt"
)

func testServerMode(t *testing.T, mode string) *Server {
	t.Helper()
	srv, err := New(Config{
		DataDir:        t.TempDir(),
		SessionSecret:  "test-secret",
		AdminUsername:  "admin",
		AdminPassword:  "admin",
		ViewerUsername: "viewer",
		ViewerPassword: "viewer",
		BcryptCost:     bcrypt.MinCost,
		SeedMode:       mode,
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = srv.Close() })
	return srv
}

func TestEmptyModeHasNoDemo(t *testing.T) {
	srv := testServerMode(t, store.SeedNone)
	admin := login(t, srv, "admin", "admin")
	viewer := login(t, srv, "viewer", "viewer")
	forbidden := do(srv, http.MethodPost, "/api/v1/people", viewer, map[string]string{"name": "不行", "department": "廠務處"})
	if forbidden.Code != http.StatusForbidden {
		t.Fatalf("viewer write %d %s", forbidden.Code, forbidden.Body.String())
	}
	list := do(srv, http.MethodGet, "/api/v1/factories", admin, nil)
	var factories views.FactoryList
	if err := json.Unmarshal(list.Body.Bytes(), &factories); err != nil {
		t.Fatal(err)
	}
	if len(factories.Items) != 0 {
		t.Fatalf("empty factories %+v", factories.Items)
	}
	boot := do(srv, http.MethodGet, "/api/v1/bootstrap", admin, nil)
	if !bytes.Contains(boot.Body.Bytes(), []byte("系統管理員")) || !bytes.Contains(boot.Body.Bytes(), []byte(impex.EmptyViewerName)) {
		t.Fatalf("bootstrap %s", boot.Body.String())
	}
	reset := do(srv, http.MethodPost, "/api/v1/session/reset", admin, map[string]bool{})
	if reset.Code != http.StatusBadRequest || !bytes.Contains(reset.Body.Bytes(), []byte("這個環境沒有示範資料可重設")) {
		t.Fatalf("reset %d %s", reset.Code, reset.Body.String())
	}
}

func TestImportExportAgainstHTTP(t *testing.T) {
	srv := testServerMode(t, store.SeedNone)
	ts := httptest.NewServer(srv)
	t.Cleanup(ts.Close)
	files, err := demodata.Read()
	if err != nil {
		t.Fatal(err)
	}
	dry, err := impex.ImportRemote(context.Background(), ts.URL, "admin", "admin", files, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(dry.Errors) > 0 || len(dry.Created) == 0 {
		t.Fatalf("dry-run %s", dry.Text(true))
	}
	admin := login(t, srv, "admin", "admin")
	list := do(srv, http.MethodGet, "/api/v1/factories", admin, nil)
	var factories views.FactoryList
	if err := json.Unmarshal(list.Body.Bytes(), &factories); err != nil {
		t.Fatal(err)
	}
	if len(factories.Items) != 0 {
		t.Fatalf("dry-run wrote factories %d", len(factories.Items))
	}

	first, err := impex.ImportRemote(context.Background(), ts.URL, "admin", "admin", files, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Errors) > 0 || len(first.Created) == 0 {
		t.Fatalf("import %s", first.Text(false))
	}
	list = do(srv, http.MethodGet, "/api/v1/factories", admin, nil)
	if err := json.Unmarshal(list.Body.Bytes(), &factories); err != nil {
		t.Fatal(err)
	}
	if len(factories.Items) != 12 {
		t.Fatalf("factories %d", len(factories.Items))
	}
	second, err := impex.ImportRemote(context.Background(), ts.URL, "admin", "admin", files, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Errors) > 0 || len(second.Created) != 0 || len(second.Updated) != 0 {
		t.Fatalf("second import created=%d updated=%d\n%s", len(second.Created), len(second.Updated), second.Text(false))
	}

	extra := map[string]string{impex.FilePeople: "name,department\n匯入測試員,廠務處\n"}
	added, err := impex.ImportRemote(context.Background(), ts.URL, "admin", "admin", extra, false)
	if err != nil || len(added.Errors) > 0 || len(added.Created) != 1 {
		t.Fatalf("extra %+v %v", added, err)
	}
	again, err := impex.ImportRemote(context.Background(), ts.URL, "admin", "admin", files, false)
	if err != nil || len(again.Created) != 0 || len(again.Updated) != 0 {
		t.Fatalf("reimport demo %+v %v", again, err)
	}
	exported, err := impex.ExportRemote(context.Background(), ts.URL, "admin", "admin")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains([]byte(exported[impex.FilePeople]), []byte("匯入測試員")) {
		t.Fatal("omitted person was deleted")
	}

	bad := do(srv, http.MethodPost, "/api/v1/import", admin, map[string]any{
		"files": map[string]string{impex.FilePeople: "name,department\n,廠務處\n"},
	})
	if bad.Code != http.StatusBadRequest {
		t.Fatalf("bad import %d %s", bad.Code, bad.Body.String())
	}
	var report impex.Report
	if err := json.Unmarshal(bad.Body.Bytes(), &report); err != nil {
		t.Fatal(err)
	}
	if len(report.Errors) == 0 || report.Errors[0].File != impex.FilePeople || report.Errors[0].Row != 2 {
		t.Fatalf("row error %+v", report.Errors)
	}

	demo := testServer(t)
	viewer := login(t, demo, "viewer", "viewer")
	forbidden := do(demo, http.MethodPost, "/api/v1/import", viewer, map[string]any{"files": extra})
	if forbidden.Code != http.StatusForbidden {
		t.Fatalf("viewer import %d %s", forbidden.Code, forbidden.Body.String())
	}
	exportedDemo := do(demo, http.MethodGet, "/api/v1/export", viewer, nil)
	if exportedDemo.Code != http.StatusOK || !bytes.Contains(exportedDemo.Body.Bytes(), []byte("新竹一廠")) {
		t.Fatalf("viewer export %d %s", exportedDemo.Code, exportedDemo.Body.String()[:min(200, exportedDemo.Body.Len())])
	}
}
