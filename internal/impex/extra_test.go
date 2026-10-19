package impex

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"
)

func TestRemoteImportExport(t *testing.T) {
	var sawDry, sawCookie bool
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/login", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body["password"] == "" {
			http.Error(w, "bad", http.StatusBadRequest)
			return
		}
		if body["password"] != "secret" {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"message":"帳號或密碼不正確"}`))
			return
		}
		http.SetCookie(w, &http.Cookie{Name: "fpm_session", Value: "ok", Path: "/"})
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
	mux.HandleFunc("/api/v1/import", func(w http.ResponseWriter, r *http.Request) {
		if _, err := r.Cookie("fpm_session"); err != nil {
			t.Errorf("import without cookie")
		}
		sawCookie = true
		var body importBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("import body %v", err)
		}
		sawDry = body.DryRun
		_, _ = w.Write([]byte(`{"created":[{"file":"people.csv","row":2,"action":"create","entity":"人員","name":"林品均"}],"unchanged":1}`))
	})
	mux.HandleFunc("/api/v1/export", func(w http.ResponseWriter, r *http.Request) {
		if _, err := r.Cookie("fpm_session"); err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"message":"請先登入"}`))
			return
		}
		_, _ = w.Write([]byte(`{"files":{"people.csv":"name,department\n林品均,廠務處\n"}}`))
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	if _, err := ImportRemote(context.Background(), srv.URL, "admin", "nope", map[string]string{"people.csv": "x"}, false); err == nil || !strings.Contains(err.Error(), "帳號或密碼不正確") {
		t.Fatalf("bad login %v", err)
	}
	report, err := ImportRemote(context.Background(), srv.URL+"/", "admin", "secret", map[string]string{"people.csv": "x"}, true)
	if err != nil || !sawDry || !sawCookie || len(report.Created) != 1 || report.Unchanged != 1 {
		t.Fatalf("import %+v %v", report, err)
	}
	files, err := ExportRemote(context.Background(), srv.URL, "admin", "secret")
	if err != nil || !strings.Contains(files["people.csv"], "林品均") {
		t.Fatalf("export %v %v", files, err)
	}

	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/login") {
			_, _ = w.Write([]byte(`{"ok":true}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("not-json"))
	}))
	defer bad.Close()
	if _, err := ImportRemote(context.Background(), bad.URL, "admin", "secret", map[string]string{}, false); err == nil || !strings.Contains(err.Error(), "匯入回應無法解析") {
		t.Fatalf("parse %v", err)
	}
	denied := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/login") {
			_, _ = w.Write([]byte(`{"ok":true}`))
			return
		}
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"message":"使用者只能閱讀"}`))
	}))
	defer denied.Close()
	if _, err := ExportRemote(context.Background(), denied.URL, "admin", "secret"); err == nil || !strings.Contains(err.Error(), "使用者只能閱讀") {
		t.Fatalf("export denied %v", err)
	}
}

func TestDiskReportAndUnknownSheet(t *testing.T) {
	db, err := LoadDemo()
	if err != nil {
		t.Fatal(err)
	}
	files, err := ExportDatabase(&db)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	if err := WriteDir(dir, files); err != nil {
		t.Fatal(err)
	}
	back, err := ReadDir(dir)
	if err != nil || !strings.Contains(back["factories.csv"], "新竹一廠") {
		t.Fatal(err)
	}
	if _, err := ReadDir(t.TempDir()); err == nil {
		t.Fatal("empty dir")
	}
	unknown := filepath.Join(dir, "notes.csv")
	if err := os.WriteFile(unknown, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := ReadDir(dir); err == nil || !strings.Contains(err.Error(), "不支援的檔案") {
		t.Fatalf("unknown file %v", err)
	}

	report := Report{Unchanged: 2, Created: []Change{{Entity: "人員", Name: "系統管理員"}}}
	text := report.Text(true)
	if !strings.Contains(text, "乾跑") || !strings.Contains(text, "自動補上") || !strings.Contains(text, "未變更 2") {
		t.Fatalf("text %s", text)
	}
	report.Errors = []RowError{{File: "people.csv", Row: 3, Message: "姓名與部門必填"}, {Message: "登入失敗"}}
	text = report.Text(false)
	if !strings.Contains(text, "第 3 列") || !strings.Contains(text, "錯誤 登入失敗") {
		t.Fatalf("errors %s", text)
	}

	book := excelize.NewFile()
	if err := book.SetSheetName("Sheet1", "nope"); err != nil {
		t.Fatal(err)
	}
	if err := book.SetCellStr("nope", "A1", "x"); err != nil {
		t.Fatal(err)
	}
	raw, err := book.WriteToBuffer()
	if err != nil {
		t.Fatal(err)
	}
	_, rep := ParseXLSX("bad.xlsx", raw)
	if len(rep.Errors) == 0 || !strings.Contains(rep.Text(false), "不支援的工作表") {
		t.Fatalf("%s", rep.Text(false))
	}
	empty := excelize.NewFile()
	raw, err = empty.WriteToBuffer()
	if err != nil {
		t.Fatal(err)
	}
	_, rep = ParseXLSX("empty.xlsx", raw)
	if len(rep.Errors) == 0 {
		t.Fatal("empty workbook")
	}
	if !hasCol(map[string]int{"name": 0}, "name") || hasCol(map[string]int{}, "name") {
		t.Fatal("hasCol")
	}
}
