import { describe, expect, it } from "vitest";
import { evaluateHandoffRequirements, type DeploymentSnapshot, type RequirementInput } from "./handoff-evaluator";

function deployment(overrides: Partial<DeploymentSnapshot> = {}): DeploymentSnapshot {
  return {
    productCode: "CMP",
    status: "DEPLOYED",
    actualVersion: "2.3.0",
    actualFeatures: { liquid_cooling: true, rack_scale: false },
    ...overrides,
  };
}

function requirement(overrides: Partial<RequirementInput> & Pick<RequirementInput, "id" | "kind">): RequirementInput {
  return {
    description: overrides.description ?? overrides.id,
    productCode: "CMP",
    ...overrides,
  };
}

describe("evaluateHandoffRequirements", () => {
  it("accepts an actual version equal to or above the minimum, including multi-digit minors", () => {
    const equal = evaluateHandoffRequirements(
      [requirement({ id: "v", kind: "MIN_VERSION", minVersion: "2.3.0" })],
      [deployment({ actualVersion: "2.3.0" })],
    );
    const higher = evaluateHandoffRequirements(
      [requirement({ id: "v", kind: "MIN_VERSION", minVersion: "v2.3" })],
      [deployment({ actualVersion: "2.10.0" })],
    );
    expect(equal.results[0]?.met).toBe(true);
    expect(higher.results[0]?.met).toBe(true);
    expect(higher.allMet).toBe(true);
  });

  it("rejects a lower version instead of comparing the strings", () => {
    const result = evaluateHandoffRequirements(
      [requirement({ id: "v", kind: "MIN_VERSION", minVersion: "2.3.0" })],
      [deployment({ actualVersion: "2.2.0" })],
    );
    expect(result.allMet).toBe(false);
    expect(result.results[0]).toMatchObject({ met: false, actual: "2.2.0" });
  });

  it("treats a missing deployment, a missing actual version, and an unparsable version as unmet", () => {
    const requirements = [
      requirement({ id: "missing-dep", kind: "MIN_VERSION", productCode: "STG", minVersion: "1.6.0" }),
      requirement({ id: "missing-ver", kind: "MIN_VERSION", minVersion: "2.3.0" }),
      requirement({ id: "bad", kind: "MIN_VERSION", minVersion: "latest" }),
    ];
    const evaluation = evaluateHandoffRequirements(requirements, [deployment({ actualVersion: null })]);
    expect(evaluation.results.map((item) => item.met)).toEqual([false, false, false]);
    expect(evaluation.results[1]?.actual).toBe("尚未填報實際版本");
    expect(evaluation.results[2]?.detail).toContain("無法比較");
  });

  it("separates an enabled feature, a disabled feature, and an unreported feature", () => {
    const evaluation = evaluateHandoffRequirements(
      [
        requirement({ id: "on", kind: "FEATURE_ENABLED", featureCode: "liquid_cooling" }),
        requirement({ id: "off", kind: "FEATURE_ENABLED", featureCode: "rack_scale" }),
        requirement({ id: "unknown", kind: "FEATURE_ENABLED", featureCode: "gpu_partition" }),
      ],
      [deployment()],
    );
    expect(evaluation.results.map((item) => [item.requirementId, item.met, item.actual])).toEqual([
      ["on", true, "已啟用"],
      ["off", false, "未啟用"],
      ["unknown", false, "尚未填報"],
    ]);
  });

  it("counts DEPLOYED and ACCEPTED as complete and leaves earlier statuses unmet", () => {
    for (const status of ["DEPLOYED", "ACCEPTED"]) {
      const evaluation = evaluateHandoffRequirements(
        [requirement({ id: "d", kind: "DEPLOYMENT_COMPLETE" })],
        [deployment({ status })],
      );
      expect(evaluation.allMet).toBe(true);
    }
    for (const status of ["PLANNED", "IN_PROGRESS"]) {
      const evaluation = evaluateHandoffRequirements(
        [requirement({ id: "d", kind: "DEPLOYMENT_COMPLETE" })],
        [deployment({ status })],
      );
      expect(evaluation.results[0]?.met).toBe(false);
    }
  });

  it("is all met only when every condition passes, and keeps result order", () => {
    const mixed = evaluateHandoffRequirements(
      [
        requirement({ id: "1", kind: "MIN_VERSION", minVersion: "2.3.0" }),
        requirement({ id: "2", kind: "FEATURE_ENABLED", featureCode: "rack_scale" }),
        requirement({ id: "3", kind: "DEPLOYMENT_COMPLETE" }),
      ],
      [deployment()],
    );
    expect(mixed.results.map((item) => item.requirementId)).toEqual(["1", "2", "3"]);
    expect(mixed.metCount).toBe(2);
    expect(mixed.unmet.map((item) => item.requirementId)).toEqual(["2"]);
    expect(mixed.allMet).toBe(false);

    const empty = evaluateHandoffRequirements([], []);
    expect(empty.allMet).toBe(true);
    expect(empty.results).toEqual([]);
  });
});
