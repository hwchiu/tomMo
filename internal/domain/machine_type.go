package domain

import "regexp"

const (
	// MachineTypeNameRequired is the error for a blank machine-type name.
	MachineTypeNameRequired = "機種名稱必填"
	// MachineTypeNameInvalid is the error when a name is not English-only.
	MachineTypeNameInvalid = "機種名稱只能使用英文、數字與 - _ . 空格"
	// MachineTypeNameTaken is the error when another type already uses the name.
	MachineTypeNameTaken = "這個機種名稱已存在"
)

var machineTypeNamePattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9 ._-]{0,31}$`)

// NormalizeMachineTypeName trims a machine-type name and checks the English-only rule.
func NormalizeMachineTypeName(name string) (string, error) {
	name = trimSpace(name)
	if name == "" {
		return "", errString(MachineTypeNameRequired)
	}
	if !machineTypeNamePattern.MatchString(name) {
		return "", errString(MachineTypeNameInvalid)
	}
	return name, nil
}

func trimSpace(s string) string {
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}

type errString string

func (e errString) Error() string { return string(e) }
