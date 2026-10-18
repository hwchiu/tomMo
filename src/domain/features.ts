import type { ChangeType, FeatureChange, PlannedFeature, PlatformMode } from "./types";

export function baselineChanges(
  features: Array<{ id: string; name: string; defaultEnabled: boolean }>,
  planned: PlannedFeature[],
): FeatureChange[] {
  const byId = new Map(planned.map((row) => [row.featureId, row.enabled]));
  const changes: FeatureChange[] = [];
  for (const feature of features) {
    const enabled = byId.get(feature.id);
    if (enabled === undefined || enabled === feature.defaultEnabled) continue;
    changes.push(
      enabled
        ? { featureId: feature.id, changeType: "ADDED", summary: `相對預設開啟${feature.name}` }
        : { featureId: feature.id, changeType: "REMOVED", summary: `相對預設關閉${feature.name}` },
    );
  }
  return changes;
}

export function isFeaturePlanComplete(featureIds: string[], planned: PlannedFeature[]): boolean {
  if (featureIds.length === 0) return true;
  const chosen = new Set(planned.map((row) => row.featureId));
  return featureIds.every((id) => chosen.has(id));
}

/** Planned on/off. Null means this plan has not chosen a state yet. */
export function resolvePlanned(input: {
  mode: PlatformMode;
  versionSupported: boolean | null;
  changeType: ChangeType | null;
  plannedEnabled: boolean | null;
}): boolean | null {
  if (input.mode === "FEATURE_ONLY") return input.plannedEnabled;
  if (input.changeType === "ADDED") return true;
  if (input.changeType === "REMOVED") return false;
  return input.versionSupported;
}
