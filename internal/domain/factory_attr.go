package domain

import "strings"

const (
	// FactoryCategoryInvalid is the error for a category outside Giga and Phase.
	FactoryCategoryInvalid = "類別只能是 Giga 或 Phase"
	// FactoryRegionInvalid is the error for a region outside the fixed set.
	FactoryRegionInvalid = "區域只能是 HQ、JP、AZ、EU"
)

// FactoryCategory is one of the two built-in factory kinds.
type FactoryCategory struct {
	Code  string
	Label string
}

// FactoryCategories is the fixed category list. It is not stored as editable data.
var FactoryCategories = []FactoryCategory{
	{Code: "GIGA", Label: "Giga"},
	{Code: "PHASE", Label: "Phase"},
}

// FactoryRegion is one of the built-in regions.
type FactoryRegion struct {
	Code  string
	Label string
}

// FactoryRegions is the fixed region list. It is not edited from 設定.
var FactoryRegions = []FactoryRegion{
	{Code: "HQ", Label: "HQ"},
	{Code: "JP", Label: "JP"},
	{Code: "AZ", Label: "AZ"},
	{Code: "EU", Label: "EU"},
}

// NormalizeFactoryCategory accepts the code or the label and returns the code.
func NormalizeFactoryCategory(raw string) (string, error) {
	key := strings.ToUpper(strings.TrimSpace(raw))
	for _, item := range FactoryCategories {
		if key == item.Code || strings.EqualFold(raw, item.Label) {
			return item.Code, nil
		}
	}
	return "", errString(FactoryCategoryInvalid)
}

// NormalizeFactoryRegion accepts a region code and returns it in canonical form.
func NormalizeFactoryRegion(raw string) (string, error) {
	key := strings.ToUpper(strings.TrimSpace(raw))
	for _, item := range FactoryRegions {
		if key == item.Code {
			return item.Code, nil
		}
	}
	return "", errString(FactoryRegionInvalid)
}

// FactoryCategoryLabel returns the display label, or the code when it is unknown.
func FactoryCategoryLabel(code string) string {
	for _, item := range FactoryCategories {
		if item.Code == code {
			return item.Label
		}
	}
	return code
}

// FactoryRegionLabel returns the display label, or the code when it is unknown.
func FactoryRegionLabel(code string) string {
	for _, item := range FactoryRegions {
		if item.Code == code {
			return item.Label
		}
	}
	return code
}

// LegacyOverseaRegion maps a pre-existing OVERSEA factory onto JP, AZ, or EU.
func LegacyOverseaRegion(name, location string) string {
	blob := name + " " + location
	switch {
	case strings.Contains(blob, "熊本"), strings.Contains(blob, "大阪"), strings.Contains(blob, "日本"):
		return "JP"
	case strings.Contains(blob, "亞利桑那"), strings.Contains(strings.ToLower(blob), "arizona"):
		return "AZ"
	default:
		return "EU"
	}
}
