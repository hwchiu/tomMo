package views

import (
	"testing"

	"fpm/internal/domain"
	"fpm/internal/impex"
)

func TestDemoViews(t *testing.T) {
	db, err := impex.LoadDemo()
	if err != nil {
		t.Fatal(err)
	}
	actor := mustName(t, &db, "林品均")
	portfolio, err := BuildPortfolio(&db)
	if err != nil {
		t.Fatal(err)
	}
	if len(portfolio.Factories) != 12 || portfolio.Counts.Total != 12 {
		t.Fatalf("factories %d counts %+v", len(portfolio.Factories), portfolio.Counts)
	}
	var hsc FactoryBoardRow
	for _, factory := range portfolio.Factories {
		if factory.Name == "新竹一廠" {
			hsc = factory
		}
		if len(factory.Phases) == 0 || factory.MachineTotal <= 0 || factory.PMName == "" {
			t.Fatalf("board row %+v", factory)
		}
	}
	if hsc.PMName != "林品均" || hsc.OutsideWindows == 0 || hsc.MachineTotal <= 0 {
		t.Fatalf("hsc %+v", hsc)
	}
	sum := 0
	for _, line := range hsc.MachineRollup {
		sum += line.Planned
	}
	if sum != hsc.MachineTotal {
		t.Fatalf("rollup %d total %d", sum, hsc.MachineTotal)
	}

	build, err := BuildProductBuild(&db)
	if err != nil || len(build.Rows) != 12 {
		t.Fatalf("build %d %v", len(build.Rows), err)
	}
	var storageOutside bool
	for _, row := range build.Rows {
		if row.FactoryName != "新竹一廠" {
			continue
		}
		if row.MachineTotal != hsc.MachineTotal {
			t.Fatalf("build total %d board %d", row.MachineTotal, hsc.MachineTotal)
		}
		for _, cell := range row.Cells {
			if cell.Mode == "VERSIONED" && cell.WindowState == domain.WindowOutside {
				storageOutside = true
			}
		}
	}
	if !storageOutside {
		t.Fatal("expected an outside construction window")
	}
	seen := map[string]bool{}
	for _, row := range build.Rows {
		if row.ReasonCounts == nil {
			t.Fatalf("nil reason counts for %s", row.FactoryName)
		}
		for _, cell := range row.Cells {
			for _, reason := range cell.Reasons {
				seen[reason.Code] = true
				if reason.Label == "" || reason.OwnerPersonID == "" || reason.OwnerName == "" || (reason.Kind != "late" && reason.Kind != "gap") {
					t.Fatalf("incomplete reason %+v", reason)
				}
			}
		}
	}
	for _, code := range domain.DelayCodes {
		if !seen[string(code)] {
			t.Errorf("demo data never produces %s", code)
		}
	}

	detail, err := BuildFactory(&db, hsc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if detail.PMName != "林品均" || detail.PMDepartment == "" || len(detail.Plans) == 0 || len(detail.Topics) == 0 {
		t.Fatalf("detail pm %s plans %d topics %d", detail.PMName, len(detail.Plans), len(detail.Topics))
	}
	outside := false
	var computeID, storageID string
	for _, plan := range detail.Plans {
		if plan.ProductName == "儲存產品 Storage" && plan.WindowState == domain.WindowOutside && plan.Status == "SUBMITTED" {
			outside = true
			storageID = plan.ProductID
		}
		if plan.ProductName == "運算產品 Compute" {
			computeID = plan.ProductID
		}
	}
	if !outside || computeID == "" {
		t.Fatal("factory plans")
	}

	editor, err := BuildPlan(&db, hsc.ID, storageID, actor, "editor")
	if err != nil || !editor.CanEdit || !editor.CanApprove || editor.AccessNote != "編輯者可以修改與核准。" || editor.PlannedTotal <= 0 {
		t.Fatalf("editor plan %+v %v", editor.AccessNote, err)
	}
	viewer, err := BuildPlan(&db, hsc.ID, storageID, actor, "viewer")
	if err != nil || viewer.CanEdit || viewer.CanApprove || viewer.AccessNote != "使用者只能閱讀。" {
		t.Fatalf("viewer plan %+v", viewer.AccessNote)
	}
	compute, err := BuildPlan(&db, hsc.ID, computeID, actor, "editor")
	if err != nil || compute.CanApprove || compute.Mode != "VERSIONED" {
		t.Fatalf("approved plan cannot be approved again %+v %v", compute.Status, err)
	}

	matrix, err := BuildCapabilities(&db)
	if err != nil {
		t.Fatal(err)
	}
	tones := map[domain.CapabilityTone]bool{}
	modes := map[string]bool{}
	for _, row := range matrix.Rows {
		modes[row.Mode] = true
		for _, cell := range row.Cells {
			tones[cell.Tone] = true
		}
	}
	if !modes["VERSIONED"] || !modes["FEATURE_ONLY"] || len(tones) < 2 {
		t.Fatalf("modes %v tones %v", modes, tones)
	}

	issues, err := BuildIssues(&db, ListQuery{Limit: 1, Severity: "CRITICAL"})
	if err != nil || issues.Limit != 1 || len(issues.Items) != 1 || issues.Total < 1 {
		t.Fatalf("issues %+v %v", issues, err)
	}
	issue, err := BuildIssue(&db, issues.Items[0].ID)
	if err != nil || issue.Title == "" || issue.Activity == nil {
		t.Fatalf("issue %+v %v", issue.Title, err)
	}
	if _, err := BuildIssue(&db, "missing"); err == nil {
		t.Fatal("missing issue")
	}

	products, err := BuildProducts(&db)
	if err != nil || len(products.Items) != 7 {
		t.Fatalf("products %d %v", len(products.Items), err)
	}
	var productID string
	for _, product := range products.Items {
		if product.Name == "運算產品 Compute" {
			productID = product.ID
			if product.Mode != "VERSIONED" || product.LatestVersion == nil {
				t.Fatalf("compute %+v", product)
			}
		}
	}
	product, err := BuildProduct(&db, productID)
	if err != nil || len(product.Versions) == 0 || len(product.Deployments) == 0 {
		t.Fatalf("product %+v %v", product.Name, err)
	}
	if _, err := BuildProduct(&db, "missing"); err == nil {
		t.Fatal("missing product")
	}

	var deploymentID string
	for _, deployment := range detail.Deployments {
		if deployment.ProductID == computeID {
			deploymentID = deployment.ID
		}
	}
	page, err := BuildDeployment(&db, deploymentID)
	if err != nil || page.FactoryName != "新竹一廠" || page.PlannedTotal <= 0 || page.ProductName == "" {
		t.Fatalf("deployment %+v %v", page.FactoryName, err)
	}
	if _, err := BuildDeployment(&db, "missing"); err == nil {
		t.Fatal("missing deployment")
	}

	activity := BuildActivity(&db, ListQuery{Limit: 5, Query: "林品均"})
	if activity.Total == 0 || len(activity.Items) == 0 || activity.Limit != 5 {
		t.Fatalf("activity %+v", activity)
	}
	people := BuildPeople(&db, ListQuery{Query: "馬怡君"})
	if people.Total != 1 || people.Items[0].Department == "" || people.Items[0].Source != "external" {
		t.Fatalf("people %+v", people)
	}
	factories, err := BuildFactories(&db)
	if err != nil || len(factories.Items) != 12 {
		t.Fatalf("factory list %v", err)
	}
	boot, err := BuildBootstrap(&db, actor, "editor", "admin")
	if err != nil || boot.Actor.Name != "林品均" || boot.Role != "editor" || len(boot.People) == 0 || len(boot.MachineTypes) != 4 {
		t.Fatalf("bootstrap %+v %v", boot.Actor.Name, err)
	}

	limit, offset := clampPage(0, -4)
	if limit != 200 || offset != 0 {
		t.Fatalf("clamp %d %d", limit, offset)
	}
	limit, offset = clampPage(900, 3)
	if limit != 500 || offset != 3 {
		t.Fatalf("clamp max %d %d", limit, offset)
	}
	pageItems, total, outLimit, outOffset := pageSlice([]string{"a", "b"}, 10, 5)
	if total != 2 || len(pageItems) != 0 || outLimit != 10 || outOffset != 5 {
		t.Fatalf("past end %v %d", pageItems, total)
	}
}

func mustName(t *testing.T, db *domain.Database, name string) string {
	t.Helper()
	for _, person := range db.People {
		if person.Name == name {
			return person.ID
		}
	}
	t.Fatalf("missing %s", name)
	return ""
}
