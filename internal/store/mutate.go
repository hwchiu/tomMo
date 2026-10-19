package store

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"fpm/internal/apierr"
	"fpm/internal/domain"
)

type idBody struct {
	ID string `json:"id"`
}

type idFactoryBody struct {
	ID        string `json:"id"`
	FactoryID string `json:"factoryId"`
}

type factoryIDBody struct {
	FactoryID string `json:"factoryId"`
}

type FactoryInput struct {
	Code         string `json:"code"`
	Name         string `json:"name"`
	Location     string `json:"location"`
	Description  string `json:"description"`
	Category     string `json:"category"`
	Region       string `json:"region"`
	PMID         string `json:"pmId"`
	PlannedStart string `json:"plannedStart"`
	PlannedEnd   string `json:"plannedEnd"`
	Status       string `json:"status"`
}

type TopicInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	OwnerID     string `json:"ownerId"`
	Status      string `json:"status"`
	RaisedOn    string `json:"raisedOn"`
}

type PhaseInput struct {
	Name              string   `json:"name"`
	Order             *float64 `json:"order"`
	OwnerID           string   `json:"ownerId"`
	PlannedStart      string   `json:"plannedStart"`
	PlannedEnd        string   `json:"plannedEnd"`
	ActualStart       *string  `json:"actualStart"`
	ActualEnd         *string  `json:"actualEnd"`
	Status            string   `json:"status"`
	RiskNote          string   `json:"riskNote"`
	DependsOnPhaseIds []string `json:"dependsOnPhaseIds"`
}

type MilestoneInput struct {
	Name         string `json:"name"`
	DueDate      string `json:"dueDate"`
	Deliverables string `json:"deliverables"`
	OwnerID      string `json:"ownerId"`
	Done         bool   `json:"done"`
}

type IssueInput struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	FactoryID   string  `json:"factoryId"`
	PhaseID     *string `json:"phaseId"`
	ProductID   *string `json:"productId"`
	OwnerID     string  `json:"ownerId"`
	Severity    string  `json:"severity"`
	Priority    string  `json:"priority"`
	Status      string  `json:"status"`
	DueDate     *string `json:"dueDate"`
	Resolution  string  `json:"resolution"`
}

type DeploymentInput struct {
	PlannedVersionID *string `json:"plannedVersionId"`
	ActualVersionID  *string `json:"actualVersionId"`
	Status           string  `json:"status"`
	SecondaryOwnerID string  `json:"secondaryOwnerId"`
	PlannedDate      *string `json:"plannedDate"`
	DeployedAt       *string `json:"deployedAt"`
	Notes            string  `json:"notes"`
	Links            []struct {
		PhaseID  string `json:"phaseId"`
		Relation string `json:"relation"`
	} `json:"links"`
	Features []struct {
		FeatureID string `json:"featureId"`
		Desired   bool   `json:"desired"`
		Actual    *bool  `json:"actual"`
	} `json:"features"`
}

type PlanInput struct {
	ProvidedVersionID *string                 `json:"providedVersionId"`
	PlannedFeatures   []domain.PlannedFeature `json:"plannedFeatures"`
	Reasons           map[string]string       `json:"reasons"`
	AdHocChanges      []domain.AdHocChange    `json:"adHocChanges"`
	ConstructionStart *string                 `json:"constructionStart"`
	ConstructionEnd   *string                 `json:"constructionEnd"`
	Machines          []struct {
		MachineTypeID string  `json:"machineTypeId"`
		Planned       float64 `json:"planned"`
	} `json:"machines"`
	Note   string `json:"note"`
	Intent string `json:"intent"`
}

type ProductInput struct {
	Name              string `json:"name"`
	Description       string `json:"description"`
	DevDepartment     string `json:"devDepartment"`
	ProjectDepartment string `json:"projectDepartment"`
	PrimaryOwnerID    string `json:"primaryOwnerId"`
	Mode              string `json:"mode"`
	Audience          string `json:"audience"`
}

type MachineTypeInput struct {
	Name string `json:"name"`
}

type MachineTypePatch struct {
	Name   string `json:"name"`
	Active bool   `json:"active"`
}

type PersonInput struct {
	Name       string `json:"name"`
	Department string `json:"department"`
	Active     *bool  `json:"active"`
}

func CreateFactory(db *domain.Database, actorID string, input FactoryInput) (idBody, error) {
	if _, err := actor(db, actorID); err != nil {
		return idBody{}, err
	}
	code := strings.ToUpper(strings.TrimSpace(input.Code))
	name := strings.TrimSpace(input.Name)
	if code == "" || name == "" {
		return idBody{}, apierr.New(400, "工廠代碼與名稱必填")
	}
	if err := validateFactoryStatus(input.Status); err != nil {
		return idBody{}, err
	}
	for _, factory := range db.Factories {
		if factory.Code == code {
			return idBody{}, apierr.New(400, "工廠代碼已存在")
		}
	}
	category, err := domain.NormalizeFactoryCategory(input.Category)
	if err != nil {
		return idBody{}, apierr.New(400, err.Error())
	}
	region, err := domain.NormalizeFactoryRegion(input.Region)
	if err != nil {
		return idBody{}, apierr.New(400, err.Error())
	}
	if err := requirePerson(db, input.PMID); err != nil {
		return idBody{}, err
	}
	start, err := requireDate(input.PlannedStart, "計畫開始")
	if err != nil {
		return idBody{}, err
	}
	id := nextID(db, "fac")
	cursor := start
	templates := append([]domain.PhaseTemplate(nil), db.PhaseTemplates...)
	sort.SliceStable(templates, func(i, j int) bool { return templates[i].Order < templates[j].Order })
	phaseIDs := []string{}
	for _, template := range templates {
		phaseID := nextID(db, "ph")
		days := template.DefaultDurationDays
		if days < 1 {
			days = 1
		}
		end := domain.AddDays(cursor, days-1)
		deps := []string{}
		if len(phaseIDs) > 0 {
			deps = []string{phaseIDs[len(phaseIDs)-1]}
		}
		tpl := template.ID
		db.Phases = append(db.Phases, domain.Phase{
			ID: phaseID, FactoryID: id, TemplateID: &tpl, Name: template.Name, Order: template.Order,
			OwnerID: input.PMID, PlannedStart: cursor, PlannedEnd: end, Status: "NOT_STARTED", RiskNote: "",
			DependsOnPhaseIds: deps,
		})
		phaseIDs = append(phaseIDs, phaseID)
		cursor = domain.AddDays(end, 1)
	}
	end := start
	for _, phase := range db.Phases {
		if phase.FactoryID == id {
			end = phase.PlannedEnd
		}
	}
	db.Factories = append(db.Factories, domain.Factory{
		ID: id, Code: code, Name: name, Location: strings.TrimSpace(input.Location), Description: strings.TrimSpace(input.Description),
		Category: category, Region: region, PMID: input.PMID,
		PlannedStart: start, PlannedEnd: end, Status: input.Status,
	})
	for _, product := range db.Products {
		if err := ensureDeployment(db, id, product.ID, input.PMID); err != nil {
			return idBody{}, err
		}
	}
	logAct(db, actorID, "FACTORY", id, "CREATE", fmt.Sprintf("建立工廠 %s（%s），並從四階段範本複製時程。", name, code))
	return idBody{ID: id}, nil
}

func UpdateFactory(db *domain.Database, actorID, id string, input FactoryInput) (idBody, error) {
	if err := validateFactoryStatus(input.Status); err != nil {
		return idBody{}, err
	}
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	idx := indexFactory(db, id)
	if idx < 0 {
		return idBody{}, apierr.New(404, "找不到這座工廠")
	}
	category, err := domain.NormalizeFactoryCategory(input.Category)
	if err != nil {
		return idBody{}, apierr.New(400, err.Error())
	}
	region, err := domain.NormalizeFactoryRegion(input.Region)
	if err != nil {
		return idBody{}, apierr.New(400, err.Error())
	}
	if err := requirePerson(db, input.PMID); err != nil {
		return idBody{}, err
	}
	start, err := requireDate(input.PlannedStart, "計畫開始")
	if err != nil {
		return idBody{}, err
	}
	end, err := requireDate(input.PlannedEnd, "計畫結束")
	if err != nil {
		return idBody{}, err
	}
	factory := &db.Factories[idx]
	previous := factory.Status
	factory.Code = strings.ToUpper(strings.TrimSpace(input.Code))
	factory.Name = strings.TrimSpace(input.Name)
	factory.Location = strings.TrimSpace(input.Location)
	factory.Description = strings.TrimSpace(input.Description)
	factory.Category = category
	factory.Region = region
	factory.PMID = input.PMID
	factory.PlannedStart = start
	factory.PlannedEnd = end
	factory.Status = input.Status
	if previous != input.Status {
		logAct(db, actorID, "FACTORY", id, "STATUS", fmt.Sprintf("%s把%s狀態改為 %s。", user.Name, factory.Name, input.Status))
	} else {
		logAct(db, actorID, "FACTORY", id, "UPDATE", fmt.Sprintf("%s更新%s的基本資料。", user.Name, factory.Name))
	}
	return idBody{ID: id}, nil
}

func CreateTopic(db *domain.Database, actorID, factoryID string, input TopicInput) (idFactoryBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idFactoryBody{}, err
	}
	fidx := indexFactory(db, factoryID)
	if fidx < 0 {
		return idFactoryBody{}, apierr.New(404, "找不到這座工廠")
	}
	topic, err := normalizeTopic(db, input)
	if err != nil {
		return idFactoryBody{}, err
	}
	id := nextID(db, "tp")
	topic.ID = id
	topic.FactoryID = factoryID
	db.Topics = append(db.Topics, topic)
	logAct(db, actorID, "TOPIC", id, "CREATE", fmt.Sprintf("%s在%s新增例外事項「%s」。", user.Name, db.Factories[fidx].Name, topic.Title))
	return idFactoryBody{ID: id, FactoryID: factoryID}, nil
}

func UpdateTopic(db *domain.Database, actorID, id string, input TopicInput) (idFactoryBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idFactoryBody{}, err
	}
	idx := indexTopic(db, id)
	if idx < 0 {
		return idFactoryBody{}, apierr.New(404, "找不到這筆例外事項")
	}
	next, err := normalizeTopic(db, input)
	if err != nil {
		return idFactoryBody{}, err
	}
	topic := &db.Topics[idx]
	topic.Title = next.Title
	topic.Description = next.Description
	topic.OwnerID = next.OwnerID
	topic.Status = next.Status
	topic.RaisedOn = next.RaisedOn
	logAct(db, actorID, "TOPIC", id, "UPDATE", fmt.Sprintf("%s更新例外事項「%s」。", user.Name, topic.Title))
	return idFactoryBody{ID: id, FactoryID: topic.FactoryID}, nil
}

func CreatePhase(db *domain.Database, actorID, factoryID string, input PhaseInput) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	if indexFactory(db, factoryID) < 0 {
		return idBody{}, apierr.New(404, "找不到這座工廠")
	}
	if err := validatePhase(input); err != nil {
		return idBody{}, err
	}
	if err := requirePerson(db, input.OwnerID); err != nil {
		return idBody{}, err
	}
	start, err := requireDate(input.PlannedStart, "計畫開始")
	if err != nil {
		return idBody{}, err
	}
	end, err := requireDate(input.PlannedEnd, "計畫結束")
	if err != nil {
		return idBody{}, err
	}
	actualStart, err := optionalDate(input.ActualStart)
	if err != nil {
		return idBody{}, err
	}
	actualEnd, err := optionalDate(input.ActualEnd)
	if err != nil {
		return idBody{}, err
	}
	id := nextID(db, "ph")
	fallback := 1
	for _, phase := range db.Phases {
		if phase.FactoryID == factoryID {
			fallback++
		}
	}
	db.Phases = append(db.Phases, domain.Phase{
		ID: id, FactoryID: factoryID, Name: strings.TrimSpace(input.Name), Order: orderValue(input.Order, fallback),
		OwnerID: input.OwnerID, PlannedStart: start, PlannedEnd: end, ActualStart: actualStart, ActualEnd: actualEnd,
		Status: input.Status, RiskNote: strings.TrimSpace(input.RiskNote), DependsOnPhaseIds: filterDeps(input.DependsOnPhaseIds, id),
	})
	logAct(db, actorID, "PHASE", id, "CREATE", fmt.Sprintf("%s新增階段「%s」。", user.Name, strings.TrimSpace(input.Name)))
	return idBody{ID: id}, nil
}

func UpdatePhase(db *domain.Database, actorID, id string, input PhaseInput) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	idx := indexPhase(db, id)
	if idx < 0 {
		return idBody{}, apierr.New(404, "找不到這個階段")
	}
	if err := validatePhase(input); err != nil {
		return idBody{}, err
	}
	if err := requirePerson(db, input.OwnerID); err != nil {
		return idBody{}, err
	}
	start, err := requireDate(input.PlannedStart, "計畫開始")
	if err != nil {
		return idBody{}, err
	}
	end, err := requireDate(input.PlannedEnd, "計畫結束")
	if err != nil {
		return idBody{}, err
	}
	actualStart, err := optionalDate(input.ActualStart)
	if err != nil {
		return idBody{}, err
	}
	actualEnd, err := optionalDate(input.ActualEnd)
	if err != nil {
		return idBody{}, err
	}
	phase := &db.Phases[idx]
	previous := phase.Status
	phase.Name = strings.TrimSpace(input.Name)
	phase.Order = orderValue(input.Order, phase.Order)
	phase.OwnerID = input.OwnerID
	phase.PlannedStart = start
	phase.PlannedEnd = end
	phase.ActualStart = actualStart
	phase.ActualEnd = actualEnd
	phase.Status = input.Status
	phase.RiskNote = strings.TrimSpace(input.RiskNote)
	phase.DependsOnPhaseIds = filterDeps(input.DependsOnPhaseIds, id)
	verb := "更新"
	action := "UPDATE"
	if previous != input.Status {
		verb = "變更"
		action = "STATUS"
	}
	logAct(db, actorID, "PHASE", id, action, fmt.Sprintf("%s%s階段「%s」。", user.Name, verb, phase.Name))
	return idBody{ID: phase.FactoryID}, nil
}

func CreateMilestone(db *domain.Database, actorID, phaseID string, input MilestoneInput) (idFactoryBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idFactoryBody{}, err
	}
	pidx := indexPhase(db, phaseID)
	if pidx < 0 {
		return idFactoryBody{}, apierr.New(404, "找不到這個階段")
	}
	if err := validateMilestoneName(input.Name); err != nil {
		return idFactoryBody{}, err
	}
	if err := requirePerson(db, input.OwnerID); err != nil {
		return idFactoryBody{}, err
	}
	due, err := requireDate(input.DueDate, "到期日")
	if err != nil {
		return idFactoryBody{}, err
	}
	id := nextID(db, "ms")
	var completed *string
	if input.Done {
		completed = stringPtr(nowISO())
	}
	db.Milestones = append(db.Milestones, domain.Milestone{
		ID: id, PhaseID: phaseID, Name: strings.TrimSpace(input.Name), DueDate: due,
		Deliverables: strings.TrimSpace(input.Deliverables), Done: input.Done, CompletedAt: completed, OwnerID: input.OwnerID,
	})
	logAct(db, actorID, "MILESTONE", id, "CREATE", fmt.Sprintf("%s在「%s」新增里程碑「%s」。", user.Name, db.Phases[pidx].Name, strings.TrimSpace(input.Name)))
	return idFactoryBody{ID: id, FactoryID: db.Phases[pidx].FactoryID}, nil
}

func UpdateMilestone(db *domain.Database, actorID, id string, input MilestoneInput) (factoryIDBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return factoryIDBody{}, err
	}
	idx := indexMilestone(db, id)
	if idx < 0 {
		return factoryIDBody{}, apierr.New(404, "找不到這個里程碑")
	}
	if err := validateMilestoneName(input.Name); err != nil {
		return factoryIDBody{}, err
	}
	if err := requirePerson(db, input.OwnerID); err != nil {
		return factoryIDBody{}, err
	}
	due, err := requireDate(input.DueDate, "到期日")
	if err != nil {
		return factoryIDBody{}, err
	}
	milestone := &db.Milestones[idx]
	was := milestone.Done
	milestone.Name = strings.TrimSpace(input.Name)
	milestone.DueDate = due
	milestone.Deliverables = strings.TrimSpace(input.Deliverables)
	milestone.OwnerID = input.OwnerID
	milestone.Done = input.Done
	if input.Done {
		if milestone.CompletedAt == nil {
			milestone.CompletedAt = stringPtr(nowISO())
		}
	} else {
		milestone.CompletedAt = nil
	}
	pidx := indexPhase(db, milestone.PhaseID)
	if pidx < 0 {
		return factoryIDBody{}, apierr.New(404, "找不到這個階段")
	}
	if was != input.Done {
		label := "未完成"
		if input.Done {
			label = "完成"
		}
		logAct(db, actorID, "MILESTONE", id, "STATUS", fmt.Sprintf("%s把里程碑「%s」標為%s。", user.Name, milestone.Name, label))
	} else {
		logAct(db, actorID, "MILESTONE", id, "UPDATE", fmt.Sprintf("%s更新里程碑「%s」。", user.Name, milestone.Name))
	}
	return factoryIDBody{FactoryID: db.Phases[pidx].FactoryID}, nil
}

func CreateIssue(db *domain.Database, actorID string, input IssueInput) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	if err := validateIssue(input); err != nil {
		return idBody{}, err
	}
	if indexFactory(db, input.FactoryID) < 0 {
		return idBody{}, apierr.New(404, "找不到這座工廠")
	}
	if err := requirePerson(db, input.OwnerID); err != nil {
		return idBody{}, err
	}
	due, err := optionalDate(input.DueDate)
	if err != nil {
		return idBody{}, err
	}
	id := nextID(db, "iss")
	code := fmt.Sprintf("ISS-%03d", len(db.Issues)+40)
	issue := domain.Issue{
		ID: id, Code: code, Title: strings.TrimSpace(input.Title), Description: strings.TrimSpace(input.Description),
		FactoryID: input.FactoryID, PhaseID: input.PhaseID, ProductID: input.ProductID, OwnerID: input.OwnerID,
		Severity: input.Severity, Priority: input.Priority, Status: input.Status, DueDate: due,
		Resolution: strings.TrimSpace(input.Resolution), UpdatedAt: nowISO(),
	}
	db.Issues = append([]domain.Issue{issue}, db.Issues...)
	logAct(db, actorID, "ISSUE", id, "CREATE", fmt.Sprintf("%s登錄問題 %s：%s。", user.Name, code, strings.TrimSpace(input.Title)))
	return idBody{ID: id}, nil
}

func UpdateIssue(db *domain.Database, actorID, id string, input IssueInput) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	idx := indexIssue(db, id)
	if idx < 0 {
		return idBody{}, apierr.New(404, "找不到這筆問題")
	}
	if err := validateIssue(input); err != nil {
		return idBody{}, err
	}
	if indexFactory(db, input.FactoryID) < 0 {
		return idBody{}, apierr.New(404, "找不到這座工廠")
	}
	if err := requirePerson(db, input.OwnerID); err != nil {
		return idBody{}, err
	}
	due, err := optionalDate(input.DueDate)
	if err != nil {
		return idBody{}, err
	}
	issue := &db.Issues[idx]
	previous := issue.Status
	issue.Title = strings.TrimSpace(input.Title)
	issue.Description = strings.TrimSpace(input.Description)
	issue.FactoryID = input.FactoryID
	issue.PhaseID = input.PhaseID
	issue.ProductID = input.ProductID
	issue.OwnerID = input.OwnerID
	issue.Severity = input.Severity
	issue.Priority = input.Priority
	issue.Status = input.Status
	issue.DueDate = due
	issue.Resolution = strings.TrimSpace(input.Resolution)
	issue.UpdatedAt = nowISO()
	extra := ""
	action := "UPDATE"
	if previous != input.Status {
		extra = fmt.Sprintf("，狀態改為 %s", input.Status)
		action = "STATUS"
	}
	logAct(db, actorID, "ISSUE", id, action, fmt.Sprintf("%s更新問題 %s%s。", user.Name, issue.Code, extra))
	return idBody{ID: id}, nil
}

func UpdateDeployment(db *domain.Database, actorID, id string, input DeploymentInput) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	idx := indexDeployment(db, id)
	if idx < 0 {
		return idBody{}, apierr.New(404, "找不到這筆部署")
	}
	if err := validateDeploymentStatus(input.Status); err != nil {
		return idBody{}, err
	}
	if err := requirePerson(db, input.SecondaryOwnerID); err != nil {
		return idBody{}, err
	}
	pidx := indexProduct(db, db.Deployments[idx].ProductID)
	if pidx < 0 {
		return idBody{}, apierr.New(404, "找不到這個產品")
	}
	product := db.Products[pidx]
	if product.Mode == "FEATURE_ONLY" {
		input.PlannedVersionID = nil
		input.ActualVersionID = nil
	}
	deployment := &db.Deployments[idx]
	prevNotes := deployment.Notes
	prevOwner := deployment.SecondaryOwnerID
	prevPlannedDate := deployment.PlannedDate
	prevDeployedAt := deployment.DeployedAt
	linksSame := deploymentLinksMatch(db, id, input.Links)
	plannedDate, err := optionalDate(input.PlannedDate)
	if err != nil {
		return idBody{}, err
	}
	deployedAt, err := optionalDate(input.DeployedAt)
	if err != nil {
		return idBody{}, err
	}
	for _, link := range input.Links {
		if err := validatePhaseLink(link.Relation); err != nil {
			return idBody{}, err
		}
		if indexPhase(db, link.PhaseID) < 0 {
			return idBody{}, apierr.New(400, "找不到這個階段")
		}
	}
	for _, feature := range input.Features {
		if !featureOnProduct(db, product.ID, feature.FeatureID) {
			return idBody{}, apierr.New(400, "找不到這個功能")
		}
	}
	if input.Status != deployment.Status {
		logAct(db, actorID, "DEPLOYMENT", id, "STATUS", fmt.Sprintf("%s把%s部署狀態改為 %s。", user.Name, product.Name, input.Status))
	}
	if !ptrEqual(input.ActualVersionID, deployment.ActualVersionID) {
		logAct(db, actorID, "DEPLOYMENT", id, "ACTUAL_VERSION", fmt.Sprintf("%s填報%s實際版本為 %s。", user.Name, product.Name, versionLabel(db, input.ActualVersionID)))
	}
	if !ptrEqual(input.PlannedVersionID, deployment.PlannedVersionID) {
		logAct(db, actorID, "DEPLOYMENT", id, "PLANNED_VERSION", fmt.Sprintf("%s更新%s計畫版本為 %s。", user.Name, product.Name, versionLabel(db, input.PlannedVersionID)))
	}
	deployment.PlannedVersionID = input.PlannedVersionID
	deployment.ActualVersionID = input.ActualVersionID
	deployment.Status = input.Status
	deployment.SecondaryOwnerID = input.SecondaryOwnerID
	deployment.PlannedDate = plannedDate
	deployment.DeployedAt = deployedAt
	deployment.Notes = strings.TrimSpace(input.Notes)
	kept := make([]domain.DeploymentPhaseLink, 0, len(db.PhaseLinks))
	for _, link := range db.PhaseLinks {
		if link.DeploymentID != id {
			kept = append(kept, link)
		}
	}
	db.PhaseLinks = kept
	for _, link := range input.Links {
		db.PhaseLinks = append(db.PhaseLinks, domain.DeploymentPhaseLink{
			ID: nextID(db, "lnk"), DeploymentID: id, PhaseID: link.PhaseID, Relation: link.Relation,
		})
	}
	for _, feature := range input.Features {
		var existing *domain.FeatureConfiguration
		for i := range db.FeatureConfigs {
			if db.FeatureConfigs[i].DeploymentID == id && db.FeatureConfigs[i].FeatureID == feature.FeatureID {
				existing = &db.FeatureConfigs[i]
				break
			}
		}
		var previousActual *bool
		hadDesired := false
		var previousDesired bool
		if existing != nil {
			hadDesired = true
			previousDesired = existing.Desired
			previousActual = existing.Actual
		}
		if existing == nil {
			db.FeatureConfigs = append(db.FeatureConfigs, domain.FeatureConfiguration{
				ID: nextID(db, "fc"), DeploymentID: id, FeatureID: feature.FeatureID, Desired: feature.Desired, Actual: feature.Actual,
			})
		} else {
			existing.Desired = feature.Desired
			existing.Actual = feature.Actual
		}
		featureName := feature.FeatureID
		for _, item := range db.Features {
			if item.ID == feature.FeatureID {
				featureName = item.Name
				break
			}
		}
		if hadDesired && previousDesired != feature.Desired {
			label := "關閉"
			if feature.Desired {
				label = "啟用"
			}
			logAct(db, actorID, "FEATURE", id, "DESIRED", fmt.Sprintf("%s把%s／%s的期望改為%s。", user.Name, product.Name, featureName, label))
		}
		if !boolPtrEqual(previousActual, feature.Actual) {
			label := "未填報"
			if feature.Actual != nil {
				if *feature.Actual {
					label = "啟用"
				} else {
					label = "關閉"
				}
			}
			logAct(db, actorID, "FEATURE", id, "ACTUAL", fmt.Sprintf("%s填報%s／%s實際為%s。", user.Name, product.Name, featureName, label))
		}
	}
	metaChanged := strings.TrimSpace(input.Notes) != prevNotes ||
		input.SecondaryOwnerID != prevOwner ||
		!ptrEqual(plannedDate, prevPlannedDate) ||
		!ptrEqual(deployedAt, prevDeployedAt) ||
		!linksSame
	if metaChanged {
		logAct(db, actorID, "DEPLOYMENT", id, "UPDATE", fmt.Sprintf("%s更新%s的部署資料。", user.Name, product.Name))
	}
	return idBody{ID: id}, nil
}

func SavePlan(db *domain.Database, actorID, factoryID, productID string, input PlanInput) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	if err := validatePlanIntent(input.Intent); err != nil {
		return idBody{}, err
	}
	pidx := indexProduct(db, productID)
	if pidx < 0 {
		return idBody{}, apierr.New(404, "找不到這個產品")
	}
	product := db.Products[pidx]
	didx := -1
	for i := range db.Deployments {
		if db.Deployments[i].FactoryID == factoryID && db.Deployments[i].ProductID == productID {
			didx = i
			break
		}
	}
	planIdx := -1
	for i := range db.Plans {
		if db.Plans[i].FactoryID == factoryID && db.Plans[i].ProductID == productID {
			planIdx = i
			break
		}
	}
	if didx < 0 || planIdx < 0 {
		return idBody{}, apierr.New(404, "找不到這份產品計畫")
	}
	start, err := optionalDate(input.ConstructionStart)
	if err != nil {
		return idBody{}, err
	}
	end, err := optionalDate(input.ConstructionEnd)
	if err != nil {
		return idBody{}, err
	}
	if start != nil && end != nil && *end < *start {
		return idBody{}, apierr.New(400, "施工結束日不能早於開始日")
	}
	features := featuresOf(db, productID)
	var provided *string
	plannedFeatures := []domain.PlannedFeature{}
	adhoc := []domain.AdHocChange{}
	if product.Mode == "FEATURE_ONLY" {
		seen := map[string]bool{}
		for _, row := range input.PlannedFeatures {
			if !hasFeature(features, row.FeatureID) {
				return idBody{}, apierr.New(400, "找不到這個功能")
			}
			if seen[row.FeatureID] {
				continue
			}
			seen[row.FeatureID] = true
			plannedFeatures = append(plannedFeatures, domain.PlannedFeature{FeatureID: row.FeatureID, Enabled: row.Enabled})
		}
		plan := db.Plans[planIdx]
		if (input.Intent == "submit" || plan.Status == "SUBMITTED" || plan.Status == "APPROVED") && !domain.IsFeaturePlanComplete(featureIDs(features), plannedFeatures) {
			return idBody{}, apierr.New(400, "送出前要為每個功能選擇啟用或關閉")
		}
		normalized, err := normalizeAdHoc(db, productID, input.AdHocChanges, "FEATURE_ONLY")
		if err != nil {
			return idBody{}, err
		}
		reasons := input.Reasons
		if reasons == nil {
			reasons = map[string]string{}
		}
		adhoc = domain.FeatureOverrides(features, plannedFeatures, reasons, normalized)
		for _, row := range plannedFeatures {
			for i := range db.FeatureConfigs {
				if db.FeatureConfigs[i].DeploymentID == db.Deployments[didx].ID && db.FeatureConfigs[i].FeatureID == row.FeatureID {
					db.FeatureConfigs[i].Desired = row.Enabled
				}
			}
		}
	} else {
		if input.ProvidedVersionID != nil && *input.ProvidedVersionID != "" {
			ok := false
			for _, version := range db.Versions {
				if version.ID == *input.ProvidedVersionID && version.ProductID == productID {
					ok = true
					break
				}
			}
			if !ok {
				return idBody{}, apierr.New(400, "這個版本不屬於此產品")
			}
		}
		if input.Intent == "submit" && (input.ProvidedVersionID == nil || *input.ProvidedVersionID == "") {
			return idBody{}, apierr.New(400, "送出前要選擇提供的版本")
		}
		if input.ProvidedVersionID != nil && *input.ProvidedVersionID == "" {
			provided = nil
		} else {
			provided = input.ProvidedVersionID
		}
		adhoc, err = normalizeAdHoc(db, productID, input.AdHocChanges, "VERSIONED")
		if err != nil {
			return idBody{}, err
		}
	}
	if input.Intent == "submit" && (start == nil || end == nil) {
		return idBody{}, apierr.New(400, "送出前要填施工時間範圍")
	}
	plan := &db.Plans[planIdx]
	plan.ProvidedVersionID = provided
	plan.PlannedFeatures = plannedFeatures
	plan.AdHocChanges = adhoc
	plan.ConstructionStart = start
	plan.ConstructionEnd = end
	plan.Note = strings.TrimSpace(input.Note)
	machines, err := replaceMachines(db, db.Deployments[didx].ID, input.Machines)
	if err != nil {
		return idBody{}, err
	}
	editingLive := plan.Status == "SUBMITTED" || plan.Status == "APPROVED"
	if input.Intent == "submit" || editingLive {
		now := nowISO()
		plan.Status = "SUBMITTED"
		plan.SubmittedByID = &user.ID
		plan.SubmittedAt = &now
		plan.ApprovedByID = nil
		plan.ApprovedAt = nil
	}
	action := "SUBMIT"
	if input.Intent == "draft" && !editingLive {
		action = "DRAFT"
	}
	number := 1
	for _, revision := range db.Revisions {
		if revision.PlanID == plan.ID {
			number++
		}
	}
	db.Revisions = append(db.Revisions, domain.PlanRevision{
		ID: nextID(db, "rev"), PlanID: plan.ID, Number: number, Action: action,
		ProvidedVersionID: plan.ProvidedVersionID, PlannedFeatures: append([]domain.PlannedFeature(nil), plannedFeatures...),
		AdHocChanges: append([]domain.AdHocChange(nil), adhoc...), ConstructionStart: start, ConstructionEnd: end,
		Machines: machines, ActorID: user.ID, CreatedAt: nowISO(), Note: strings.TrimSpace(input.Note),
	})
	verb := "送出"
	if action == "DRAFT" {
		verb = "儲存草稿"
	}
	fidx := indexFactory(db, factoryID)
	if fidx < 0 {
		return idBody{}, apierr.New(404, "找不到這座工廠")
	}
	logAct(db, actorID, "PLAN", plan.ID, action, fmt.Sprintf("%s%s%s的%s計畫。", user.Name, verb, db.Factories[fidx].Name, product.Name))
	return idBody{ID: plan.ID}, nil
}

func ApprovePlan(db *domain.Database, actorID, factoryID, productID string) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	planIdx := -1
	for i := range db.Plans {
		if db.Plans[i].FactoryID == factoryID && db.Plans[i].ProductID == productID {
			planIdx = i
			break
		}
	}
	if planIdx < 0 {
		return idBody{}, apierr.New(404, "找不到這份產品計畫")
	}
	plan := &db.Plans[planIdx]
	if plan.Status != "SUBMITTED" {
		return idBody{}, apierr.New(400, "只有已提報的計畫可以核准")
	}
	now := nowISO()
	plan.Status = "APPROVED"
	plan.ApprovedByID = &user.ID
	plan.ApprovedAt = &now
	number := 1
	for _, revision := range db.Revisions {
		if revision.PlanID == plan.ID {
			number++
		}
	}
	db.Revisions = append(db.Revisions, domain.PlanRevision{
		ID: nextID(db, "rev"), PlanID: plan.ID, Number: number, Action: "APPROVE",
		ProvidedVersionID: plan.ProvidedVersionID,
		PlannedFeatures:   append([]domain.PlannedFeature(nil), plan.PlannedFeatures...),
		AdHocChanges:      append([]domain.AdHocChange(nil), plan.AdHocChanges...),
		ConstructionStart: plan.ConstructionStart, ConstructionEnd: plan.ConstructionEnd,
		Machines: snapshotMachines(db, plan.DeploymentID), ActorID: user.ID, CreatedAt: nowISO(), Note: "TPM 核准",
	})
	pidx := indexProduct(db, productID)
	if pidx < 0 {
		return idBody{}, apierr.New(404, "找不到這個產品")
	}
	logAct(db, actorID, "PLAN", plan.ID, "APPROVE", fmt.Sprintf("%s核准%s計畫。", user.Name, db.Products[pidx].Name))
	return idBody{ID: plan.ID}, nil
}

func CreateProduct(db *domain.Database, actorID string, input ProductInput) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return idBody{}, apierr.New(400, "產品名稱必填")
	}
	if input.Mode != "VERSIONED" && input.Mode != "FEATURE_ONLY" {
		return idBody{}, apierr.New(400, "請選擇版本模式或僅功能開關")
	}
	audience, err := domain.NormalizeAudience(input.Audience)
	if err != nil {
		return idBody{}, apierr.New(400, err.Error())
	}
	if err := requirePerson(db, input.PrimaryOwnerID); err != nil {
		return idBody{}, err
	}
	id := nextID(db, "prd")
	db.Products = append(db.Products, domain.Product{
		ID: id, Name: name, Description: strings.TrimSpace(input.Description),
		DevDepartment: strings.TrimSpace(input.DevDepartment), ProjectDepartment: strings.TrimSpace(input.ProjectDepartment),
		PrimaryOwnerID: input.PrimaryOwnerID, Mode: input.Mode, Audience: audience,
	})
	for _, factory := range db.Factories {
		if err := ensureDeployment(db, factory.ID, id, factory.PMID); err != nil {
			return idBody{}, err
		}
	}
	logAct(db, actorID, "PRODUCT", id, "CREATE", fmt.Sprintf("%s新增產品「%s」，並在每座工廠建立未提報的計畫。", user.Name, name))
	return idBody{ID: id}, nil
}

func UpdateProduct(db *domain.Database, actorID, id string, input ProductInput) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	idx := indexProduct(db, id)
	if idx < 0 {
		return idBody{}, apierr.New(404, "找不到這個產品")
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return idBody{}, apierr.New(400, "產品名稱必填")
	}
	if err := requirePerson(db, input.PrimaryOwnerID); err != nil {
		return idBody{}, err
	}
	product := &db.Products[idx]
	product.Name = name
	product.Description = strings.TrimSpace(input.Description)
	product.DevDepartment = strings.TrimSpace(input.DevDepartment)
	product.ProjectDepartment = strings.TrimSpace(input.ProjectDepartment)
	product.PrimaryOwnerID = input.PrimaryOwnerID
	if err := validateProductMode(input.Mode); err != nil {
		return idBody{}, err
	}
	audience, err := domain.NormalizeAudience(input.Audience)
	if err != nil {
		return idBody{}, apierr.New(400, err.Error())
	}
	product.Mode = input.Mode
	product.Audience = audience
	logAct(db, actorID, "PRODUCT", id, "UPDATE", fmt.Sprintf("%s更新產品「%s」。", user.Name, product.Name))
	return idBody{ID: id}, nil
}

func CreateMachineType(db *domain.Database, actorID string, input MachineTypeInput) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	name, err := domain.NormalizeMachineTypeName(input.Name)
	if err != nil {
		return idBody{}, apierr.New(400, err.Error())
	}
	for _, item := range db.MachineTypes {
		if strings.EqualFold(item.Name, name) {
			return idBody{}, apierr.New(400, domain.MachineTypeNameTaken)
		}
	}
	id := nextID(db, "mt")
	db.MachineTypes = append(db.MachineTypes, domain.MachineType{ID: id, Name: name, Order: len(db.MachineTypes) + 1, Active: true})
	logAct(db, actorID, "MACHINE", id, "CREATE", fmt.Sprintf("%s新增機種「%s」。", user.Name, name))
	return idBody{ID: id}, nil
}

func UpdateMachineType(db *domain.Database, actorID, id string, input MachineTypePatch) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	idx := -1
	for i := range db.MachineTypes {
		if db.MachineTypes[i].ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		return idBody{}, apierr.New(404, "找不到這個機種")
	}
	name, err := domain.NormalizeMachineTypeName(input.Name)
	if err != nil {
		return idBody{}, apierr.New(400, err.Error())
	}
	for _, item := range db.MachineTypes {
		if item.ID != id && strings.EqualFold(item.Name, name) {
			return idBody{}, apierr.New(400, domain.MachineTypeNameTaken)
		}
	}
	db.MachineTypes[idx].Name = name
	db.MachineTypes[idx].Active = input.Active
	logAct(db, actorID, "MACHINE", id, "UPDATE", fmt.Sprintf("%s更新機種「%s」。", user.Name, name))
	return idBody{ID: id}, nil
}

func DiffVersionFeatures(db *domain.Database, fromID *string, toID string) []domain.FeatureChange {
	var to *domain.ProductVersion
	for i := range db.Versions {
		if db.Versions[i].ID == toID {
			to = &db.Versions[i]
			break
		}
	}
	if to == nil {
		return []domain.FeatureChange{}
	}
	features := featuresOf(db, to.ProductID)
	previous := ""
	if fromID != nil && *fromID != "" {
		previous = *fromID
	} else {
		candidates := []domain.ProductVersion{}
		for _, version := range db.Versions {
			if version.ProductID == to.ProductID && version.ID != toID {
				candidates = append(candidates, version)
			}
		}
		sort.SliceStable(candidates, func(i, j int) bool {
			return semverOrZero(candidates[i].Version, candidates[j].Version) < 0
		})
		var below []domain.ProductVersion
		for _, version := range candidates {
			if semverOrZero(version.Version, to.Version) < 0 {
				below = append(below, version)
			}
		}
		if len(below) > 0 {
			previous = below[len(below)-1].ID
		}
	}
	supported := func(versionID, featureID string) bool {
		if versionID == "" {
			return false
		}
		for _, row := range db.VersionFeatures {
			if row.VersionID == versionID && row.FeatureID == featureID && row.Supported {
				return true
			}
		}
		return false
	}
	changes := []domain.FeatureChange{}
	for _, feature := range features {
		before := supported(previous, feature.ID)
		after := supported(toID, feature.ID)
		if !before && after {
			changes = append(changes, domain.FeatureChange{FeatureID: feature.ID, ChangeType: "ADDED", Summary: "相對前一版新增" + feature.Name})
		}
		if before && !after {
			changes = append(changes, domain.FeatureChange{FeatureID: feature.ID, ChangeType: "REMOVED", Summary: "相對前一版移除" + feature.Name})
		}
	}
	return changes
}

func CreatePerson(db *domain.Database, actorID string, input PersonInput) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	name := strings.TrimSpace(input.Name)
	department := strings.TrimSpace(input.Department)
	if name == "" || department == "" {
		return idBody{}, apierr.New(400, "姓名與部門必填")
	}
	id := nextID(db, "per")
	db.People = append(db.People, domain.Person{ID: id, Name: name, Department: department, Active: true, Source: "manual"})
	logAct(db, actorID, "PERSON", id, "CREATE", fmt.Sprintf("%s新增人員「%s」。", user.Name, name))
	return idBody{ID: id}, nil
}

func UpdatePerson(db *domain.Database, actorID, id string, input PersonInput) (idBody, error) {
	user, err := actor(db, actorID)
	if err != nil {
		return idBody{}, err
	}
	idx := -1
	for i := range db.People {
		if db.People[i].ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		return idBody{}, apierr.New(404, "找不到這個人")
	}
	person := &db.People[idx]
	if person.Source != "manual" {
		return idBody{}, apierr.New(400, "外部人員由目錄同步，不能在這裡修改")
	}
	name := strings.TrimSpace(input.Name)
	department := strings.TrimSpace(input.Department)
	if name == "" || department == "" {
		return idBody{}, apierr.New(400, "姓名與部門必填")
	}
	person.Name = name
	person.Department = department
	if input.Active != nil {
		person.Active = *input.Active
	}
	verb := "更新"
	if !person.Active {
		verb = "停用"
	}
	logAct(db, actorID, "PERSON", id, "UPDATE", fmt.Sprintf("%s%s人員「%s」。", user.Name, verb, name))
	return idBody{ID: id}, nil
}

func ensureDeployment(db *domain.Database, factoryID, productID, ownerID string) error {
	pidx := indexProduct(db, productID)
	if pidx < 0 {
		return apierr.New(404, "找不到這個產品")
	}
	product := db.Products[pidx]
	var planned *string
	if product.Mode == "VERSIONED" {
		versions := []domain.ProductVersion{}
		for _, version := range db.Versions {
			if version.ProductID == productID {
				versions = append(versions, version)
			}
		}
		sort.SliceStable(versions, func(i, j int) bool { return semverOrZero(versions[i].Version, versions[j].Version) < 0 })
		if len(versions) > 0 {
			last := versions[len(versions)-1].ID
			planned = &last
		}
	}
	deploymentID := nextID(db, "dep")
	db.Deployments = append(db.Deployments, domain.ProductDeployment{
		ID: deploymentID, FactoryID: factoryID, ProductID: productID, PlannedVersionID: planned,
		Status: "PLANNED", SecondaryOwnerID: ownerID, Notes: "",
	})
	for _, phase := range db.Phases {
		if phase.FactoryID == factoryID && phase.Order == 2 {
			phaseID := phase.ID
			db.PhaseLinks = append(db.PhaseLinks, domain.DeploymentPhaseLink{
				ID: nextID(db, "lnk"), DeploymentID: deploymentID, PhaseID: phaseID, Relation: "INTRODUCED",
			})
			break
		}
	}
	for _, feature := range db.Features {
		if feature.ProductID != productID {
			continue
		}
		desired := false
		if product.Mode == "FEATURE_ONLY" {
			desired = feature.DefaultEnabled
		} else if planned != nil {
			desired = supports(db, *planned, feature.ID)
		}
		db.FeatureConfigs = append(db.FeatureConfigs, domain.FeatureConfiguration{
			ID: nextID(db, "fc"), DeploymentID: deploymentID, FeatureID: feature.ID, Desired: desired,
		})
	}
	db.Plans = append(db.Plans, domain.ProductFactoryPlan{
		ID: nextID(db, "plan"), FactoryID: factoryID, ProductID: productID, DeploymentID: deploymentID,
		Status: "NOT_SUBMITTED", PlannedFeatures: []domain.PlannedFeature{}, AdHocChanges: []domain.AdHocChange{}, Note: "",
	})
	return nil
}

func normalizeAdHoc(db *domain.Database, productID string, rows []domain.AdHocChange, mode string) ([]domain.AdHocChange, error) {
	features := featuresOf(db, productID)
	cleaned := []domain.AdHocChange{}
	for _, row := range rows {
		if row.Kind == "CUSTOM" {
			title := strings.TrimSpace(row.Title)
			if title == "" {
				continue
			}
			id := row.ID
			if id == "" {
				id = nextID(db, "ah")
			}
			cleaned = append(cleaned, domain.AdHocChange{ID: id, Kind: "CUSTOM", Title: title, Description: strings.TrimSpace(row.Description)})
			continue
		}
		if mode == "FEATURE_ONLY" {
			continue
		}
		if row.FeatureID == nil || *row.FeatureID == "" || !hasFeature(features, *row.FeatureID) {
			return nil, apierr.New(400, "特殊異動指向不存在的功能")
		}
		id := row.ID
		if id == "" {
			id = nextID(db, "ah")
		}
		enabled := row.Enabled != nil && *row.Enabled
		fid := *row.FeatureID
		cleaned = append(cleaned, domain.AdHocChange{
			ID: id, Kind: "FEATURE_OVERRIDE", FeatureID: &fid, Enabled: &enabled, Title: "", Description: strings.TrimSpace(row.Description),
		})
	}
	return cleaned, nil
}

func replaceMachines(db *domain.Database, deploymentID string, rows []struct {
	MachineTypeID string  `json:"machineTypeId"`
	Planned       float64 `json:"planned"`
}) ([]domain.PlannedMachine, error) {
	seen := map[string]bool{}
	cleaned := []domain.PlannedMachine{}
	for _, row := range rows {
		if seen[row.MachineTypeID] {
			continue
		}
		seen[row.MachineTypeID] = true
		found := false
		for _, item := range db.MachineTypes {
			if item.ID == row.MachineTypeID {
				found = true
				break
			}
		}
		if !found {
			return nil, apierr.New(400, "找不到這個機種")
		}
		if math.IsNaN(row.Planned) || math.IsInf(row.Planned, 0) || row.Planned != math.Trunc(row.Planned) || row.Planned < 0 {
			return nil, apierr.New(400, "計畫機台數需為 0 以上的整數")
		}
		cleaned = append(cleaned, domain.PlannedMachine{MachineTypeID: row.MachineTypeID, Planned: int(row.Planned)})
	}
	kept := make([]domain.MachineQuantity, 0, len(db.MachineQuantities))
	for _, row := range db.MachineQuantities {
		if row.DeploymentID != deploymentID {
			kept = append(kept, row)
		}
	}
	db.MachineQuantities = kept
	for _, row := range cleaned {
		db.MachineQuantities = append(db.MachineQuantities, domain.MachineQuantity{
			ID: nextID(db, "mq"), DeploymentID: deploymentID, MachineTypeID: row.MachineTypeID, Planned: row.Planned,
		})
	}
	return cleaned, nil
}

func snapshotMachines(db *domain.Database, deploymentID string) []domain.PlannedMachine {
	out := []domain.PlannedMachine{}
	for _, row := range db.MachineQuantities {
		if row.DeploymentID == deploymentID {
			out = append(out, domain.PlannedMachine{MachineTypeID: row.MachineTypeID, Planned: domain.NonNegativeInt(float64(row.Planned))})
		}
	}
	return out
}

func normalizeTopic(db *domain.Database, input TopicInput) (domain.DiscussionTopic, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		return domain.DiscussionTopic{}, apierr.New(400, "請填例外事項標題")
	}
	if err := requirePerson(db, input.OwnerID); err != nil {
		return domain.DiscussionTopic{}, err
	}
	switch input.Status {
	case "OPEN", "IN_DISCUSSION", "RESOLVED", "CLOSED":
	default:
		return domain.DiscussionTopic{}, apierr.New(400, "例外事項狀態不正確")
	}
	raised, err := requireDate(input.RaisedOn, "提出日期")
	if err != nil {
		return domain.DiscussionTopic{}, err
	}
	return domain.DiscussionTopic{
		Title: title, Description: strings.TrimSpace(input.Description), OwnerID: input.OwnerID, Status: input.Status, RaisedOn: raised,
	}, nil
}

func featuresOf(db *domain.Database, productID string) []domain.FeatureDefinition {
	out := []domain.FeatureDefinition{}
	for _, feature := range db.Features {
		if feature.ProductID == productID {
			out = append(out, feature)
		}
	}
	return out
}

func featureIDs(features []domain.FeatureDefinition) []string {
	ids := make([]string, 0, len(features))
	for _, feature := range features {
		ids = append(ids, feature.ID)
	}
	return ids
}

func hasFeature(features []domain.FeatureDefinition, id string) bool {
	for _, feature := range features {
		if feature.ID == id {
			return true
		}
	}
	return false
}

func supports(db *domain.Database, versionID, featureID string) bool {
	for _, row := range db.VersionFeatures {
		if row.VersionID == versionID && row.FeatureID == featureID && row.Supported {
			return true
		}
	}
	return false
}

func requirePerson(db *domain.Database, id string) error {
	for _, person := range db.People {
		if person.ID == id && person.Active {
			return nil
		}
	}
	return apierr.New(400, "請從在職人員名單選擇")
}

func actor(db *domain.Database, actorID string) (domain.Person, error) {
	for _, person := range db.People {
		if person.ID == actorID {
			return person, nil
		}
	}
	return domain.Person{}, apierr.New(401, "找不到目前的操作者")
}

func requireDate(value, label string) (string, error) {
	if !domain.IsIsoDate(value) {
		return "", apierr.New(400, label+"需要 YYYY-MM-DD")
	}
	return value, nil
}

func optionalDate(value *string) (*string, error) {
	if value == nil || *value == "" {
		return nil, nil
	}
	if !domain.IsIsoDate(*value) {
		return nil, apierr.New(400, "日期需要 YYYY-MM-DD")
	}
	return value, nil
}

func orderValue(v *float64, fallback int) int {
	if v == nil || math.IsNaN(*v) || *v == 0 {
		return fallback
	}
	return int(math.Trunc(*v))
}

func filterDeps(ids []string, self string) []string {
	out := []string{}
	for _, id := range ids {
		if id != self {
			out = append(out, id)
		}
	}
	return out
}

func nextID(db *domain.Database, prefix string) string {
	db.Seq++
	return fmt.Sprintf("%s_%d", prefix, db.Seq)
}

func featureOnProduct(db *domain.Database, productID, featureID string) bool {
	for _, feature := range db.Features {
		if feature.ID == featureID && feature.ProductID == productID {
			return true
		}
	}
	return false
}

func deploymentLinksMatch(db *domain.Database, deploymentID string, links []struct {
	PhaseID  string `json:"phaseId"`
	Relation string `json:"relation"`
}) bool {
	current := make([]domain.DeploymentPhaseLink, 0)
	for _, link := range db.PhaseLinks {
		if link.DeploymentID == deploymentID {
			current = append(current, link)
		}
	}
	if len(current) != len(links) {
		return false
	}
	for i := range current {
		if current[i].PhaseID != links[i].PhaseID || current[i].Relation != links[i].Relation {
			return false
		}
	}
	return true
}

func logAct(db *domain.Database, actorID, entityType, entityID, action, summary string) {
	db.Activity = append([]domain.Activity{{
		ID: nextID(db, "act"), EntityType: entityType, EntityID: entityID, Action: action,
		Summary: summary, ActorID: actorID, CreatedAt: nowISO(),
	}}, db.Activity...)
}

func nowISO() string { return time.Now().UTC().Format("2006-01-02T15:04:05.000Z") }

func stringPtr(v string) *string { return &v }

func ptrEqual(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func boolPtrEqual(a, b *bool) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func versionLabel(db *domain.Database, id *string) string {
	if id == nil || *id == "" {
		return "未填"
	}
	for _, version := range db.Versions {
		if version.ID == *id {
			return version.Version
		}
	}
	return "undefined"
}

func semverOrZero(a, b string) int {
	cmp, ok := domain.CompareSemver(a, b)
	if !ok {
		return 0
	}
	return cmp
}

func indexFactory(db *domain.Database, id string) int {
	for i := range db.Factories {
		if db.Factories[i].ID == id {
			return i
		}
	}
	return -1
}

func indexPhase(db *domain.Database, id string) int {
	for i := range db.Phases {
		if db.Phases[i].ID == id {
			return i
		}
	}
	return -1
}

func indexMilestone(db *domain.Database, id string) int {
	for i := range db.Milestones {
		if db.Milestones[i].ID == id {
			return i
		}
	}
	return -1
}

func indexTopic(db *domain.Database, id string) int {
	for i := range db.Topics {
		if db.Topics[i].ID == id {
			return i
		}
	}
	return -1
}

func indexIssue(db *domain.Database, id string) int {
	for i := range db.Issues {
		if db.Issues[i].ID == id {
			return i
		}
	}
	return -1
}

func indexDeployment(db *domain.Database, id string) int {
	for i := range db.Deployments {
		if db.Deployments[i].ID == id {
			return i
		}
	}
	return -1
}

func indexProduct(db *domain.Database, id string) int {
	for i := range db.Products {
		if db.Products[i].ID == id {
			return i
		}
	}
	return -1
}
