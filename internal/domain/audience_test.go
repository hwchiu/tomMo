package domain

import "testing"

func TestNormalizeAudience(t *testing.T) {
	external, err := NormalizeAudience("")
	if err != nil || external != AudienceExternal {
		t.Fatalf("empty: %q %v", external, err)
	}
	external, err = NormalizeAudience("對外")
	if err != nil || external != AudienceExternal {
		t.Fatalf("label: %q %v", external, err)
	}
	internal, err := NormalizeAudience("internal")
	if err != nil || internal != AudienceInternal {
		t.Fatalf("code: %q %v", internal, err)
	}
	if _, err := NormalizeAudience("公開"); err == nil || err.Error() != AudienceInvalid {
		t.Fatalf("invalid: %v", err)
	}
	if AudienceLabel(AudienceInternal) != "對內" || AudienceLabel(AudienceExternal) != "對外" {
		t.Fatal("labels")
	}
}
