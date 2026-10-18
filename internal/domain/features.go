package domain

import (
	"fmt"
	"sync"
)

func BaselineChanges(features []FeatureDefinition, planned []PlannedFeature) []FeatureChange {
	byID := map[string]bool{}
	seen := map[string]bool{}
	for _, row := range planned {
		byID[row.FeatureID] = row.Enabled
		seen[row.FeatureID] = true
	}
	changes := []FeatureChange{}
	for _, feature := range features {
		if !seen[feature.ID] || byID[feature.ID] == feature.DefaultEnabled {
			continue
		}
		if byID[feature.ID] {
			changes = append(changes, FeatureChange{FeatureID: feature.ID, ChangeType: "ADDED", Summary: "相對預設開啟" + feature.Name})
		} else {
			changes = append(changes, FeatureChange{FeatureID: feature.ID, ChangeType: "REMOVED", Summary: "相對預設關閉" + feature.Name})
		}
	}
	return changes
}

func IsFeaturePlanComplete(featureIDs []string, planned []PlannedFeature) bool {
	if len(featureIDs) == 0 {
		return true
	}
	chosen := map[string]bool{}
	for _, row := range planned {
		chosen[row.FeatureID] = true
	}
	for _, id := range featureIDs {
		if !chosen[id] {
			return false
		}
	}
	return true
}

type PlannedInput struct {
	Mode             string
	VersionSupported *bool
	ChangeType       *string
	PlannedEnabled   *bool
}

func ResolvePlanned(input PlannedInput) *bool {
	if input.Mode == "FEATURE_ONLY" {
		return input.PlannedEnabled
	}
	if input.ChangeType != nil && *input.ChangeType == "ADDED" {
		v := true
		return &v
	}
	if input.ChangeType != nil && *input.ChangeType == "REMOVED" {
		v := false
		return &v
	}
	return input.VersionSupported
}

type CapabilityTone string

const (
	ToneUnplanned    CapabilityTone = "UNPLANNED"
	ToneUnchangedOn  CapabilityTone = "UNCHANGED_ON"
	ToneUnchangedOff CapabilityTone = "UNCHANGED_OFF"
	ToneAdded        CapabilityTone = "ADDED"
	ToneRemoved      CapabilityTone = "REMOVED"
)

func ToneAgainstBaseline(planned, baseline bool) CapabilityTone {
	if planned == baseline {
		if planned {
			return ToneUnchangedOn
		}
		return ToneUnchangedOff
	}
	if planned {
		return ToneAdded
	}
	return ToneRemoved
}

type CapabilityInput struct {
	Mode             string
	DefaultEnabled   bool
	PlannedEnabled   *bool
	VersionSupported *bool
	OverrideEnabled  *bool
}

type CapabilityCell struct {
	Tone     CapabilityTone `json:"tone"`
	Planned  *bool          `json:"planned"`
	Baseline *bool          `json:"baseline"`
	Adhoc    bool           `json:"adhoc"`
}

func CapabilityCellOf(input CapabilityInput) CapabilityCell {
	if input.Mode == "FEATURE_ONLY" {
		if input.PlannedEnabled == nil {
			base := input.DefaultEnabled
			return CapabilityCell{Tone: ToneUnplanned, Planned: nil, Baseline: &base, Adhoc: false}
		}
		base := input.DefaultEnabled
		planned := *input.PlannedEnabled
		return CapabilityCell{
			Tone:     ToneAgainstBaseline(planned, base),
			Planned:  &planned,
			Baseline: &base,
			Adhoc:    planned != base,
		}
	}
	if input.VersionSupported == nil {
		return CapabilityCell{Tone: ToneUnplanned, Planned: nil, Baseline: nil, Adhoc: false}
	}
	base := *input.VersionSupported
	planned := base
	if input.OverrideEnabled != nil {
		planned = *input.OverrideEnabled
	}
	adhoc := input.OverrideEnabled != nil && *input.OverrideEnabled != base
	return CapabilityCell{
		Tone:     ToneAgainstBaseline(planned, base),
		Planned:  &planned,
		Baseline: &base,
		Adhoc:    adhoc,
	}
}

var (
	adhocMu  sync.Mutex
	adhocSeq int
)

// FeatureOverrides rebuilds feature-flag diffs and keeps free-text custom changes.
func FeatureOverrides(features []FeatureDefinition, planned []PlannedFeature, descriptions map[string]string, existing []AdHocChange) []AdHocChange {
	customs := []AdHocChange{}
	previous := map[string]AdHocChange{}
	for _, change := range existing {
		if change.Kind == "CUSTOM" {
			customs = append(customs, change)
			continue
		}
		if change.Kind == "FEATURE_OVERRIDE" && change.FeatureID != nil {
			previous[*change.FeatureID] = change
		}
	}
	diffs := BaselineChanges(features, planned)
	overrides := make([]AdHocChange, 0, len(diffs))
	for _, diff := range diffs {
		enabled := false
		for _, row := range planned {
			if row.FeatureID == diff.FeatureID {
				enabled = row.Enabled
				break
			}
		}
		id := ""
		description := ""
		if prior, ok := previous[diff.FeatureID]; ok {
			id = prior.ID
			description = prior.Description
		}
		if text, ok := descriptions[diff.FeatureID]; ok {
			description = text
		}
		if id == "" {
			id = nextAdhocID(diff.FeatureID)
		}
		en := enabled
		fid := diff.FeatureID
		overrides = append(overrides, AdHocChange{
			ID:          id,
			Kind:        "FEATURE_OVERRIDE",
			FeatureID:   &fid,
			Enabled:     &en,
			Title:       "",
			Description: description,
		})
	}
	return append(overrides, customs...)
}

func nextAdhocID(featureID string) string {
	adhocMu.Lock()
	defer adhocMu.Unlock()
	id := fmt.Sprintf("adhoc_%s_%d", featureID, adhocSeq)
	adhocSeq++
	return id
}
