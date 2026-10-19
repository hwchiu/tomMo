package impex

// Dataset is a parsed import. Row numbers match the source file.
type Dataset struct {
	People       []PersonRow
	MachineTypes []MachineTypeRow
	Products     []ProductRow
	Features     []FeatureRow
	Versions     []VersionRow
	Factories    []FactoryRow
	Phases       []PhaseRow
	Plans        []PlanRow
	Machines     []MachineRow
	Topics       []TopicRow
	Issues       []IssueRow
	Milestones   []MilestoneRow
}

type PersonRow struct {
	File, Name, Department, Source, ExternalID string
	Row                                        int
	Active                                     bool
}

type MachineTypeRow struct {
	File, Name string
	Row        int
	Active     bool
}

type ProductRow struct {
	File, Name, Owner, Mode, Description, DevDepartment, ProjectDepartment string
	Row                                                                    int
}

type FeatureRow struct {
	File, Product, Name, Code, Description string
	Row                                    int
	DefaultEnabled                         bool
	Supported                              []string
}

type VersionRow struct {
	File, Product, Version, ReleasedAt, Notes string
	Row                                       int
}

type FactoryRow struct {
	File, Code, Name, Category, Region, Technology, PM string
	PlannedStart, PlannedEnd, Status                   string
	Location, Description, ActualStart, ActualEnd      string
	Row                                                int
}

type PhaseRow struct {
	File, Factory, Name, Owner string
	PlannedStart, PlannedEnd   string
	Status                     string
	ActualStart, ActualEnd     string
	RiskNote                   string
	Row, Order                 int
}

type FeatureChange struct {
	Name    string
	Enabled bool
	Reason  string
}

type CustomChange struct {
	Title, Description string
}

type PlanRow struct {
	File, Factory, Product, Status     string
	Version, ActualVersion             string
	DeploymentStatus, Secondary        string
	ConstructionStart, ConstructionEnd string
	Note, PlannedDate, DeployedAt      string
	FeatureChanges                     []FeatureChange
	AdHoc                              []CustomChange
	Row                                int
}

type MachineRow struct {
	File, Factory, Product, MachineType string
	Row, Planned                        int
}

type TopicRow struct {
	File, Factory, Title, Owner, Status, RaisedOn, Description string
	Row                                                        int
}

type IssueRow struct {
	File, Title, Factory, Owner, Severity, Priority, Status string
	Code, Description, Phase, Product, Milestone            string
	DueDate, Resolution                                     string
	Row                                                     int
}

type MilestoneRow struct {
	File, Factory, Phase, Name, DueDate, Owner, Deliverables string
	Row                                                      int
	Done                                                     bool
}
