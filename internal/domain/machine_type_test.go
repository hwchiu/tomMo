package domain

import "testing"

func TestNormalizeMachineTypeName(t *testing.T) {
	ok := []string{"EIA-1", "A", "Rack 2", "node_1", "gpu.v2", "  EIA-4  "}
	for _, name := range ok {
		got, err := NormalizeMachineTypeName(name)
		if err != nil {
			t.Fatalf("%q %v", name, err)
		}
		if got == "" || got[0] == ' ' {
			t.Fatalf("normalized %q → %q", name, got)
		}
	}
	if _, err := NormalizeMachineTypeName("   "); err == nil || err.Error() != MachineTypeNameRequired {
		t.Fatalf("blank %v", err)
	}
	bad := []string{"機種A", "1EIA", "-EIA", "has/slash", "this-name-is-longer-than-thirty-two-chars"}
	for _, name := range bad {
		if _, err := NormalizeMachineTypeName(name); err == nil || err.Error() != MachineTypeNameInvalid {
			t.Fatalf("%q %v", name, err)
		}
	}
}
