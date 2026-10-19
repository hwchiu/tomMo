package impex

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseReportsFileAndRow(t *testing.T) {
	_, rep := ParseFiles(map[string]string{
		FilePeople: "name\n林品均\n",
	})
	if len(rep.Errors) != 1 || rep.Errors[0].File != FilePeople || rep.Errors[0].Row != 1 || !strings.Contains(rep.Errors[0].Message, "department") {
		t.Fatalf("missing column %+v", rep.Errors)
	}

	_, rep = ParseFiles(map[string]string{
		FilePeople: "name,department\n林品均,廠務處\n林品均,廠務處\n",
	})
	if len(rep.Errors) != 1 || rep.Errors[0].Row != 3 || !strings.Contains(rep.Errors[0].Message, "重複") {
		t.Fatalf("duplicate %+v", rep.Errors)
	}

	_, rep = ParseFiles(map[string]string{
		FileFactories: "code,name,category,region,pm,planned_start,planned_end,status\n" +
			"FAB-HSC,新竹一廠,GIGA,HQ,林品均,2026/06/01,2026-12-31,ON_TRACK\n",
	})
	if len(rep.Errors) != 1 || rep.Errors[0].File != FileFactories || rep.Errors[0].Row != 2 || !strings.Contains(rep.Errors[0].Message, "YYYY-MM-DD") {
		t.Fatalf("date %+v", rep.Errors)
	}

	_, rep = ParseFiles(map[string]string{
		FilePlans: "factory,product,status,feature_changes\n新竹一廠,運算產品 Compute,SUBMITTED,液冷支援=maybe\n",
	})
	if len(rep.Errors) != 1 || rep.Errors[0].Row != 2 || !strings.Contains(rep.Errors[0].Message, "on 或 off") {
		t.Fatalf("feature change %+v", rep.Errors)
	}
}

func TestTemplateApplyIsIdempotent(t *testing.T) {
	root := moduleRoot(t)
	files, err := ReadDir(filepath.Join(root, "data", "templates"))
	if err != nil {
		t.Fatal(err)
	}
	ds, rep := ParseFiles(files)
	if len(rep.Errors) > 0 {
		t.Fatal(rep.Text(false))
	}
	db := LoadEmpty()
	rep = Apply(&db, ds, Options{})
	if len(rep.Errors) > 0 {
		t.Fatal(rep.Text(false))
	}
	var hsc, compute string
	for _, factory := range db.Factories {
		if factory.Name == "新竹一廠" {
			hsc = factory.ID
		}
	}
	for _, product := range db.Products {
		if product.Name == "運算產品 Compute" {
			compute = product.ID
		}
	}
	if hsc == "" || compute == "" {
		t.Fatal("template factory or product missing")
	}
	foundPlan := false
	for _, plan := range db.Plans {
		if plan.FactoryID == hsc && plan.ProductID == compute {
			foundPlan = plan.Status == "SUBMITTED"
		}
	}
	if !foundPlan {
		t.Fatal("template plan was not submitted")
	}
	sum := 0
	for _, dep := range db.Deployments {
		if dep.FactoryID == hsc && dep.ProductID == compute {
			for _, row := range db.MachineQuantities {
				if row.DeploymentID == dep.ID {
					sum += row.Planned
				}
			}
		}
	}
	if sum != 480 {
		t.Fatalf("template machines %d", sum)
	}
	external := false
	for _, person := range db.People {
		if person.ExternalID != nil && *person.ExternalID == "emp-2048" {
			external = true
		}
		if person.Name == EmptyAdminName && person.ID != "u_admin" {
			t.Fatalf("admin id %s", person.ID)
		}
	}
	if !external {
		t.Fatal("external person missing")
	}
	before := db.Seq
	rep = Apply(&db, ds, Options{})
	if len(rep.Errors) > 0 || len(rep.Created) != 0 || len(rep.Updated) != 0 || db.Seq != before {
		t.Fatalf("second apply created=%d updated=%d seq %d→%d\n%s", len(rep.Created), len(rep.Updated), before, db.Seq, rep.Text(false))
	}
}

func TestLoadEmptyPeople(t *testing.T) {
	db := LoadEmpty()
	got := map[string]string{}
	for _, person := range db.People {
		got[person.Name] = person.ID
	}
	if got[EmptyAdminName] != "u_admin" || got[EmptyViewerName] != "u_viewer" || len(db.People) != 2 {
		t.Fatalf("empty catalog people %+v", got)
	}
	if len(db.Factories) != 0 || len(db.Products) != 0 {
		t.Fatal("empty catalog has domain rows")
	}
}

func moduleRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("go.mod not found")
		}
		dir = parent
	}
}
