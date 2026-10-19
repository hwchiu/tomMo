package domain

import (
	"regexp"
	"strings"
	"time"
)

const (
	ScheduleDateInvalid  = "時程格式須為 YYYY-MM-DD"
	ScheduleMonthInvalid = "月份格式須為 YYYY-MM"
	ScheduleOrderInvalid = "時程的開始日不能晚於結束日"
)

var monthPattern = regexp.MustCompile(`^\d{4}-\d{2}$`)

// Schedule is an inclusive date window. Empty From and To means no filter.
type Schedule struct {
	From string
	To   string
}

func (s Schedule) Active() bool {
	return s.From != "" || s.To != ""
}

type scheduleError string

func (e scheduleError) Error() string { return string(e) }

// ParseSchedule reads month=YYYY-MM or from/to. from and to win when either is set.
// A lone bound is open. Both empty, with no month, is the unfiltered schedule.
func ParseSchedule(month, from, to string) (Schedule, error) {
	month = strings.TrimSpace(month)
	from = strings.TrimSpace(from)
	to = strings.TrimSpace(to)
	if from == "" && to == "" && month != "" {
		start, end, err := MonthBounds(month)
		if err != nil {
			return Schedule{}, err
		}
		from, to = start, end
	}
	if from != "" && !IsIsoDate(from) {
		return Schedule{}, scheduleError(ScheduleDateInvalid)
	}
	if to != "" && !IsIsoDate(to) {
		return Schedule{}, scheduleError(ScheduleDateInvalid)
	}
	if from != "" && to != "" && from > to {
		return Schedule{}, scheduleError(ScheduleOrderInvalid)
	}
	return Schedule{From: from, To: to}, nil
}

// MonthBounds returns the first and last calendar day of YYYY-MM.
func MonthBounds(month string) (string, string, error) {
	if !monthPattern.MatchString(month) {
		return "", "", scheduleError(ScheduleMonthInvalid)
	}
	start, err := time.Parse("2006-01", month)
	if err != nil {
		return "", "", scheduleError(ScheduleMonthInvalid)
	}
	end := start.AddDate(0, 1, -1)
	return start.Format("2006-01-02"), end.Format("2006-01-02"), nil
}

// Overlaps reports whether the span [start, end] meets the inclusive window [from, to].
// A missing endpoint of the span makes it a single day. A span with no dates does not overlap.
// An empty from or to leaves that side of the window open. Touching either endpoint counts.
func Overlaps(start, end, from, to string) bool {
	if start == "" && end == "" {
		return false
	}
	if start == "" {
		start = end
	}
	if end == "" {
		end = start
	}
	if start > end {
		start, end = end, start
	}
	if from != "" && end < from {
		return false
	}
	if to != "" && start > to {
		return false
	}
	return true
}

// FactoryInSchedule is true when the factory has any progress requirement in the window.
// An inactive schedule includes every factory.
func FactoryInSchedule(db *Database, factoryID string, sched Schedule) bool {
	if !sched.Active() {
		return true
	}
	for i := range db.Phases {
		phase := &db.Phases[i]
		if phase.FactoryID != factoryID || phase.Order != 2 {
			continue
		}
		if Overlaps(phase.PlannedStart, phase.PlannedEnd, sched.From, sched.To) {
			return true
		}
		if Overlaps(deref(phase.ActualStart), deref(phase.ActualEnd), sched.From, sched.To) {
			return true
		}
	}
	for i := range db.Plans {
		plan := &db.Plans[i]
		if plan.FactoryID != factoryID {
			continue
		}
		if Overlaps(deref(plan.ConstructionStart), deref(plan.ConstructionEnd), sched.From, sched.To) {
			return true
		}
	}
	for i := range db.Deployments {
		dep := &db.Deployments[i]
		if dep.FactoryID == factoryID && Overlaps(deref(dep.PlannedDate), "", sched.From, sched.To) {
			return true
		}
	}
	for i := range db.Issues {
		issue := &db.Issues[i]
		if issue.FactoryID == factoryID && issueOpen(issue.Status) && Overlaps(deref(issue.DueDate), "", sched.From, sched.To) {
			return true
		}
	}
	phases := map[string]bool{}
	for i := range db.Phases {
		if db.Phases[i].FactoryID == factoryID {
			phases[db.Phases[i].ID] = true
		}
	}
	for i := range db.Milestones {
		ms := &db.Milestones[i]
		if phases[ms.PhaseID] && Overlaps(ms.DueDate, "", sched.From, sched.To) {
			return true
		}
	}
	return false
}

// ProductInSchedule is the product cell's own activity: its construction window,
// planned date, or an open issue tied to that product. Phase 2, milestones, and
// factory-wide issues do not light up a cell.
func ProductInSchedule(db *Database, factoryID, productID string, sched Schedule) bool {
	if !sched.Active() {
		return true
	}
	for i := range db.Plans {
		plan := &db.Plans[i]
		if plan.FactoryID != factoryID || plan.ProductID != productID {
			continue
		}
		if Overlaps(deref(plan.ConstructionStart), deref(plan.ConstructionEnd), sched.From, sched.To) {
			return true
		}
	}
	for i := range db.Deployments {
		dep := &db.Deployments[i]
		if dep.FactoryID == factoryID && dep.ProductID == productID && Overlaps(deref(dep.PlannedDate), "", sched.From, sched.To) {
			return true
		}
	}
	for i := range db.Issues {
		issue := &db.Issues[i]
		if issue.FactoryID != factoryID || deref(issue.ProductID) != productID || !issueOpen(issue.Status) {
			continue
		}
		if Overlaps(deref(issue.DueDate), "", sched.From, sched.To) {
			return true
		}
	}
	return false
}

func issueOpen(status string) bool {
	return status == "OPEN" || status == "IN_PROGRESS" || status == "BLOCKED"
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
