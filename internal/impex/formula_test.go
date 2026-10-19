package impex

import "testing"

func TestNeutralizeFormula(t *testing.T) {
	if got := neutralizeFormula("=1+1"); got != "'=1+1" {
		t.Fatalf("formula %q", got)
	}
	if got := neutralizeFormula("+cmd"); got != "'+cmd" {
		t.Fatalf("plus %q", got)
	}
	if got := neutralizeFormula("新竹一廠"); got != "新竹一廠" {
		t.Fatalf("plain %q", got)
	}
	if got := neutralizeFormula(""); got != "" {
		t.Fatalf("empty %q", got)
	}
}
