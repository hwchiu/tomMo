package store

import (
	"context"
	"errors"
	"testing"

	"fpm/internal/apierr"
	"fpm/internal/domain"
)

func TestValidateWriteInputs(t *testing.T) {
	if err := validateIssue(IssueInput{Title: "  ", Severity: "LOW", Priority: "P1", Status: "OPEN"}); err == nil {
		t.Fatal("expected empty title")
	}
	assertAPI(t, validateIssue(IssueInput{Title: "標題", Severity: "URGENT", Priority: "P1", Status: "OPEN"}), 400, "嚴重度不正確")
	assertAPI(t, validateFactoryStatus("PAUSED"), 400, "工廠狀態不正確")
	assertAPI(t, validatePhase(PhaseInput{Name: "", Status: "IN_PROGRESS"}), 400, "請填階段名稱")
	assertAPI(t, validateDeploymentStatus("DONE"), 400, "部署狀態不正確")
	assertAPI(t, validatePlanIntent("approve"), 400, "請選擇草稿或送出")
	assertAPI(t, validateMilestoneName("   "), 400, "請填里程碑名稱")
	assertAPI(t, validateProductMode("CUSTOM"), 400, "請選擇版本模式或僅功能開關")
	assertAPI(t, validatePhaseLink("BLOCKED"), 400, "階段關聯不正確")
	if validateIssue(IssueInput{Title: "標題", Severity: "HIGH", Priority: "P0", Status: "BLOCKED"}) != nil {
		t.Fatal("valid issue rejected")
	}
}

func TestWriteContextHonoursCancel(t *testing.T) {
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	var before int
	if err := s.Read(func(db *domain.Database) error {
		before = len(db.People)
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	err = s.WriteContext(ctx, func(db *domain.Database) error {
		_, createErr := CreatePerson(db, "u_lin", PersonInput{Name: "不該寫入", Department: "廠務處"})
		return createErr
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v", err)
	}
	if err := s.Read(func(db *domain.Database) error {
		if len(db.People) != before {
			t.Fatalf("people %d want %d", len(db.People), before)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}

func TestSeedPortfolioShape(t *testing.T) {
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	err = s.Read(func(db *domain.Database) error {
		if len(db.Factories) != 12 || len(db.People) != 25 || len(db.Products) != 7 || len(db.MachineTypes) != 4 {
			t.Fatalf("factories=%d people=%d products=%d types=%d", len(db.Factories), len(db.People), len(db.Products), len(db.MachineTypes))
		}
		for _, factory := range db.Factories {
			topics := 0
			for _, topic := range db.Topics {
				if topic.FactoryID == factory.ID {
					topics++
				}
			}
			if topics == 0 {
				t.Fatalf("%s has no topics", factory.ID)
			}
			for _, product := range db.Products {
				deploymentID := ""
				for _, deployment := range db.Deployments {
					if deployment.FactoryID == factory.ID && deployment.ProductID == product.ID {
						deploymentID = deployment.ID
					}
				}
				if deploymentID == "" {
					t.Fatalf("%s missing %s", factory.ID, product.ID)
				}
				sum := 0
				for _, row := range db.MachineQuantities {
					if row.DeploymentID == deploymentID {
						sum += row.Planned
					}
				}
				if sum <= 0 {
					t.Fatalf("%s planned machines = %d", deploymentID, sum)
				}
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func assertAPI(t *testing.T, err error, status int, message string) {
	t.Helper()
	var api *apierr.Error
	if !errors.As(err, &api) || api.Status != status || api.Message != message {
		t.Fatalf("got %v want %d %s", err, status, message)
	}
}
