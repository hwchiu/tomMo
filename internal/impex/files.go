package impex

// Canonical CSV names. Sheet names in a workbook are the same without ".csv".
const (
	FilePeople       = "people.csv"
	FileMachineTypes = "machine_types.csv"
	FileProducts     = "products.csv"
	FileFeatures     = "features.csv"
	FileVersions     = "versions.csv"
	FileFactories    = "factories.csv"
	FilePhases       = "phases.csv"
	FilePlans        = "plans.csv"
	FileMachines     = "machine_counts.csv"
	FileTopics       = "topics.csv"
	FileIssues       = "issues.csv"
	FileMilestones   = "milestones.csv"
)

// FileOrder is the stable read and write order.
var FileOrder = []string{
	FilePeople,
	FileMachineTypes,
	FileProducts,
	FileFeatures,
	FileVersions,
	FileFactories,
	FilePhases,
	FilePlans,
	FileMachines,
	FileTopics,
	FileIssues,
	FileMilestones,
}

type fileSpec struct {
	required []string
	all      []string
}

var specs = map[string]fileSpec{
	FilePeople: {
		required: []string{"name", "department"},
		all:      []string{"name", "department", "active", "source", "external_id"},
	},
	FileMachineTypes: {
		required: []string{"name"},
		all:      []string{"name", "active"},
	},
	FileProducts: {
		required: []string{"name", "owner", "mode"},
		all:      []string{"name", "owner", "mode", "description", "dev_department", "project_department"},
	},
	FileFeatures: {
		required: []string{"product", "name"},
		all:      []string{"product", "name", "code", "description", "default_enabled", "supported_versions"},
	},
	FileVersions: {
		required: []string{"product", "version"},
		all:      []string{"product", "version", "released_at", "notes"},
	},
	FileFactories: {
		required: []string{"code", "name", "category", "region", "technology", "pm", "planned_start", "planned_end", "status"},
		all:      []string{"code", "name", "category", "region", "technology", "pm", "planned_start", "planned_end", "status", "location", "description", "actual_start", "actual_end"},
	},
	FilePhases: {
		required: []string{"factory", "name", "owner", "planned_start", "planned_end", "status"},
		all:      []string{"factory", "name", "owner", "planned_start", "planned_end", "status", "order", "actual_start", "actual_end", "risk_note"},
	},
	FilePlans: {
		required: []string{"factory", "product", "status"},
		all:      []string{"factory", "product", "status", "version", "actual_version", "deployment_status", "secondary", "construction_start", "construction_end", "note", "feature_changes", "adhoc", "planned_date", "deployed_at"},
	},
	FileMachines: {
		required: []string{"factory", "product", "machine_type", "planned"},
		all:      []string{"factory", "product", "machine_type", "planned"},
	},
	FileTopics: {
		required: []string{"factory", "title", "owner", "status", "raised_on"},
		all:      []string{"factory", "title", "owner", "status", "raised_on", "description"},
	},
	FileIssues: {
		required: []string{"title", "factory", "owner", "severity", "priority", "status"},
		all:      []string{"title", "factory", "owner", "severity", "priority", "status", "code", "description", "phase", "product", "milestone", "due_date", "resolution"},
	},
	FileMilestones: {
		required: []string{"factory", "phase", "name", "due_date", "owner"},
		all:      []string{"factory", "phase", "name", "due_date", "owner", "deliverables", "done"},
	},
}

// KnownFile reports whether name is one of the import CSVs.
func KnownFile(name string) bool {
	_, ok := specs[name]
	return ok
}

const (
	entPerson    = "人員"
	entMachine   = "機種"
	entProduct   = "產品"
	entFeature   = "功能"
	entVersion   = "版本"
	entFactory   = "工廠"
	entPhase     = "階段"
	entPlan      = "施工計畫"
	entCount     = "機台數量"
	entTopic     = "議題"
	entIssue     = "問題"
	entMilestone = "里程碑"
)
