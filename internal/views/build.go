package views

import (
	"sort"
	"strings"

	"fpm/internal/apierr"
	"fpm/internal/domain"
	"golang.org/x/text/collate"
	"golang.org/x/text/language"
)

var titleCollator = collate.New(language.MustParse("zh-Hant"))

func BuildBootstrap(db *domain.Database, actorID string, role, username string) (Bootstrap, error) {
	person, err := mustPerson(db, actorID)
	if err != nil {
		return Bootstrap{}, err
	}
	types := append([]domain.MachineType(nil), db.MachineTypes...)
	sort.SliceStable(types, func(i, j int) bool { return types[i].Order < types[j].Order })
	templates := append([]domain.PhaseTemplate(nil), db.PhaseTemplates...)
	sort.SliceStable(templates, func(i, j int) bool { return templates[i].Order < templates[j].Order })
	opts := make([]PhaseTemplateOption, 0, len(templates))
	for _, template := range templates {
		opts = append(opts, PhaseTemplateOption{ID: template.ID, Name: template.Name, Order: template.Order, DefaultDurationDays: template.DefaultDurationDays})
	}
	return Bootstrap{
		AsOf: db.AsOf, Role: role, Username: username, Actor: person,
		People: clonePeople(db.People), MachineTypes: types, PhaseTemplates: opts,
	}, nil
}

func BuildPortfolio(db *domain.Database) (Portfolio, error) {
	factories := make([]FactoryBoardRow, 0, len(db.Factories))
	for _, factory := range db.Factories {
		row, err := boardRow(db, factory.ID)
		if err != nil {
			return Portfolio{}, err
		}
		factories = append(factories, row)
	}
	counts := PortfolioCounts{Total: len(factories)}
	for _, factory := range factories {
		switch factory.Status {
		case "ON_TRACK":
			counts.OnTrack++
		case "AT_RISK":
			counts.AtRisk++
		case "DELAYED":
			counts.Delayed++
		}
	}
	return Portfolio{
		AsOf: db.AsOf, Counts: counts, Exceptions: exceptions(db), Factories: factories,
		Milestones: milestoneRows(db), PendingPlans: pendingPlans(db),
	}, nil
}

func BuildProductBuild(db *domain.Database) (ProductBuild, error) {
	out := ProductBuild{AsOf: db.AsOf, Rows: []BuildRow{}}
	ids := make([]string, 0, len(db.Products))
	for _, product := range db.Products {
		ids = append(ids, product.ID)
		out.Products = append(out.Products, struct {
			ID               string `json:"id"`
			Name             string `json:"name"`
			PrimaryOwnerName string `json:"primaryOwnerName"`
			Mode             string `json:"mode"`
		}{ID: product.ID, Name: product.Name, PrimaryOwnerName: nameOf(db, product.PrimaryOwnerID), Mode: product.Mode})
	}
	if out.Products == nil {
		out.Products = []struct {
			ID               string `json:"id"`
			Name             string `json:"name"`
			PrimaryOwnerName string `json:"primaryOwnerName"`
			Mode             string `json:"mode"`
		}{}
	}
	for _, factory := range db.Factories {
		row, err := buildRow(db, factory.ID, ids)
		if err != nil {
			return ProductBuild{}, err
		}
		out.Rows = append(out.Rows, row)
	}
	return out, nil
}

func BuildFactory(db *domain.Database, id string) (FactoryDetail, error) {
	factory, err := mustFactory(db, id)
	if err != nil {
		return FactoryDetail{}, err
	}
	phases := phasesOf(db, id)
	var phase2 *domain.Phase
	for i := range phases {
		if phases[i].Order == 2 {
			phase2 = &phases[i]
		}
	}
	detail := FactoryDetail{
		AsOf: db.AsOf, ID: factory.ID, Code: factory.Code, Name: factory.Name, Location: factory.Location,
		Description: factory.Description, Status: factory.Status, Category: factory.Category,
		CategoryLabel: domain.FactoryCategoryLabel(factory.Category), Region: factory.Region,
		RegionLabel: domain.FactoryRegionLabel(factory.Region), PMID: factory.PMID,
		PMName: nameOf(db, factory.PMID), PMDepartment: departmentOf(db, factory.PMID),
		MachineTotal: totalOf(factoryRollup(db, id)), MachineRollup: factoryRollup(db, id),
		PlannedStart: factory.PlannedStart, PlannedEnd: factory.PlannedEnd, ActualStart: factory.ActualStart, ActualEnd: factory.ActualEnd,
		Phases: []FactoryPhase{}, Windows: []TimelineWindow{}, Plans: []FactoryPlanCard{},
		Deployments: []FactoryDeployment{}, Issues: []IssueListItem{}, Topics: []FactoryTopic{}, Activity: []ActivityItem{},
	}
	for _, phase := range phases {
		item := FactoryPhase{
			ID: phase.ID, Name: phase.Name, Order: phase.Order, Status: phase.Status, OwnerID: phase.OwnerID,
			OwnerName: nameOf(db, phase.OwnerID), PlannedStart: phase.PlannedStart, PlannedEnd: phase.PlannedEnd,
			ActualStart: phase.ActualStart, ActualEnd: phase.ActualEnd, RiskNote: phase.RiskNote, Focus: phase.Order == 2,
			DependsOn: []string{}, Milestones: []FactoryMilestone{},
		}
		for _, dep := range phase.DependsOnPhaseIds {
			name := dep
			for _, other := range phases {
				if other.ID == dep {
					name = other.Name
					break
				}
			}
			item.DependsOn = append(item.DependsOn, name)
		}
		for _, milestone := range db.Milestones {
			if milestone.PhaseID != phase.ID {
				continue
			}
			item.Milestones = append(item.Milestones, FactoryMilestone{
				ID: milestone.ID, Name: milestone.Name, DueDate: milestone.DueDate, Deliverables: milestone.Deliverables,
				Done: milestone.Done, Overdue: !milestone.Done && milestone.DueDate < db.AsOf,
				OwnerID: milestone.OwnerID, OwnerName: nameOf(db, milestone.OwnerID),
			})
		}
		detail.Phases = append(detail.Phases, item)
	}
	for _, product := range db.Products {
		plan := findPlan(db, id, product.ID)
		check := construction(plan, phase2)
		var start, end *string
		if plan != nil {
			start, end = plan.ConstructionStart, plan.ConstructionEnd
		}
		detail.Windows = append(detail.Windows, TimelineWindow{ID: product.ID, Label: product.Name, Start: start, End: end, State: check.State, Reasons: check.Reasons})
		card := FactoryPlanCard{
			ID: "", ProductID: product.ID, ProductName: product.Name, Mode: product.Mode, Status: "NOT_SUBMITTED",
			AdHocChanges: []AdHocView{}, WindowState: check.State, WindowReasons: check.Reasons,
		}
		if plan != nil {
			card.ID = plan.ID
			card.Status = plan.Status
			card.ChangeCount = len(plan.AdHocChanges)
			card.AdHocChanges = adHocViews(db, plan.AdHocChanges)
			card.WindowStart = plan.ConstructionStart
			card.WindowEnd = plan.ConstructionEnd
			for _, revision := range db.Revisions {
				if revision.PlanID == plan.ID {
					card.RevisionCount++
				}
			}
		}
		if product.Mode == "VERSIONED" {
			var vid *string
			if plan != nil {
				vid = plan.ProvidedVersionID
			}
			card.ProvidedVersion = versionName(db, vid)
		}
		detail.Plans = append(detail.Plans, card)
	}
	for _, deployment := range db.Deployments {
		if deployment.FactoryID != id {
			continue
		}
		product, err := mustProduct(db, deployment.ProductID)
		if err != nil {
			return FactoryDetail{}, err
		}
		planned := versionName(db, deployment.PlannedVersionID)
		actual := versionName(db, deployment.ActualVersionID)
		latest := latestVersion(db, product.ID)
		lines := machineLines(db, deployment.ID)
		detail.Deployments = append(detail.Deployments, FactoryDeployment{
			ID: deployment.ID, ProductID: product.ID, ProductName: product.Name, Mode: product.Mode, Status: deployment.Status,
			PlannedVersion: planned, ActualVersion: actual, BehindPlan: behind(actual, planned), BehindLatest: behind(actual, latest),
			SecondaryOwnerName: nameOf(db, deployment.SecondaryOwnerID), Machines: lines, PlannedTotal: totalOf(lines),
		})
	}
	for _, issue := range db.Issues {
		if issue.FactoryID == id {
			item, err := issueItem(db, issue)
			if err != nil {
				return FactoryDetail{}, err
			}
			detail.Issues = append(detail.Issues, item)
		}
	}
	topics := []domain.DiscussionTopic{}
	for _, topic := range db.Topics {
		if topic.FactoryID == id {
			topics = append(topics, topic)
		}
	}
	sort.SliceStable(topics, func(i, j int) bool { return topics[i].RaisedOn > topics[j].RaisedOn })
	for _, topic := range topics {
		detail.Topics = append(detail.Topics, FactoryTopic{
			ID: topic.ID, Title: topic.Title, Description: topic.Description, OwnerID: topic.OwnerID,
			OwnerName: nameOf(db, topic.OwnerID), Status: topic.Status, RaisedOn: topic.RaisedOn,
		})
	}
	for _, item := range activityItems(db) {
		if relatedToFactory(db, item, id) {
			detail.Activity = append(detail.Activity, item)
		}
	}
	if len(detail.Activity) > 12 {
		detail.Activity = detail.Activity[:12]
	}
	return detail, nil
}

func BuildIssues(db *domain.Database, query ListQuery) (IssueList, error) {
	matched := []IssueListItem{}
	for _, issue := range db.Issues {
		item, err := issueItem(db, issue)
		if err != nil {
			return IssueList{}, err
		}
		if query.FactoryID != "" && item.FactoryID != query.FactoryID {
			continue
		}
		if query.Severity != "" && item.Severity != query.Severity {
			continue
		}
		if query.Status != "" && item.Status != query.Status {
			continue
		}
		if query.Overdue != nil && item.Overdue != *query.Overdue {
			continue
		}
		if query.Query != "" && !containsFold(item.Title+" "+item.Code, query.Query) {
			continue
		}
		matched = append(matched, item)
	}
	items, total, limit, offset := pageSlice(matched, query.Limit, query.Offset)
	return IssueList{AsOf: db.AsOf, Items: items, Total: total, Limit: limit, Offset: offset}, nil
}

func BuildIssue(db *domain.Database, id string) (IssuePage, error) {
	for _, issue := range db.Issues {
		if issue.ID != id {
			continue
		}
		item, err := issueItem(db, issue)
		if err != nil {
			return IssuePage{}, err
		}
		page := IssuePage{IssueListItem: item, AsOf: db.AsOf, Activity: []ActivityItem{}}
		for _, act := range activityItems(db) {
			if act.EntityType == "ISSUE" && act.EntityID == id {
				page.Activity = append(page.Activity, act)
			}
		}
		return page, nil
	}
	return IssuePage{}, apierr.New(404, "找不到這筆問題")
}

func BuildProducts(db *domain.Database) (ProductList, error) {
	out := ProductList{AsOf: db.AsOf, Items: []ProductSummary{}}
	for _, product := range db.Products {
		item, err := productSummary(db, product.ID)
		if err != nil {
			return ProductList{}, err
		}
		out.Items = append(out.Items, item)
	}
	return out, nil
}

func BuildProduct(db *domain.Database, id string) (ProductDetail, error) {
	summary, err := productSummary(db, id)
	if err != nil {
		return ProductDetail{}, err
	}
	detail := ProductDetail{ProductSummary: summary, AsOf: db.AsOf, Versions: []ProductVersionRow{}, Features: []ProductFeatureRow{}, Deployments: []ProductDeployment{}}
	versions := []domain.ProductVersion{}
	for _, version := range db.Versions {
		if version.ProductID == id {
			versions = append(versions, version)
		}
	}
	sort.SliceStable(versions, func(i, j int) bool { return semverOrZero(versions[i].Version, versions[j].Version) < 0 })
	for _, version := range versions {
		row := ProductVersionRow{ID: version.ID, Version: version.Version, ReleasedAt: version.ReleasedAt, Notes: version.Notes}
		for _, feature := range db.Features {
			if feature.ProductID != id {
				continue
			}
			supported := false
			for _, link := range db.VersionFeatures {
				if link.VersionID == version.ID && link.FeatureID == feature.ID && link.Supported {
					supported = true
					break
				}
			}
			row.Features = append(row.Features, struct {
				ID        string `json:"id"`
				Name      string `json:"name"`
				Supported bool   `json:"supported"`
			}{ID: feature.ID, Name: feature.Name, Supported: supported})
		}
		if row.Features == nil {
			row.Features = []struct {
				ID        string `json:"id"`
				Name      string `json:"name"`
				Supported bool   `json:"supported"`
			}{}
		}
		detail.Versions = append(detail.Versions, row)
	}
	for _, feature := range db.Features {
		if feature.ProductID == id {
			detail.Features = append(detail.Features, ProductFeatureRow{ID: feature.ID, Code: feature.Code, Name: feature.Name, DefaultEnabled: feature.DefaultEnabled})
		}
	}
	latest := latestVersion(db, id)
	for _, deployment := range db.Deployments {
		if deployment.ProductID != id {
			continue
		}
		factory, err := mustFactory(db, deployment.FactoryID)
		if err != nil {
			return ProductDetail{}, err
		}
		planned := versionName(db, deployment.PlannedVersionID)
		actual := versionName(db, deployment.ActualVersionID)
		lines := machineLines(db, deployment.ID)
		planStatus := "NOT_SUBMITTED"
		for _, plan := range db.Plans {
			if plan.DeploymentID == deployment.ID {
				planStatus = plan.Status
				break
			}
		}
		detail.Deployments = append(detail.Deployments, ProductDeployment{
			ID: deployment.ID, FactoryID: factory.ID, FactoryName: factory.Name, FactoryCode: factory.Code,
			Status: deployment.Status, PlannedVersion: planned, ActualVersion: actual,
			BehindPlan: behind(actual, planned), BehindLatest: behind(actual, latest),
			SecondaryOwnerName: nameOf(db, deployment.SecondaryOwnerID), Machines: lines, PlannedTotal: totalOf(lines),
			PlanStatus: planStatus, DeployedAt: deployment.DeployedAt,
		})
	}
	return detail, nil
}

func BuildCapabilities(db *domain.Database) (CapabilityMatrix, error) {
	out := CapabilityMatrix{AsOf: db.AsOf, Rows: []CapabilityRow{}, Factories: []NamedRef{}}
	for _, feature := range db.Features {
		product, err := mustProduct(db, feature.ProductID)
		if err != nil {
			return CapabilityMatrix{}, err
		}
		out.Features = append(out.Features, struct {
			ID          string `json:"id"`
			Code        string `json:"code"`
			Name        string `json:"name"`
			ProductID   string `json:"productId"`
			ProductName string `json:"productName"`
		}{ID: feature.ID, Code: feature.Code, Name: feature.Name, ProductID: feature.ProductID, ProductName: product.Name})
	}
	if out.Features == nil {
		out.Features = []struct {
			ID          string `json:"id"`
			Code        string `json:"code"`
			Name        string `json:"name"`
			ProductID   string `json:"productId"`
			ProductName string `json:"productName"`
		}{}
	}
	for _, deployment := range db.Deployments {
		product, err := mustProduct(db, deployment.ProductID)
		if err != nil {
			return CapabilityMatrix{}, err
		}
		factory, err := mustFactory(db, deployment.FactoryID)
		if err != nil {
			return CapabilityMatrix{}, err
		}
		plan := findPlan(db, factory.ID, product.ID)
		var versionID *string
		if product.Mode == "VERSIONED" && plan != nil {
			versionID = plan.ProvidedVersionID
		}
		row := CapabilityRow{
			DeploymentID: deployment.ID, FactoryID: factory.ID, FactoryName: factory.Name,
			ProductID: product.ID, ProductName: product.Name, Mode: product.Mode,
			VersionLabel: versionName(db, versionID), Cells: []CapabilityCellView{},
		}
		if plan != nil {
			row.AdHocChanges = adHocViews(db, plan.AdHocChanges)
		} else {
			row.AdHocChanges = []AdHocView{}
		}
		for _, feature := range db.Features {
			if feature.ProductID != product.ID {
				continue
			}
			var supported *bool
			if versionID != nil && *versionID != "" {
				value := false
				for _, link := range db.VersionFeatures {
					if link.VersionID == *versionID && link.FeatureID == feature.ID && link.Supported {
						value = true
						break
					}
				}
				supported = &value
			}
			var plannedEnabled *bool
			if product.Mode == "FEATURE_ONLY" && plan != nil {
				for _, item := range plan.PlannedFeatures {
					if item.FeatureID == feature.ID {
						value := item.Enabled
						plannedEnabled = &value
						break
					}
				}
			}
			var overrideEnabled *bool
			note := ""
			if plan != nil {
				for _, change := range plan.AdHocChanges {
					if change.Kind == "FEATURE_OVERRIDE" && change.FeatureID != nil && *change.FeatureID == feature.ID {
						value := change.Enabled != nil && *change.Enabled
						overrideEnabled = &value
						note = change.Description
						break
					}
				}
			}
			cell := domain.CapabilityCellOf(domain.CapabilityInput{
				Mode: product.Mode, DefaultEnabled: feature.DefaultEnabled, PlannedEnabled: plannedEnabled,
				VersionSupported: supported, OverrideEnabled: overrideEnabled,
			})
			row.Cells = append(row.Cells, CapabilityCellView{FeatureID: feature.ID, CapabilityCell: cell, Note: note})
		}
		out.Rows = append(out.Rows, row)
	}
	for _, factory := range db.Factories {
		out.Factories = append(out.Factories, NamedRef{ID: factory.ID, Name: factory.Name})
	}
	for _, product := range db.Products {
		out.Products = append(out.Products, struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			Mode string `json:"mode"`
		}{ID: product.ID, Name: product.Name, Mode: product.Mode})
	}
	if out.Products == nil {
		out.Products = []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			Mode string `json:"mode"`
		}{}
	}
	return out, nil
}

func BuildPlan(db *domain.Database, factoryID, productID, actorID, role string) (PlanPage, error) {
	factory, err := mustFactory(db, factoryID)
	if err != nil {
		return PlanPage{}, err
	}
	product, err := mustProduct(db, productID)
	if err != nil {
		return PlanPage{}, err
	}
	if _, err := mustPerson(db, actorID); err != nil {
		return PlanPage{}, err
	}
	var deployment *domain.ProductDeployment
	for i := range db.Deployments {
		if db.Deployments[i].FactoryID == factoryID && db.Deployments[i].ProductID == productID {
			deployment = &db.Deployments[i]
			break
		}
	}
	plan := findPlan(db, factoryID, productID)
	if deployment == nil || plan == nil {
		return PlanPage{}, apierr.New(404, "找不到這份產品計畫")
	}
	var phase2 *domain.Phase
	for i := range db.Phases {
		if db.Phases[i].FactoryID == factoryID && db.Phases[i].Order == 2 {
			phase2 = &db.Phases[i]
			break
		}
	}
	window := construction(plan, phase2)
	lines := machineLines(db, deployment.ID)
	page := PlanPage{
		AsOf: db.AsOf, FactoryID: factoryID, FactoryName: factory.Name, ProductID: productID, ProductName: product.Name,
		Mode: product.Mode, PrimaryOwnerName: nameOf(db, product.PrimaryOwnerID), DevDepartment: product.DevDepartment,
		ProjectDepartment: product.ProjectDepartment, DeploymentID: deployment.ID, DeploymentStatus: deployment.Status,
		ActualVersion: versionName(db, deployment.ActualVersionID), SecondaryOwnerName: nameOf(db, deployment.SecondaryOwnerID),
		PlanID: plan.ID, Status: plan.Status, ProvidedVersionID: plan.ProvidedVersionID,
		PlannedFeatures: clonePlanned(plan.PlannedFeatures), AdHocChanges: adHocViews(db, plan.AdHocChanges),
		ConstructionStart: plan.ConstructionStart, ConstructionEnd: plan.ConstructionEnd, Note: plan.Note,
		Machines: lines, PlannedTotal: totalOf(lines), WindowState: window.State, WindowReasons: window.Reasons,
		Versions: []PlanVersionOption{}, Features: []ProductFeatureRow{}, Revisions: []PlanRevisionView{},
		CanEdit: role == "editor", CanApprove: role == "editor" && plan.Status == "SUBMITTED",
		AccessNote: "使用者只能閱讀。",
	}
	if role == "editor" {
		page.AccessNote = "編輯者可以修改與核准。"
	}
	if phase2 != nil {
		page.Phase2 = &Phase2{ID: phase2.ID, Name: phase2.Name, Status: phase2.Status, PlannedStart: phase2.PlannedStart, PlannedEnd: phase2.PlannedEnd}
	}
	versions := []domain.ProductVersion{}
	for _, version := range db.Versions {
		if version.ProductID == productID {
			versions = append(versions, version)
		}
	}
	sort.SliceStable(versions, func(i, j int) bool { return semverOrZero(versions[i].Version, versions[j].Version) < 0 })
	for _, version := range versions {
		page.Versions = append(page.Versions, PlanVersionOption{ID: version.ID, Version: version.Version, Notes: version.Notes})
	}
	for _, feature := range db.Features {
		if feature.ProductID == productID {
			page.Features = append(page.Features, ProductFeatureRow{ID: feature.ID, Code: feature.Code, Name: feature.Name, DefaultEnabled: feature.DefaultEnabled})
		}
	}
	revisions := []domain.PlanRevision{}
	for _, revision := range db.Revisions {
		if revision.PlanID == plan.ID {
			revisions = append(revisions, revision)
		}
	}
	sort.SliceStable(revisions, func(i, j int) bool { return revisions[i].Number > revisions[j].Number })
	for _, revision := range revisions {
		view := PlanRevisionView{
			ID: revision.ID, Number: revision.Number, Action: revision.Action, Version: versionName(db, revision.ProvidedVersionID),
			AdHocChanges: adHocViews(db, revision.AdHocChanges), ConstructionStart: revision.ConstructionStart,
			ConstructionEnd: revision.ConstructionEnd, Machines: []PlanRevisionMachine{}, ActorName: nameOf(db, revision.ActorID),
			CreatedAt: revision.CreatedAt, Note: revision.Note,
		}
		for _, line := range revision.Machines {
			name := line.MachineTypeID
			for _, kind := range db.MachineTypes {
				if kind.ID == line.MachineTypeID {
					name = kind.Name
					break
				}
			}
			view.Machines = append(view.Machines, PlanRevisionMachine{MachineTypeID: line.MachineTypeID, Name: name, Planned: line.Planned})
		}
		page.Revisions = append(page.Revisions, view)
	}
	return page, nil
}

func BuildDeployment(db *domain.Database, id string) (DeploymentPage, error) {
	var deployment *domain.ProductDeployment
	for i := range db.Deployments {
		if db.Deployments[i].ID == id {
			deployment = &db.Deployments[i]
			break
		}
	}
	if deployment == nil {
		return DeploymentPage{}, apierr.New(404, "找不到這筆部署")
	}
	product, err := mustProduct(db, deployment.ProductID)
	if err != nil {
		return DeploymentPage{}, err
	}
	factory, err := mustFactory(db, deployment.FactoryID)
	if err != nil {
		return DeploymentPage{}, err
	}
	lines := machineLines(db, deployment.ID)
	page := DeploymentPage{
		AsOf: db.AsOf, ID: deployment.ID, FactoryID: factory.ID, FactoryName: factory.Name, ProductID: product.ID, ProductName: product.Name,
		Mode: product.Mode, Status: deployment.Status, PlannedVersionID: deployment.PlannedVersionID, ActualVersionID: deployment.ActualVersionID,
		SecondaryOwnerID: deployment.SecondaryOwnerID, Machines: lines, PlannedTotal: totalOf(lines),
		PlannedDate: deployment.PlannedDate, DeployedAt: deployment.DeployedAt, Notes: deployment.Notes,
		People: clonePeople(db.People), Features: []DeploymentFeature{},
	}
	versions := []domain.ProductVersion{}
	for _, version := range db.Versions {
		if version.ProductID == product.ID {
			versions = append(versions, version)
		}
	}
	sort.SliceStable(versions, func(i, j int) bool { return semverOrZero(versions[i].Version, versions[j].Version) < 0 })
	for _, version := range versions {
		page.Versions = append(page.Versions, struct {
			ID      string `json:"id"`
			Version string `json:"version"`
		}{ID: version.ID, Version: version.Version})
	}
	if page.Versions == nil {
		page.Versions = []struct {
			ID      string `json:"id"`
			Version string `json:"version"`
		}{}
	}
	phases := phasesOf(db, factory.ID)
	for _, phase := range phases {
		page.Phases = append(page.Phases, struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}{ID: phase.ID, Name: phase.Name})
	}
	if page.Phases == nil {
		page.Phases = []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}{}
	}
	for _, link := range db.PhaseLinks {
		if link.DeploymentID == id {
			page.Links = append(page.Links, struct {
				PhaseID  string `json:"phaseId"`
				Relation string `json:"relation"`
			}{PhaseID: link.PhaseID, Relation: link.Relation})
		}
	}
	if page.Links == nil {
		page.Links = []struct {
			PhaseID  string `json:"phaseId"`
			Relation string `json:"relation"`
		}{}
	}
	for _, feature := range db.Features {
		if feature.ProductID != product.ID {
			continue
		}
		desired := feature.DefaultEnabled
		var actual *bool
		for _, config := range db.FeatureConfigs {
			if config.DeploymentID == id && config.FeatureID == feature.ID {
				desired = config.Desired
				actual = config.Actual
				break
			}
		}
		var supported *bool
		if deployment.ActualVersionID != nil && *deployment.ActualVersionID != "" {
			value := false
			for _, row := range db.VersionFeatures {
				if row.VersionID == *deployment.ActualVersionID && row.FeatureID == feature.ID && row.Supported {
					value = true
					break
				}
			}
			supported = &value
		}
		page.Features = append(page.Features, DeploymentFeature{
			ID: feature.ID, Name: feature.Name, DefaultEnabled: feature.DefaultEnabled, Desired: desired, Actual: actual, SupportedByActual: supported,
		})
	}
	return page, nil
}

func BuildActivity(db *domain.Database, query ListQuery) ActivityList {
	matched := []ActivityItem{}
	for _, item := range activityItems(db) {
		if query.EntityType != "" && item.EntityType != query.EntityType {
			continue
		}
		if query.FactoryID != "" && !relatedToFactory(db, item, query.FactoryID) {
			continue
		}
		if query.Query != "" && !containsFold(item.Summary, query.Query) {
			continue
		}
		matched = append(matched, item)
	}
	items, total, limit, offset := pageSlice(matched, query.Limit, query.Offset)
	return ActivityList{AsOf: db.AsOf, Items: items, Total: total, Limit: limit, Offset: offset}
}

func BuildFactories(db *domain.Database) (FactoryList, error) {
	out := FactoryList{AsOf: db.AsOf, Items: []FactoryBoardRow{}, People: clonePeople(db.People)}
	for _, factory := range db.Factories {
		row, err := boardRow(db, factory.ID)
		if err != nil {
			return FactoryList{}, err
		}
		out.Items = append(out.Items, row)
	}
	return out, nil
}

func BuildPeople(db *domain.Database, query ListQuery) PeopleList {
	matched := []domain.Person{}
	for _, person := range db.People {
		if query.Active != nil && person.Active != *query.Active {
			continue
		}
		if query.Query != "" && !containsFold(person.Name+" "+person.Department, query.Query) {
			continue
		}
		matched = append(matched, person)
	}
	items, total, limit, offset := pageSlice(matched, query.Limit, query.Offset)
	return PeopleList{Items: items, Total: total, Limit: limit, Offset: offset}
}

func containsFold(haystack, needle string) bool {
	return strings.Contains(strings.ToLower(haystack), strings.ToLower(needle))
}

func boardRow(db *domain.Database, factoryID string) (FactoryBoardRow, error) {
	factory, err := mustFactory(db, factoryID)
	if err != nil {
		return FactoryBoardRow{}, err
	}
	phases := phasesOf(db, factoryID)
	var current *domain.Phase
	for i := range phases {
		if phases[i].Status != "COMPLETED" {
			current = &phases[i]
			break
		}
	}
	if current == nil && len(phases) > 0 {
		current = &phases[len(phases)-1]
	}
	var phase2 *domain.Phase
	for i := range phases {
		if phases[i].Order == 2 {
			phase2 = &phases[i]
			break
		}
	}
	outside, missing, notReady := 0, 0, 0
	for _, product := range db.Products {
		plan := findPlan(db, factoryID, product.ID)
		if plan == nil || plan.Status == "NOT_SUBMITTED" {
			missing++
		}
		check := construction(plan, phase2)
		if check.State == domain.WindowOutside {
			outside++
		}
		ready := readinessFor(db, factoryID, product.ID, phase2)
		if !ready.Ready {
			notReady++
		}
	}
	row := FactoryBoardRow{
		ID: factory.ID, Code: factory.Code, Name: factory.Name, Location: factory.Location, Status: factory.Status,
		Category: factory.Category, CategoryLabel: domain.FactoryCategoryLabel(factory.Category),
		Region: factory.Region, RegionLabel: domain.FactoryRegionLabel(factory.Region),
		PMID: factory.PMID, PMName: nameOf(db, factory.PMID), PMDepartment: departmentOf(db, factory.PMID),
		MachineTotal: totalOf(factoryRollup(db, factoryID)), MachineRollup: factoryRollup(db, factoryID),
		CurrentPhaseName: "—", CurrentPhaseStatus: "NOT_STARTED", CurrentOwnerName: "—",
		Phases: []PhaseBar{}, NotReady: notReady, MissingPlans: missing, OutsideWindows: outside,
	}
	for _, topic := range db.Topics {
		if topic.FactoryID == factoryID && (topic.Status == "OPEN" || topic.Status == "IN_DISCUSSION") {
			row.OpenTopics++
		}
	}
	if current != nil {
		row.CurrentPhaseName = current.Name
		row.CurrentPhaseOrder = current.Order
		row.CurrentPhaseStatus = current.Status
		row.CurrentOwnerName = nameOf(db, current.OwnerID)
	}
	for _, phase := range phases {
		row.Phases = append(row.Phases, PhaseBar{
			ID: phase.ID, Name: phase.Name, Order: phase.Order, Status: phase.Status,
			PlannedStart: phase.PlannedStart, PlannedEnd: phase.PlannedEnd, ActualStart: phase.ActualStart, ActualEnd: phase.ActualEnd,
		})
	}
	for _, issue := range db.Issues {
		if issue.FactoryID != factoryID {
			continue
		}
		if (issue.Status == "BLOCKED" || issue.Severity == "CRITICAL") && issue.Status != "RESOLVED" && issue.Status != "CLOSED" {
			row.Blockers++
		}
	}
	return row, nil
}

func readinessFor(db *domain.Database, factoryID, productID string, phase2 *domain.Phase) domain.Readiness {
	product, _ := mustProduct(db, productID)
	plan := findPlan(db, factoryID, productID)
	window := construction(plan, phase2)
	status := "NOT_SUBMITTED"
	var provided *string
	var planned []domain.PlannedFeature
	if plan != nil {
		status = plan.Status
		provided = plan.ProvidedVersionID
		planned = plan.PlannedFeatures
	}
	ids := []string{}
	for _, feature := range db.Features {
		if feature.ProductID == productID {
			ids = append(ids, feature.ID)
		}
	}
	return domain.CellReadiness(domain.ReadinessInput{
		PlanStatus: status, WindowState: window.State, Mode: product.Mode,
		HasProvidedVersion:  provided != nil && *provided != "",
		FeaturePlanComplete: domain.IsFeaturePlanComplete(ids, planned),
	})
}

func buildRow(db *domain.Database, factoryID string, productIDs []string) (BuildRow, error) {
	factory, err := mustFactory(db, factoryID)
	if err != nil {
		return BuildRow{}, err
	}
	var phase2 *domain.Phase
	for i := range db.Phases {
		if db.Phases[i].FactoryID == factoryID && db.Phases[i].Order == 2 {
			phase2 = &db.Phases[i]
			break
		}
	}
	row := BuildRow{
		FactoryID: factoryID, FactoryName: factory.Name, FactoryCode: factory.Code,
		Category: factory.Category, CategoryLabel: domain.FactoryCategoryLabel(factory.Category),
		Region: factory.Region, RegionLabel: domain.FactoryRegionLabel(factory.Region),
		Status: factory.Status, Cells: []BuildCell{}, MachineRollup: factoryRollup(db, factoryID),
		MachineTotal: totalOf(factoryRollup(db, factoryID)),
	}
	if phase2 != nil {
		row.Phase2 = &Phase2{ID: phase2.ID, Name: phase2.Name, Status: phase2.Status, PlannedStart: phase2.PlannedStart, PlannedEnd: phase2.PlannedEnd}
	}
	for _, productID := range productIDs {
		product, err := mustProduct(db, productID)
		if err != nil {
			return BuildRow{}, err
		}
		var deployment *domain.ProductDeployment
		for i := range db.Deployments {
			if db.Deployments[i].FactoryID == factoryID && db.Deployments[i].ProductID == productID {
				deployment = &db.Deployments[i]
				break
			}
		}
		plan := findPlan(db, factoryID, productID)
		window := construction(plan, phase2)
		planStatus := "NOT_SUBMITTED"
		deploymentStatus := "PLANNED"
		var provided *string
		var planned []domain.PlannedFeature
		changeCount := 0
		var start, end *string
		planID := ""
		if plan != nil {
			planStatus = plan.Status
			planID = plan.ID
			provided = plan.ProvidedVersionID
			planned = plan.PlannedFeatures
			changeCount = len(plan.AdHocChanges)
			start, end = plan.ConstructionStart, plan.ConstructionEnd
		}
		ready := domain.CellReadiness(domain.ReadinessInput{
			PlanStatus: planStatus, WindowState: window.State, Mode: product.Mode,
			HasProvidedVersion:  provided != nil && *provided != "",
			FeaturePlanComplete: domain.IsFeaturePlanComplete(featureIDs(db, productID), planned),
		})
		if deployment != nil {
			deploymentStatus = deployment.Status
		}
		var providedVersion, actualVersion *string
		if product.Mode == "VERSIONED" {
			providedVersion = versionName(db, provided)
			if deployment != nil {
				actualVersion = versionName(db, deployment.ActualVersionID)
			}
		}
		lines := []MachineLineView{}
		secondary := "—"
		deploymentID := ""
		if deployment != nil {
			lines = machineLines(db, deployment.ID)
			secondary = nameOf(db, deployment.SecondaryOwnerID)
			deploymentID = deployment.ID
		}
		cell := BuildCell{
			FactoryID: factoryID, ProductID: productID, DeploymentID: deploymentID, PlanID: planID,
			DeploymentStatus: deploymentStatus, PlanStatus: planStatus, Mode: product.Mode,
			ProvidedVersion: providedVersion, ActualVersion: actualVersion, ChangeCount: changeCount,
			VersionGap: versionGap(providedVersion, actualVersion), PrimaryOwnerName: nameOf(db, product.PrimaryOwnerID),
			SecondaryOwnerName: secondary, Machines: lines, PlannedTotal: totalOf(lines),
			WindowStart: start, WindowEnd: end, WindowState: window.State, WindowReasons: window.Reasons,
			Ready: ready.Ready, Flags: flagStrings(ready.Flags),
		}
		if cell.Ready {
			row.ReadyCount++
		}
		row.Cells = append(row.Cells, cell)
	}
	return row, nil
}

func exceptions(db *domain.Database) []ExceptionItem {
	items := []ExceptionItem{}
	for _, factory := range db.Factories {
		if factory.Status == "DELAYED" {
			items = append(items, ExceptionItem{
				ID: "ex-fac-" + factory.ID, Rank: 0, Tone: "danger", Title: factory.Name + "延遲",
				Detail: "工廠整體狀態是延遲，先看產品建立的未提報計畫與超出時程。", Href: "/factories/" + factory.ID, FactoryName: factory.Name,
			})
		} else if factory.Status == "AT_RISK" {
			items = append(items, ExceptionItem{
				ID: "ex-risk-" + factory.ID, Rank: 6, Tone: "warning", Title: factory.Name + "有風險",
				Detail: factory.Description, Href: "/factories/" + factory.ID, FactoryName: factory.Name,
			})
		}
		var phase2 *domain.Phase
		for i := range db.Phases {
			if db.Phases[i].FactoryID == factory.ID && db.Phases[i].Order == 2 {
				phase2 = &db.Phases[i]
				break
			}
		}
		for _, phase := range db.Phases {
			if phase.FactoryID != factory.ID {
				continue
			}
			if phase.Status != "COMPLETED" && phase.PlannedEnd < db.AsOf {
				items = append(items, ExceptionItem{
					ID: "ex-phase-" + phase.ID, Rank: 4, Tone: "danger",
					Title:  factory.Name + " · " + phase.Name + "已過計畫結束日",
					Detail: "計畫結束 " + phase.PlannedEnd + "，狀態仍是未完成。",
					Href:   "/factories/" + factory.ID + "#timeline", FactoryName: factory.Name,
				})
			}
		}
		for _, product := range db.Products {
			plan := findPlan(db, factory.ID, product.ID)
			check := construction(plan, phase2)
			if plan == nil || plan.Status == "NOT_SUBMITTED" {
				active := phase2 != nil && (phase2.Status == "IN_PROGRESS" || phase2.Status == "AT_RISK" || phase2.Status == "DELAYED")
				rank := 8
				tone := "info"
				if active {
					rank = 2
					tone = "warning"
				}
				detail := "產品團隊尚未送出提供版本、異動功能與施工時程。"
				if product.Mode == "FEATURE_ONLY" {
					detail = "產品團隊尚未送出功能開關與施工時程。"
				}
				items = append(items, ExceptionItem{
					ID: "ex-plan-" + factory.ID + "-" + product.ID, Rank: rank, Tone: tone,
					Title: factory.Name + " · " + product.Name + "計畫未提報", Detail: detail,
					Href: "/factories/" + factory.ID + "/plans/" + product.ID, FactoryName: factory.Name,
				})
			}
			if check.State == domain.WindowOutside {
				start, end := "—", "—"
				if plan != nil && plan.ConstructionStart != nil {
					start = *plan.ConstructionStart
				}
				if plan != nil && plan.ConstructionEnd != nil {
					end = *plan.ConstructionEnd
				}
				pStart, pEnd := "—", "—"
				if phase2 != nil {
					pStart, pEnd = phase2.PlannedStart, phase2.PlannedEnd
				}
				items = append(items, ExceptionItem{
					ID: "ex-win-" + factory.ID + "-" + product.ID, Rank: 2, Tone: "danger",
					Title:  factory.Name + " · " + product.Name + "施工時程超出產品建立",
					Detail: start + " – " + end + "，階段 " + pStart + " – " + pEnd + "。平行施工的重疊不算衝突。",
					Href:   "/factories/" + factory.ID + "/plans/" + product.ID, FactoryName: factory.Name,
				})
			}
		}
	}
	for _, issue := range db.Issues {
		open := issue.Status == "OPEN" || issue.Status == "IN_PROGRESS" || issue.Status == "BLOCKED"
		if !open || issue.DueDate == nil || *issue.DueDate >= db.AsOf {
			continue
		}
		factory, err := mustFactory(db, issue.FactoryID)
		if err != nil {
			continue
		}
		rank := 7
		if issue.Severity == "CRITICAL" || issue.Severity == "HIGH" {
			rank = 2
		}
		tone := "warning"
		if issue.Severity == "CRITICAL" {
			tone = "danger"
		}
		items = append(items, ExceptionItem{
			ID: "ex-iss-" + issue.ID, Rank: rank, Tone: tone, Title: issue.Code + " 逾期 · " + issue.Title,
			Detail: "到期 " + *issue.DueDate + "，負責人 " + nameOf(db, issue.OwnerID) + "。",
			Href:   "/issues/" + issue.ID, FactoryName: factory.Name,
		})
	}
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].Rank != items[j].Rank {
			return items[i].Rank < items[j].Rank
		}
		return titleCollator.CompareString(items[i].Title, items[j].Title) < 0
	})
	return items
}

func milestoneRows(db *domain.Database) []MilestoneRow {
	limit := domain.AddDays(db.AsOf, 21)
	rows := []MilestoneRow{}
	for _, milestone := range db.Milestones {
		if milestone.Done || milestone.DueDate > limit {
			continue
		}
		var phase *domain.Phase
		for i := range db.Phases {
			if db.Phases[i].ID == milestone.PhaseID {
				phase = &db.Phases[i]
				break
			}
		}
		factoryID, factoryName, phaseName := "", "—", "—"
		if phase != nil {
			phaseName = phase.Name
			if factory, err := mustFactory(db, phase.FactoryID); err == nil {
				factoryID = factory.ID
				factoryName = factory.Name
			}
		}
		rows = append(rows, MilestoneRow{
			ID: milestone.ID, Name: milestone.Name, DueDate: milestone.DueDate, Done: milestone.Done,
			Overdue: milestone.DueDate < db.AsOf, FactoryID: factoryID, FactoryName: factoryName,
			PhaseName: phaseName, OwnerName: nameOf(db, milestone.OwnerID),
		})
	}
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].DueDate < rows[j].DueDate })
	return rows
}

func pendingPlans(db *domain.Database) []PendingPlan {
	out := []PendingPlan{}
	for _, plan := range db.Plans {
		if plan.Status != "SUBMITTED" {
			continue
		}
		product, err := mustProduct(db, plan.ProductID)
		if err != nil {
			continue
		}
		factory, err := mustFactory(db, plan.FactoryID)
		if err != nil {
			continue
		}
		out = append(out, PendingPlan{
			ID: plan.ID, FactoryID: plan.FactoryID, FactoryName: factory.Name, ProductID: product.ID,
			ProductName: product.Name, Status: plan.Status, Mode: product.Mode,
		})
	}
	return out
}

func issueItem(db *domain.Database, issue domain.Issue) (IssueListItem, error) {
	factory, err := mustFactory(db, issue.FactoryID)
	if err != nil {
		return IssueListItem{}, err
	}
	var phaseName *string
	if issue.PhaseID != nil {
		for _, phase := range db.Phases {
			if phase.ID == *issue.PhaseID {
				name := phase.Name
				phaseName = &name
				break
			}
		}
	}
	var productName *string
	if issue.ProductID != nil {
		product, err := mustProduct(db, *issue.ProductID)
		if err != nil {
			return IssueListItem{}, err
		}
		productName = &product.Name
	}
	open := issue.Status == "OPEN" || issue.Status == "IN_PROGRESS" || issue.Status == "BLOCKED"
	return IssueListItem{
		ID: issue.ID, Code: issue.Code, Title: issue.Title, Description: issue.Description,
		FactoryID: issue.FactoryID, FactoryName: factory.Name, PhaseID: issue.PhaseID, PhaseName: phaseName,
		ProductID: issue.ProductID, ProductName: productName, OwnerID: issue.OwnerID, OwnerName: nameOf(db, issue.OwnerID),
		Severity: issue.Severity, Priority: issue.Priority, Status: issue.Status, DueDate: issue.DueDate,
		Overdue: open && issue.DueDate != nil && *issue.DueDate < db.AsOf, Resolution: issue.Resolution, UpdatedAt: issue.UpdatedAt,
	}, nil
}

func productSummary(db *domain.Database, id string) (ProductSummary, error) {
	product, err := mustProduct(db, id)
	if err != nil {
		return ProductSummary{}, err
	}
	latest := latestVersion(db, id)
	outdated := 0
	for _, deployment := range db.Deployments {
		if deployment.ProductID != id {
			continue
		}
		actual := versionName(db, deployment.ActualVersionID)
		if behind(actual, latest) {
			outdated++
		}
	}
	count := 0
	for _, version := range db.Versions {
		if version.ProductID == id {
			count++
		}
	}
	return ProductSummary{
		ID: product.ID, Name: product.Name, Description: product.Description, DevDepartment: product.DevDepartment,
		ProjectDepartment: product.ProjectDepartment, PrimaryOwnerID: product.PrimaryOwnerID,
		PrimaryOwnerName: nameOf(db, product.PrimaryOwnerID), Mode: product.Mode, VersionCount: count,
		LatestVersion: latest, OutdatedFactories: outdated,
	}, nil
}

func activityItems(db *domain.Database) []ActivityItem {
	items := append([]domain.Activity(nil), db.Activity...)
	sort.SliceStable(items, func(i, j int) bool { return items[i].CreatedAt > items[j].CreatedAt })
	out := make([]ActivityItem, 0, len(items))
	for _, item := range items {
		out = append(out, ActivityItem{
			ID: item.ID, EntityType: item.EntityType, EntityID: item.EntityID, Action: item.Action,
			Summary: item.Summary, ActorName: nameOf(db, item.ActorID), CreatedAt: item.CreatedAt,
		})
	}
	return out
}

func relatedToFactory(db *domain.Database, item ActivityItem, factoryID string) bool {
	switch item.EntityType {
	case "FACTORY":
		return item.EntityID == factoryID
	case "PHASE":
		for _, phase := range db.Phases {
			if phase.ID == item.EntityID && phase.FactoryID == factoryID {
				return true
			}
		}
	case "MILESTONE":
		for _, milestone := range db.Milestones {
			if milestone.ID != item.EntityID {
				continue
			}
			for _, phase := range db.Phases {
				if phase.ID == milestone.PhaseID {
					return phase.FactoryID == factoryID
				}
			}
		}
	case "ISSUE":
		for _, issue := range db.Issues {
			if issue.ID == item.EntityID && issue.FactoryID == factoryID {
				return true
			}
		}
	case "TOPIC":
		for _, topic := range db.Topics {
			if topic.ID == item.EntityID && topic.FactoryID == factoryID {
				return true
			}
		}
	case "DEPLOYMENT", "FEATURE":
		for _, deployment := range db.Deployments {
			if deployment.ID == item.EntityID && deployment.FactoryID == factoryID {
				return true
			}
		}
	case "PLAN":
		for _, plan := range db.Plans {
			if plan.ID == item.EntityID && plan.FactoryID == factoryID {
				return true
			}
		}
	}
	return false
}

func latestVersion(db *domain.Database, productID string) *string {
	versions := []string{}
	for _, version := range db.Versions {
		if version.ProductID == productID {
			versions = append(versions, version.Version)
		}
	}
	if len(versions) == 0 {
		return nil
	}
	sort.SliceStable(versions, func(i, j int) bool { return semverOrZero(versions[i], versions[j]) < 0 })
	last := versions[len(versions)-1]
	return &last
}

func versionName(db *domain.Database, id *string) *string {
	if id == nil || *id == "" {
		return nil
	}
	for _, version := range db.Versions {
		if version.ID == *id {
			name := version.Version
			return &name
		}
	}
	return nil
}

func machineLines(db *domain.Database, deploymentID string) []MachineLineView {
	types := append([]domain.MachineType(nil), db.MachineTypes...)
	sort.SliceStable(types, func(i, j int) bool { return types[i].Order < types[j].Order })
	out := []MachineLineView{}
	for _, kind := range types {
		planned := 0
		for _, row := range db.MachineQuantities {
			if row.DeploymentID == deploymentID && row.MachineTypeID == kind.ID {
				planned = row.Planned
				break
			}
		}
		if kind.Active || planned > 0 {
			out = append(out, MachineLineView{MachineTypeID: kind.ID, Name: kind.Name, Planned: planned})
		}
	}
	return out
}

func factoryRollup(db *domain.Database, factoryID string) []MachineLineView {
	types := append([]domain.MachineType(nil), db.MachineTypes...)
	sort.SliceStable(types, func(i, j int) bool { return types[i].Order < types[j].Order })
	out := []MachineLineView{}
	for _, kind := range types {
		planned := 0
		for _, deployment := range db.Deployments {
			if deployment.FactoryID != factoryID {
				continue
			}
			for _, row := range db.MachineQuantities {
				if row.DeploymentID == deployment.ID && row.MachineTypeID == kind.ID {
					planned += row.Planned
				}
			}
		}
		if planned > 0 || kind.Active {
			out = append(out, MachineLineView{MachineTypeID: kind.ID, Name: kind.Name, Planned: planned})
		}
	}
	return out
}

func totalOf(lines []MachineLineView) int {
	raw := make([]domain.PlannedLine, 0, len(lines))
	for _, line := range lines {
		raw = append(raw, domain.PlannedLine{Planned: float64(line.Planned)})
	}
	return domain.PlannedTotal(raw)
}

func nameOf(db *domain.Database, id string) string {
	for _, person := range db.People {
		if person.ID == id {
			return person.Name
		}
	}
	return "—"
}

func departmentOf(db *domain.Database, id string) string {
	for _, person := range db.People {
		if person.ID == id {
			return person.Department
		}
	}
	return "—"
}

func mustPerson(db *domain.Database, id string) (domain.Person, error) {
	for _, person := range db.People {
		if person.ID == id {
			return person, nil
		}
	}
	return domain.Person{}, apierr.New(404, "找不到這位人員")
}

func mustFactory(db *domain.Database, id string) (domain.Factory, error) {
	for _, factory := range db.Factories {
		if factory.ID == id {
			return factory, nil
		}
	}
	return domain.Factory{}, apierr.New(404, "找不到這座工廠")
}

func mustProduct(db *domain.Database, id string) (domain.Product, error) {
	for _, product := range db.Products {
		if product.ID == id {
			return product, nil
		}
	}
	return domain.Product{}, apierr.New(404, "找不到這個產品")
}

func adHocViews(db *domain.Database, rows []domain.AdHocChange) []AdHocView {
	out := make([]AdHocView, 0, len(rows))
	for _, change := range rows {
		view := AdHocView{ID: change.ID, Kind: change.Kind, FeatureID: change.FeatureID, Enabled: change.Enabled, Title: change.Title, Description: change.Description}
		if change.FeatureID != nil {
			name := *change.FeatureID
			for _, feature := range db.Features {
				if feature.ID == *change.FeatureID {
					name = feature.Name
					break
				}
			}
			view.FeatureName = &name
		}
		out = append(out, view)
	}
	return out
}

func findPlan(db *domain.Database, factoryID, productID string) *domain.ProductFactoryPlan {
	for i := range db.Plans {
		if db.Plans[i].FactoryID == factoryID && db.Plans[i].ProductID == productID {
			return &db.Plans[i]
		}
	}
	return nil
}

func phasesOf(db *domain.Database, factoryID string) []domain.Phase {
	out := []domain.Phase{}
	for _, phase := range db.Phases {
		if phase.FactoryID == factoryID {
			out = append(out, phase)
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Order < out[j].Order })
	return out
}

func construction(plan *domain.ProductFactoryPlan, phase *domain.Phase) domain.WindowCheck {
	var start, end *string
	if plan != nil {
		start, end = plan.ConstructionStart, plan.ConstructionEnd
	}
	var window *domain.PhaseWindow
	if phase != nil {
		window = &domain.PhaseWindow{Start: phase.PlannedStart, End: phase.PlannedEnd}
	}
	return domain.EvaluateConstructionWindow(domain.ConstructionWindow{Start: start, End: end}, window)
}

func behind(actual, planned *string) bool {
	if actual == nil || planned == nil || *actual == "" || *planned == "" {
		return false
	}
	cmp, ok := domain.CompareSemver(*actual, *planned)
	if !ok {
		cmp = 0
	}
	return cmp < 0
}

func versionGap(a, b *string) bool {
	if a == nil || b == nil || *a == "" || *b == "" {
		return false
	}
	return *a != *b
}

func semverOrZero(a, b string) int {
	cmp, ok := domain.CompareSemver(a, b)
	if !ok {
		return 0
	}
	return cmp
}

func featureIDs(db *domain.Database, productID string) []string {
	ids := []string{}
	for _, feature := range db.Features {
		if feature.ProductID == productID {
			ids = append(ids, feature.ID)
		}
	}
	return ids
}

func flagStrings(flags []domain.ReadinessFlag) []string {
	out := make([]string, 0, len(flags))
	for _, flag := range flags {
		out = append(out, string(flag))
	}
	return out
}

func clonePeople(in []domain.Person) []domain.Person {
	out := make([]domain.Person, len(in))
	copy(out, in)
	return out
}

func clonePlanned(in []domain.PlannedFeature) []domain.PlannedFeature {
	out := make([]domain.PlannedFeature, len(in))
	copy(out, in)
	return out
}
