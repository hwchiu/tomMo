package domain

type WindowState string

const (
	WindowMissing WindowState = "MISSING"
	WindowInside  WindowState = "INSIDE"
	WindowOutside WindowState = "OUTSIDE"
)

type WindowReason string

const (
	ReasonMissingDates WindowReason = "MISSING_DATES"
	ReasonMissingPhase WindowReason = "MISSING_PHASE"
	ReasonStartsBefore WindowReason = "STARTS_BEFORE_PHASE"
	ReasonEndsAfter    WindowReason = "ENDS_AFTER_PHASE"
)

type ConstructionWindow struct {
	Start *string
	End   *string
}

type PhaseWindow struct {
	Start string
	End   string
}

type WindowCheck struct {
	State   WindowState
	Reasons []WindowReason
}

// EvaluateConstructionWindow flags a window only when it is missing or falls outside phase 2.
// Overlapping windows between products are not conflicts.
func EvaluateConstructionWindow(window ConstructionWindow, phase *PhaseWindow) WindowCheck {
	if blank(window.Start) || blank(window.End) {
		return WindowCheck{State: WindowMissing, Reasons: []WindowReason{ReasonMissingDates}}
	}
	if phase == nil || phase.Start == "" || phase.End == "" {
		return WindowCheck{State: WindowOutside, Reasons: []WindowReason{ReasonMissingPhase}}
	}
	reasons := []WindowReason{}
	if *window.Start < phase.Start {
		reasons = append(reasons, ReasonStartsBefore)
	}
	if *window.End > phase.End {
		reasons = append(reasons, ReasonEndsAfter)
	}
	if len(reasons) == 0 {
		return WindowCheck{State: WindowInside, Reasons: []WindowReason{}}
	}
	return WindowCheck{State: WindowOutside, Reasons: reasons}
}

func blank(p *string) bool {
	return p == nil || *p == ""
}
