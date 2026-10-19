package store

import (
	"context"
	"errors"
	"strings"
	"testing"

	"fpm/internal/domain"
	"fpm/internal/impex"
	"golang.org/x/crypto/bcrypt"
)

func TestMutationErrors(t *testing.T) {
	base := loadDemo(t)
	actor := personID(t, base, "林品均")
	hsc := factoryID(t, base, "新竹一廠")
	khh := factoryID(t, base, "高雄三廠")
	compute := productID(t, base, "運算產品 Compute")
	dataProduct := productID(t, base, "資料產品 Data")
	external := personID(t, base, "馬怡君")
	version := versionID(t, base, compute, "2.4.0")
	machine := machineID(t, base, "機種A")
	start, end := "2026-08-01", "2026-07-01"
	late := "2026-10-01"
	early := "2026-07-01"
	badDate := "2026/03/01"
	neg := -1.0

	cases := []struct {
		name   string
		status int
		msg    string
		fn     func(*domain.Database) error
	}{
		{"empty person", 400, "姓名與部門必填", func(db *domain.Database) error {
			_, err := CreatePerson(db, actor, PersonInput{Name: " ", Department: ""})
			return err
		}},
		{"external person", 400, "外部人員由目錄同步，不能在這裡修改", func(db *domain.Database) error {
			_, err := UpdatePerson(db, actor, external, PersonInput{Name: "馬怡君", Department: "別處"})
			return err
		}},
		{"missing person", 404, "找不到這個人", func(db *domain.Database) error {
			_, err := UpdatePerson(db, actor, "per_missing", PersonInput{Name: "甲", Department: "乙"})
			return err
		}},
		{"factory required", 400, "工廠代碼與名稱必填", func(db *domain.Database) error {
			_, err := CreateFactory(db, actor, sampleFactory(""))
			return err
		}},
		{"factory duplicate", 400, "工廠代碼已存在", func(db *domain.Database) error {
			input := sampleFactory("FAB-HSC")
			input.PMID = actor
			_, err := CreateFactory(db, actor, input)
			return err
		}},
		{"factory status", 400, "工廠狀態不正確", func(db *domain.Database) error {
			input := sampleFactory("FAB-NEW")
			input.PMID = actor
			input.Status = "PAUSED"
			_, err := CreateFactory(db, actor, input)
			return err
		}},
		{"bad enum", 400, "請選擇有效的列舉值", func(db *domain.Database) error {
			input := sampleFactory("FAB-NEW")
			input.PMID = actor
			input.Category = "NOPE"
			_, err := CreateFactory(db, actor, input)
			return err
		}},
		{"inactive person", 400, "請從在職人員名單選擇", func(db *domain.Database) error {
			input := sampleFactory("FAB-NEW")
			input.PMID = "nobody"
			_, err := CreateFactory(db, actor, input)
			return err
		}},
		{"bad start date", 400, "計畫開始需要 YYYY-MM-DD", func(db *domain.Database) error {
			input := sampleFactory("FAB-NEW")
			input.PMID = actor
			input.PlannedStart = badDate
			_, err := CreateFactory(db, actor, input)
			return err
		}},
		{"unknown actor", 401, "找不到目前的操作者", func(db *domain.Database) error {
			_, err := CreatePerson(db, "nobody", PersonInput{Name: "甲", Department: "乙"})
			return err
		}},
		{"issue severity", 400, "嚴重度不正確", func(db *domain.Database) error {
			_, err := CreateIssue(db, actor, IssueInput{Title: "標題", FactoryID: hsc, OwnerID: actor, Severity: "URGENT", Priority: "P1", Status: "OPEN"})
			return err
		}},
		{"issue title", 400, "請填問題標題", func(db *domain.Database) error {
			_, err := CreateIssue(db, actor, IssueInput{Title: " ", FactoryID: hsc, OwnerID: actor, Severity: "LOW", Priority: "P1", Status: "OPEN"})
			return err
		}},
		{"unknown issue", 404, "找不到這筆問題", func(db *domain.Database) error {
			_, err := UpdateIssue(db, actor, "iss_missing", IssueInput{Title: "標題", FactoryID: hsc, OwnerID: actor, Severity: "LOW", Priority: "P1", Status: "OPEN"})
			return err
		}},
		{"plan reversed dates", 400, "施工結束日不能早於開始日", func(db *domain.Database) error {
			_, err := SavePlan(db, actor, hsc, compute, PlanInput{Intent: "draft", ConstructionStart: &start, ConstructionEnd: &end})
			return err
		}},
		{"negative machines", 400, "計畫機台數需為 0 以上的整數", func(db *domain.Database) error {
			_, err := SavePlan(db, actor, hsc, compute, PlanInput{Intent: "draft", Machines: machineRows(machine, neg)})
			return err
		}},
		{"unknown machine", 400, "找不到這個機種", func(db *domain.Database) error {
			_, err := SavePlan(db, actor, hsc, compute, PlanInput{Intent: "draft", Machines: machineRows("mt_missing", 1)})
			return err
		}},
		{"submit without version", 400, "送出前要選擇提供的版本", func(db *domain.Database) error {
			_, err := SavePlan(db, actor, khh, compute, PlanInput{Intent: "submit", ConstructionStart: &early, ConstructionEnd: &late})
			return err
		}},
		{"submit without window", 400, "送出前要填施工時間範圍", func(db *domain.Database) error {
			_, err := SavePlan(db, actor, khh, compute, PlanInput{Intent: "submit", ProvidedVersionID: &version})
			return err
		}},
		{"wrong version product", 400, "這個版本不屬於此產品", func(db *domain.Database) error {
			storage := productID(t, db, "儲存產品 Storage")
			_, err := SavePlan(db, actor, hsc, storage, PlanInput{Intent: "draft", ProvidedVersionID: &version})
			return err
		}},
		{"feature plan incomplete", 400, "送出前要為每個功能選擇啟用或關閉", func(db *domain.Database) error {
			_, err := SavePlan(db, actor, hsc, dataProduct, PlanInput{Intent: "draft", ConstructionStart: &early, ConstructionEnd: &late})
			return err
		}},
		{"approve approved plan", 400, "只有已提報的計畫可以核准", func(db *domain.Database) error {
			_, err := ApprovePlan(db, actor, hsc, compute)
			return err
		}},
		{"missing plan", 404, "找不到這份產品計畫", func(db *domain.Database) error {
			_, err := ApprovePlan(db, actor, "fac_missing", compute)
			return err
		}},
		{"product name", 400, "產品名稱必填", func(db *domain.Database) error {
			_, err := CreateProduct(db, actor, ProductInput{Name: " ", Mode: "VERSIONED", PrimaryOwnerID: actor})
			return err
		}},
		{"product mode", 400, "請選擇版本模式或僅功能開關", func(db *domain.Database) error {
			_, err := CreateProduct(db, actor, ProductInput{Name: "新產品", Mode: "CUSTOM", PrimaryOwnerID: actor})
			return err
		}},
		{"topic title", 400, "請填例外事項標題", func(db *domain.Database) error {
			_, err := CreateTopic(db, actor, hsc, TopicInput{Title: " ", OwnerID: actor, Status: "OPEN", RaisedOn: "2026-10-01"})
			return err
		}},
		{"topic status", 400, "例外事項狀態不正確", func(db *domain.Database) error {
			_, err := CreateTopic(db, actor, hsc, TopicInput{Title: "議題", OwnerID: actor, Status: "LATER", RaisedOn: "2026-10-01"})
			return err
		}},
		{"phase name", 400, "請填階段名稱", func(db *domain.Database) error {
			_, err := CreatePhase(db, actor, hsc, PhaseInput{Name: " ", Status: "NOT_STARTED", OwnerID: actor, PlannedStart: "2026-12-01", PlannedEnd: "2026-12-15"})
			return err
		}},
		{"enum code", 400, "代碼與名稱必填", func(db *domain.Database) error {
			_, err := CreateEnumeration(db, actor, EnumerationInput{Set: "factoryCategory", Code: "", Label: ""})
			return err
		}},
		{"machine code", 400, "機種代碼與名稱必填", func(db *domain.Database) error {
			_, err := CreateMachineType(db, actor, MachineTypeInput{})
			return err
		}},
		{"bad plan intent", 400, "請選擇草稿或送出", func(db *domain.Database) error {
			_, err := SavePlan(db, actor, hsc, compute, PlanInput{Intent: "approve"})
			return err
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db := cloneDB(t, base)
			assertAPI(t, tc.fn(db), tc.status, tc.msg)
		})
	}
	missing := cloneDB(t, base)
	if _, err := UpdateFactory(missing, actor, "fac_missing", sampleFactory("FAB-X")); err == nil || err.Error() != "找不到這座工廠" {
		t.Fatalf("update factory %v", err)
	}
}

func TestWorkflowPersistsAndAggregates(t *testing.T) {
	s := openDemo(t)
	var actor, hsc, storage, machine string
	if err := s.Read(func(db *domain.Database) error {
		actor = personID(t, db, "林品均")
		hsc = factoryID(t, db, "新竹一廠")
		storage = productID(t, db, "儲存產品 Storage")
		machine = machineID(t, db, "機種A")
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	beforePeople := 0
	if err := s.Read(func(db *domain.Database) error {
		beforePeople = len(db.People)
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	err := s.Write(func(db *domain.Database) error {
		if _, createErr := CreatePerson(db, actor, PersonInput{Name: "不該留下", Department: "廠務處"}); createErr != nil {
			return createErr
		}
		return errors.New("boom")
	})
	if err == nil || err.Error() != "boom" {
		t.Fatalf("rollback err %v", err)
	}
	if err := s.Read(func(db *domain.Database) error {
		if len(db.People) != beforePeople {
			t.Fatalf("people %d want %d", len(db.People), beforePeople)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	var created string
	if err := s.Write(func(db *domain.Database) error {
		body, createErr := CreatePerson(db, actor, PersonInput{Name: "品管測試員", Department: "廠務處"})
		created = body.ID
		return createErr
	}); err != nil {
		t.Fatal(err)
	}
	if err := s.Write(func(db *domain.Database) error {
		active := true
		_, updateErr := UpdatePerson(db, actor, created, PersonInput{Name: "品管測試員", Department: "品管處", Active: &active})
		return updateErr
	}); err != nil {
		t.Fatal(err)
	}
	if err := s.Read(func(db *domain.Database) error {
		found := false
		for _, item := range db.Activity {
			if item.EntityID == created && contains(item.Summary, "品管測試員") {
				found = true
			}
		}
		if !found {
			t.Fatal("activity missing person")
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	if err := s.Write(func(db *domain.Database) error {
		_, approveErr := ApprovePlan(db, actor, hsc, storage)
		return approveErr
	}); err != nil {
		t.Fatal(err)
	}
	err = s.Write(func(db *domain.Database) error {
		_, approveErr := ApprovePlan(db, actor, hsc, storage)
		return approveErr
	})
	assertAPI(t, err, 400, "只有已提報的計畫可以核准")

	start, end := "2026-08-01", "2026-12-20"
	if err := s.Write(func(db *domain.Database) error {
		_, saveErr := SavePlan(db, actor, hsc, storage, PlanInput{
			Intent: "draft", ConstructionStart: &start, ConstructionEnd: &end,
			Machines: machineRows(machine, 10), Note: "只留機種A",
		})
		return saveErr
	}); err != nil {
		t.Fatal(err)
	}
	var want int
	if err := s.Read(func(db *domain.Database) error {
		for _, plan := range db.Plans {
			if plan.FactoryID == hsc && plan.ProductID == storage {
				if plan.Status != "SUBMITTED" {
					t.Fatalf("edited approved plan status %s", plan.Status)
				}
			}
		}
		for _, row := range db.MachineQuantities {
			for _, deployment := range db.Deployments {
				if deployment.ID == row.DeploymentID && deployment.FactoryID == hsc {
					want += row.Planned
					if deployment.ProductID == storage && row.MachineTypeID == machine && row.Planned != 10 {
						t.Fatalf("planned %d", row.Planned)
					}
				}
			}
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	got, err := s.FactoryMachineSum(context.Background(), hsc)
	if err != nil || got != want || want <= 10 {
		t.Fatalf("sql sum %d want %d err %v", got, want, err)
	}

	var factory string
	if err := s.Write(func(db *domain.Database) error {
		input := sampleFactory("FAB-QA")
		input.Name = "測試廠"
		input.PMID = actor
		body, createErr := CreateFactory(db, actor, input)
		factory = body.ID
		return createErr
	}); err != nil {
		t.Fatal(err)
	}
	if err := s.Read(func(db *domain.Database) error {
		phases := 0
		for _, phase := range db.Phases {
			if phase.FactoryID == factory {
				phases++
			}
		}
		if phases != 4 {
			t.Fatalf("phases %d", phases)
		}
		products := len(db.Products)
		deployments := 0
		for _, deployment := range db.Deployments {
			if deployment.FactoryID == factory {
				deployments++
			}
		}
		if deployments != products {
			t.Fatalf("deployments %d products %d", deployments, products)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	if err := s.Reset(); err != nil {
		t.Fatal(err)
	}
	if err := s.Read(func(db *domain.Database) error {
		for _, person := range db.People {
			if person.Name == "品管測試員" {
				t.Fatal("reset kept the extra person")
			}
		}
		if len(db.Factories) != 12 {
			t.Fatalf("factories %d", len(db.Factories))
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}

func TestAccountsAndEmptyReset(t *testing.T) {
	if _, err := OpenWith(t.TempDir(), "sometimes"); err == nil || err.Error() != "SEED_MODE 必須是 none 或 demo" {
		t.Fatalf("mode %v", err)
	}
	empty := openMode(t, SeedNone)
	assertAPI(t, empty.Reset(), 400, "這個環境沒有示範資料可重設")
	_, err := empty.EnsureAccounts(AccountConfig{
		AdminUsername: "admin", AdminPassword: "unused", AdminPerson: "沒有這個人", BcryptCost: bcrypt.MinCost,
	})
	if err == nil || !contains(err.Error(), "找不到人員") {
		t.Fatalf("missing person %v", err)
	}

	demo := openDemo(t)
	password := "stored-secret"
	if _, err := demo.EnsureAccounts(AccountConfig{
		AdminUsername: "admin", AdminPassword: password, AdminPerson: "林品均",
		ViewerUsername: "viewer", ViewerPassword: "viewer-secret", ViewerPerson: "陳浩宇",
		BcryptCost: bcrypt.MinCost,
	}); err != nil {
		t.Fatal(err)
	}
	if !demo.PasswordMatches("admin", password) || demo.PasswordMatches("admin", "other") || demo.PasswordMatches("missing", password) {
		t.Fatal("password match")
	}
	if _, err := demo.EnsureAccounts(AccountConfig{
		AdminUsername: "admin", AdminPassword: "replaced", AdminPerson: "林品均", BcryptCost: bcrypt.MinCost,
	}); err != nil {
		t.Fatal(err)
	}
	if !demo.PasswordMatches("admin", password) || demo.PasswordMatches("admin", "replaced") {
		t.Fatal("existing password was overwritten")
	}
	id, _, role, person, ok, err := demo.FindAccount(context.Background(), "admin")
	if err != nil || !ok || id == "" || role != "editor" || person == "" {
		t.Fatalf("account %s %s %s %v %v", id, role, person, ok, err)
	}
	if _, _, _, _, ok, err = demo.FindAccount(context.Background(), "nobody"); err != nil || ok {
		t.Fatalf("missing account %v %v", ok, err)
	}
	generated, err := demo.EnsureAccounts(AccountConfig{
		AdminUsername: "nightly", AdminPassword: "", AdminPerson: "林品均", BcryptCost: bcrypt.MinCost,
	})
	if err != nil || len(generated) != 1 || generated[0].Password == "" || generated[0].Username != "nightly" {
		t.Fatal("generated credential missing")
	}
	if !demo.PasswordMatches("nightly", generated[0].Password) {
		t.Fatal("generated password does not match")
	}
	a, err := RandomPassword()
	if err != nil {
		t.Fatal(err)
	}
	b, err := RandomPassword()
	if err != nil || a == b || len(a) < 16 {
		t.Fatal("random password")
	}
}

func TestCatalogMutations(t *testing.T) {
	db := loadDemo(t)
	actor := personID(t, db, "林品均")
	hsc := factoryID(t, db, "新竹一廠")
	compute := productID(t, db, "運算產品 Compute")
	var phase string
	for _, item := range db.Phases {
		if item.FactoryID == hsc && item.Order == 2 {
			phase = item.ID
		}
	}
	var deployment string
	for _, item := range db.Deployments {
		if item.FactoryID == hsc && item.ProductID == compute {
			deployment = item.ID
		}
	}
	topic, err := CreateTopic(db, actor, hsc, TopicInput{Title: "新增議題", OwnerID: actor, Status: "OPEN", RaisedOn: "2026-10-02"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateTopic(db, actor, topic.ID, TopicInput{Title: "更新議題", OwnerID: actor, Status: "IN_DISCUSSION", RaisedOn: "2026-10-03"}); err != nil {
		t.Fatal(err)
	}
	issue, err := CreateIssue(db, actor, IssueInput{
		Title: "新問題", FactoryID: hsc, OwnerID: actor, Severity: "HIGH", Priority: "P1", Status: "OPEN", PhaseID: &phase,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateIssue(db, actor, issue.ID, IssueInput{
		Title: "新問題", FactoryID: hsc, OwnerID: actor, Severity: "HIGH", Priority: "P1", Status: "RESOLVED", Resolution: "已處理",
	}); err != nil {
		t.Fatal(err)
	}
	order := 9.0
	createdPhase, err := CreatePhase(db, actor, hsc, PhaseInput{
		Name: "加測階段", Order: &order, OwnerID: actor, PlannedStart: "2027-05-01", PlannedEnd: "2027-05-20", Status: "NOT_STARTED",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := UpdatePhase(db, actor, createdPhase.ID, PhaseInput{
		Name: "加測階段", Order: &order, OwnerID: actor, PlannedStart: "2027-05-01", PlannedEnd: "2027-06-01", Status: "IN_PROGRESS",
	}); err != nil {
		t.Fatal(err)
	}
	milestone, err := CreateMilestone(db, actor, phase, MilestoneInput{Name: "驗收", DueDate: "2026-11-01", OwnerID: actor})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateMilestone(db, actor, milestone.ID, MilestoneInput{Name: "驗收", DueDate: "2026-11-02", OwnerID: actor, Done: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateDeployment(db, actor, deployment, DeploymentInput{Status: "IN_PROGRESS", SecondaryOwnerID: actor, Notes: "備註"}); err != nil {
		t.Fatal(err)
	}
	enum, err := CreateEnumeration(db, actor, EnumerationInput{Set: "factoryRegion", Code: "LAB", Label: "實驗室"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateEnumeration(db, actor, enum.ID, EnumerationPatch{Label: "實驗室區", Active: true}); err != nil {
		t.Fatal(err)
	}
	kind, err := CreateMachineType(db, actor, MachineTypeInput{Code: "Z", Name: "機種Z"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateMachineType(db, actor, kind.ID, MachineTypePatch{Name: "機種Z改", Active: false}); err != nil {
		t.Fatal(err)
	}
	product, err := CreateProduct(db, actor, ProductInput{Name: "測試產品", Mode: "FEATURE_ONLY", PrimaryOwnerID: actor, DevDepartment: "開發", ProjectDepartment: "專案"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateProduct(db, actor, product.ID, ProductInput{Name: "測試產品改", Mode: "FEATURE_ONLY", PrimaryOwnerID: actor}); err != nil {
		t.Fatal(err)
	}
	input := sampleFactory("FAB-HSC")
	input.Name = "新竹一廠改"
	input.PMID = actor
	input.PlannedEnd = "2027-04-15"
	if _, err := UpdateFactory(db, actor, hsc, input); err != nil {
		t.Fatal(err)
	}
	var from, to string
	for _, version := range db.Versions {
		if version.ProductID != compute {
			continue
		}
		if version.Version == "2.3.0" {
			from = version.ID
		}
		if version.Version == "2.4.0" {
			to = version.ID
		}
	}
	changes := DiffVersionFeatures(db, &from, to)
	if len(changes) == 0 {
		t.Fatal("expected a feature diff between 2.3 and 2.4")
	}
	if len(DiffVersionFeatures(db, nil, "missing")) != 0 {
		t.Fatal("unknown version")
	}
	logged := false
	for _, item := range db.Activity {
		if contains(item.Summary, "測試產品改") || contains(item.Summary, "新竹一廠改") || contains(item.Summary, "新增議題") {
			logged = true
		}
	}
	if !logged {
		t.Fatal("catalog activity missing")
	}
}

func loadDemo(t *testing.T) *domain.Database {
	t.Helper()
	db, err := impex.LoadDemo()
	if err != nil {
		t.Fatal(err)
	}
	return &db
}

func cloneDB(t *testing.T, db *domain.Database) *domain.Database {
	t.Helper()
	next, err := impex.LoadDemo()
	if err != nil {
		t.Fatal(err)
	}
	_ = db
	return &next
}

func openDemo(t *testing.T) *Store {
	t.Helper()
	return openMode(t, SeedDemo)
}

func openMode(t *testing.T, mode string) *Store {
	t.Helper()
	s, err := OpenWith(t.TempDir(), mode)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

func personID(t *testing.T, db *domain.Database, name string) string {
	t.Helper()
	for _, person := range db.People {
		if person.Name == name {
			return person.ID
		}
	}
	t.Fatalf("person %s", name)
	return ""
}

func factoryID(t *testing.T, db *domain.Database, name string) string {
	t.Helper()
	for _, factory := range db.Factories {
		if factory.Name == name {
			return factory.ID
		}
	}
	t.Fatalf("factory %s", name)
	return ""
}

func productID(t *testing.T, db *domain.Database, name string) string {
	t.Helper()
	for _, product := range db.Products {
		if product.Name == name {
			return product.ID
		}
	}
	t.Fatalf("product %s", name)
	return ""
}

func versionID(t *testing.T, db *domain.Database, product, version string) string {
	t.Helper()
	for _, item := range db.Versions {
		if item.ProductID == product && item.Version == version {
			return item.ID
		}
	}
	t.Fatalf("version %s", version)
	return ""
}

func machineID(t *testing.T, db *domain.Database, name string) string {
	t.Helper()
	for _, item := range db.MachineTypes {
		if item.Name == name {
			return item.ID
		}
	}
	t.Fatalf("machine %s", name)
	return ""
}

func sampleFactory(code string) FactoryInput {
	return FactoryInput{
		Code: code, Name: "新廠", Location: "測試", Category: "GIGA", Region: "HQ", Technology: "N3",
		PlannedStart: "2026-03-01", Status: "ON_TRACK",
	}
}

func machineRows(id string, planned float64) []struct {
	MachineTypeID string  `json:"machineTypeId"`
	Planned       float64 `json:"planned"`
} {
	return []struct {
		MachineTypeID string  `json:"machineTypeId"`
		Planned       float64 `json:"planned"`
	}{{MachineTypeID: id, Planned: planned}}
}

func contains(s, part string) bool { return strings.Contains(s, part) }
