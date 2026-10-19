export interface FactoryScope {
  category?: string;
  region?: string;
  status?: string;
}

export function inFactoryScope(
  factory: { category: string; region: string; status: string },
  scope: FactoryScope,
): boolean {
  if (scope.category && factory.category !== scope.category) return false;
  if (scope.region && factory.region !== scope.region) return false;
  if (scope.status && factory.status !== scope.status) return false;
  return true;
}

export type GroupKey = "none" | "category" | "region";

export function groupKeyOf(
  factory: { category: string; region: string },
  group: GroupKey,
): string {
  if (group === "category") return factory.category;
  if (group === "region") return factory.region;
  return "all";
}
