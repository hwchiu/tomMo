package store

import (
	"strings"

	"fpm/internal/apierr"
)

func oneOf(value, message string, allowed ...string) error {
	for _, item := range allowed {
		if value == item {
			return nil
		}
	}
	return apierr.New(400, message)
}

func validateFactoryStatus(status string) error {
	return oneOf(status, "工廠狀態不正確", "ON_TRACK", "AT_RISK", "DELAYED", "COMPLETED")
}

func validatePhase(input PhaseInput) error {
	if strings.TrimSpace(input.Name) == "" {
		return apierr.New(400, "請填階段名稱")
	}
	return oneOf(input.Status, "階段狀態不正確", "NOT_STARTED", "IN_PROGRESS", "AT_RISK", "DELAYED", "COMPLETED")
}

func validateDeploymentStatus(status string) error {
	return oneOf(status, "部署狀態不正確", "PLANNED", "IN_PROGRESS", "DEPLOYED", "ACCEPTED")
}

func validateIssue(input IssueInput) error {
	if strings.TrimSpace(input.Title) == "" {
		return apierr.New(400, "請填問題標題")
	}
	if err := oneOf(input.Severity, "嚴重度不正確", "LOW", "MEDIUM", "HIGH", "CRITICAL"); err != nil {
		return err
	}
	if err := oneOf(input.Priority, "優先順序不正確", "P0", "P1", "P2", "P3"); err != nil {
		return err
	}
	return oneOf(input.Status, "問題狀態不正確", "OPEN", "IN_PROGRESS", "BLOCKED", "RESOLVED", "CLOSED")
}

func validatePlanIntent(intent string) error {
	return oneOf(intent, "請選擇草稿或送出", "draft", "submit")
}

func validateMilestoneName(name string) error {
	if strings.TrimSpace(name) == "" {
		return apierr.New(400, "請填里程碑名稱")
	}
	return nil
}

func validateProductMode(mode string) error {
	return oneOf(mode, "請選擇版本模式或僅功能開關", "VERSIONED", "FEATURE_ONLY")
}

func validatePhaseLink(relation string) error {
	return oneOf(relation, "階段關聯不正確", "INTRODUCED", "UPGRADED", "ACCEPTED")
}
