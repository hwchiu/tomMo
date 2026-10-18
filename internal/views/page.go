package views

const (
	defaultPageLimit = 200
	maxPageLimit     = 500
)

func clampPage(limit, offset int) (int, int) {
	if limit <= 0 {
		limit = defaultPageLimit
	}
	if limit > maxPageLimit {
		limit = maxPageLimit
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

func pageSlice[T any](items []T, limit, offset int) (page []T, total, outLimit, outOffset int) {
	outLimit, outOffset = clampPage(limit, offset)
	total = len(items)
	if outOffset >= total {
		return []T{}, total, outLimit, outOffset
	}
	end := outOffset + outLimit
	if end > total {
		end = total
	}
	page = append([]T(nil), items[outOffset:end]...)
	return page, total, outLimit, outOffset
}
