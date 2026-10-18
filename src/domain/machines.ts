/** Planned machine quantities only. There is no actual or delivered count. */

export function plannedTotal(lines: Array<{ planned: number }>): number {
  return lines.reduce((sum, line) => sum + nonNegativeInt(line.planned), 0);
}

export function nonNegativeInt(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.trunc(value);
}

/** Sum planned quantities of the same machine type across product deployments. */
export function rollupPlanned(
  groups: Array<Array<{ machineTypeId: string; planned: number }>>,
): Array<{ machineTypeId: string; planned: number }> {
  const totals = new Map<string, number>();
  for (const group of groups) {
    for (const line of group) {
      totals.set(line.machineTypeId, (totals.get(line.machineTypeId) ?? 0) + nonNegativeInt(line.planned));
    }
  }
  return [...totals.entries()].map(([machineTypeId, planned]) => ({ machineTypeId, planned }));
}
