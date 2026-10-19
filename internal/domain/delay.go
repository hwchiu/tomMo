package domain

// DueSoonDays is how far ahead a missing or unapproved plan still counts as 待補.
const DueSoonDays = 14

const (
	DelayKindLate = "late"
	DelayKindGap  = "gap"

	OwnerPrimary   = "primary"
	OwnerSecondary = "secondary"
	OwnerPM        = "pm"
	OwnerIssue     = "issue"
)

type DelayCode string

const (
	DelayPhase2DatesMissing  DelayCode = "PHASE2_DATES_MISSING"
	DelayPlanNotSubmitted    DelayCode = "PLAN_NOT_SUBMITTED"
	DelayPlanNotApproved     DelayCode = "PLAN_NOT_APPROVED"
	DelayVersionMissing      DelayCode = "VERSION_MISSING"
	DelayFeatureUnplanned    DelayCode = "FEATURE_UNPLANNED"
	DelayWindowMissing       DelayCode = "WINDOW_MISSING"
	DelayWindowStartsBefore  DelayCode = "WINDOW_STARTS_BEFORE"
	DelayWindowEndsAfter     DelayCode = "WINDOW_ENDS_AFTER"
	DelayConstructionOverdue DelayCode = "CONSTRUCTION_OVERDUE"
	DelayIssueOverdue        DelayCode = "ISSUE_OVERDUE"
)

// DelayCodes is the stable order used by cell payloads and factory summaries.
var DelayCodes = []DelayCode{
	DelayPhase2DatesMissing,
	DelayPlanNotSubmitted,
	DelayPlanNotApproved,
	DelayVersionMissing,
	DelayFeatureUnplanned,
	DelayWindowMissing,
	DelayWindowStartsBefore,
	DelayWindowEndsAfter,
	DelayConstructionOverdue,
	DelayIssueOverdue,
}

type DelaySpec struct {
	Code        DelayCode
	Label       string
	Explanation string
}

// DelayCatalog is the finite zh-TW taxonomy. Kind is not fixed: some codes are
// 延遲 once Phase 2 has started and 待補 before that.
var DelayCatalog = []DelaySpec{
	{DelayPhase2DatesMissing, "第二階段日期未設定", "這座廠沒有第二階段，或是計畫開始、結束日還沒填。算待補，不算已經遲到。"},
	{DelayPlanNotSubmitted, "施工計畫未提交", "計畫仍是未提交。第二階段已開始（或狀態已在進行）算延遲；開始日在 14 天內算待補；更遠則不列。"},
	{DelayPlanNotApproved, "計畫未核准", "計畫已提交但尚未核准。時間判斷與施工計畫未提交相同，不和未提交重複計算。"},
	{DelayVersionMissing, "未指定提供版本", "有版本的產品已提出計畫，卻沒有指定提供版本。階段已開始算延遲，否則算待補。"},
	{DelayFeatureUnplanned, "功能開關未定", "純功能開關產品已提出計畫，卻還沒為每個功能選擇開或關。階段已開始算延遲，否則算待補。"},
	{DelayWindowMissing, "施工時窗未填", "已提交或已核准的計畫少了施工開始或結束日。未提交的計畫不另列這項。階段已開始算延遲，否則算待補。"},
	{DelayWindowStartsBefore, "施工時窗早於第二階段", "施工開始日早於第二階段開始日。這是時程不符，算待補，不計遲到天數。"},
	{DelayWindowEndsAfter, "施工時窗晚於第二階段", "施工結束日晚於第二階段結束日。這是時程不符，算待補，不計遲到天數。"},
	{DelayConstructionOverdue, "已過預計完工日尚未完成", "施工結束日早於基準日，部署狀態還不是已驗收。遲到天數是基準日減結束日。"},
	{DelayIssueOverdue, "有逾期未解問題", "這座廠或這個產品有未結案問題（待處理、處理中、受阻），到期日早於基準日。沒有指定產品的問題會計入每一格。"},
}

type DelayIssue struct {
	ProductID *string `json:"productId"`
	Status    string  `json:"status"`
	DueDate   *string `json:"dueDate"`
	OwnerID   string  `json:"ownerId"`
}

type DelayInput struct {
	AsOf                string       `json:"asOf"`
	PhaseStart          string       `json:"phaseStart"`
	PhaseEnd            string       `json:"phaseEnd"`
	PhaseStatus         string       `json:"phaseStatus"`
	PhaseOwnerID        string       `json:"phaseOwnerId"`
	FactoryPMID         string       `json:"factoryPmId"`
	PlanStatus          string       `json:"planStatus"`
	Mode                string       `json:"mode"`
	HasProvidedVersion  bool         `json:"hasProvidedVersion"`
	FeaturePlanComplete bool         `json:"featurePlanComplete"`
	WindowStart         *string      `json:"windowStart"`
	WindowEnd           *string      `json:"windowEnd"`
	DeploymentStatus    string       `json:"deploymentStatus"`
	SecondaryOwnerID    string       `json:"secondaryOwnerId"`
	PrimaryOwnerID      string       `json:"primaryOwnerId"`
	ProductID           string       `json:"productId"`
	Issues              []DelayIssue `json:"issues"`
}

type DelayReason struct {
	Code          string `json:"code"`
	Label         string `json:"label"`
	Explanation   string `json:"explanation"`
	Kind          string `json:"kind"`
	DaysLate      *int   `json:"daysLate"`
	OwnerPersonID string `json:"ownerPersonId"`
	OwnerRole     string `json:"ownerRole"`
}

type phaseClock struct {
	late bool
	soon bool
	days *int
}

// DelayReasons returns the delay and gap reasons for one factory × product cell.
// 延遲 (late) is already past the as-of date. 待補 (gap) is missing or mismatched
// information that is not late yet. DaysLate is a calendar count only when the
// reason is late against a date; 0 means the phase started on the as-of date.
func DelayReasons(in DelayInput) []DelayReason {
	out := []DelayReason{}
	plan := in.PlanStatus
	if plan == "" {
		plan = "NOT_SUBMITTED"
	}
	deployment := in.DeploymentStatus
	if deployment == "" {
		deployment = "PLANNED"
	}
	start := text(in.WindowStart)
	end := text(in.WindowEnd)
	clock := phaseTiming(in)
	phaseOwner, phaseRole := phaseOwnerOf(in)
	primaryID, primaryRole := primaryOwnerOf(in)
	secondaryID, secondaryRole := secondaryOwnerOf(in)

	if in.PhaseStart == "" || in.PhaseEnd == "" {
		out = append(out, reason(DelayPhase2DatesMissing, DelayKindGap, nil, phaseOwner, phaseRole))
	}
	if plan == "NOT_SUBMITTED" {
		if kind, ok := listed(clock, false); ok {
			out = append(out, reason(DelayPlanNotSubmitted, kind, clock.days, primaryID, primaryRole))
		}
	} else if plan == "SUBMITTED" {
		if kind, ok := listed(clock, false); ok {
			out = append(out, reason(DelayPlanNotApproved, kind, clock.days, primaryID, primaryRole))
		}
	}
	if plan == "SUBMITTED" || plan == "APPROVED" {
		if in.Mode == "VERSIONED" && !in.HasProvidedVersion {
			kind, _ := listed(clock, true)
			days := (*int)(nil)
			if kind == DelayKindLate {
				days = clock.days
			}
			out = append(out, reason(DelayVersionMissing, kind, days, primaryID, primaryRole))
		}
		if in.Mode == "FEATURE_ONLY" && !in.FeaturePlanComplete {
			kind, _ := listed(clock, true)
			days := (*int)(nil)
			if kind == DelayKindLate {
				days = clock.days
			}
			out = append(out, reason(DelayFeatureUnplanned, kind, days, primaryID, primaryRole))
		}
		if start == "" || end == "" {
			kind, _ := listed(clock, true)
			days := (*int)(nil)
			if kind == DelayKindLate {
				days = clock.days
			}
			out = append(out, reason(DelayWindowMissing, kind, days, secondaryID, secondaryRole))
		}
	}
	if start != "" && end != "" && in.PhaseStart != "" && in.PhaseEnd != "" {
		if start < in.PhaseStart {
			out = append(out, reason(DelayWindowStartsBefore, DelayKindGap, nil, secondaryID, secondaryRole))
		}
		if end > in.PhaseEnd {
			out = append(out, reason(DelayWindowEndsAfter, DelayKindGap, nil, secondaryID, secondaryRole))
		}
	}
	if end != "" && end < in.AsOf && deployment != "ACCEPTED" {
		days := DayDiff(in.AsOf, end)
		out = append(out, reason(DelayConstructionOverdue, DelayKindLate, &days, secondaryID, secondaryRole))
	}
	if issue, days, ok := worstIssue(in); ok {
		out = append(out, reason(DelayIssueOverdue, DelayKindLate, &days, issue.OwnerID, OwnerIssue))
	}
	return out
}

func OwnerRoleLabel(role string) string {
	switch role {
	case OwnerPrimary:
		return "產品主責"
	case OwnerSecondary:
		return "工廠副責"
	case OwnerIssue:
		return "問題負責人"
	default:
		return "廠務 PM"
	}
}

func reason(code DelayCode, kind string, days *int, ownerID, role string) DelayReason {
	spec := delaySpec(code)
	return DelayReason{
		Code: string(code), Label: spec.Label, Explanation: spec.Explanation,
		Kind: kind, DaysLate: days, OwnerPersonID: ownerID, OwnerRole: role,
	}
}

func delaySpec(code DelayCode) DelaySpec {
	for _, spec := range DelayCatalog {
		if spec.Code == code {
			return spec
		}
	}
	return DelaySpec{Code: code, Label: string(code)}
}

func phaseTiming(in DelayInput) phaseClock {
	status := in.PhaseStatus
	active := status == "IN_PROGRESS" || status == "AT_RISK" || status == "DELAYED" || status == "COMPLETED"
	ended := status == "COMPLETED" || (in.PhaseEnd != "" && in.AsOf > in.PhaseEnd)
	if active || ended || (in.PhaseStart != "" && in.AsOf >= in.PhaseStart) {
		var days *int
		if in.PhaseStart != "" && in.AsOf >= in.PhaseStart {
			n := DayDiff(in.AsOf, in.PhaseStart)
			days = &n
		}
		return phaseClock{late: true, days: days}
	}
	if in.PhaseStart != "" && in.AsOf < in.PhaseStart && DayDiff(in.PhaseStart, in.AsOf) <= DueSoonDays {
		return phaseClock{soon: true}
	}
	return phaseClock{}
}

func listed(clock phaseClock, alwaysGap bool) (string, bool) {
	if clock.late {
		return DelayKindLate, true
	}
	if clock.soon || alwaysGap {
		return DelayKindGap, true
	}
	return "", false
}

func worstIssue(in DelayInput) (DelayIssue, int, bool) {
	var best DelayIssue
	bestDays := 0
	found := false
	for _, issue := range in.Issues {
		if issue.Status != "OPEN" && issue.Status != "IN_PROGRESS" && issue.Status != "BLOCKED" {
			continue
		}
		if issue.DueDate == nil || *issue.DueDate == "" || *issue.DueDate >= in.AsOf {
			continue
		}
		if issue.ProductID != nil && *issue.ProductID != "" && *issue.ProductID != in.ProductID {
			continue
		}
		days := DayDiff(in.AsOf, *issue.DueDate)
		if !found || days > bestDays {
			best = issue
			bestDays = days
			found = true
		}
	}
	return best, bestDays, found
}

func primaryOwnerOf(in DelayInput) (string, string) {
	if in.PrimaryOwnerID != "" {
		return in.PrimaryOwnerID, OwnerPrimary
	}
	return in.FactoryPMID, OwnerPM
}

func secondaryOwnerOf(in DelayInput) (string, string) {
	if in.SecondaryOwnerID != "" {
		return in.SecondaryOwnerID, OwnerSecondary
	}
	return in.FactoryPMID, OwnerPM
}

func phaseOwnerOf(in DelayInput) (string, string) {
	if in.PhaseOwnerID != "" {
		return in.PhaseOwnerID, OwnerPM
	}
	return in.FactoryPMID, OwnerPM
}

func text(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
