import { compareSemver, parseSemver } from "./semver";

export type RequirementKind = "MIN_VERSION" | "FEATURE_ENABLED" | "DEPLOYMENT_COMPLETE";

/** Expected condition on a handoff. Product here is a platform code. */
export interface RequirementInput {
  id: string;
  kind: RequirementKind;
  description: string;
  productCode: string;
  minVersion?: string | null;
  featureCode?: string | null;
}

/** Actual deployment state the condition is checked against. */
export interface DeploymentSnapshot {
  productCode: string;
  status: string;
  actualVersion: string | null;
  /** feature code → reported actual. Null means not reported. */
  actualFeatures: Record<string, boolean | null>;
}

export interface ConditionResult {
  requirementId: string;
  kind: RequirementKind;
  description: string;
  met: boolean;
  expected: string;
  actual: string;
  detail: string;
}

export interface HandoffEvaluation {
  allMet: boolean;
  metCount: number;
  unmet: ConditionResult[];
  results: ConditionResult[];
}

const COMPLETE = new Set(["DEPLOYED", "ACCEPTED"]);

/**
 * Compare expected handoff conditions with actual deployment state.
 * This never accepts a handoff by itself; a person still has to.
 */
export function evaluateHandoffRequirements(
  requirements: RequirementInput[],
  deployments: DeploymentSnapshot[],
): HandoffEvaluation {
  const results = requirements.map((requirement) => evaluateOne(requirement, deployments));
  const unmet = results.filter((result) => !result.met);
  return {
    allMet: unmet.length === 0,
    metCount: results.length - unmet.length,
    unmet,
    results,
  };
}

function evaluateOne(requirement: RequirementInput, deployments: DeploymentSnapshot[]): ConditionResult {
  const deployment = deployments.find((item) => item.productCode === requirement.productCode);
  const base = {
    requirementId: requirement.id,
    kind: requirement.kind,
    description: requirement.description,
  };

  if (requirement.kind === "MIN_VERSION") {
    const minVersion = requirement.minVersion?.trim() || "";
    const expected = `${requirement.productCode} 實際版本 ≥ ${minVersion || "（未設定）"}`;
    if (!minVersion) {
      return { ...base, met: false, expected, actual: "條件缺少最低版本", detail: "最低版本未設定，無法比較。" };
    }
    if (!parseSemver(minVersion)) {
      return { ...base, met: false, expected, actual: minVersion, detail: "版本格式無法比較。" };
    }
    if (!deployment) {
      return { ...base, met: false, expected, actual: "沒有部署", detail: "此工廠沒有該平台的部署。" };
    }
    if (!deployment.actualVersion) {
      return { ...base, met: false, expected, actual: "尚未填報實際版本", detail: "工程師尚未填報實際版本。" };
    }
    const order = compareSemver(deployment.actualVersion, minVersion);
    if (order === null) {
      return {
        ...base,
        met: false,
        expected,
        actual: deployment.actualVersion,
        detail: "版本格式無法比較。",
      };
    }
    const met = order >= 0;
    return {
      ...base,
      met,
      expected,
      actual: deployment.actualVersion,
      detail: met ? "實際版本達到最低要求。" : "實際版本低於交接要求。",
    };
  }

  if (requirement.kind === "FEATURE_ENABLED") {
    const feature = requirement.featureCode?.trim() || "";
    const expected = `${requirement.productCode} 功能 ${feature || "（未設定）"} 實際啟用`;
    if (!feature) {
      return { ...base, met: false, expected, actual: "條件缺少功能", detail: "功能代碼未設定。" };
    }
    if (!deployment) {
      return { ...base, met: false, expected, actual: "沒有部署", detail: "此工廠沒有該平台的部署。" };
    }
    const actual = deployment.actualFeatures[feature];
    if (actual === undefined || actual === null) {
      return { ...base, met: false, expected, actual: "尚未填報", detail: "實際啟用狀態尚未填報。" };
    }
    return {
      ...base,
      met: actual === true,
      expected,
      actual: actual ? "已啟用" : "未啟用",
      detail: actual ? "實際已啟用。" : "實際未啟用。",
    };
  }

  const expected = `${requirement.productCode} 部署完成（已部署或已驗收）`;
  if (!deployment) {
    return { ...base, met: false, expected, actual: "沒有部署", detail: "此工廠沒有該平台的部署。" };
  }
  const met = COMPLETE.has(deployment.status);
  return {
    ...base,
    met,
    expected,
    actual: deployment.status,
    detail: met ? "部署已完成。" : "部署尚未完成。",
  };
}
