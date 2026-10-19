package impex

import (
	"strings"

	"fpm/internal/domain"
)

// ParseFiles parses a directory's CSV texts. Keys are file names such as people.csv.
func ParseFiles(files map[string]string) (Dataset, Report) {
	var ds Dataset
	var rep Report
	seen := false
	for _, name := range FileOrder {
		text, ok := files[name]
		if !ok {
			continue
		}
		seen = true
		rows, errs := decodeCSV(name, text)
		if len(errs) > 0 {
			rep.Errors = append(rep.Errors, errs...)
			continue
		}
		errs = parseRecords(name, rows, &ds)
		rep.Errors = append(rep.Errors, errs...)
	}
	names := make([]string, 0)
	for name := range files {
		names = append(names, name)
	}
	sortStrings(names)
	for _, name := range names {
		if !KnownFile(name) {
			rep.Errors = append(rep.Errors, RowError{File: name, Message: "不支援的檔案"})
		}
	}
	if !seen && len(rep.Errors) == 0 {
		rep.Errors = append(rep.Errors, RowError{Message: "沒有可匯入的檔案"})
	}
	rep.normalize()
	return ds, rep
}

func parseRecords(file string, rows []rawRow, ds *Dataset) []RowError {
	spec, ok := specs[file]
	if !ok {
		return []RowError{{File: file, Message: "不支援的檔案"}}
	}
	header := rows[0]
	idx, errs := indexHeaders(file, header.cells, spec.required, spec.all)
	if len(errs) > 0 {
		return errs
	}
	switch file {
	case FilePeople:
		return parsePeople(file, idx, rows[1:], ds)
	case FileMachineTypes:
		return parseMachineTypes(file, idx, rows[1:], ds)
	case FileProducts:
		return parseProducts(file, idx, rows[1:], ds)
	case FileFeatures:
		return parseFeatures(file, idx, rows[1:], ds)
	case FileVersions:
		return parseVersions(file, idx, rows[1:], ds)
	case FileFactories:
		return parseFactories(file, idx, rows[1:], ds)
	case FilePhases:
		return parsePhases(file, idx, rows[1:], ds)
	case FilePlans:
		return parsePlans(file, idx, rows[1:], ds)
	case FileMachines:
		return parseMachines(file, idx, rows[1:], ds)
	case FileTopics:
		return parseTopics(file, idx, rows[1:], ds)
	case FileIssues:
		return parseIssues(file, idx, rows[1:], ds)
	case FileMilestones:
		return parseMilestones(file, idx, rows[1:], ds)
	default:
		return []RowError{{File: file, Message: "不支援的檔案"}}
	}
}

func parsePeople(file string, idx map[string]int, rows []rawRow, ds *Dataset) []RowError {
	var errs []RowError
	seen := map[string]bool{}
	for _, raw := range rows {
		name := cell(raw.cells, idx, "name")
		dept := cell(raw.cells, idx, "department")
		if name == "" || dept == "" {
			errs = append(errs, rowErr(file, raw.line, "姓名與部門必填"))
			continue
		}
		if seen[name] {
			errs = append(errs, rowErr(file, raw.line, "人員「"+name+"」重複"))
			continue
		}
		seen[name] = true
		active, errActive := parseBoolCell(file, raw.line, cell(raw.cells, idx, "active"), true)
		source := cell(raw.cells, idx, "source")
		if source == "" {
			source = "manual"
		}
		errs = append(errs, errActive...)
		if source != "manual" && source != "external" {
			errs = append(errs, rowErr(file, raw.line, "來源須為 manual 或 external"))
		}
		ds.People = append(ds.People, PersonRow{
			File: file, Row: raw.line, Name: name, Department: dept, Active: active,
			Source: source, ExternalID: cell(raw.cells, idx, "external_id"),
		})
	}
	return errs
}

func parseMachineTypes(file string, idx map[string]int, rows []rawRow, ds *Dataset) []RowError {
	var errs []RowError
	seenName := map[string]bool{}
	for _, raw := range rows {
		name, err := domain.NormalizeMachineTypeName(cell(raw.cells, idx, "name"))
		if err != nil {
			errs = append(errs, rowErr(file, raw.line, err.Error()))
			continue
		}
		key := strings.ToLower(name)
		if seenName[key] {
			errs = append(errs, rowErr(file, raw.line, "機種「"+name+"」重複"))
		}
		seenName[key] = true
		active, errActive := parseBoolCell(file, raw.line, cell(raw.cells, idx, "active"), true)
		errs = append(errs, errActive...)
		ds.MachineTypes = append(ds.MachineTypes, MachineTypeRow{File: file, Row: raw.line, Name: name, Active: active})
	}
	return errs
}

func parseProducts(file string, idx map[string]int, rows []rawRow, ds *Dataset) []RowError {
	var errs []RowError
	seen := map[string]bool{}
	for _, raw := range rows {
		name := cell(raw.cells, idx, "name")
		owner := cell(raw.cells, idx, "owner")
		mode := cell(raw.cells, idx, "mode")
		if name == "" || owner == "" || mode == "" {
			errs = append(errs, rowErr(file, raw.line, "產品名稱、負責人與模式必填"))
			continue
		}
		if seen[name] {
			errs = append(errs, rowErr(file, raw.line, "產品「"+name+"」重複"))
			continue
		}
		seen[name] = true
		errs = append(errs, oneOf(file, raw.line, mode, []string{"VERSIONED", "FEATURE_ONLY"}, "模式須為 VERSIONED 或 FEATURE_ONLY")...)
		audience, errAudience := domain.NormalizeAudience(cell(raw.cells, idx, "audience"))
		if errAudience != nil {
			errs = append(errs, rowErr(file, raw.line, errAudience.Error()))
			continue
		}
		ds.Products = append(ds.Products, ProductRow{
			File: file, Row: raw.line, Name: name, Owner: owner, Mode: mode,
			Description: cell(raw.cells, idx, "description"), DevDepartment: cell(raw.cells, idx, "dev_department"),
			ProjectDepartment: cell(raw.cells, idx, "project_department"), Audience: audience,
		})
	}
	return errs
}

func parseFeatures(file string, idx map[string]int, rows []rawRow, ds *Dataset) []RowError {
	var errs []RowError
	seen := map[string]bool{}
	seenCode := map[string]bool{}
	for _, raw := range rows {
		product := cell(raw.cells, idx, "product")
		name := cell(raw.cells, idx, "name")
		if product == "" || name == "" {
			errs = append(errs, rowErr(file, raw.line, "產品與功能名稱必填"))
			continue
		}
		key := product + "\t" + name
		if seen[key] {
			errs = append(errs, rowErr(file, raw.line, "功能「"+name+"」重複"))
		}
		seen[key] = true
		code := cell(raw.cells, idx, "code")
		if code != "" {
			codeKey := product + "\t" + code
			if seenCode[codeKey] {
				errs = append(errs, rowErr(file, raw.line, "功能代碼「"+code+"」重複"))
			}
			seenCode[codeKey] = true
		}
		enabled, errBool := parseBoolCell(file, raw.line, cell(raw.cells, idx, "default_enabled"), false)
		errs = append(errs, errBool...)
		var supported []string
		rawVersions := cell(raw.cells, idx, "supported_versions")
		if rawVersions != "" {
			for _, part := range strings.Fields(rawVersions) {
				errs = append(errs, parseSemver(file, raw.line, part)...)
				supported = append(supported, part)
			}
		}
		ds.Features = append(ds.Features, FeatureRow{
			File: file, Row: raw.line, Product: product, Name: name, Code: code,
			Description: cell(raw.cells, idx, "description"), DefaultEnabled: enabled, Supported: supported,
		})
	}
	return errs
}

func parseVersions(file string, idx map[string]int, rows []rawRow, ds *Dataset) []RowError {
	var errs []RowError
	seen := map[string]bool{}
	for _, raw := range rows {
		product := cell(raw.cells, idx, "product")
		version := cell(raw.cells, idx, "version")
		if product == "" || version == "" {
			errs = append(errs, rowErr(file, raw.line, "產品與版本必填"))
			continue
		}
		key := product + "\t" + version
		if seen[key] {
			errs = append(errs, rowErr(file, raw.line, "版本「"+version+"」重複"))
		}
		seen[key] = true
		errs = append(errs, parseSemver(file, raw.line, version)...)
		released, errDate := parseDate(file, raw.line, cell(raw.cells, idx, "released_at"), "發布日", false)
		errs = append(errs, errDate...)
		ds.Versions = append(ds.Versions, VersionRow{
			File: file, Row: raw.line, Product: product, Version: version, ReleasedAt: released,
			Notes: cell(raw.cells, idx, "notes"),
		})
	}
	return errs
}

func parseFactories(file string, idx map[string]int, rows []rawRow, ds *Dataset) []RowError {
	var errs []RowError
	seenName := map[string]bool{}
	seenCode := map[string]bool{}
	for _, raw := range rows {
		rawCategory := cell(raw.cells, idx, "category")
		rawRegion := cell(raw.cells, idx, "region")
		row := FactoryRow{
			File: file, Row: raw.line,
			Code: cell(raw.cells, idx, "code"), Name: cell(raw.cells, idx, "name"),
			PM:     cell(raw.cells, idx, "pm"),
			Status: cell(raw.cells, idx, "status"), Location: cell(raw.cells, idx, "location"),
			Description: cell(raw.cells, idx, "description"),
		}
		if row.Code == "" || row.Name == "" || rawCategory == "" || rawRegion == "" || row.PM == "" || row.Status == "" {
			errs = append(errs, rowErr(file, raw.line, "工廠代碼、名稱、類別、區域、TPM 與狀態必填"))
			continue
		}
		var catErr, regErr error
		row.Category, catErr = domain.NormalizeFactoryCategory(rawCategory)
		row.Region, regErr = domain.NormalizeFactoryRegion(rawRegion)
		if catErr != nil {
			errs = append(errs, rowErr(file, raw.line, catErr.Error()))
		}
		if regErr != nil {
			errs = append(errs, rowErr(file, raw.line, regErr.Error()))
		}
		if seenName[row.Name] {
			errs = append(errs, rowErr(file, raw.line, "工廠「"+row.Name+"」重複"))
		}
		if seenCode[row.Code] {
			errs = append(errs, rowErr(file, raw.line, "工廠代碼「"+row.Code+"」重複"))
		}
		seenName[row.Name] = true
		seenCode[row.Code] = true
		var errDate []RowError
		row.PlannedStart, errDate = parseDate(file, raw.line, cell(raw.cells, idx, "planned_start"), "計畫開始", true)
		errs = append(errs, errDate...)
		row.PlannedEnd, errDate = parseDate(file, raw.line, cell(raw.cells, idx, "planned_end"), "計畫結束", true)
		errs = append(errs, errDate...)
		row.ActualStart, errDate = parseDate(file, raw.line, cell(raw.cells, idx, "actual_start"), "實際開始", false)
		errs = append(errs, errDate...)
		row.ActualEnd, errDate = parseDate(file, raw.line, cell(raw.cells, idx, "actual_end"), "實際結束", false)
		errs = append(errs, errDate...)
		errs = append(errs, oneOf(file, raw.line, row.Status, []string{"ON_TRACK", "AT_RISK", "DELAYED", "COMPLETED"}, "工廠狀態不正確")...)
		ds.Factories = append(ds.Factories, row)
	}
	return errs
}

func parsePhases(file string, idx map[string]int, rows []rawRow, ds *Dataset) []RowError {
	var errs []RowError
	seen := map[string]bool{}
	for _, raw := range rows {
		row := PhaseRow{
			File: file, Row: raw.line, Factory: cell(raw.cells, idx, "factory"), Name: cell(raw.cells, idx, "name"),
			Owner: cell(raw.cells, idx, "owner"), Status: cell(raw.cells, idx, "status"),
			RiskNote: cell(raw.cells, idx, "risk_note"),
		}
		if row.Factory == "" || row.Name == "" || row.Owner == "" || row.Status == "" {
			errs = append(errs, rowErr(file, raw.line, "階段的工廠、名稱、負責人與狀態必填"))
			continue
		}
		key := row.Factory + "\t" + row.Name
		if seen[key] {
			errs = append(errs, rowErr(file, raw.line, "階段「"+row.Name+"」重複"))
		}
		seen[key] = true
		var errDate []RowError
		row.PlannedStart, errDate = parseDate(file, raw.line, cell(raw.cells, idx, "planned_start"), "計畫開始", true)
		errs = append(errs, errDate...)
		row.PlannedEnd, errDate = parseDate(file, raw.line, cell(raw.cells, idx, "planned_end"), "計畫結束", true)
		errs = append(errs, errDate...)
		row.ActualStart, errDate = parseDate(file, raw.line, cell(raw.cells, idx, "actual_start"), "實際開始", false)
		errs = append(errs, errDate...)
		row.ActualEnd, errDate = parseDate(file, raw.line, cell(raw.cells, idx, "actual_end"), "實際結束", false)
		errs = append(errs, errDate...)
		order, errOrder := parsePositive(file, raw.line, cell(raw.cells, idx, "order"), "順序")
		errs = append(errs, errOrder...)
		row.Order = order
		errs = append(errs, oneOf(file, raw.line, row.Status, []string{"NOT_STARTED", "IN_PROGRESS", "AT_RISK", "DELAYED", "COMPLETED"}, "階段狀態不正確")...)
		ds.Phases = append(ds.Phases, row)
	}
	return errs
}

func parsePlans(file string, idx map[string]int, rows []rawRow, ds *Dataset) []RowError {
	var errs []RowError
	seen := map[string]bool{}
	for _, raw := range rows {
		row := PlanRow{
			File: file, Row: raw.line, Factory: cell(raw.cells, idx, "factory"), Product: cell(raw.cells, idx, "product"),
			Status: cell(raw.cells, idx, "status"), Version: cell(raw.cells, idx, "version"),
			ActualVersion: cell(raw.cells, idx, "actual_version"), DeploymentStatus: cell(raw.cells, idx, "deployment_status"),
			Secondary: cell(raw.cells, idx, "secondary"), Note: cell(raw.cells, idx, "note"),
		}
		if row.Factory == "" || row.Product == "" || row.Status == "" {
			errs = append(errs, rowErr(file, raw.line, "計畫的工廠、產品與狀態必填"))
			continue
		}
		key := row.Factory + "\t" + row.Product
		if seen[key] {
			errs = append(errs, rowErr(file, raw.line, "計畫重複"))
		}
		seen[key] = true
		if row.DeploymentStatus == "" {
			row.DeploymentStatus = "PLANNED"
		}
		errs = append(errs, oneOf(file, raw.line, row.Status, []string{"NOT_SUBMITTED", "SUBMITTED", "APPROVED"}, "計畫狀態不正確")...)
		errs = append(errs, oneOf(file, raw.line, row.DeploymentStatus, []string{"PLANNED", "IN_PROGRESS", "DEPLOYED", "ACCEPTED"}, "部署狀態不正確")...)
		errs = append(errs, parseSemver(file, raw.line, row.Version)...)
		errs = append(errs, parseSemver(file, raw.line, row.ActualVersion)...)
		var errDate []RowError
		row.ConstructionStart, errDate = parseDate(file, raw.line, cell(raw.cells, idx, "construction_start"), "施工開始", false)
		errs = append(errs, errDate...)
		row.ConstructionEnd, errDate = parseDate(file, raw.line, cell(raw.cells, idx, "construction_end"), "施工結束", false)
		errs = append(errs, errDate...)
		row.PlannedDate, errDate = parseDate(file, raw.line, cell(raw.cells, idx, "planned_date"), "預計部署日", false)
		errs = append(errs, errDate...)
		row.DeployedAt, errDate = parseDate(file, raw.line, cell(raw.cells, idx, "deployed_at"), "部署日", false)
		errs = append(errs, errDate...)
		var errList []RowError
		row.FeatureChanges, errList = parseFeatureChanges(file, raw.line, cell(raw.cells, idx, "feature_changes"))
		errs = append(errs, errList...)
		row.AdHoc, errList = parseAdhoc(file, raw.line, cell(raw.cells, idx, "adhoc"))
		errs = append(errs, errList...)
		ds.Plans = append(ds.Plans, row)
	}
	return errs
}

func parseMachines(file string, idx map[string]int, rows []rawRow, ds *Dataset) []RowError {
	var errs []RowError
	seen := map[string]bool{}
	for _, raw := range rows {
		row := MachineRow{
			File: file, Row: raw.line, Factory: cell(raw.cells, idx, "factory"),
			Product: cell(raw.cells, idx, "product"), MachineType: cell(raw.cells, idx, "machine_type"),
		}
		if row.Factory == "" || row.Product == "" || row.MachineType == "" {
			errs = append(errs, rowErr(file, raw.line, "機台數量的工廠、產品與機種必填"))
			continue
		}
		key := row.Factory + "\t" + row.Product + "\t" + row.MachineType
		if seen[key] {
			errs = append(errs, rowErr(file, raw.line, "機台數量重複"))
		}
		seen[key] = true
		n, errN := parseNonNeg(file, raw.line, cell(raw.cells, idx, "planned"), "計畫數量")
		errs = append(errs, errN...)
		row.Planned = n
		ds.Machines = append(ds.Machines, row)
	}
	return errs
}

func parseTopics(file string, idx map[string]int, rows []rawRow, ds *Dataset) []RowError {
	var errs []RowError
	seen := map[string]bool{}
	for _, raw := range rows {
		row := TopicRow{
			File: file, Row: raw.line, Factory: cell(raw.cells, idx, "factory"), Title: cell(raw.cells, idx, "title"),
			Owner: cell(raw.cells, idx, "owner"), Status: cell(raw.cells, idx, "status"),
			Description: cell(raw.cells, idx, "description"),
		}
		if row.Factory == "" || row.Title == "" || row.Owner == "" || row.Status == "" {
			errs = append(errs, rowErr(file, raw.line, "議題的工廠、標題、負責人與狀態必填"))
			continue
		}
		key := row.Factory + "\t" + row.Title
		if seen[key] {
			errs = append(errs, rowErr(file, raw.line, "議題「"+row.Title+"」重複"))
		}
		seen[key] = true
		raised, errDate := parseDate(file, raw.line, cell(raw.cells, idx, "raised_on"), "提出日", true)
		errs = append(errs, errDate...)
		row.RaisedOn = raised
		errs = append(errs, oneOf(file, raw.line, row.Status, []string{"OPEN", "IN_DISCUSSION", "RESOLVED", "CLOSED"}, "議題狀態不正確")...)
		ds.Topics = append(ds.Topics, row)
	}
	return errs
}

func parseIssues(file string, idx map[string]int, rows []rawRow, ds *Dataset) []RowError {
	var errs []RowError
	seenCode := map[string]bool{}
	seenTitle := map[string]bool{}
	for _, raw := range rows {
		row := IssueRow{
			File: file, Row: raw.line, Title: cell(raw.cells, idx, "title"), Factory: cell(raw.cells, idx, "factory"),
			Owner: cell(raw.cells, idx, "owner"), Severity: cell(raw.cells, idx, "severity"),
			Priority: cell(raw.cells, idx, "priority"), Status: cell(raw.cells, idx, "status"),
			Code: cell(raw.cells, idx, "code"), Description: cell(raw.cells, idx, "description"),
			Phase: cell(raw.cells, idx, "phase"), Product: cell(raw.cells, idx, "product"),
			Milestone: cell(raw.cells, idx, "milestone"), Resolution: cell(raw.cells, idx, "resolution"),
		}
		if row.Title == "" || row.Factory == "" || row.Owner == "" || row.Severity == "" || row.Priority == "" || row.Status == "" {
			errs = append(errs, rowErr(file, raw.line, "問題的標題、工廠、負責人、嚴重度、優先順序與狀態必填"))
			continue
		}
		if row.Code != "" {
			if seenCode[row.Code] {
				errs = append(errs, rowErr(file, raw.line, "問題代碼「"+row.Code+"」重複"))
			}
			seenCode[row.Code] = true
		} else {
			key := row.Factory + "\t" + row.Title
			if seenTitle[key] {
				errs = append(errs, rowErr(file, raw.line, "問題「"+row.Title+"」重複"))
			}
			seenTitle[key] = true
		}
		due, errDate := parseDate(file, raw.line, cell(raw.cells, idx, "due_date"), "到期日", false)
		errs = append(errs, errDate...)
		row.DueDate = due
		errs = append(errs, oneOf(file, raw.line, row.Severity, []string{"LOW", "MEDIUM", "HIGH", "CRITICAL"}, "嚴重度不正確")...)
		errs = append(errs, oneOf(file, raw.line, row.Priority, []string{"P0", "P1", "P2", "P3"}, "優先順序不正確")...)
		errs = append(errs, oneOf(file, raw.line, row.Status, []string{"OPEN", "IN_PROGRESS", "BLOCKED", "RESOLVED", "CLOSED"}, "問題狀態不正確")...)
		ds.Issues = append(ds.Issues, row)
	}
	return errs
}

func parseMilestones(file string, idx map[string]int, rows []rawRow, ds *Dataset) []RowError {
	var errs []RowError
	seen := map[string]bool{}
	for _, raw := range rows {
		row := MilestoneRow{
			File: file, Row: raw.line, Factory: cell(raw.cells, idx, "factory"), Phase: cell(raw.cells, idx, "phase"),
			Name: cell(raw.cells, idx, "name"), Owner: cell(raw.cells, idx, "owner"),
			Deliverables: cell(raw.cells, idx, "deliverables"),
		}
		if row.Factory == "" || row.Phase == "" || row.Name == "" || row.Owner == "" {
			errs = append(errs, rowErr(file, raw.line, "里程碑的工廠、階段、名稱與負責人必填"))
			continue
		}
		key := row.Factory + "\t" + row.Phase + "\t" + row.Name
		if seen[key] {
			errs = append(errs, rowErr(file, raw.line, "里程碑「"+row.Name+"」重複"))
		}
		seen[key] = true
		due, errDate := parseDate(file, raw.line, cell(raw.cells, idx, "due_date"), "到期日", true)
		errs = append(errs, errDate...)
		row.DueDate = due
		done, errBool := parseBoolCell(file, raw.line, cell(raw.cells, idx, "done"), false)
		errs = append(errs, errBool...)
		row.Done = done
		ds.Milestones = append(ds.Milestones, row)
	}
	return errs
}

func assignPhaseOrders(rows []PhaseRow) {
	maxOrder := map[string]int{}
	for _, row := range rows {
		if row.Order > maxOrder[row.Factory] {
			maxOrder[row.Factory] = row.Order
		}
	}
	for i := range rows {
		if rows[i].Order > 0 {
			continue
		}
		maxOrder[rows[i].Factory]++
		rows[i].Order = maxOrder[rows[i].Factory]
	}
}

func sortStrings(values []string) {
	for i := 1; i < len(values); i++ {
		for j := i; j > 0 && values[j] < values[j-1]; j-- {
			values[j], values[j-1] = values[j-1], values[j]
		}
	}
}
