package domain

type ReadinessFlag string

const (
	FlagPlanMissing      ReadinessFlag = "PLAN_MISSING"
	FlagPlanNotApproved  ReadinessFlag = "PLAN_NOT_APPROVED"
	FlagWindowMissing    ReadinessFlag = "WINDOW_MISSING"
	FlagWindowOutside    ReadinessFlag = "WINDOW_OUTSIDE"
	FlagVersionMissing   ReadinessFlag = "VERSION_MISSING"
	FlagFeatureUnplanned ReadinessFlag = "FEATURE_UNPLANNED"
)

type ReadinessInput struct {
	PlanStatus          string
	WindowState         WindowState
	Mode                string
	HasProvidedVersion  bool
	FeaturePlanComplete bool
}

type Readiness struct {
	Ready bool
	Flags []ReadinessFlag
}

func CellReadiness(input ReadinessInput) Readiness {
	flags := []ReadinessFlag{}
	if input.PlanStatus == "NOT_SUBMITTED" {
		flags = append(flags, FlagPlanMissing)
	} else if input.PlanStatus != "APPROVED" {
		flags = append(flags, FlagPlanNotApproved)
	}
	if input.WindowState == WindowMissing {
		flags = append(flags, FlagWindowMissing)
	}
	if input.WindowState == WindowOutside {
		flags = append(flags, FlagWindowOutside)
	}
	if input.PlanStatus != "NOT_SUBMITTED" {
		if input.Mode == "VERSIONED" && !input.HasProvidedVersion {
			flags = append(flags, FlagVersionMissing)
		}
		if input.Mode == "FEATURE_ONLY" && !input.FeaturePlanComplete {
			flags = append(flags, FlagFeatureUnplanned)
		}
	}
	return Readiness{Ready: len(flags) == 0, Flags: flags}
}
