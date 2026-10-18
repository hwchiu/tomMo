package domain

import "math"

// PlannedLine is one planned quantity. MachineTypeID may be empty for a bare total.
type PlannedLine struct {
	MachineTypeID string
	Planned       float64
}

// NonNegativeInt maps non-finite or non-positive values to 0 and truncates the rest toward zero.
func NonNegativeInt(value float64) int {
	if math.IsNaN(value) || math.IsInf(value, 0) || value <= 0 {
		return 0
	}
	return int(math.Trunc(value))
}

// PlannedTotal sums planned quantities, ignoring blank, negative, and non-finite input.
func PlannedTotal(lines []PlannedLine) int {
	sum := 0
	for _, line := range lines {
		sum += NonNegativeInt(line.Planned)
	}
	return sum
}

// RollupPlanned sums planned quantities of the same machine type across product deployments.
// Insertion order of machine types is preserved. Each line is passed through NonNegativeInt first.
func RollupPlanned(groups [][]PlannedLine) []PlannedLine {
	totals := map[string]int{}
	var order []string
	for _, group := range groups {
		for _, line := range group {
			if _, seen := totals[line.MachineTypeID]; !seen {
				order = append(order, line.MachineTypeID)
			}
			totals[line.MachineTypeID] += NonNegativeInt(line.Planned)
		}
	}
	out := make([]PlannedLine, 0, len(order))
	for _, id := range order {
		out = append(out, PlannedLine{MachineTypeID: id, Planned: float64(totals[id])})
	}
	return out
}
