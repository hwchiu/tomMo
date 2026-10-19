package impex

import "fpm/internal/domain"

func check(db *domain.Database, ds Dataset) Report {
	var rep Report
	people := map[string]bool{}
	for _, person := range db.People {
		people[person.Name] = true
	}
	for _, row := range ds.People {
		people[row.Name] = true
	}
	products := map[string]string{}
	for _, product := range db.Products {
		products[product.Name] = product.Mode
	}
	for _, row := range ds.Products {
		products[row.Name] = row.Mode
		if !people[row.Owner] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到人員「"+row.Owner+"」"))
		}
	}
	factories := map[string]bool{}
	for _, factory := range db.Factories {
		factories[factory.Name] = true
	}
	for _, row := range ds.Factories {
		factories[row.Name] = true
		if !people[row.PM] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到人員「"+row.PM+"」"))
		}
		for _, existing := range db.Factories {
			if existing.Code == row.Code && existing.Name != row.Name {
				rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "代碼與既有工廠「"+existing.Name+"」衝突"))
			}
		}
	}
	types := map[string]bool{}
	for _, item := range db.MachineTypes {
		types[item.Name] = true
	}
	for _, row := range ds.MachineTypes {
		types[row.Name] = true
		for _, existing := range db.MachineTypes {
			if existing.Code == row.Code && existing.Name != row.Name {
				rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "代碼與既有機種「"+existing.Name+"」衝突"))
			}
		}
	}
	features := map[string]map[string]bool{}
	addFeature := func(product, name string) {
		if features[product] == nil {
			features[product] = map[string]bool{}
		}
		features[product][name] = true
	}
	for _, feature := range db.Features {
		addFeature(productName(db, feature.ProductID), feature.Name)
	}
	for _, row := range ds.Features {
		if _, ok := products[row.Product]; !ok {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到產品「"+row.Product+"」"))
		}
		addFeature(row.Product, row.Name)
		for _, existing := range db.Features {
			if row.Code != "" && existing.Code == row.Code && existing.Name != row.Name && productName(db, existing.ProductID) == row.Product {
				rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "代碼與既有功能「"+existing.Name+"」衝突"))
			}
		}
	}
	for _, row := range ds.Versions {
		if _, ok := products[row.Product]; !ok {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到產品「"+row.Product+"」"))
		}
	}
	phases := map[string]bool{}
	for _, phase := range db.Phases {
		phases[productFactoryKey(factoryName(db, phase.FactoryID), phase.Name)] = true
	}
	orders := map[string]int{}
	for _, row := range ds.Phases {
		if !factories[row.Factory] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到工廠「"+row.Factory+"」"))
		}
		if !people[row.Owner] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到人員「"+row.Owner+"」"))
		}
		phases[productFactoryKey(row.Factory, row.Name)] = true
		key := row.Factory + "\t" + itoa(row.Order)
		if prev, ok := orders[key]; ok && prev != row.Row {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "階段順序重複"))
		}
		orders[key] = row.Row
	}
	for _, row := range ds.Plans {
		if !factories[row.Factory] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到工廠「"+row.Factory+"」"))
		}
		mode, ok := products[row.Product]
		if !ok {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到產品「"+row.Product+"」"))
		}
		if row.Secondary != "" && !people[row.Secondary] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到人員「"+row.Secondary+"」"))
		}
		if mode == "FEATURE_ONLY" && (row.Version != "" || row.ActualVersion != "") {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "純功能開關的產品不能指定版本"))
		}
		names := features[row.Product]
		for _, change := range row.FeatureChanges {
			if names == nil || !names[change.Name] {
				rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到功能「"+change.Name+"」"))
			}
		}
	}
	for _, row := range ds.Machines {
		if !factories[row.Factory] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到工廠「"+row.Factory+"」"))
		}
		if _, ok := products[row.Product]; !ok {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到產品「"+row.Product+"」"))
		}
		if !types[row.MachineType] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到機種「"+row.MachineType+"」"))
		}
	}
	for _, row := range ds.Topics {
		if !factories[row.Factory] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到工廠「"+row.Factory+"」"))
		}
		if !people[row.Owner] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到人員「"+row.Owner+"」"))
		}
	}
	type milestoneKey struct{ name, factory, phase string }
	milestones := map[milestoneKey]struct{}{}
	noteMilestone := func(name, factory, phase string) {
		milestones[milestoneKey{name, factory, phase}] = struct{}{}
	}
	for _, item := range db.Milestones {
		phase := phaseByID(db, item.PhaseID)
		if phase == nil {
			continue
		}
		noteMilestone(item.Name, factoryName(db, phase.FactoryID), phase.Name)
	}
	for _, row := range ds.Milestones {
		if !phases[productFactoryKey(row.Factory, row.Phase)] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到階段「"+row.Phase+"」"))
		}
		if !people[row.Owner] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到人員「"+row.Owner+"」"))
		}
		noteMilestone(row.Name, row.Factory, row.Phase)
	}
	for _, row := range ds.Issues {
		if !factories[row.Factory] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到工廠「"+row.Factory+"」"))
		}
		if !people[row.Owner] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到人員「"+row.Owner+"」"))
		}
		if row.Phase != "" && !phases[productFactoryKey(row.Factory, row.Phase)] {
			rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到階段「"+row.Phase+"」"))
		}
		if row.Product != "" {
			if _, ok := products[row.Product]; !ok {
				rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到產品「"+row.Product+"」"))
			}
		}
		if row.Milestone != "" {
			total, onPhase := 0, 0
			for key := range milestones {
				if key.name == row.Milestone && key.factory == row.Factory {
					total++
					if row.Phase != "" && key.phase == row.Phase {
						onPhase++
					}
				}
			}
			if total == 0 {
				rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "找不到里程碑「"+row.Milestone+"」"))
			} else if total > 1 && onPhase != 1 {
				rep.Errors = append(rep.Errors, rowErr(row.File, row.Row, "里程碑「"+row.Milestone+"」在這座工廠有多筆，請指定它所在的階段"))
			}
		}
	}
	rep.normalize()
	return rep
}

func productFactoryKey(factory, name string) string { return factory + "\t" + name }

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [16]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

func productName(db *domain.Database, id string) string {
	for _, product := range db.Products {
		if product.ID == id {
			return product.Name
		}
	}
	return ""
}

func factoryName(db *domain.Database, id string) string {
	for _, factory := range db.Factories {
		if factory.ID == id {
			return factory.Name
		}
	}
	return ""
}

func phaseByID(db *domain.Database, id string) *domain.Phase {
	for i := range db.Phases {
		if db.Phases[i].ID == id {
			return &db.Phases[i]
		}
	}
	return nil
}
