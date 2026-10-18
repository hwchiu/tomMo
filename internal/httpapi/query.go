package httpapi

import (
	"net/http"
	"strconv"
	"strings"

	"fpm/internal/views"
)

func listQuery(r *http.Request) views.ListQuery {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	query := views.ListQuery{
		Limit:      limit,
		Offset:     offset,
		FactoryID:  q.Get("factory"),
		Severity:   q.Get("severity"),
		Status:     q.Get("status"),
		Query:      strings.TrimSpace(q.Get("q")),
		EntityType: q.Get("entityType"),
	}
	switch q.Get("active") {
	case "1", "true":
		value := true
		query.Active = &value
	case "0", "false":
		value := false
		query.Active = &value
	}
	switch q.Get("overdue") {
	case "1", "true":
		value := true
		query.Overdue = &value
	case "0", "false":
		value := false
		query.Overdue = &value
	}
	return query
}
