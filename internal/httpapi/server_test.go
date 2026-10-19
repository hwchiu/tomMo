package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"fpm/internal/views"
	"golang.org/x/crypto/bcrypt"
)

func testServer(t *testing.T) *Server {
	t.Helper()
	srv, err := New(Config{
		DataDir:        t.TempDir(),
		SessionSecret:  "test-secret",
		AdminUsername:  "admin",
		AdminPassword:  "admin",
		ViewerUsername: "viewer",
		ViewerPassword: "viewer",
		BcryptCost:     bcrypt.MinCost,
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = srv.Close() })
	return srv
}

func do(srv *Server, method, path, cookie string, body any) *httptest.ResponseRecorder {
	var reader io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, reader)
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec
}

func cookieHeader(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	res := rec.Result()
	defer res.Body.Close()
	cookies := res.Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected session cookie")
	}
	c := cookies[0]
	if c.Name != "fpm_session" || !c.HttpOnly || c.Path != "/" {
		t.Fatalf("cookie = %#v", c)
	}
	return c.Name + "=" + c.Value
}

func TestAuthAndMachineTotals(t *testing.T) {
	srv := testServer(t)

	health := do(srv, http.MethodGet, "/healthz", "", nil)
	if health.Code != 200 || !bytes.Contains(health.Body.Bytes(), []byte(`"ok":true`)) {
		t.Fatalf("healthz %d %s", health.Code, health.Body.String())
	}

	anon := do(srv, http.MethodGet, "/api/v1/portfolio", "", nil)
	if anon.Code != 401 || !bytes.Contains(anon.Body.Bytes(), []byte("請先登入")) {
		t.Fatalf("anon portfolio %d %s", anon.Code, anon.Body.String())
	}

	bad := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": "admin", "password": "nope"})
	if bad.Code != 401 || !bytes.Contains(bad.Body.Bytes(), []byte("帳號或密碼不正確")) {
		t.Fatalf("bad login %d %s", bad.Code, bad.Body.String())
	}

	adminLogin := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": "admin", "password": "admin"})
	if adminLogin.Code != 200 {
		t.Fatalf("admin login %d %s", adminLogin.Code, adminLogin.Body.String())
	}
	adminCookie := cookieHeader(t, adminLogin)

	viewerLogin := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": "viewer", "password": "viewer"})
	if viewerLogin.Code != 200 {
		t.Fatalf("viewer login %d %s", viewerLogin.Code, viewerLogin.Body.String())
	}
	viewerCookie := cookieHeader(t, viewerLogin)

	forbidden := do(srv, http.MethodPost, "/api/v1/people", viewerCookie, map[string]string{"name": "不能新增", "department": "廠務處"})
	if forbidden.Code != 403 || !bytes.Contains(forbidden.Body.Bytes(), []byte("使用者只能閱讀")) {
		t.Fatalf("viewer post %d %s", forbidden.Code, forbidden.Body.String())
	}

	created := do(srv, http.MethodPost, "/api/v1/people", adminCookie, map[string]string{"name": "測試員", "department": "廠務處"})
	if created.Code != 200 {
		t.Fatalf("create person %d %s", created.Code, created.Body.String())
	}
	var idBody struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &idBody); err != nil || idBody.ID == "" {
		t.Fatalf("create body %s", created.Body.String())
	}

	portfolioRec := do(srv, http.MethodGet, "/api/v1/portfolio", adminCookie, nil)
	if portfolioRec.Code != 200 {
		t.Fatalf("portfolio %d %s", portfolioRec.Code, portfolioRec.Body.String())
	}
	var portfolio views.Portfolio
	if err := json.Unmarshal(portfolioRec.Body.Bytes(), &portfolio); err != nil {
		t.Fatal(err)
	}
	if len(portfolio.Factories) == 0 {
		t.Fatal("expected seeded factories")
	}
	seenHsinchu := false
	for _, factory := range portfolio.Factories {
		if factory.MachineTotal <= 0 {
			t.Fatalf("%s machineTotal = %d", factory.Name, factory.MachineTotal)
		}
		sum, err := srv.store.FactoryMachineSum(context.Background(), factory.ID)
		if err != nil {
			t.Fatal(err)
		}
		if sum != factory.MachineTotal {
			t.Fatalf("%s sql sum %d != machineTotal %d", factory.Name, sum, factory.MachineTotal)
		}
		if factory.Name == "新竹一廠" {
			seenHsinchu = true
		}
	}
	if !seenHsinchu {
		t.Fatal("seeded factory 新竹一廠 missing")
	}

	buildRec := do(srv, http.MethodGet, "/api/v1/product-build", adminCookie, nil)
	if buildRec.Code != 200 {
		t.Fatalf("product-build %d %s", buildRec.Code, buildRec.Body.String())
	}
	var matrix views.ProductBuild
	if err := json.Unmarshal(buildRec.Body.Bytes(), &matrix); err != nil {
		t.Fatal(err)
	}
	if len(matrix.Rows) == 0 || matrix.Rows[0].MachineTotal <= 0 {
		t.Fatalf("product-build machine total missing: %+v", matrix.Rows)
	}

	ref := demoRefOf(t, srv, adminCookie)
	planRec := do(srv, http.MethodGet, "/api/v1/factories/"+ref.hsc+"/products/"+ref.compute+"/plan", viewerCookie, nil)
	if planRec.Code != 200 {
		t.Fatalf("viewer plan %d %s", planRec.Code, planRec.Body.String())
	}
	var plan views.PlanPage
	if err := json.Unmarshal(planRec.Body.Bytes(), &plan); err != nil {
		t.Fatal(err)
	}
	if plan.CanEdit || plan.CanApprove || plan.AccessNote != "使用者只能閱讀。" {
		t.Fatalf("viewer plan access %+v", plan.AccessNote)
	}
	editorPlan := do(srv, http.MethodGet, "/api/v1/factories/"+ref.hsc+"/products/"+ref.storage+"/plan", adminCookie, nil)
	if err := json.Unmarshal(editorPlan.Body.Bytes(), &plan); err != nil {
		t.Fatal(err)
	}
	if !plan.CanEdit || !plan.CanApprove || plan.AccessNote != "編輯者可以修改與核准。" || plan.Status != "SUBMITTED" {
		t.Fatalf("editor plan canEdit=%v canApprove=%v status=%s note=%s", plan.CanEdit, plan.CanApprove, plan.Status, plan.AccessNote)
	}

	boot := do(srv, http.MethodGet, "/api/v1/bootstrap", adminCookie, nil)
	if boot.Code != 200 || !bytes.Contains(boot.Body.Bytes(), []byte("林品均")) || !bytes.Contains(boot.Body.Bytes(), []byte(`"role":"editor"`)) {
		t.Fatalf("bootstrap %d %s", boot.Code, boot.Body.String())
	}
	caps := do(srv, http.MethodGet, "/api/v1/capabilities", adminCookie, nil)
	if caps.Code != 200 || !bytes.Contains(caps.Body.Bytes(), []byte(`"tone":"`)) || !bytes.Contains(caps.Body.Bytes(), []byte(`"featureId":`)) {
		t.Fatalf("capabilities shape %d %s", caps.Code, caps.Body.String()[:min(400, caps.Body.Len())])
	}

	staticPage := do(srv, http.MethodGet, "/", "", nil)
	if staticPage.Code != 200 {
		t.Fatalf("static %d", staticPage.Code)
	}
}

type demoRef struct {
	hsc, compute, storage, phase, actor string
}

func demoRefOf(t *testing.T, srv *Server, cookie string) demoRef {
	t.Helper()
	boot := do(srv, http.MethodGet, "/api/v1/bootstrap", cookie, nil)
	var session views.Bootstrap
	if err := json.Unmarshal(boot.Body.Bytes(), &session); err != nil || session.Actor.ID == "" {
		t.Fatalf("bootstrap %d %s", boot.Code, boot.Body.String())
	}
	list := do(srv, http.MethodGet, "/api/v1/factories", cookie, nil)
	var factories views.FactoryList
	if err := json.Unmarshal(list.Body.Bytes(), &factories); err != nil {
		t.Fatal(err)
	}
	var hsc string
	for _, item := range factories.Items {
		if item.Name == "新竹一廠" {
			hsc = item.ID
		}
	}
	if hsc == "" {
		t.Fatal("新竹一廠 missing")
	}
	detailRec := do(srv, http.MethodGet, "/api/v1/factories/"+hsc, cookie, nil)
	var detail views.FactoryDetail
	if err := json.Unmarshal(detailRec.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	var phase string
	for _, item := range detail.Phases {
		if item.Order == 2 {
			phase = item.ID
		}
	}
	productsRec := do(srv, http.MethodGet, "/api/v1/products", cookie, nil)
	var products views.ProductList
	if err := json.Unmarshal(productsRec.Body.Bytes(), &products); err != nil {
		t.Fatal(err)
	}
	var compute, storage string
	for _, item := range products.Items {
		if item.Name == "運算產品 Compute" {
			compute = item.ID
		}
		if item.Name == "儲存產品 Storage" {
			storage = item.ID
		}
	}
	if phase == "" || compute == "" || storage == "" {
		t.Fatalf("lookup phase=%s compute=%s storage=%s", phase, compute, storage)
	}
	return demoRef{hsc: hsc, compute: compute, storage: storage, phase: phase, actor: session.Actor.ID}
}

func TestPersonPersistsAcrossRestart(t *testing.T) {
	dir := t.TempDir()
	cfg := Config{
		DataDir: dir, SessionSecret: "test-secret",
		AdminUsername: "admin", AdminPassword: "admin",
		ViewerUsername: "viewer", ViewerPassword: "viewer",
		BcryptCost: bcrypt.MinCost,
	}
	srv, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	login := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": "admin", "password": "admin"})
	cookie := cookieHeader(t, login)
	created := do(srv, http.MethodPost, "/api/v1/people", cookie, map[string]string{"name": "重啟後仍在", "department": "廠務處"})
	if created.Code != 200 {
		t.Fatalf("create %d %s", created.Code, created.Body.String())
	}
	if err := srv.Close(); err != nil {
		t.Fatal(err)
	}
	srv, err = New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer srv.Close()
	login = do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": "admin", "password": "admin"})
	cookie = cookieHeader(t, login)
	list := do(srv, http.MethodGet, "/api/v1/people", cookie, nil)
	if list.Code != 200 || !bytes.Contains(list.Body.Bytes(), []byte("重啟後仍在")) {
		t.Fatalf("people after restart %d %s", list.Code, list.Body.String())
	}
}

func TestScheduleQuery(t *testing.T) {
	srv := testServer(t)
	login := do(srv, http.MethodPost, "/api/v1/login", "", map[string]string{"username": "admin", "password": "admin"})
	cookie := cookieHeader(t, login)
	bad := do(srv, http.MethodGet, "/api/v1/product-build?month=2026-13", cookie, nil)
	if bad.Code != 400 || !bytes.Contains(bad.Body.Bytes(), []byte("月份格式須為 YYYY-MM")) {
		t.Fatalf("bad month %d %s", bad.Code, bad.Body.String())
	}
	ok := do(srv, http.MethodGet, "/api/v1/product-versions?from=2026-10-01&to=2026-10-31", cookie, nil)
	if ok.Code != 200 {
		t.Fatalf("product versions %d %s", ok.Code, ok.Body.String()[:min(300, ok.Body.Len())])
	}
	var matrix views.CapabilityMatrix
	if err := json.Unmarshal(ok.Body.Bytes(), &matrix); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, row := range matrix.Rows {
		seen[row.FactoryName] = true
	}
	if !seen["新竹一廠"] || seen["新竹二廠"] {
		t.Fatalf("rows %v", seen)
	}
}
