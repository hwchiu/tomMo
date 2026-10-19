package domain

import (
	"regexp"
	"time"
)

var isoDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

func IsIsoDate(value string) bool {
	if !isoDateRe.MatchString(value) {
		return false
	}
	_, err := time.Parse("2006-01-02", value)
	return err == nil
}

func AddDays(iso string, days int) string {
	t, err := time.Parse("2006-01-02", iso)
	if err != nil {
		return iso
	}
	return t.AddDate(0, 0, days).Format("2006-01-02")
}

// DayDiff is the number of calendar days from earlier to later (later − earlier).
func DayDiff(later, earlier string) int {
	a, errA := time.Parse("2006-01-02", later)
	b, errB := time.Parse("2006-01-02", earlier)
	if errA != nil || errB != nil {
		return 0
	}
	return int(a.Sub(b) / (24 * time.Hour))
}
