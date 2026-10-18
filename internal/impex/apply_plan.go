package impex

import "fpm/internal/domain"

func (w *world) plans() {
	for _, row := range w.ds.Plans {
		fid, _ := w.factoryID(row.Factory)
		pid, _ := w.productID(row.Product)
		product := *w.productByID(pid)
		factory := *w.factoryByID(fid)
		versionID := ""
		actualID := ""
		if product.Mode != "FEATURE_ONLY" {
			if row.Version != "" {
				versionID, _ = w.versionID(pid, row.Version)
			}
			if row.ActualVersion != "" {
				actualID, _ = w.versionID(pid, row.ActualVersion)
			}
		}
		secondary := row.Secondary
		if secondary == "" {
			if owner := w.productByID(pid); owner != nil {
				secondary = personName(w.db, owner.PrimaryOwnerID)
			}
		}
		secondaryID, _ := w.personID(secondary)
		if secondaryID == "" {
			secondaryID = factory.PMID
		}
		depIdx := w.ensureDeployment(fid, pid, secondaryID)
		planIdx := w.planIndex(fid, pid)
		created := planIdx < 0 || !w.existed[fid+"\t"+pid]
		if planIdx < 0 {
			w.db.Plans = append(w.db.Plans, domain.ProductFactoryPlan{
				ID: w.id("pln"), FactoryID: fid, ProductID: pid, DeploymentID: w.db.Deployments[depIdx].ID,
				PlannedFeatures: []domain.PlannedFeature{}, AdHocChanges: []domain.AdHocChange{},
			})
			planIdx = len(w.db.Plans) - 1
		}
		desiredFeatures := w.desiredFeatures(product, row)
		desiredAdhoc := w.desiredAdhoc(product, row, w.db.Plans[planIdx].AdHocChanges)
		dep := &w.db.Deployments[depIdx]
		plan := &w.db.Plans[planIdx]
		depSame := dep.Status == row.DeploymentStatus && dep.SecondaryOwnerID == secondaryID && strVal(dep.PlannedVersionID) == versionID && strVal(dep.ActualVersionID) == actualID && strVal(dep.PlannedDate) == row.PlannedDate && strVal(dep.DeployedAt) == row.DeployedAt
		planSame := plan.Status == row.Status && strVal(plan.ProvidedVersionID) == versionID && plan.Note == row.Note && strVal(plan.ConstructionStart) == row.ConstructionStart && strVal(plan.ConstructionEnd) == row.ConstructionEnd && sameFeatures(plan.PlannedFeatures, desiredFeatures) && sameAdhoc(plan.AdHocChanges, desiredAdhoc) && plan.DeploymentID == dep.ID
		changed := !created && (!depSame || !planSame)
		if created || changed {
			dep.Status = row.DeploymentStatus
			dep.SecondaryOwnerID = secondaryID
			dep.PlannedVersionID = strPtr(versionID)
			dep.ActualVersionID = strPtr(actualID)
			dep.PlannedDate = strPtr(row.PlannedDate)
			dep.DeployedAt = strPtr(row.DeployedAt)
			plan.DeploymentID = dep.ID
			plan.Status = row.Status
			plan.ProvidedVersionID = strPtr(versionID)
			plan.PlannedFeatures = desiredFeatures
			plan.AdHocChanges = desiredAdhoc
			plan.ConstructionStart = strPtr(row.ConstructionStart)
			plan.ConstructionEnd = strPtr(row.ConstructionEnd)
			plan.Note = row.Note
			w.syncApproval(plan, row.Status, product.PrimaryOwnerID, factory.PMID)
			w.touched = append(w.touched, planTouch{id: plan.ID, created: created})
			action := "UPDATE"
			if created {
				action = "CREATE"
			}
			w.act("PLAN", plan.ID, action, "匯入施工計畫"+row.Factory+"／"+row.Product, secondaryID)
		}
		w.rep.add(row.File, row.Row, created, changed, entPlan, row.Factory+"／"+row.Product)
	}
}

func (w *world) ensureDeployment(factoryID, productID, secondaryID string) int {
	idx := w.deploymentIndex(factoryID, productID)
	if idx >= 0 {
		return idx
	}
	w.db.Deployments = append(w.db.Deployments, domain.ProductDeployment{
		ID: w.id("dep"), FactoryID: factoryID, ProductID: productID, Status: "PLANNED", SecondaryOwnerID: secondaryID,
	})
	return len(w.db.Deployments) - 1
}

func (w *world) desiredFeatures(product domain.Product, row PlanRow) []domain.PlannedFeature {
	if product.Mode != "FEATURE_ONLY" || (row.Status == "NOT_SUBMITTED" && len(row.FeatureChanges) == 0) {
		return []domain.PlannedFeature{}
	}
	enabled := map[string]bool{}
	for _, change := range row.FeatureChanges {
		enabled[change.Name] = change.Enabled
	}
	out := make([]domain.PlannedFeature, 0)
	for _, feature := range w.featuresOf(product.ID) {
		out = append(out, domain.PlannedFeature{FeatureID: feature.ID, Enabled: enabled[feature.Name]})
	}
	return out
}

func (w *world) desiredAdhoc(product domain.Product, row PlanRow, existing []domain.AdHocChange) []domain.AdHocChange {
	out := make([]domain.AdHocChange, 0)
	if product.Mode == "FEATURE_ONLY" && len(row.FeatureChanges) == 0 {
		// No planned set yet: keep only free-text changes.
	} else if product.Mode == "FEATURE_ONLY" {
		enabled := map[string]bool{}
		reasons := map[string]string{}
		for _, change := range row.FeatureChanges {
			enabled[change.Name] = change.Enabled
			reasons[change.Name] = change.Reason
		}
		for _, feature := range w.featuresOf(product.ID) {
			on := enabled[feature.Name]
			if on == feature.DefaultEnabled {
				continue
			}
			out = append(out, reuseOverride(existing, feature.ID, on, reasons[feature.Name], w.id))
		}
	} else {
		for _, change := range row.FeatureChanges {
			feature := w.featureByName(product.ID, change.Name)
			if feature == nil {
				continue
			}
			out = append(out, reuseOverride(existing, feature.ID, change.Enabled, change.Reason, w.id))
		}
	}
	for _, custom := range row.AdHoc {
		out = append(out, reuseCustom(existing, custom.Title, custom.Description, w.id))
	}
	return out
}

func reuseOverride(existing []domain.AdHocChange, featureID string, enabled bool, reason string, next func(string) string) domain.AdHocChange {
	for _, item := range existing {
		if item.Kind == "FEATURE_OVERRIDE" && strVal(item.FeatureID) == featureID {
			item.Enabled = boolPtr(enabled)
			item.Description = reason
			item.Title = ""
			return item
		}
	}
	return domain.AdHocChange{
		ID: next("ah"), Kind: "FEATURE_OVERRIDE", FeatureID: strPtr(featureID), Enabled: boolPtr(enabled), Description: reason,
	}
}

func reuseCustom(existing []domain.AdHocChange, title, description string, next func(string) string) domain.AdHocChange {
	for _, item := range existing {
		if item.Kind == "CUSTOM" && item.Title == title {
			item.Description = description
			item.FeatureID = nil
			item.Enabled = nil
			return item
		}
	}
	return domain.AdHocChange{ID: next("ah"), Kind: "CUSTOM", Title: title, Description: description}
}

func sameFeatures(a, b []domain.PlannedFeature) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].FeatureID != b[i].FeatureID || a[i].Enabled != b[i].Enabled {
			return false
		}
	}
	return true
}

func sameAdhoc(a, b []domain.AdHocChange) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].Kind != b[i].Kind || a[i].Title != b[i].Title || a[i].Description != b[i].Description || strVal(a[i].FeatureID) != strVal(b[i].FeatureID) || !boolEq(a[i].Enabled, b[i].Enabled) {
			return false
		}
	}
	return true
}

func (w *world) syncApproval(plan *domain.ProductFactoryPlan, status, ownerID, pmID string) {
	switch status {
	case "NOT_SUBMITTED":
		plan.SubmittedByID, plan.SubmittedAt = nil, nil
		plan.ApprovedByID, plan.ApprovedAt = nil, nil
	case "APPROVED":
		if plan.SubmittedAt == nil {
			plan.SubmittedByID = strPtr(ownerID)
			plan.SubmittedAt = strPtr(w.timestamp())
		}
		if plan.ApprovedAt == nil {
			plan.ApprovedByID = strPtr(pmID)
			plan.ApprovedAt = strPtr(w.timestamp())
		}
	default:
		if plan.SubmittedAt == nil {
			plan.SubmittedByID = strPtr(ownerID)
			plan.SubmittedAt = strPtr(w.timestamp())
		}
		plan.ApprovedByID, plan.ApprovedAt = nil, nil
	}
}

func (w *world) machines() {
	for _, row := range w.ds.Machines {
		fid, _ := w.factoryID(row.Factory)
		pid, _ := w.productID(row.Product)
		typeID, _ := w.machineTypeID(row.MachineType)
		secondary := ""
		if product := w.productByID(pid); product != nil {
			secondary = product.PrimaryOwnerID
		}
		depIdx := w.ensureDeployment(fid, pid, secondary)
		depID := w.db.Deployments[depIdx].ID
		found := -1
		for i := range w.db.MachineQuantities {
			if w.db.MachineQuantities[i].DeploymentID == depID && w.db.MachineQuantities[i].MachineTypeID == typeID {
				found = i
				break
			}
		}
		if found < 0 {
			w.db.MachineQuantities = append(w.db.MachineQuantities, domain.MachineQuantity{
				ID: w.id("mq"), DeploymentID: depID, MachineTypeID: typeID, Planned: row.Planned,
			})
			w.rep.add(row.File, row.Row, true, false, entCount, row.Factory+"／"+row.Product+"／"+row.MachineType)
			continue
		}
		changed := w.db.MachineQuantities[found].Planned != row.Planned
		if changed {
			w.db.MachineQuantities[found].Planned = row.Planned
		}
		w.rep.add(row.File, row.Row, false, changed, entCount, row.Factory+"／"+row.Product+"／"+row.MachineType)
	}
}

func (w *world) shells() {
	factories := append([]domain.Factory(nil), w.db.Factories...)
	products := append([]domain.Product(nil), w.db.Products...)
	for _, factory := range factories {
		for _, product := range products {
			depIdx := w.deploymentIndex(factory.ID, product.ID)
			if depIdx < 0 {
				depIdx = w.ensureDeployment(factory.ID, product.ID, product.PrimaryOwnerID)
			}
			if w.planIndex(factory.ID, product.ID) >= 0 {
				continue
			}
			w.db.Plans = append(w.db.Plans, domain.ProductFactoryPlan{
				ID: w.id("pln"), FactoryID: factory.ID, ProductID: product.ID, DeploymentID: w.db.Deployments[depIdx].ID,
				Status: "NOT_SUBMITTED", PlannedFeatures: []domain.PlannedFeature{}, AdHocChanges: []domain.AdHocChange{},
			})
			w.rep.add("", 0, true, false, entPlan, factory.Name+"／"+product.Name)
		}
	}
}

func (w *world) finishDeployments() {
	factories := append([]domain.Factory(nil), w.db.Factories...)
	products := append([]domain.Product(nil), w.db.Products...)
	for _, factory := range factories {
		for _, product := range products {
			depIdx := w.deploymentIndex(factory.ID, product.ID)
			if depIdx < 0 {
				continue
			}
			w.syncConfigs(w.db.Deployments[depIdx].ID, product)
			w.syncLinks(w.db.Deployments[depIdx].ID, factory.ID)
		}
	}
}

func (w *world) syncConfigs(deploymentID string, product domain.Product) {
	depIdx := -1
	for i := range w.db.Deployments {
		if w.db.Deployments[i].ID == deploymentID {
			depIdx = i
			break
		}
	}
	if depIdx < 0 {
		return
	}
	dep := w.db.Deployments[depIdx]
	planIdx := w.planIndex(dep.FactoryID, dep.ProductID)
	var plan *domain.ProductFactoryPlan
	if planIdx >= 0 {
		plan = &w.db.Plans[planIdx]
	}
	for _, feature := range w.featuresOf(product.ID) {
		desired, actual := w.desiredActual(dep, product, feature, plan)
		found := -1
		for i := range w.db.FeatureConfigs {
			if w.db.FeatureConfigs[i].DeploymentID == deploymentID && w.db.FeatureConfigs[i].FeatureID == feature.ID {
				found = i
				break
			}
		}
		if found < 0 {
			w.db.FeatureConfigs = append(w.db.FeatureConfigs, domain.FeatureConfiguration{
				ID: w.id("fc"), DeploymentID: deploymentID, FeatureID: feature.ID, Desired: desired, Actual: actual,
			})
			continue
		}
		item := &w.db.FeatureConfigs[found]
		if item.Desired != desired || !boolEq(item.Actual, actual) {
			item.Desired = desired
			item.Actual = actual
		}
	}
}

func (w *world) desiredActual(dep domain.ProductDeployment, product domain.Product, feature domain.FeatureDefinition, plan *domain.ProductFactoryPlan) (bool, *bool) {
	if product.Mode == "FEATURE_ONLY" {
		desired := feature.DefaultEnabled
		if plan != nil {
			for _, item := range plan.PlannedFeatures {
				if item.FeatureID == feature.ID {
					desired = item.Enabled
					break
				}
			}
		}
		if dep.Status == "PLANNED" {
			return desired, nil
		}
		return desired, boolPtr(desired)
	}
	desired := false
	if dep.PlannedVersionID != nil && *dep.PlannedVersionID != "" {
		desired = w.supported(*dep.PlannedVersionID, feature.ID)
	}
	if plan != nil {
		for _, change := range plan.AdHocChanges {
			if change.Kind == "FEATURE_OVERRIDE" && strVal(change.FeatureID) == feature.ID && change.Enabled != nil {
				desired = *change.Enabled
				break
			}
		}
	}
	if dep.Status == "PLANNED" || dep.ActualVersionID == nil || *dep.ActualVersionID == "" {
		return desired, nil
	}
	return desired, boolPtr(w.supported(*dep.ActualVersionID, feature.ID))
}

func (w *world) supported(versionID, featureID string) bool {
	for _, row := range w.db.VersionFeatures {
		if row.VersionID == versionID && row.FeatureID == featureID && row.Supported {
			return true
		}
	}
	return false
}

func (w *world) syncLinks(deploymentID, factoryID string) {
	phaseID := ""
	for _, phase := range w.db.Phases {
		if phase.FactoryID == factoryID && phase.Order == 2 {
			phaseID = phase.ID
			break
		}
	}
	if phaseID == "" {
		return
	}
	w.ensureLink(deploymentID, phaseID, "INTRODUCED")
	status := ""
	for _, dep := range w.db.Deployments {
		if dep.ID == deploymentID {
			status = dep.Status
			break
		}
	}
	if status == "ACCEPTED" {
		w.ensureLink(deploymentID, phaseID, "ACCEPTED")
	}
}

func (w *world) ensureLink(deploymentID, phaseID, relation string) {
	for _, link := range w.db.PhaseLinks {
		if link.DeploymentID == deploymentID && link.PhaseID == phaseID && link.Relation == relation {
			return
		}
	}
	w.db.PhaseLinks = append(w.db.PhaseLinks, domain.DeploymentPhaseLink{
		ID: w.id("lnk"), DeploymentID: deploymentID, PhaseID: phaseID, Relation: relation,
	})
}

func (w *world) revisions() {
	for _, touch := range w.touched {
		plan := w.planByID(touch.id)
		if plan == nil || plan.Status == "NOT_SUBMITTED" && touch.created {
			continue
		}
		if plan.Status == "NOT_SUBMITTED" {
			w.addRevision(plan, "DRAFT", "匯入草稿")
			continue
		}
		if touch.created {
			w.addRevision(plan, "SUBMIT", "匯入提報")
			if plan.Status == "APPROVED" {
				w.addRevision(plan, "APPROVE", "匯入核准")
			}
			continue
		}
		action := "SUBMIT"
		note := "匯入提報"
		if plan.Status == "APPROVED" {
			action = "APPROVE"
			note = "匯入核准"
		}
		if plan.Status == "NOT_SUBMITTED" {
			action = "DRAFT"
			note = "匯入草稿"
		}
		w.addRevision(plan, action, note)
	}
}

func (w *world) addRevision(plan *domain.ProductFactoryPlan, action, note string) {
	number := 1
	for _, revision := range w.db.Revisions {
		if revision.PlanID == plan.ID && revision.Number >= number {
			number = revision.Number + 1
		}
	}
	actor := strVal(plan.SubmittedByID)
	if action == "APPROVE" {
		actor = strVal(plan.ApprovedByID)
	}
	if actor == "" {
		if factory := w.factoryByID(plan.FactoryID); factory != nil {
			actor = factory.PMID
		}
	}
	machines := []domain.PlannedMachine{}
	for _, row := range w.db.MachineQuantities {
		if row.DeploymentID == plan.DeploymentID {
			machines = append(machines, domain.PlannedMachine{MachineTypeID: row.MachineTypeID, Planned: row.Planned})
		}
	}
	features := append([]domain.PlannedFeature(nil), plan.PlannedFeatures...)
	adhoc := append([]domain.AdHocChange(nil), plan.AdHocChanges...)
	w.db.Revisions = append(w.db.Revisions, domain.PlanRevision{
		ID: w.id("rev"), PlanID: plan.ID, Number: number, Action: action,
		ProvidedVersionID: plan.ProvidedVersionID, PlannedFeatures: features, AdHocChanges: adhoc,
		ConstructionStart: plan.ConstructionStart, ConstructionEnd: plan.ConstructionEnd, Machines: machines,
		ActorID: actor, CreatedAt: w.timestamp(), Note: note,
	})
}

func (w *world) topics() {
	for _, row := range w.ds.Topics {
		fid, _ := w.factoryID(row.Factory)
		owner, _ := w.personID(row.Owner)
		found := -1
		for i := range w.db.Topics {
			if w.db.Topics[i].FactoryID == fid && w.db.Topics[i].Title == row.Title {
				found = i
				break
			}
		}
		if found < 0 {
			id := w.id("tp")
			w.db.Topics = append(w.db.Topics, domain.DiscussionTopic{
				ID: id, FactoryID: fid, Title: row.Title, Description: row.Description, OwnerID: owner, Status: row.Status, RaisedOn: row.RaisedOn,
			})
			w.rep.add(row.File, row.Row, true, false, entTopic, row.Title)
			w.act("TOPIC", id, "CREATE", "匯入議題"+row.Title, owner)
			continue
		}
		item := &w.db.Topics[found]
		changed := item.Description != row.Description || item.OwnerID != owner || item.Status != row.Status || item.RaisedOn != row.RaisedOn
		if changed {
			item.Description = row.Description
			item.OwnerID = owner
			item.Status = row.Status
			item.RaisedOn = row.RaisedOn
			w.act("TOPIC", item.ID, "UPDATE", "更新議題"+row.Title, owner)
		}
		w.rep.add(row.File, row.Row, false, changed, entTopic, row.Title)
	}
}

func (w *world) milestones() {
	for _, row := range w.ds.Milestones {
		fid, _ := w.factoryID(row.Factory)
		phaseIdx := w.findPhase(fid, row.Phase)
		if phaseIdx < 0 {
			continue
		}
		phaseID := w.db.Phases[phaseIdx].ID
		owner, _ := w.personID(row.Owner)
		found := -1
		for i := range w.db.Milestones {
			if w.db.Milestones[i].PhaseID == phaseID && w.db.Milestones[i].Name == row.Name {
				found = i
				break
			}
		}
		if found < 0 {
			var completed *string
			if row.Done {
				completed = strPtr(w.timestamp())
			}
			id := w.id("ms")
			w.db.Milestones = append(w.db.Milestones, domain.Milestone{
				ID: id, PhaseID: phaseID, Name: row.Name, DueDate: row.DueDate, Deliverables: row.Deliverables,
				Done: row.Done, CompletedAt: completed, OwnerID: owner,
			})
			w.rep.add(row.File, row.Row, true, false, entMilestone, row.Name)
			w.act("MILESTONE", id, "CREATE", "匯入里程碑"+row.Name, owner)
			continue
		}
		item := &w.db.Milestones[found]
		changed := item.DueDate != row.DueDate || item.Deliverables != row.Deliverables || item.Done != row.Done || item.OwnerID != owner
		if changed {
			item.DueDate = row.DueDate
			item.Deliverables = row.Deliverables
			item.OwnerID = owner
			if row.Done && item.CompletedAt == nil {
				item.CompletedAt = strPtr(w.timestamp())
			}
			if !row.Done {
				item.CompletedAt = nil
			}
			item.Done = row.Done
			w.act("MILESTONE", item.ID, "UPDATE", "更新里程碑"+row.Name, owner)
		}
		w.rep.add(row.File, row.Row, false, changed, entMilestone, row.Name)
	}
}

func (w *world) issues() {
	for _, row := range w.ds.Issues {
		fid, _ := w.factoryID(row.Factory)
		owner, _ := w.personID(row.Owner)
		var phaseID, productID, milestoneID string
		if row.Phase != "" {
			if idx := w.findPhase(fid, row.Phase); idx >= 0 {
				phaseID = w.db.Phases[idx].ID
			}
		}
		if row.Product != "" {
			productID, _ = w.productID(row.Product)
		}
		if row.Milestone != "" {
			milestoneID = w.milestoneID(fid, phaseID, row.Milestone)
		}
		found := -1
		for i := range w.db.Issues {
			if row.Code != "" && w.db.Issues[i].Code == row.Code {
				found = i
				break
			}
			if row.Code == "" && w.db.Issues[i].FactoryID == fid && w.db.Issues[i].Title == row.Title {
				found = i
				break
			}
		}
		if found < 0 {
			id := w.id("iss")
			code := row.Code
			if code == "" {
				code = "ISS-" + itoa(len(w.db.Issues)+1)
			}
			w.db.Issues = append(w.db.Issues, domain.Issue{
				ID: id, Code: code, Title: row.Title, Description: row.Description, FactoryID: fid,
				PhaseID: strPtr(phaseID), MilestoneID: strPtr(milestoneID), ProductID: strPtr(productID),
				OwnerID: owner, Severity: row.Severity, Priority: row.Priority, Status: row.Status,
				DueDate: strPtr(row.DueDate), Resolution: row.Resolution, UpdatedAt: w.timestamp(),
			})
			w.rep.add(row.File, row.Row, true, false, entIssue, row.Title)
			w.act("ISSUE", id, "CREATE", "匯入問題"+row.Title, owner)
			continue
		}
		item := &w.db.Issues[found]
		changed := item.Title != row.Title || item.Description != row.Description || item.FactoryID != fid || strVal(item.PhaseID) != phaseID || strVal(item.MilestoneID) != milestoneID || strVal(item.ProductID) != productID || item.OwnerID != owner || item.Severity != row.Severity || item.Priority != row.Priority || item.Status != row.Status || strVal(item.DueDate) != row.DueDate || item.Resolution != row.Resolution
		if row.Code != "" && item.Code != row.Code {
			changed = true
		}
		if changed {
			if row.Code != "" {
				item.Code = row.Code
			}
			item.Title = row.Title
			item.Description = row.Description
			item.FactoryID = fid
			item.PhaseID = strPtr(phaseID)
			item.MilestoneID = strPtr(milestoneID)
			item.ProductID = strPtr(productID)
			item.OwnerID = owner
			item.Severity = row.Severity
			item.Priority = row.Priority
			item.Status = row.Status
			item.DueDate = strPtr(row.DueDate)
			item.Resolution = row.Resolution
			item.UpdatedAt = w.timestamp()
			w.act("ISSUE", item.ID, "UPDATE", "更新問題"+row.Title, owner)
		}
		w.rep.add(row.File, row.Row, false, changed, entIssue, row.Title)
	}
}

func personName(db *domain.Database, id string) string {
	for _, person := range db.People {
		if person.ID == id {
			return person.Name
		}
	}
	return ""
}
