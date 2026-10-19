package domain

// Database mirrors src/domain/types.ts. Dates are YYYY-MM-DD; timestamps are ISO-8601.
// JSON tags match the TypeScript field names so the embedded seed and the API stay aligned.

type Database struct {
	Seq               int                    `json:"seq"`
	AsOf              string                 `json:"asOf"`
	Enumerations      []Enumeration          `json:"enumerations"`
	MachineTypes      []MachineType          `json:"machineTypes"`
	People            []Person               `json:"people"`
	PhaseTemplates    []PhaseTemplate        `json:"phaseTemplates"`
	Factories         []Factory              `json:"factories"`
	Phases            []Phase                `json:"phases"`
	Milestones        []Milestone            `json:"milestones"`
	Products          []Product              `json:"products"`
	Versions          []ProductVersion       `json:"versions"`
	Features          []FeatureDefinition    `json:"features"`
	VersionFeatures   []VersionFeature       `json:"versionFeatures"`
	Deployments       []ProductDeployment    `json:"deployments"`
	MachineQuantities []MachineQuantity      `json:"machineQuantities"`
	PhaseLinks        []DeploymentPhaseLink  `json:"phaseLinks"`
	FeatureConfigs    []FeatureConfiguration `json:"featureConfigs"`
	Plans             []ProductFactoryPlan   `json:"plans"`
	Revisions         []PlanRevision         `json:"revisions"`
	Issues            []Issue                `json:"issues"`
	Topics            []DiscussionTopic      `json:"topics"`
	Activity          []Activity             `json:"activity"`
}

type Enumeration struct {
	ID          string `json:"id"`
	Set         string `json:"set"`
	Code        string `json:"code"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Order       int    `json:"order"`
	Active      bool   `json:"active"`
}

type Person struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Department string  `json:"department"`
	Active     bool    `json:"active"`
	Source     string  `json:"source"`
	ExternalID *string `json:"externalId"`
}

type PhaseTemplate struct {
	ID                  string `json:"id"`
	Code                string `json:"code"`
	Name                string `json:"name"`
	Description         string `json:"description"`
	Order               int    `json:"order"`
	DefaultDurationDays int    `json:"defaultDurationDays"`
}

type Factory struct {
	ID           string  `json:"id"`
	Code         string  `json:"code"`
	Name         string  `json:"name"`
	Location     string  `json:"location"`
	Description  string  `json:"description"`
	Category     string  `json:"category"`
	Region       string  `json:"region"`
	Technology   string  `json:"technology"`
	PMID         string  `json:"pmId"`
	PlannedStart string  `json:"plannedStart"`
	PlannedEnd   string  `json:"plannedEnd"`
	ActualStart  *string `json:"actualStart"`
	ActualEnd    *string `json:"actualEnd"`
	Status       string  `json:"status"`
}

type DiscussionTopic struct {
	ID          string `json:"id"`
	FactoryID   string `json:"factoryId"`
	Title       string `json:"title"`
	Description string `json:"description"`
	OwnerID     string `json:"ownerId"`
	Status      string `json:"status"`
	RaisedOn    string `json:"raisedOn"`
}

type Phase struct {
	ID                string   `json:"id"`
	FactoryID         string   `json:"factoryId"`
	TemplateID        *string  `json:"templateId"`
	Name              string   `json:"name"`
	Order             int      `json:"order"`
	OwnerID           string   `json:"ownerId"`
	PlannedStart      string   `json:"plannedStart"`
	PlannedEnd        string   `json:"plannedEnd"`
	ActualStart       *string  `json:"actualStart"`
	ActualEnd         *string  `json:"actualEnd"`
	Status            string   `json:"status"`
	RiskNote          string   `json:"riskNote"`
	DependsOnPhaseIds []string `json:"dependsOnPhaseIds"`
}

type Milestone struct {
	ID           string  `json:"id"`
	PhaseID      string  `json:"phaseId"`
	Name         string  `json:"name"`
	DueDate      string  `json:"dueDate"`
	Deliverables string  `json:"deliverables"`
	Done         bool    `json:"done"`
	CompletedAt  *string `json:"completedAt"`
	OwnerID      string  `json:"ownerId"`
}

type Product struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Description       string `json:"description"`
	DevDepartment     string `json:"devDepartment"`
	ProjectDepartment string `json:"projectDepartment"`
	PrimaryOwnerID    string `json:"primaryOwnerId"`
	Mode              string `json:"mode"`
}

type ProductVersion struct {
	ID         string  `json:"id"`
	ProductID  string  `json:"productId"`
	Version    string  `json:"version"`
	ReleasedAt *string `json:"releasedAt"`
	Notes      string  `json:"notes"`
}

type FeatureDefinition struct {
	ID             string `json:"id"`
	ProductID      string `json:"productId"`
	Code           string `json:"code"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	DefaultEnabled bool   `json:"defaultEnabled"`
}

type VersionFeature struct {
	VersionID string `json:"versionId"`
	FeatureID string `json:"featureId"`
	Supported bool   `json:"supported"`
}

type ProductDeployment struct {
	ID               string  `json:"id"`
	FactoryID        string  `json:"factoryId"`
	ProductID        string  `json:"productId"`
	PlannedVersionID *string `json:"plannedVersionId"`
	ActualVersionID  *string `json:"actualVersionId"`
	Status           string  `json:"status"`
	SecondaryOwnerID string  `json:"secondaryOwnerId"`
	PlannedDate      *string `json:"plannedDate"`
	DeployedAt       *string `json:"deployedAt"`
	Notes            string  `json:"notes"`
}

type DeploymentPhaseLink struct {
	ID           string `json:"id"`
	DeploymentID string `json:"deploymentId"`
	PhaseID      string `json:"phaseId"`
	Relation     string `json:"relation"`
}

type FeatureConfiguration struct {
	ID           string `json:"id"`
	DeploymentID string `json:"deploymentId"`
	FeatureID    string `json:"featureId"`
	Desired      bool   `json:"desired"`
	Actual       *bool  `json:"actual"`
}

type AdHocChange struct {
	ID          string  `json:"id"`
	Kind        string  `json:"kind"`
	FeatureID   *string `json:"featureId"`
	Enabled     *bool   `json:"enabled"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
}

type PlannedFeature struct {
	FeatureID string `json:"featureId"`
	Enabled   bool   `json:"enabled"`
}

type ProductFactoryPlan struct {
	ID                string           `json:"id"`
	FactoryID         string           `json:"factoryId"`
	ProductID         string           `json:"productId"`
	DeploymentID      string           `json:"deploymentId"`
	Status            string           `json:"status"`
	ProvidedVersionID *string          `json:"providedVersionId"`
	PlannedFeatures   []PlannedFeature `json:"plannedFeatures"`
	AdHocChanges      []AdHocChange    `json:"adHocChanges"`
	ConstructionStart *string          `json:"constructionStart"`
	ConstructionEnd   *string          `json:"constructionEnd"`
	Note              string           `json:"note"`
	SubmittedByID     *string          `json:"submittedById"`
	SubmittedAt       *string          `json:"submittedAt"`
	ApprovedByID      *string          `json:"approvedById"`
	ApprovedAt        *string          `json:"approvedAt"`
}

type MachineType struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Order  int    `json:"order"`
	Active bool   `json:"active"`
}

type MachineQuantity struct {
	ID            string `json:"id"`
	DeploymentID  string `json:"deploymentId"`
	MachineTypeID string `json:"machineTypeId"`
	Planned       int    `json:"planned"`
}

type PlannedMachine struct {
	MachineTypeID string `json:"machineTypeId"`
	Planned       int    `json:"planned"`
}

type PlanRevision struct {
	ID                string           `json:"id"`
	PlanID            string           `json:"planId"`
	Number            int              `json:"number"`
	Action            string           `json:"action"`
	ProvidedVersionID *string          `json:"providedVersionId"`
	PlannedFeatures   []PlannedFeature `json:"plannedFeatures"`
	AdHocChanges      []AdHocChange    `json:"adHocChanges"`
	ConstructionStart *string          `json:"constructionStart"`
	ConstructionEnd   *string          `json:"constructionEnd"`
	Machines          []PlannedMachine `json:"machines"`
	ActorID           string           `json:"actorId"`
	CreatedAt         string           `json:"createdAt"`
	Note              string           `json:"note"`
}

type Issue struct {
	ID          string  `json:"id"`
	Code        string  `json:"code"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	FactoryID   string  `json:"factoryId"`
	PhaseID     *string `json:"phaseId"`
	MilestoneID *string `json:"milestoneId"`
	ProductID   *string `json:"productId"`
	OwnerID     string  `json:"ownerId"`
	Severity    string  `json:"severity"`
	Priority    string  `json:"priority"`
	Status      string  `json:"status"`
	DueDate     *string `json:"dueDate"`
	Resolution  string  `json:"resolution"`
	UpdatedAt   string  `json:"updatedAt"`
}

type Activity struct {
	ID         string `json:"id"`
	EntityType string `json:"entityType"`
	EntityID   string `json:"entityId"`
	Action     string `json:"action"`
	Summary    string `json:"summary"`
	ActorID    string `json:"actorId"`
	CreatedAt  string `json:"createdAt"`
}

type FeatureChange struct {
	FeatureID  string `json:"featureId"`
	ChangeType string `json:"changeType"`
	Summary    string `json:"summary"`
}

// Normalize replaces nil slices with empty slices so JSON responses stay arrays.
func Normalize(db *Database) {
	db.Enumerations = nz(db.Enumerations)
	db.MachineTypes = nz(db.MachineTypes)
	db.People = nz(db.People)
	db.PhaseTemplates = nz(db.PhaseTemplates)
	db.Factories = nz(db.Factories)
	db.Phases = nz(db.Phases)
	db.Milestones = nz(db.Milestones)
	db.Products = nz(db.Products)
	db.Versions = nz(db.Versions)
	db.Features = nz(db.Features)
	db.VersionFeatures = nz(db.VersionFeatures)
	db.Deployments = nz(db.Deployments)
	db.MachineQuantities = nz(db.MachineQuantities)
	db.PhaseLinks = nz(db.PhaseLinks)
	db.FeatureConfigs = nz(db.FeatureConfigs)
	db.Plans = nz(db.Plans)
	db.Revisions = nz(db.Revisions)
	db.Issues = nz(db.Issues)
	db.Topics = nz(db.Topics)
	db.Activity = nz(db.Activity)
	for i := range db.Phases {
		db.Phases[i].DependsOnPhaseIds = nz(db.Phases[i].DependsOnPhaseIds)
	}
	for i := range db.Plans {
		db.Plans[i].PlannedFeatures = nz(db.Plans[i].PlannedFeatures)
		db.Plans[i].AdHocChanges = nz(db.Plans[i].AdHocChanges)
	}
	for i := range db.Revisions {
		db.Revisions[i].PlannedFeatures = nz(db.Revisions[i].PlannedFeatures)
		db.Revisions[i].AdHocChanges = nz(db.Revisions[i].AdHocChanges)
		db.Revisions[i].Machines = nz(db.Revisions[i].Machines)
	}
}

func nz[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}
