package domain

import (
	"math"
	"testing"
)

func TestPlannedTotalIgnoresNegatives(t *testing.T) {
	got := PlannedTotal([]PlannedLine{
		{Planned: 120},
		{Planned: 40},
		{Planned: 0},
		{Planned: -3},
	})
	if got != 160 {
		t.Fatalf("planned total = %d, want 160", got)
	}
	if NonNegativeInt(2.9) != 2 {
		t.Fatal("trunc")
	}
	if NonNegativeInt(0.4) != 0 || NonNegativeInt(math.NaN()) != 0 || NonNegativeInt(math.Inf(1)) != 0 || NonNegativeInt(-1.2) != 0 {
		t.Fatal("non-finite or non-positive should be 0")
	}
}

func TestRollupSumsAcrossDeployments(t *testing.T) {
	compute := []PlannedLine{{MachineTypeID: "mt_a", Planned: 420}, {MachineTypeID: "mt_b", Planned: 220}}
	storage := []PlannedLine{{MachineTypeID: "mt_a", Planned: 180}, {MachineTypeID: "mt_b", Planned: 120}}
	got := RollupPlanned([][]PlannedLine{compute, storage})
	if len(got) != 2 || got[0].MachineTypeID != "mt_a" || got[0].Planned != 600 || got[1].MachineTypeID != "mt_b" || got[1].Planned != 340 {
		t.Fatalf("rollup = %#v", got)
	}
	if PlannedTotal(got) != 940 {
		t.Fatalf("factory total = %d, want 940", PlannedTotal(got))
	}
	withNegative := RollupPlanned([][]PlannedLine{
		{{MachineTypeID: "mt_a", Planned: 10}, {MachineTypeID: "mt_b", Planned: -5}},
		{{MachineTypeID: "mt_a", Planned: 1}},
	})
	if withNegative[0].Planned != 11 || withNegative[1].Planned != 0 {
		t.Fatalf("negative line should not add, got %#v", withNegative)
	}
}
