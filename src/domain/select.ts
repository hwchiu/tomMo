export interface FactoryScope {
  category?: string;
  region?: string;
  technology?: string;
  status?: string;
}

export function inFactoryScope(
  factory: { category: string; region: string; technology: string; status: string },
  scope: FactoryScope,
): boolean {
  if (scope.category && factory.category !== scope.category) return false;
  if (scope.region && factory.region !== scope.region) return false;
  if (scope.technology && factory.technology !== scope.technology) return false;
  if (scope.status && factory.status !== scope.status) return false;
  return true;
}

export type GroupKey = "none" | "category" | "region" | "technology";

export function groupKeyOf(
  factory: { category: string; region: string; technology: string },
  group: GroupKey,
): string {
  if (group === "category") return factory.category;
  if (group === "region") return factory.region;
  if (group === "technology") return factory.technology;
  return "all";
}
