package views

import "fpm/internal/domain"

type MachineLineView struct {
	MachineTypeID string `json:"machineTypeId"`
	Code          string `json:"code"`
	Name          string `json:"name"`
	Planned       int    `json:"planned"`
}

type NamedRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ActivityItem struct {
	ID         string `json:"id"`
	EntityType string `json:"entityType"`
	EntityID   string `json:"entityId"`
	Action     string `json:"action"`
	Summary    string `json:"summary"`
	ActorName  string `json:"actorName"`
	CreatedAt  string `json:"createdAt"`
}

type DelayReasonView struct {
	domain.DelayReason
	OwnerName string `json:"ownerName"`
}

type ReasonCount struct {
	Code  string `json:"code"`
	Label string `json:"label"`
	Count int    `json:"count"`
}

type ExceptionItem struct {
	ID          string            `json:"id"`
	Rank        int               `json:"rank"`
	Tone        string            `json:"tone"`
	Title       string            `json:"title"`
	Detail      string            `json:"detail"`
	Href        string            `json:"href"`
	FactoryName string            `json:"factoryName"`
	Reasons     []DelayReasonView `json:"reasons"`
}

type PhaseBar struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Order        int     `json:"order"`
	Status       string  `json:"status"`
	PlannedStart string  `json:"plannedStart"`
	PlannedEnd   string  `json:"plannedEnd"`
	ActualStart  *string `json:"actualStart"`
	ActualEnd    *string `json:"actualEnd"`
}

type FactoryBoardRow struct {
	ID                 string            `json:"id"`
	Code               string            `json:"code"`
	Name               string            `json:"name"`
	Location           string            `json:"location"`
	Status             string            `json:"status"`
	Category           string            `json:"category"`
	CategoryLabel      string            `json:"categoryLabel"`
	Region             string            `json:"region"`
	RegionLabel        string            `json:"regionLabel"`
	Technology         string            `json:"technology"`
	TechnologyLabel    string            `json:"technologyLabel"`
	PMID               string            `json:"pmId"`
	PMName             string            `json:"pmName"`
	PMDepartment       string            `json:"pmDepartment"`
	MachineTotal       int               `json:"machineTotal"`
	MachineRollup      []MachineLineView `json:"machineRollup"`
	OpenTopics         int               `json:"openTopics"`
	NotReady           int               `json:"notReady"`
	CurrentPhaseName   string            `json:"currentPhaseName"`
	CurrentPhaseOrder  int               `json:"currentPhaseOrder"`
	CurrentPhaseStatus string            `json:"currentPhaseStatus"`
	CurrentOwnerName   string            `json:"currentOwnerName"`
	Phases             []PhaseBar        `json:"phases"`
	Blockers           int               `json:"blockers"`
	MissingPlans       int               `json:"missingPlans"`
	OutsideWindows     int               `json:"outsideWindows"`
}

type MilestoneRow struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	DueDate     string `json:"dueDate"`
	Done        bool   `json:"done"`
	Overdue     bool   `json:"overdue"`
	FactoryID   string `json:"factoryId"`
	FactoryName string `json:"factoryName"`
	PhaseName   string `json:"phaseName"`
	OwnerName   string `json:"ownerName"`
}

type PendingPlan struct {
	ID          string `json:"id"`
	FactoryID   string `json:"factoryId"`
	FactoryName string `json:"factoryName"`
	ProductID   string `json:"productId"`
	ProductName string `json:"productName"`
	Status      string `json:"status"`
	Mode        string `json:"mode"`
}

type Portfolio struct {
	AsOf         string            `json:"asOf"`
	Counts       PortfolioCounts   `json:"counts"`
	Exceptions   []ExceptionItem   `json:"exceptions"`
	Factories    []FactoryBoardRow `json:"factories"`
	Milestones   []MilestoneRow    `json:"milestones"`
	PendingPlans []PendingPlan     `json:"pendingPlans"`
}

type PortfolioCounts struct {
	Total   int `json:"total"`
	OnTrack int `json:"onTrack"`
	AtRisk  int `json:"atRisk"`
	Delayed int `json:"delayed"`
}

type Phase2 struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Status       string `json:"status"`
	PlannedStart string `json:"plannedStart"`
	PlannedEnd   string `json:"plannedEnd"`
}

type BuildCell struct {
	FactoryID          string                `json:"factoryId"`
	ProductID          string                `json:"productId"`
	DeploymentID       string                `json:"deploymentId"`
	PlanID             string                `json:"planId"`
	DeploymentStatus   string                `json:"deploymentStatus"`
	PlanStatus         string                `json:"planStatus"`
	Mode               string                `json:"mode"`
	ProvidedVersion    *string               `json:"providedVersion"`
	ActualVersion      *string               `json:"actualVersion"`
	ChangeCount        int                   `json:"changeCount"`
	VersionGap         bool                  `json:"versionGap"`
	PrimaryOwnerName   string                `json:"primaryOwnerName"`
	SecondaryOwnerName string                `json:"secondaryOwnerName"`
	Machines           []MachineLineView     `json:"machines"`
	PlannedTotal       int                   `json:"plannedTotal"`
	WindowStart        *string               `json:"windowStart"`
	WindowEnd          *string               `json:"windowEnd"`
	WindowState        domain.WindowState    `json:"windowState"`
	WindowReasons      []domain.WindowReason `json:"windowReasons"`
	Ready              bool                  `json:"ready"`
	Flags              []string              `json:"flags"`
	Reasons            []DelayReasonView     `json:"reasons"`
	InSchedule         bool                  `json:"inSchedule"`
}

type BuildRow struct {
	FactoryID       string            `json:"factoryId"`
	FactoryName     string            `json:"factoryName"`
	FactoryCode     string            `json:"factoryCode"`
	Category        string            `json:"category"`
	CategoryLabel   string            `json:"categoryLabel"`
	Region          string            `json:"region"`
	RegionLabel     string            `json:"regionLabel"`
	Technology      string            `json:"technology"`
	TechnologyLabel string            `json:"technologyLabel"`
	Status          string            `json:"status"`
	Phase2          *Phase2           `json:"phase2"`
	Cells           []BuildCell       `json:"cells"`
	ReadyCount      int               `json:"readyCount"`
	LateCount       int               `json:"lateCount"`
	GapCount        int               `json:"gapCount"`
	ReasonCounts    []ReasonCount     `json:"reasonCounts"`
	MachineTotal    int               `json:"machineTotal"`
	MachineRollup   []MachineLineView `json:"machineRollup"`
}

type ScheduleWindow struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type ProductBuild struct {
	AsOf     string          `json:"asOf"`
	Schedule *ScheduleWindow `json:"schedule"`
	Products []struct {
		ID               string `json:"id"`
		Name             string `json:"name"`
		PrimaryOwnerName string `json:"primaryOwnerName"`
		Mode             string `json:"mode"`
	} `json:"products"`
	Rows []BuildRow `json:"rows"`
}

type TimelineWindow struct {
	ID      string                `json:"id"`
	Label   string                `json:"label"`
	Start   *string               `json:"start"`
	End     *string               `json:"end"`
	State   domain.WindowState    `json:"state"`
	Reasons []domain.WindowReason `json:"reasons"`
}

type AdHocView struct {
	ID          string  `json:"id"`
	Kind        string  `json:"kind"`
	FeatureID   *string `json:"featureId"`
	FeatureName *string `json:"featureName"`
	Enabled     *bool   `json:"enabled"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
}

type FactoryDetail struct {
	AsOf            string              `json:"asOf"`
	ID              string              `json:"id"`
	Code            string              `json:"code"`
	Name            string              `json:"name"`
	Location        string              `json:"location"`
	Description     string              `json:"description"`
	Status          string              `json:"status"`
	Category        string              `json:"category"`
	CategoryLabel   string              `json:"categoryLabel"`
	Region          string              `json:"region"`
	RegionLabel     string              `json:"regionLabel"`
	Technology      string              `json:"technology"`
	TechnologyLabel string              `json:"technologyLabel"`
	PMID            string              `json:"pmId"`
	PMName          string              `json:"pmName"`
	PMDepartment    string              `json:"pmDepartment"`
	MachineTotal    int                 `json:"machineTotal"`
	PlannedStart    string              `json:"plannedStart"`
	PlannedEnd      string              `json:"plannedEnd"`
	ActualStart     *string             `json:"actualStart"`
	ActualEnd       *string             `json:"actualEnd"`
	Phases          []FactoryPhase      `json:"phases"`
	Windows         []TimelineWindow    `json:"windows"`
	Plans           []FactoryPlanCard   `json:"plans"`
	Deployments     []FactoryDeployment `json:"deployments"`
	Issues          []IssueListItem     `json:"issues"`
	Topics          []FactoryTopic      `json:"topics"`
	Activity        []ActivityItem      `json:"activity"`
	MachineRollup   []MachineLineView   `json:"machineRollup"`
}

type FactoryPhase struct {
	ID           string             `json:"id"`
	Name         string             `json:"name"`
	Order        int                `json:"order"`
	Status       string             `json:"status"`
	OwnerID      string             `json:"ownerId"`
	OwnerName    string             `json:"ownerName"`
	PlannedStart string             `json:"plannedStart"`
	PlannedEnd   string             `json:"plannedEnd"`
	ActualStart  *string            `json:"actualStart"`
	ActualEnd    *string            `json:"actualEnd"`
	RiskNote     string             `json:"riskNote"`
	DependsOn    []string           `json:"dependsOn"`
	Focus        bool               `json:"focus"`
	Milestones   []FactoryMilestone `json:"milestones"`
}

type FactoryMilestone struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	DueDate      string `json:"dueDate"`
	Deliverables string `json:"deliverables"`
	Done         bool   `json:"done"`
	Overdue      bool   `json:"overdue"`
	OwnerID      string `json:"ownerId"`
	OwnerName    string `json:"ownerName"`
}

type FactoryPlanCard struct {
	ID              string                `json:"id"`
	ProductID       string                `json:"productId"`
	ProductName     string                `json:"productName"`
	Mode            string                `json:"mode"`
	Status          string                `json:"status"`
	ProvidedVersion *string               `json:"providedVersion"`
	ChangeCount     int                   `json:"changeCount"`
	AdHocChanges    []AdHocView           `json:"adHocChanges"`
	WindowStart     *string               `json:"windowStart"`
	WindowEnd       *string               `json:"windowEnd"`
	WindowState     domain.WindowState    `json:"windowState"`
	WindowReasons   []domain.WindowReason `json:"windowReasons"`
	RevisionCount   int                   `json:"revisionCount"`
}

type FactoryDeployment struct {
	ID                 string            `json:"id"`
	ProductID          string            `json:"productId"`
	ProductName        string            `json:"productName"`
	Mode               string            `json:"mode"`
	Status             string            `json:"status"`
	PlannedVersion     *string           `json:"plannedVersion"`
	ActualVersion      *string           `json:"actualVersion"`
	BehindPlan         bool              `json:"behindPlan"`
	BehindLatest       bool              `json:"behindLatest"`
	SecondaryOwnerName string            `json:"secondaryOwnerName"`
	Machines           []MachineLineView `json:"machines"`
	PlannedTotal       int               `json:"plannedTotal"`
}

type FactoryTopic struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	OwnerID     string `json:"ownerId"`
	OwnerName   string `json:"ownerName"`
	Status      string `json:"status"`
	RaisedOn    string `json:"raisedOn"`
}

type IssueListItem struct {
	ID          string  `json:"id"`
	Code        string  `json:"code"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	FactoryID   string  `json:"factoryId"`
	FactoryName string  `json:"factoryName"`
	PhaseID     *string `json:"phaseId"`
	PhaseName   *string `json:"phaseName"`
	ProductID   *string `json:"productId"`
	ProductName *string `json:"productName"`
	OwnerID     string  `json:"ownerId"`
	OwnerName   string  `json:"ownerName"`
	Severity    string  `json:"severity"`
	Priority    string  `json:"priority"`
	Status      string  `json:"status"`
	DueDate     *string `json:"dueDate"`
	Overdue     bool    `json:"overdue"`
	Resolution  string  `json:"resolution"`
	UpdatedAt   string  `json:"updatedAt"`
}

type IssuePage struct {
	IssueListItem
	AsOf     string         `json:"asOf"`
	Activity []ActivityItem `json:"activity"`
}

type IssueList struct {
	AsOf   string          `json:"asOf"`
	Items  []IssueListItem `json:"items"`
	Total  int             `json:"total"`
	Limit  int             `json:"limit"`
	Offset int             `json:"offset"`
}

type ProductSummary struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	Description       string  `json:"description"`
	DevDepartment     string  `json:"devDepartment"`
	ProjectDepartment string  `json:"projectDepartment"`
	PrimaryOwnerID    string  `json:"primaryOwnerId"`
	PrimaryOwnerName  string  `json:"primaryOwnerName"`
	Mode              string  `json:"mode"`
	VersionCount      int     `json:"versionCount"`
	LatestVersion     *string `json:"latestVersion"`
	OutdatedFactories int     `json:"outdatedFactories"`
}

type ProductList struct {
	AsOf  string           `json:"asOf"`
	Items []ProductSummary `json:"items"`
}

type ProductDetail struct {
	ProductSummary
	AsOf        string              `json:"asOf"`
	Versions    []ProductVersionRow `json:"versions"`
	Features    []ProductFeatureRow `json:"features"`
	Deployments []ProductDeployment `json:"deployments"`
}

type ProductVersionRow struct {
	ID         string  `json:"id"`
	Version    string  `json:"version"`
	ReleasedAt *string `json:"releasedAt"`
	Notes      string  `json:"notes"`
	Features   []struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		Supported bool   `json:"supported"`
	} `json:"features"`
}

type ProductFeatureRow struct {
	ID             string `json:"id"`
	Code           string `json:"code"`
	Name           string `json:"name"`
	DefaultEnabled bool   `json:"defaultEnabled"`
}

type ProductDeployment struct {
	ID                 string            `json:"id"`
	FactoryID          string            `json:"factoryId"`
	FactoryName        string            `json:"factoryName"`
	FactoryCode        string            `json:"factoryCode"`
	Status             string            `json:"status"`
	PlannedVersion     *string           `json:"plannedVersion"`
	ActualVersion      *string           `json:"actualVersion"`
	BehindPlan         bool              `json:"behindPlan"`
	BehindLatest       bool              `json:"behindLatest"`
	SecondaryOwnerName string            `json:"secondaryOwnerName"`
	Machines           []MachineLineView `json:"machines"`
	PlannedTotal       int               `json:"plannedTotal"`
	PlanStatus         string            `json:"planStatus"`
	DeployedAt         *string           `json:"deployedAt"`
}

type CapabilityCellView struct {
	FeatureID string `json:"featureId"`
	domain.CapabilityCell
	Note string `json:"note"`
}

type CapabilityRow struct {
	DeploymentID string               `json:"deploymentId"`
	FactoryID    string               `json:"factoryId"`
	FactoryName  string               `json:"factoryName"`
	ProductID    string               `json:"productId"`
	ProductName  string               `json:"productName"`
	Mode         string               `json:"mode"`
	VersionLabel *string              `json:"versionLabel"`
	Cells        []CapabilityCellView `json:"cells"`
	AdHocChanges []AdHocView          `json:"adHocChanges"`
	InSchedule   bool                 `json:"inSchedule"`
}

type CapabilityMatrix struct {
	AsOf     string          `json:"asOf"`
	Schedule *ScheduleWindow `json:"schedule"`
	Features []struct {
		ID          string `json:"id"`
		Code        string `json:"code"`
		Name        string `json:"name"`
		ProductID   string `json:"productId"`
		ProductName string `json:"productName"`
	} `json:"features"`
	Rows      []CapabilityRow `json:"rows"`
	Factories []NamedRef      `json:"factories"`
	Products  []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Mode string `json:"mode"`
	} `json:"products"`
}

type PlanPage struct {
	AsOf               string                  `json:"asOf"`
	FactoryID          string                  `json:"factoryId"`
	FactoryName        string                  `json:"factoryName"`
	ProductID          string                  `json:"productId"`
	ProductName        string                  `json:"productName"`
	Mode               string                  `json:"mode"`
	PrimaryOwnerName   string                  `json:"primaryOwnerName"`
	DevDepartment      string                  `json:"devDepartment"`
	ProjectDepartment  string                  `json:"projectDepartment"`
	Phase2             *Phase2                 `json:"phase2"`
	DeploymentID       string                  `json:"deploymentId"`
	DeploymentStatus   string                  `json:"deploymentStatus"`
	ActualVersion      *string                 `json:"actualVersion"`
	SecondaryOwnerName string                  `json:"secondaryOwnerName"`
	PlanID             string                  `json:"planId"`
	Status             string                  `json:"status"`
	ProvidedVersionID  *string                 `json:"providedVersionId"`
	PlannedFeatures    []domain.PlannedFeature `json:"plannedFeatures"`
	AdHocChanges       []AdHocView             `json:"adHocChanges"`
	ConstructionStart  *string                 `json:"constructionStart"`
	ConstructionEnd    *string                 `json:"constructionEnd"`
	Note               string                  `json:"note"`
	Machines           []MachineLineView       `json:"machines"`
	PlannedTotal       int                     `json:"plannedTotal"`
	WindowState        domain.WindowState      `json:"windowState"`
	WindowReasons      []domain.WindowReason   `json:"windowReasons"`
	Versions           []PlanVersionOption     `json:"versions"`
	Features           []ProductFeatureRow     `json:"features"`
	Revisions          []PlanRevisionView      `json:"revisions"`
	CanEdit            bool                    `json:"canEdit"`
	CanApprove         bool                    `json:"canApprove"`
	AccessNote         string                  `json:"accessNote"`
}

type PlanVersionOption struct {
	ID      string `json:"id"`
	Version string `json:"version"`
	Notes   string `json:"notes"`
}

type PlanRevisionView struct {
	ID                string                `json:"id"`
	Number            int                   `json:"number"`
	Action            string                `json:"action"`
	Version           *string               `json:"version"`
	AdHocChanges      []AdHocView           `json:"adHocChanges"`
	ConstructionStart *string               `json:"constructionStart"`
	ConstructionEnd   *string               `json:"constructionEnd"`
	Machines          []PlanRevisionMachine `json:"machines"`
	ActorName         string                `json:"actorName"`
	CreatedAt         string                `json:"createdAt"`
	Note              string                `json:"note"`
}

type PlanRevisionMachine struct {
	MachineTypeID string `json:"machineTypeId"`
	Name          string `json:"name"`
	Planned       int    `json:"planned"`
}

type DeploymentPage struct {
	AsOf             string            `json:"asOf"`
	ID               string            `json:"id"`
	FactoryID        string            `json:"factoryId"`
	FactoryName      string            `json:"factoryName"`
	ProductID        string            `json:"productId"`
	ProductName      string            `json:"productName"`
	Mode             string            `json:"mode"`
	Status           string            `json:"status"`
	PlannedVersionID *string           `json:"plannedVersionId"`
	ActualVersionID  *string           `json:"actualVersionId"`
	SecondaryOwnerID string            `json:"secondaryOwnerId"`
	Machines         []MachineLineView `json:"machines"`
	PlannedTotal     int               `json:"plannedTotal"`
	PlannedDate      *string           `json:"plannedDate"`
	DeployedAt       *string           `json:"deployedAt"`
	Notes            string            `json:"notes"`
	Versions         []struct {
		ID      string `json:"id"`
		Version string `json:"version"`
	} `json:"versions"`
	People []domain.Person `json:"people"`
	Phases []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"phases"`
	Links []struct {
		PhaseID  string `json:"phaseId"`
		Relation string `json:"relation"`
	} `json:"links"`
	Features []DeploymentFeature `json:"features"`
}

type DeploymentFeature struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	DefaultEnabled    bool   `json:"defaultEnabled"`
	Desired           bool   `json:"desired"`
	Actual            *bool  `json:"actual"`
	SupportedByActual *bool  `json:"supportedByActual"`
}

type PhaseTemplateOption struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	Order               int    `json:"order"`
	DefaultDurationDays int    `json:"defaultDurationDays"`
}

type Bootstrap struct {
	AsOf           string                `json:"asOf"`
	Role           string                `json:"role"`
	Username       string                `json:"username"`
	Actor          domain.Person         `json:"actor"`
	People         []domain.Person       `json:"people"`
	Enumerations   []domain.Enumeration  `json:"enumerations"`
	MachineTypes   []domain.MachineType  `json:"machineTypes"`
	PhaseTemplates []PhaseTemplateOption `json:"phaseTemplates"`
}

type FactoryList struct {
	AsOf         string               `json:"asOf"`
	Items        []FactoryBoardRow    `json:"items"`
	People       []domain.Person      `json:"people"`
	Enumerations []domain.Enumeration `json:"enumerations"`
}

type ActivityList struct {
	AsOf   string         `json:"asOf"`
	Items  []ActivityItem `json:"items"`
	Total  int            `json:"total"`
	Limit  int            `json:"limit"`
	Offset int            `json:"offset"`
}

type PeopleList struct {
	Items  []domain.Person `json:"items"`
	Total  int             `json:"total"`
	Limit  int             `json:"limit"`
	Offset int             `json:"offset"`
}

// ListQuery pages and filters the lists that grow: issues, activity, and people.
// Limit defaults to 200 and caps at 500 so a demo screen still receives the full seed.
type ListQuery struct {
	Limit      int
	Offset     int
	FactoryID  string
	Severity   string
	Status     string
	Query      string
	EntityType string
	Active     *bool
	Overdue    *bool
}

type FeatureDiff struct {
	Changes []domain.FeatureChange `json:"changes"`
}
