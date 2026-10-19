package domain

import "testing"

func TestParseAndCompareSemver(t *testing.T) {
	cases := []struct {
		in                  string
		major, minor, patch int
		ok                  bool
	}{
		{"2.10.0", 2, 10, 0, true},
		{"v2.3", 2, 3, 0, true},
		{"V1", 1, 0, 0, true},
		{" 2.0.1 ", 2, 0, 1, true},
		{"", 0, 0, 0, false},
		{"latest", 0, 0, 0, false},
		{"1.2.3.4", 0, 0, 0, false},
	}
	for _, tc := range cases {
		major, minor, patch, ok := ParseSemver(tc.in)
		if major != tc.major || minor != tc.minor || patch != tc.patch || ok != tc.ok {
			t.Fatalf("ParseSemver(%q) = %d.%d.%d ok=%v", tc.in, major, minor, patch, ok)
		}
	}
	diff, ok := CompareSemver("2.10.0", "2.3.0")
	if !ok || diff <= 0 {
		t.Fatalf("2.10 vs 2.3 = %d %v", diff, ok)
	}
	if d, ok := CompareSemver("1.0.0", "1.0.0"); !ok || d != 0 {
		t.Fatalf("equal %d %v", d, ok)
	}
	if _, ok := CompareSemver("nope", "1.0.0"); ok {
		t.Fatal("invalid compare should fail")
	}
}

func TestConstructionWindow(t *testing.T) {
	phase := &PhaseWindow{Start: "2026-06-16", End: "2026-11-30"}
	start, end := "2026-06-16", "2026-11-30"
	inside := EvaluateConstructionWindow(ConstructionWindow{Start: &start, End: &end}, phase)
	if inside.State != WindowInside || len(inside.Reasons) != 0 {
		t.Fatalf("boundary %+v", inside)
	}
	early, late := "2026-06-01", "2026-12-20"
	both := EvaluateConstructionWindow(ConstructionWindow{Start: &early, End: &late}, phase)
	if both.State != WindowOutside || len(both.Reasons) != 2 {
		t.Fatalf("outside %+v", both)
	}
	missing := EvaluateConstructionWindow(ConstructionWindow{Start: &start, End: nil}, phase)
	if missing.State != WindowMissing || missing.Reasons[0] != ReasonMissingDates {
		t.Fatalf("missing %+v", missing)
	}
	empty := ""
	blankEnd := EvaluateConstructionWindow(ConstructionWindow{Start: &start, End: &empty}, phase)
	if blankEnd.State != WindowMissing {
		t.Fatalf("blank %+v", blankEnd)
	}
	noPhase := EvaluateConstructionWindow(ConstructionWindow{Start: &start, End: &end}, nil)
	if noPhase.State != WindowOutside || noPhase.Reasons[0] != ReasonMissingPhase {
		t.Fatalf("no phase %+v", noPhase)
	}
	// Overlap is not a conflict: two inside windows stay inside.
	a0, a1 := "2026-07-01", "2026-09-30"
	b0, b1 := "2026-08-01", "2026-10-15"
	if EvaluateConstructionWindow(ConstructionWindow{Start: &a0, End: &a1}, phase).State != WindowInside ||
		EvaluateConstructionWindow(ConstructionWindow{Start: &b0, End: &b1}, phase).State != WindowInside {
		t.Fatal("overlap should stay inside")
	}
}

func TestCellReadiness(t *testing.T) {
	ready := CellReadiness(ReadinessInput{
		PlanStatus: "APPROVED", WindowState: WindowInside, Mode: "VERSIONED", HasProvidedVersion: true, FeaturePlanComplete: true,
	})
	if !ready.Ready || len(ready.Flags) != 0 {
		t.Fatalf("ready %+v", ready)
	}
	missing := CellReadiness(ReadinessInput{PlanStatus: "NOT_SUBMITTED", WindowState: WindowMissing, Mode: "VERSIONED"})
	if missing.Ready || !hasFlag(missing.Flags, FlagPlanMissing) || !hasFlag(missing.Flags, FlagWindowMissing) {
		t.Fatalf("missing %+v", missing)
	}
	if hasFlag(missing.Flags, FlagVersionMissing) {
		t.Fatal("unsubmitted plan should not also demand a version")
	}
	submitted := CellReadiness(ReadinessInput{
		PlanStatus: "SUBMITTED", WindowState: WindowOutside, Mode: "FEATURE_ONLY", FeaturePlanComplete: false,
	})
	for _, flag := range []ReadinessFlag{FlagPlanNotApproved, FlagWindowOutside, FlagFeatureUnplanned} {
		if !hasFlag(submitted.Flags, flag) {
			t.Fatalf("missing %s in %+v", flag, submitted.Flags)
		}
	}
	versioned := CellReadiness(ReadinessInput{PlanStatus: "SUBMITTED", WindowState: WindowInside, Mode: "VERSIONED"})
	if !hasFlag(versioned.Flags, FlagVersionMissing) {
		t.Fatalf("%+v", versioned)
	}
}

func TestFeatureBaselineAndCapability(t *testing.T) {
	features := []FeatureDefinition{
		{ID: "ft_on", Name: "預設開", DefaultEnabled: true},
		{ID: "ft_off", Name: "預設關", DefaultEnabled: false},
	}
	planned := []PlannedFeature{{FeatureID: "ft_on", Enabled: false}, {FeatureID: "ft_off", Enabled: true}}
	changes := BaselineChanges(features, planned)
	if len(changes) != 2 || changes[0].ChangeType != "REMOVED" || changes[1].ChangeType != "ADDED" {
		t.Fatalf("%+v", changes)
	}
	if !IsFeaturePlanComplete([]string{"ft_on", "ft_off"}, planned) {
		t.Fatal("complete")
	}
	if IsFeaturePlanComplete([]string{"ft_on", "missing"}, planned) {
		t.Fatal("incomplete")
	}
	if !IsFeaturePlanComplete(nil, nil) {
		t.Fatal("empty feature list is complete")
	}
	on := true
	added := "ADDED"
	if v := ResolvePlanned(PlannedInput{Mode: "VERSIONED", ChangeType: &added, VersionSupported: boolPtr(false)}); v == nil || !*v {
		t.Fatal("ADDED forces on")
	}
	removed := "REMOVED"
	if v := ResolvePlanned(PlannedInput{Mode: "VERSIONED", ChangeType: &removed, VersionSupported: &on}); v == nil || *v {
		t.Fatal("REMOVED forces off")
	}
	if v := ResolvePlanned(PlannedInput{Mode: "VERSIONED", VersionSupported: &on}); v == nil || !*v {
		t.Fatal("version support")
	}
	if v := ResolvePlanned(PlannedInput{Mode: "FEATURE_ONLY", PlannedEnabled: boolPtr(false)}); v == nil || *v {
		t.Fatal("feature flag")
	}

	unplanned := CapabilityCellOf(CapabilityInput{Mode: "FEATURE_ONLY", DefaultEnabled: true})
	if unplanned.Tone != ToneUnplanned || unplanned.Adhoc {
		t.Fatalf("unplanned %+v", unplanned)
	}
	flipped := CapabilityCellOf(CapabilityInput{Mode: "FEATURE_ONLY", DefaultEnabled: false, PlannedEnabled: &on})
	if flipped.Tone != ToneAdded || !flipped.Adhoc {
		t.Fatalf("added %+v", flipped)
	}
	same := CapabilityCellOf(CapabilityInput{Mode: "FEATURE_ONLY", DefaultEnabled: true, PlannedEnabled: &on})
	if same.Tone != ToneUnchangedOn || same.Adhoc {
		t.Fatalf("same %+v", same)
	}
	off := false
	offCell := CapabilityCellOf(CapabilityInput{Mode: "FEATURE_ONLY", DefaultEnabled: false, PlannedEnabled: &off})
	if offCell.Tone != ToneUnchangedOff {
		t.Fatalf("off %+v", offCell)
	}
	versioned := CapabilityCellOf(CapabilityInput{Mode: "VERSIONED"})
	if versioned.Tone != ToneUnplanned {
		t.Fatalf("version missing %+v", versioned)
	}
	override := CapabilityCellOf(CapabilityInput{Mode: "VERSIONED", VersionSupported: &on, OverrideEnabled: &off})
	if override.Tone != ToneRemoved || !override.Adhoc || override.Planned == nil || *override.Planned {
		t.Fatalf("override %+v", override)
	}

	custom := AdHocChange{ID: "ah_custom", Kind: "CUSTOM", Title: "夜班"}
	prior := AdHocChange{ID: "ah_keep", Kind: "FEATURE_OVERRIDE", FeatureID: strPtr("ft_off"), Description: "舊說明"}
	again := FeatureOverrides(features, planned, map[string]string{"ft_on": "關掉"}, []AdHocChange{custom, prior})
	if len(again) != 3 || again[2].Kind != "CUSTOM" || again[2].Title != "夜班" {
		t.Fatalf("overrides %+v", again)
	}
	var kept, described bool
	for _, row := range again {
		if row.FeatureID != nil && *row.FeatureID == "ft_off" && row.ID == "ah_keep" {
			kept = true
		}
		if row.FeatureID != nil && *row.FeatureID == "ft_on" && row.Description == "關掉" && row.ID != "" {
			described = true
		}
	}
	if !kept || !described {
		t.Fatalf("reuse %+v", again)
	}
}

func TestDatesMachinesAndNormalize(t *testing.T) {
	if !IsIsoDate("2026-10-18") || IsIsoDate("2026-13-01") || IsIsoDate("18/10/2026") || IsIsoDate("") {
		t.Fatal("iso date")
	}
	if AddDays("2026-01-31", 1) != "2026-02-01" {
		t.Fatal(AddDays("2026-01-31", 1))
	}
	if AddDays("nope", 3) != "nope" {
		t.Fatal("bad date stays")
	}
	if NonNegativeInt(3.9) != 3 || NonNegativeInt(-1) != 0 || NonNegativeInt(0) != 0 {
		t.Fatal("non-negative")
	}
	lines := []PlannedLine{{MachineTypeID: "a", Planned: 10}, {MachineTypeID: "b", Planned: -4}, {Planned: 2.2}}
	if PlannedTotal(lines) != 12 {
		t.Fatalf("total %d", PlannedTotal(lines))
	}
	roll := RollupPlanned([][]PlannedLine{
		{{MachineTypeID: "a", Planned: 10}, {MachineTypeID: "b", Planned: 1}},
		{{MachineTypeID: "b", Planned: 4}, {MachineTypeID: "a", Planned: 2.8}},
	})
	if len(roll) != 2 || roll[0].MachineTypeID != "a" || roll[0].Planned != 12 || roll[1].Planned != 5 {
		t.Fatalf("rollup %+v", roll)
	}
	db := Database{}
	Normalize(&db)
	if db.Factories == nil || db.Plans == nil || db.Activity == nil {
		t.Fatal("normalize nil slices")
	}
}

func hasFlag(flags []ReadinessFlag, want ReadinessFlag) bool {
	for _, flag := range flags {
		if flag == want {
			return true
		}
	}
	return false
}

func boolPtr(v bool) *bool    { return &v }
func strPtr(v string) *string { return &v }
