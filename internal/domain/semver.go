package domain

import (
	"regexp"
	"strconv"
	"strings"
)

var semverRe = regexp.MustCompile(`^(\d+)(?:\.(\d+))?(?:\.(\d+))?$`)

// ParseSemver accepts numeric major.minor.patch. A single leading v is ignored.
func ParseSemver(input string) (major, minor, patch int, ok bool) {
	s := strings.TrimSpace(input)
	if len(s) > 0 && (s[0] == 'v' || s[0] == 'V') {
		s = s[1:]
	}
	m := semverRe.FindStringSubmatch(s)
	if m == nil {
		return 0, 0, 0, false
	}
	major, _ = strconv.Atoi(m[1])
	if m[2] != "" {
		minor, _ = strconv.Atoi(m[2])
	}
	if m[3] != "" {
		patch, _ = strconv.Atoi(m[3])
	}
	return major, minor, patch, true
}

// CompareSemver returns the numeric difference and true when both sides parse.
// Callers that use `?? 0` should treat ok == false as equal.
func CompareSemver(a, b string) (int, bool) {
	a1, a2, a3, okA := ParseSemver(a)
	b1, b2, b3, okB := ParseSemver(b)
	if !okA || !okB {
		return 0, false
	}
	if a1 != b1 {
		return a1 - b1, true
	}
	if a2 != b2 {
		return a2 - b2, true
	}
	if a3 != b3 {
		return a3 - b3, true
	}
	return 0, true
}
