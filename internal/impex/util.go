package impex

func strPtr(v string) *string {
	if v == "" {
		return nil
	}
	s := v
	return &s
}

func strVal(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func boolPtr(v bool) *bool {
	b := v
	return &b
}

func boolVal(p *bool) (bool, bool) {
	if p == nil {
		return false, false
	}
	return *p, true
}

func boolEq(a, b *bool) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func sameIDs(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
