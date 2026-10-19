package impex

import (
	"fmt"
	"sort"
	"time"

	"fpm/internal/domain"
)

// Options controls who is recorded on imported activity.
type Options struct {
	ActorID string
}

type planTouch struct {
	id      string
	created bool
}

type world struct {
	db      *domain.Database
	ds      Dataset
	opt     Options
	rep     Report
	clock   int
	touched []planTouch
	existed map[string]bool
}

// Apply upserts ds into db. Rows already present and unchanged stay put, including their ids.
func Apply(db *domain.Database, ds Dataset, opt Options) Report {
	ds.Phases = append([]PhaseRow(nil), ds.Phases...)
	assignPhaseOrders(ds.Phases)
	rep := check(db, ds)
	if len(rep.Errors) > 0 {
		rep.normalize()
		return rep
	}
	w := &world{db: db, ds: ds, opt: opt, existed: map[string]bool{}}
	for _, plan := range db.Plans {
		w.existed[plan.FactoryID+"\t"+plan.ProductID] = true
	}
	w.people()
	w.machineTypes()
	w.products()
	w.versions()
	w.features()
	w.factories()
	w.phases()
	w.plans()
	w.machines()
	w.shells()
	w.finishDeployments()
	w.revisions()
	w.topics()
	w.milestones()
	w.issues()
	domain.Normalize(db)
	w.rep.normalize()
	return w.rep
}

func (w *world) id(prefix string) string {
	w.db.Seq++
	return fmt.Sprintf("%s_%d", prefix, w.db.Seq)
}

func (w *world) timestamp() string {
	asOf := w.db.AsOf
	if asOf == "" {
		asOf = DemoAsOf
	}
	base, err := time.Parse("2006-01-02", asOf)
	if err != nil {
		base = time.Date(2026, 10, 18, 0, 0, 0, 0, time.UTC)
	}
	ts := base.Add(time.Duration(w.clock) * time.Second).UTC().Format("2006-01-02T15:04:05.000Z")
	w.clock++
	return ts
}

func (w *world) actor(prefer string) string {
	if w.opt.ActorID != "" {
		for _, person := range w.db.People {
			if person.ID == w.opt.ActorID {
				return w.opt.ActorID
			}
		}
	}
	if prefer != "" {
		return prefer
	}
	if len(w.db.People) > 0 {
		return w.db.People[0].ID
	}
	return ""
}

func (w *world) act(entityType, entityID, action, summary, prefer string) {
	actor := w.actor(prefer)
	if actor == "" {
		return
	}
	w.db.Activity = append(w.db.Activity, domain.Activity{
		ID: w.id("act"), EntityType: entityType, EntityID: entityID, Action: action,
		Summary: summary, ActorID: actor, CreatedAt: w.timestamp(),
	})
}

func (w *world) people() {
	for _, row := range w.ds.People {
		idx := -1
		for i := range w.db.People {
			if w.db.People[i].Name == row.Name {
				idx = i
				break
			}
		}
		if idx < 0 {
			id := w.id("per")
			w.db.People = append(w.db.People, domain.Person{
				ID: id, Name: row.Name, Department: row.Department, Active: row.Active,
				Source: row.Source, ExternalID: strPtr(row.ExternalID),
			})
			w.rep.add(row.File, row.Row, true, false, entPerson, row.Name)
			w.act("PERSON", id, "CREATE", "匯入人員"+row.Name, id)
			continue
		}
		person := &w.db.People[idx]
		changed := person.Department != row.Department || person.Active != row.Active || person.Source != row.Source || strVal(person.ExternalID) != row.ExternalID
		if changed {
			person.Department = row.Department
			person.Active = row.Active
			person.Source = row.Source
			person.ExternalID = strPtr(row.ExternalID)
			w.act("PERSON", person.ID, "UPDATE", "更新人員"+row.Name, person.ID)
		}
		w.rep.add(row.File, row.Row, false, changed, entPerson, row.Name)
	}
}

func (w *world) machineTypes() {
	for i, row := range w.ds.MachineTypes {
		idx := w.machineTypeIndex(row.Name)
		order := i + 1
		if idx < 0 {
			id := w.id("mt")
			w.db.MachineTypes = append(w.db.MachineTypes, domain.MachineType{
				ID: id, Name: row.Name, Order: order, Active: row.Active,
			})
			w.rep.add(row.File, row.Row, true, false, entMachine, row.Name)
			continue
		}
		item := &w.db.MachineTypes[idx]
		changed := item.Active != row.Active || item.Order != order || item.Name != row.Name
		if changed {
			item.Name = row.Name
			item.Active = row.Active
			item.Order = order
		}
		w.rep.add(row.File, row.Row, false, changed, entMachine, row.Name)
	}
}

func (w *world) products() {
	for _, row := range w.ds.Products {
		owner, _ := w.personID(row.Owner)
		idx := w.productIndex(row.Name)
		if idx < 0 {
			id := w.id("prd")
			w.db.Products = append(w.db.Products, domain.Product{
				ID: id, Name: row.Name, Description: row.Description, DevDepartment: row.DevDepartment,
				ProjectDepartment: row.ProjectDepartment, PrimaryOwnerID: owner, Mode: row.Mode, Audience: row.Audience,
			})
			w.rep.add(row.File, row.Row, true, false, entProduct, row.Name)
			w.act("PRODUCT", id, "CREATE", "匯入產品"+row.Name, owner)
			continue
		}
		item := &w.db.Products[idx]
		changed := item.Description != row.Description || item.DevDepartment != row.DevDepartment || item.ProjectDepartment != row.ProjectDepartment || item.PrimaryOwnerID != owner || item.Mode != row.Mode || item.Audience != row.Audience
		if changed {
			item.Description = row.Description
			item.DevDepartment = row.DevDepartment
			item.ProjectDepartment = row.ProjectDepartment
			item.PrimaryOwnerID = owner
			item.Mode = row.Mode
			item.Audience = row.Audience
			w.act("PRODUCT", item.ID, "UPDATE", "更新產品"+row.Name, owner)
		}
		w.rep.add(row.File, row.Row, false, changed, entProduct, row.Name)
	}
}

func (w *world) versions() {
	for _, row := range w.ds.Versions {
		_, created, changed := w.ensureVersion(row.Product, row.Version, row.ReleasedAt, row.Notes, true)
		w.rep.add(row.File, row.Row, created, changed, entVersion, row.Product+" "+row.Version)
	}
}

func (w *world) features() {
	for _, row := range w.ds.Features {
		for _, version := range row.Supported {
			w.ensureVersion(row.Product, version, "", "", false)
		}
	}
	for _, row := range w.ds.Plans {
		if row.Version != "" {
			w.ensureVersion(row.Product, row.Version, "", "", false)
		}
		if row.ActualVersion != "" {
			w.ensureVersion(row.Product, row.ActualVersion, "", "", false)
		}
	}
	for _, row := range w.ds.Features {
		pid, _ := w.productID(row.Product)
		idx := w.featureIndex(pid, row.Name)
		created := idx < 0
		var id string
		if created {
			id = w.id("ft")
			w.db.Features = append(w.db.Features, domain.FeatureDefinition{
				ID: id, ProductID: pid, Code: row.Code, Name: row.Name, Description: row.Description, DefaultEnabled: row.DefaultEnabled,
			})
		} else {
			id = w.db.Features[idx].ID
			item := &w.db.Features[idx]
			if item.Code != row.Code || item.Description != row.Description || item.DefaultEnabled != row.DefaultEnabled {
				item.Code = row.Code
				item.Description = row.Description
				item.DefaultEnabled = row.DefaultEnabled
				created = false
				w.rep.add(row.File, row.Row, false, true, entFeature, row.Name)
				w.syncSupport(id, pid, row.Supported)
				continue
			}
		}
		supportChanged := w.syncSupport(id, pid, row.Supported)
		if created {
			w.rep.add(row.File, row.Row, true, false, entFeature, row.Name)
			continue
		}
		w.rep.add(row.File, row.Row, false, supportChanged, entFeature, row.Name)
	}
}

func (w *world) syncSupport(featureID, productID string, supported []string) bool {
	want := map[string]bool{}
	for _, version := range supported {
		want[version] = true
	}
	changed := false
	for _, version := range w.db.Versions {
		if version.ProductID != productID {
			continue
		}
		should := want[version.Version]
		found := -1
		for i := range w.db.VersionFeatures {
			if w.db.VersionFeatures[i].VersionID == version.ID && w.db.VersionFeatures[i].FeatureID == featureID {
				found = i
				break
			}
		}
		if found < 0 {
			w.db.VersionFeatures = append(w.db.VersionFeatures, domain.VersionFeature{VersionID: version.ID, FeatureID: featureID, Supported: should})
			changed = true
			continue
		}
		if w.db.VersionFeatures[found].Supported != should {
			w.db.VersionFeatures[found].Supported = should
			changed = true
		}
	}
	return changed
}

func (w *world) ensureVersion(productName, version, released, notes string, fromFile bool) (string, bool, bool) {
	pid, ok := w.productID(productName)
	if !ok {
		return "", false, false
	}
	for i := range w.db.Versions {
		item := &w.db.Versions[i]
		if item.ProductID != pid || item.Version != version {
			continue
		}
		if !fromFile {
			return item.ID, false, false
		}
		changed := strVal(item.ReleasedAt) != released || item.Notes != notes
		if changed {
			item.ReleasedAt = strPtr(released)
			item.Notes = notes
		}
		return item.ID, false, changed
	}
	id := w.id("ver")
	w.db.Versions = append(w.db.Versions, domain.ProductVersion{
		ID: id, ProductID: pid, Version: version, ReleasedAt: strPtr(released), Notes: notes,
	})
	return id, true, false
}

func (w *world) factories() {
	for _, row := range w.ds.Factories {
		pm, _ := w.personID(row.PM)
		idx := w.factoryIndex(row.Name)
		if idx < 0 {
			id := w.id("fac")
			w.db.Factories = append(w.db.Factories, domain.Factory{
				ID: id, Code: row.Code, Name: row.Name, Location: row.Location, Description: row.Description,
				Category: row.Category, Region: row.Region, PMID: pm,
				PlannedStart: row.PlannedStart, PlannedEnd: row.PlannedEnd, ActualStart: strPtr(row.ActualStart), ActualEnd: strPtr(row.ActualEnd),
				Status: row.Status,
			})
			w.rep.add(row.File, row.Row, true, false, entFactory, row.Name)
			w.act("FACTORY", id, "CREATE", "匯入工廠"+row.Name, pm)
			continue
		}
		item := &w.db.Factories[idx]
		changed := item.Code != row.Code || item.Location != row.Location || item.Description != row.Description || item.Category != row.Category || item.Region != row.Region || item.PMID != pm || item.PlannedStart != row.PlannedStart || item.PlannedEnd != row.PlannedEnd || strVal(item.ActualStart) != row.ActualStart || strVal(item.ActualEnd) != row.ActualEnd || item.Status != row.Status
		if changed {
			item.Code = row.Code
			item.Location = row.Location
			item.Description = row.Description
			item.Category = row.Category
			item.Region = row.Region
			item.PMID = pm
			item.PlannedStart = row.PlannedStart
			item.PlannedEnd = row.PlannedEnd
			item.ActualStart = strPtr(row.ActualStart)
			item.ActualEnd = strPtr(row.ActualEnd)
			item.Status = row.Status
			w.act("FACTORY", item.ID, "UPDATE", "更新工廠"+row.Name, pm)
		}
		w.rep.add(row.File, row.Row, false, changed, entFactory, row.Name)
	}
}

type phaseResult struct {
	id      string
	row     PhaseRow
	created bool
	changed bool
}

func (w *world) phases() {
	results := make([]phaseResult, 0, len(w.ds.Phases))
	for _, row := range w.ds.Phases {
		fid, _ := w.factoryID(row.Factory)
		existing := w.findPhase(fid, row.Name)
		if existing < 0 {
			id := w.id("ph")
			w.db.Phases = append(w.db.Phases, domain.Phase{ID: id, FactoryID: fid, Name: row.Name})
			results = append(results, phaseResult{id: id, row: row, created: true})
			continue
		}
		results = append(results, phaseResult{id: w.db.Phases[existing].ID, row: row})
	}
	for i, res := range results {
		idx := w.phaseIndex(res.id)
		if idx < 0 {
			continue
		}
		owner, _ := w.personID(res.row.Owner)
		item := &w.db.Phases[idx]
		template := w.templateID(res.row.Name)
		changed := !res.created && (strVal(item.TemplateID) != strVal(template) || item.Order != res.row.Order || item.OwnerID != owner || item.PlannedStart != res.row.PlannedStart || item.PlannedEnd != res.row.PlannedEnd || strVal(item.ActualStart) != res.row.ActualStart || strVal(item.ActualEnd) != res.row.ActualEnd || item.Status != res.row.Status || item.RiskNote != res.row.RiskNote)
		item.TemplateID = template
		item.Order = res.row.Order
		item.OwnerID = owner
		item.PlannedStart = res.row.PlannedStart
		item.PlannedEnd = res.row.PlannedEnd
		item.ActualStart = strPtr(res.row.ActualStart)
		item.ActualEnd = strPtr(res.row.ActualEnd)
		item.Status = res.row.Status
		item.RiskNote = res.row.RiskNote
		results[i].changed = changed
	}
	seenFactory := map[string]bool{}
	var factoryIDs []string
	for _, res := range results {
		fid := w.db.Phases[w.phaseIndex(res.id)].FactoryID
		if seenFactory[fid] {
			continue
		}
		seenFactory[fid] = true
		factoryIDs = append(factoryIDs, fid)
	}
	for _, fid := range factoryIDs {
		w.relink(fid, results)
	}
	for _, res := range results {
		w.rep.add(res.row.File, res.row.Row, res.created, res.changed, entPhase, res.row.Name)
		if res.created || res.changed {
			owner, _ := w.personID(res.row.Owner)
			action := "UPDATE"
			if res.created {
				action = "CREATE"
			}
			w.act("PHASE", res.id, action, "匯入階段"+res.row.Name, owner)
		}
	}
}

func (w *world) relink(factoryID string, results []phaseResult) {
	idxs := make([]int, 0)
	for i := range w.db.Phases {
		if w.db.Phases[i].FactoryID == factoryID {
			idxs = append(idxs, i)
		}
	}
	sort.SliceStable(idxs, func(a, b int) bool {
		pa := w.db.Phases[idxs[a]]
		pb := w.db.Phases[idxs[b]]
		if pa.Order != pb.Order {
			return pa.Order < pb.Order
		}
		return pa.ID < pb.ID
	})
	for n, idx := range idxs {
		deps := []string{}
		if n > 0 {
			deps = []string{w.db.Phases[idxs[n-1]].ID}
		}
		differ := !sameIDs(w.db.Phases[idx].DependsOnPhaseIds, deps)
		if w.db.Phases[idx].DependsOnPhaseIds == nil || differ {
			w.db.Phases[idx].DependsOnPhaseIds = deps
		}
		if !differ {
			continue
		}
		for i := range results {
			if results[i].id == w.db.Phases[idx].ID && !results[i].created {
				results[i].changed = true
			}
		}
	}
}

func (w *world) templateID(name string) *string {
	for _, item := range w.db.PhaseTemplates {
		if item.Name == name {
			id := item.ID
			return &id
		}
	}
	return nil
}
