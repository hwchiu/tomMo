package impex

import "fpm/internal/domain"

func (w *world) personID(name string) (string, bool) {
	for _, person := range w.db.People {
		if person.Name == name {
			return person.ID, true
		}
	}
	return "", false
}

func (w *world) productIndex(name string) int {
	for i := range w.db.Products {
		if w.db.Products[i].Name == name {
			return i
		}
	}
	return -1
}

func (w *world) productID(name string) (string, bool) {
	idx := w.productIndex(name)
	if idx < 0 {
		return "", false
	}
	return w.db.Products[idx].ID, true
}

func (w *world) productByID(id string) *domain.Product {
	for i := range w.db.Products {
		if w.db.Products[i].ID == id {
			return &w.db.Products[i]
		}
	}
	return nil
}

func (w *world) factoryIndex(name string) int {
	for i := range w.db.Factories {
		if w.db.Factories[i].Name == name {
			return i
		}
	}
	return -1
}

func (w *world) factoryID(name string) (string, bool) {
	idx := w.factoryIndex(name)
	if idx < 0 {
		return "", false
	}
	return w.db.Factories[idx].ID, true
}

func (w *world) factoryByID(id string) *domain.Factory {
	for i := range w.db.Factories {
		if w.db.Factories[i].ID == id {
			return &w.db.Factories[i]
		}
	}
	return nil
}

func (w *world) machineTypeIndex(name string) int {
	for i := range w.db.MachineTypes {
		if w.db.MachineTypes[i].Name == name {
			return i
		}
	}
	return -1
}

func (w *world) machineTypeID(name string) (string, bool) {
	idx := w.machineTypeIndex(name)
	if idx < 0 {
		return "", false
	}
	return w.db.MachineTypes[idx].ID, true
}

func (w *world) featureIndex(productID, name string) int {
	for i := range w.db.Features {
		if w.db.Features[i].ProductID == productID && w.db.Features[i].Name == name {
			return i
		}
	}
	return -1
}

func (w *world) featureByName(productID, name string) *domain.FeatureDefinition {
	idx := w.featureIndex(productID, name)
	if idx < 0 {
		return nil
	}
	return &w.db.Features[idx]
}

func (w *world) featuresOf(productID string) []domain.FeatureDefinition {
	out := []domain.FeatureDefinition{}
	for _, feature := range w.db.Features {
		if feature.ProductID == productID {
			out = append(out, feature)
		}
	}
	return out
}

func (w *world) versionID(productID, version string) (string, bool) {
	for _, item := range w.db.Versions {
		if item.ProductID == productID && item.Version == version {
			return item.ID, true
		}
	}
	return "", false
}

// milestoneID finds a milestone in a factory. When several share the name,
// the one on phaseID wins. An issue may sit on a later phase than its milestone.
func (w *world) milestoneID(factoryID, phaseID, name string) string {
	only := ""
	count := 0
	for _, item := range w.db.Milestones {
		phase := w.phaseIndex(item.PhaseID)
		if phase < 0 || w.db.Phases[phase].FactoryID != factoryID || item.Name != name {
			continue
		}
		if phaseID != "" && item.PhaseID == phaseID {
			return item.ID
		}
		count++
		only = item.ID
	}
	if count == 1 {
		return only
	}
	return ""
}

func (w *world) findPhase(factoryID, name string) int {
	for i := range w.db.Phases {
		if w.db.Phases[i].FactoryID == factoryID && w.db.Phases[i].Name == name {
			return i
		}
	}
	return -1
}

func (w *world) phaseIndex(id string) int {
	for i := range w.db.Phases {
		if w.db.Phases[i].ID == id {
			return i
		}
	}
	return -1
}

func (w *world) deploymentIndex(factoryID, productID string) int {
	for i := range w.db.Deployments {
		if w.db.Deployments[i].FactoryID == factoryID && w.db.Deployments[i].ProductID == productID {
			return i
		}
	}
	return -1
}

func (w *world) planIndex(factoryID, productID string) int {
	for i := range w.db.Plans {
		if w.db.Plans[i].FactoryID == factoryID && w.db.Plans[i].ProductID == productID {
			return i
		}
	}
	return -1
}

func (w *world) planByID(id string) *domain.ProductFactoryPlan {
	for i := range w.db.Plans {
		if w.db.Plans[i].ID == id {
			return &w.db.Plans[i]
		}
	}
	return nil
}
