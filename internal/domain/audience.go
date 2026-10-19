package domain

import "strings"

const (
	// AudienceExternal is a product delivered to end users (對外).
	AudienceExternal = "EXTERNAL"
	// AudienceInternal is a product other products depend on (對內).
	AudienceInternal = "INTERNAL"
	// AudienceInvalid is the error for a value outside 對外 and 對內.
	AudienceInvalid = "可見範圍只能是對外或對內"
	// IssueProductOther is the issue product choice 其他. It is not a product row.
	IssueProductOther = "other"
)

// NormalizeAudience accepts the code or the Traditional Chinese label.
// An empty value is 對外 so older rows and CSV files stay valid.
func NormalizeAudience(raw string) (string, error) {
	key := strings.TrimSpace(raw)
	switch {
	case key == "", strings.EqualFold(key, AudienceExternal), key == "對外":
		return AudienceExternal, nil
	case strings.EqualFold(key, AudienceInternal), key == "對內":
		return AudienceInternal, nil
	default:
		return "", errAudience
	}
}

// AudienceLabel is the Traditional Chinese mark shown in the UI.
func AudienceLabel(code string) string {
	if code == AudienceInternal {
		return "對內"
	}
	return "對外"
}

type audienceError string

func (e audienceError) Error() string { return string(e) }

const errAudience audienceError = AudienceInvalid
