package impex

import (
	"strings"

	"fpm/internal/domain"
)

// ExportDatabase writes the domain model as CSV texts keyed by file name.
// Enumerations, phase templates, activity, and plan revisions stay in the importer.
func ExportDatabase(db *domain.Database) (map[string]string, error) {
	files := map[string]string{}
	steps := []struct {
		name string
		fn   func(*domain.Database) ([][]string, error)
	}{
		{FilePeople, exportPeople},
		{FileMachineTypes, exportMachineTypes},
		{FileProducts, exportProducts},
		{FileFeatures, exportFeatures},
		{FileVersions, exportVersions},
		{FileFactories, exportFactories},
		{FilePhases, exportPhases},
		{FilePlans, exportPlans},
		{FileMachines, exportMachines},
		{FileTopics, exportTopics},
		{FileIssues, exportIssues},
		{FileMilestones, exportMilestones},
	}
	for _, step := range steps {
		rows, err := step.fn(db)
		if err := put(files, step.name, rows, err); err != nil {
			return nil, err
		}
	}
	return files, nil
}

func put(files map[string]string, name string, records [][]string, err error) error {
	if err != nil || len(records) == 0 {
		return err
	}
	text, err := encodeCSV(specs[name].all, records)
	if err != nil {
		return err
	}
	files[name] = text
	return nil
}

func exportPeople(db *domain.Database) ([][]string, error) {
	rows := make([][]string, 0, len(db.People))
	for _, person := range db.People {
		rows = append(rows, []string{person.Name, person.Department, boolText(person.Active), person.Source, strVal(person.ExternalID)})
	}
	return rows, nil
}

func exportMachineTypes(db *domain.Database) ([][]string, error) {
	rows := make([][]string, 0, len(db.MachineTypes))
	for _, item := range db.MachineTypes {
		rows = append(rows, []string{item.Code, item.Name, boolText(item.Active)})
	}
	return rows, nil
}

func exportProducts(db *domain.Database) ([][]string, error) {
	rows := make([][]string, 0, len(db.Products))
	for _, product := range db.Products {
		rows = append(rows, []string{product.Name, personName(db, product.PrimaryOwnerID), product.Mode, product.Description, product.DevDepartment, product.ProjectDepartment})
	}
	return rows, nil
}

func exportFeatures(db *domain.Database) ([][]string, error) {
	rows := make([][]string, 0, len(db.Features))
	for _, feature := range db.Features {
		var supported []string
		for _, version := range db.Versions {
			if version.ProductID != feature.ProductID {
				continue
			}
			for _, link := range db.VersionFeatures {
				if link.VersionID == version.ID && link.FeatureID == feature.ID && link.Supported {
					supported = append(supported, version.Version)
					break
				}
			}
		}
		product := productName(db, feature.ProductID)
		rows = append(rows, []string{product, feature.Name, feature.Code, feature.Description, boolText(feature.DefaultEnabled), strings.Join(supported, " ")})
	}
	return rows, nil
}

func exportVersions(db *domain.Database) ([][]string, error) {
	rows := make([][]string, 0, len(db.Versions))
	for _, version := range db.Versions {
		rows = append(rows, []string{productName(db, version.ProductID), version.Version, strVal(version.ReleasedAt), version.Notes})
	}
	return rows, nil
}

func exportFactories(db *domain.Database) ([][]string, error) {
	rows := make([][]string, 0, len(db.Factories))
	for _, factory := range db.Factories {
		rows = append(rows, []string{
			factory.Code, factory.Name, factory.Category, factory.Region, factory.Technology, personName(db, factory.PMID),
			factory.PlannedStart, factory.PlannedEnd, factory.Status, factory.Location, factory.Description,
			strVal(factory.ActualStart), strVal(factory.ActualEnd),
		})
	}
	return rows, nil
}

func exportPhases(db *domain.Database) ([][]string, error) {
	rows := make([][]string, 0, len(db.Phases))
	for _, phase := range db.Phases {
		rows = append(rows, []string{
			factoryName(db, phase.FactoryID), phase.Name, personName(db, phase.OwnerID), phase.PlannedStart, phase.PlannedEnd,
			phase.Status, itoa(phase.Order), strVal(phase.ActualStart), strVal(phase.ActualEnd), phase.RiskNote,
		})
	}
	return rows, nil
}

func exportPlans(db *domain.Database) ([][]string, error) {
	rows := make([][]string, 0, len(db.Plans))
	for _, plan := range db.Plans {
		product := findProduct(db, plan.ProductID)
		if product == nil {
			continue
		}
		dep := findDeployment(db, plan.DeploymentID)
		status := "PLANNED"
		secondary := ""
		version := ""
		actual := ""
		plannedDate := ""
		deployedAt := ""
		if dep != nil {
			status = dep.Status
			secondary = personName(db, dep.SecondaryOwnerID)
			version = versionString(db, strVal(dep.PlannedVersionID))
			actual = versionString(db, strVal(dep.ActualVersionID))
			plannedDate = strVal(dep.PlannedDate)
			deployedAt = strVal(dep.DeployedAt)
		}
		if product.Mode == "FEATURE_ONLY" {
			version = ""
			actual = ""
		} else if plan.ProvidedVersionID != nil {
			version = versionString(db, *plan.ProvidedVersionID)
		}
		changes, customs := exportPlanChanges(db, product, plan)
		rows = append(rows, []string{
			factoryName(db, plan.FactoryID), product.Name, plan.Status, version, actual, status, secondary,
			strVal(plan.ConstructionStart), strVal(plan.ConstructionEnd), plan.Note,
			formatFeatureChanges(changes), formatAdhoc(customs), plannedDate, deployedAt,
		})
	}
	return rows, nil
}

func exportPlanChanges(db *domain.Database, product *domain.Product, plan domain.ProductFactoryPlan) ([]FeatureChange, []CustomChange) {
	reasons := map[string]string{}
	var overrides []FeatureChange
	var customs []CustomChange
	for _, change := range plan.AdHocChanges {
		if change.Kind == "CUSTOM" {
			customs = append(customs, CustomChange{Title: change.Title, Description: change.Description})
			continue
		}
		if change.Kind != "FEATURE_OVERRIDE" || change.FeatureID == nil {
			continue
		}
		name := featureName(db, *change.FeatureID)
		enabled := change.Enabled != nil && *change.Enabled
		reasons[name] = change.Description
		overrides = append(overrides, FeatureChange{Name: name, Enabled: enabled, Reason: change.Description})
	}
	if product.Mode != "FEATURE_ONLY" || len(plan.PlannedFeatures) == 0 {
		return overrides, customs
	}
	enabled := map[string]bool{}
	for _, item := range plan.PlannedFeatures {
		enabled[item.FeatureID] = item.Enabled
	}
	var listed []FeatureChange
	for _, feature := range db.Features {
		if feature.ProductID != product.ID {
			continue
		}
		on, ok := enabled[feature.ID]
		if !ok {
			continue
		}
		listed = append(listed, FeatureChange{Name: feature.Name, Enabled: on, Reason: reasons[feature.Name]})
	}
	return listed, customs
}

func exportMachines(db *domain.Database) ([][]string, error) {
	rows := make([][]string, 0, len(db.MachineQuantities))
	for _, row := range db.MachineQuantities {
		dep := findDeployment(db, row.DeploymentID)
		if dep == nil {
			continue
		}
		rows = append(rows, []string{factoryName(db, dep.FactoryID), productName(db, dep.ProductID), machineTypeName(db, row.MachineTypeID), itoa(row.Planned)})
	}
	return rows, nil
}

func exportTopics(db *domain.Database) ([][]string, error) {
	rows := make([][]string, 0, len(db.Topics))
	for _, topic := range db.Topics {
		rows = append(rows, []string{factoryName(db, topic.FactoryID), topic.Title, personName(db, topic.OwnerID), topic.Status, topic.RaisedOn, topic.Description})
	}
	return rows, nil
}

func exportIssues(db *domain.Database) ([][]string, error) {
	rows := make([][]string, 0, len(db.Issues))
	for _, issue := range db.Issues {
		phase := ""
		if issue.PhaseID != nil {
			if item := phaseByID(db, *issue.PhaseID); item != nil {
				phase = item.Name
			}
		}
		product := ""
		if issue.ProductID != nil {
			product = productName(db, *issue.ProductID)
		}
		milestone := ""
		if issue.MilestoneID != nil {
			for _, item := range db.Milestones {
				if item.ID == *issue.MilestoneID {
					milestone = item.Name
					break
				}
			}
		}
		rows = append(rows, []string{
			issue.Title, factoryName(db, issue.FactoryID), personName(db, issue.OwnerID), issue.Severity, issue.Priority, issue.Status,
			issue.Code, issue.Description, phase, product, milestone, strVal(issue.DueDate), issue.Resolution,
		})
	}
	return rows, nil
}

func exportMilestones(db *domain.Database) ([][]string, error) {
	rows := make([][]string, 0, len(db.Milestones))
	for _, item := range db.Milestones {
		phase := phaseByID(db, item.PhaseID)
		if phase == nil {
			continue
		}
		rows = append(rows, []string{factoryName(db, phase.FactoryID), phase.Name, item.Name, item.DueDate, personName(db, item.OwnerID), item.Deliverables, boolText(item.Done)})
	}
	return rows, nil
}

func findProduct(db *domain.Database, id string) *domain.Product {
	for i := range db.Products {
		if db.Products[i].ID == id {
			return &db.Products[i]
		}
	}
	return nil
}

func findDeployment(db *domain.Database, id string) *domain.ProductDeployment {
	for i := range db.Deployments {
		if db.Deployments[i].ID == id {
			return &db.Deployments[i]
		}
	}
	return nil
}

func featureName(db *domain.Database, id string) string {
	for _, feature := range db.Features {
		if feature.ID == id {
			return feature.Name
		}
	}
	return ""
}

func machineTypeName(db *domain.Database, id string) string {
	for _, item := range db.MachineTypes {
		if item.ID == id {
			return item.Name
		}
	}
	return ""
}

func versionString(db *domain.Database, id string) string {
	if id == "" {
		return ""
	}
	for _, version := range db.Versions {
		if version.ID == id {
			return version.Version
		}
	}
	return ""
}
