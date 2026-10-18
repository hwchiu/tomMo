import type { AdHocChange, ChangeType, FeatureChange, PlannedFeature, ProductMode } from "./types";

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
  mode: ProductMode;
  versionSupported: boolean | null;
  changeType: ChangeType | null;
  plannedEnabled: boolean | null;
}): boolean | null {
  if (input.mode === "FEATURE_ONLY") return input.plannedEnabled;
  if (input.changeType === "ADDED") return true;
  if (input.changeType === "REMOVED") return false;
  return input.versionSupported;
}

export type CapabilityTone = "UNPLANNED" | "UNCHANGED_ON" | "UNCHANGED_OFF" | "ADDED" | "REMOVED";

export function toneAgainstBaseline(planned: boolean, baseline: boolean): CapabilityTone {
  if (planned === baseline) return planned ? "UNCHANGED_ON" : "UNCHANGED_OFF";
  return planned ? "ADDED" : "REMOVED";
}

/**
 * Effective cell for one feature.
 * Feature-flag plans compare the explicit set with the product default.
 * Versioned plans start from the selected version and apply a feature override.
 */
export function capabilityCell(input: {
  mode: ProductMode;
  defaultEnabled: boolean;
  plannedEnabled: boolean | null;
  versionSupported: boolean | null;
  overrideEnabled: boolean | null;
}): { tone: CapabilityTone; planned: boolean | null; baseline: boolean | null; adhoc: boolean } {
  if (input.mode === "FEATURE_ONLY") {
    if (input.plannedEnabled === null) return { tone: "UNPLANNED", planned: null, baseline: input.defaultEnabled, adhoc: false };
    const tone = toneAgainstBaseline(input.plannedEnabled, input.defaultEnabled);
    return { tone, planned: input.plannedEnabled, baseline: input.defaultEnabled, adhoc: input.plannedEnabled !== input.defaultEnabled };
  }
  if (input.versionSupported === null) return { tone: "UNPLANNED", planned: null, baseline: null, adhoc: false };
  const planned = input.overrideEnabled ?? input.versionSupported;
  const adhoc = input.overrideEnabled !== null && input.overrideEnabled !== input.versionSupported;
  return { tone: toneAgainstBaseline(planned, input.versionSupported), planned, baseline: input.versionSupported, adhoc };
}

let adhocSeq = 0;

export function featureOverrides(
  features: Array<{ id: string; name: string; defaultEnabled: boolean }>,
  planned: PlannedFeature[],
  descriptions: Record<string, string>,
  existing: AdHocChange[],
): AdHocChange[] {
  const customs = existing.filter((change) => change.kind === "CUSTOM");
  const previous = new Map(existing.filter((change) => change.kind === "FEATURE_OVERRIDE" && change.featureId).map((change) => [change.featureId as string, change]));
  const diffs = baselineChanges(features, planned);
  const overrides = diffs.map((diff) => {
    const prior = previous.get(diff.featureId);
    const enabled = planned.find((row) => row.featureId === diff.featureId)?.enabled ?? false;
    return {
      id: prior?.id ?? `adhoc_${diff.featureId}_${adhocSeq++}`,
      kind: "FEATURE_OVERRIDE" as const,
      featureId: diff.featureId,
      enabled,
      title: "",
      description: descriptions[diff.featureId] ?? prior?.description ?? "",
    };
  });
  return [...overrides, ...customs];
}
