import { describe, expect, it } from "vitest";
import { baselineChanges, isFeaturePlanComplete, resolvePlanned } from "./features";

const features = [
  { id: "lineage", name: "資料血緣", defaultEnabled: true },
  { id: "store", name: "特徵庫", defaultEnabled: false },
  { id: "trace", name: "批次追溯", defaultEnabled: false },
];

describe("baselineChanges", () => {
  it("records only features that differ from the default", () => {
    const changes = baselineChanges(features, [
      { featureId: "lineage", enabled: true },
      { featureId: "store", enabled: true },
      { featureId: "trace", enabled: true },
    ]);
    expect(changes.map((change) => [change.featureId, change.changeType])).toEqual([
      ["store", "ADDED"],
      ["trace", "ADDED"],
    ]);
    expect(changes[0]?.summary).toContain("特徵庫");
  });

  it("treats turning a default-on feature off as removed", () => {
    const changes = baselineChanges(features, [
      { featureId: "lineage", enabled: false },
      { featureId: "store", enabled: false },
      { featureId: "trace", enabled: false },
    ]);
    expect(changes).toEqual([
      { featureId: "lineage", changeType: "REMOVED", summary: "相對預設關閉資料血緣" },
    ]);
  });

  it("is complete only when every feature has a planned state", () => {
    expect(isFeaturePlanComplete(["lineage", "store"], [{ featureId: "lineage", enabled: true }])).toBe(false);
    expect(
      isFeaturePlanComplete(
        ["lineage", "store"],
        [
          { featureId: "lineage", enabled: true },
          { featureId: "store", enabled: false },
        ],
      ),
    ).toBe(true);
    expect(isFeaturePlanComplete([], [])).toBe(true);
  });
});

describe("resolvePlanned", () => {
  it("uses the feature set for feature-flag platforms and the version for versioned ones", () => {
    expect(resolvePlanned({ mode: "FEATURE_ONLY", versionSupported: null, changeType: null, plannedEnabled: true })).toBe(true);
    expect(resolvePlanned({ mode: "FEATURE_ONLY", versionSupported: null, changeType: null, plannedEnabled: null })).toBe(null);
    expect(resolvePlanned({ mode: "VERSIONED", versionSupported: true, changeType: "REMOVED", plannedEnabled: null })).toBe(false);
    expect(resolvePlanned({ mode: "VERSIONED", versionSupported: false, changeType: "ADDED", plannedEnabled: null })).toBe(true);
    expect(resolvePlanned({ mode: "VERSIONED", versionSupported: null, changeType: null, plannedEnabled: null })).toBe(null);
  });
});
