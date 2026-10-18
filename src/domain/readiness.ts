import type { PlanStatus, ProductMode } from "./types";
import type { WindowState } from "./windows";

export type ReadinessFlag =
  | "PLAN_MISSING"
  | "PLAN_NOT_APPROVED"
  | "WINDOW_MISSING"
  | "WINDOW_OUTSIDE"
  | "VERSION_MISSING"
  | "FEATURE_UNPLANNED";

/** Ready for 開發者進駐 from this product's plan and feature state. */
export function cellReadiness(input: {
  planStatus: PlanStatus;
  windowState: WindowState;
  mode: ProductMode;
  hasProvidedVersion: boolean;
  featurePlanComplete: boolean;
}): { ready: boolean; flags: ReadinessFlag[] } {
  const flags: ReadinessFlag[] = [];
  if (input.planStatus === "NOT_SUBMITTED") flags.push("PLAN_MISSING");
  else if (input.planStatus !== "APPROVED") flags.push("PLAN_NOT_APPROVED");
  if (input.windowState === "MISSING") flags.push("WINDOW_MISSING");
  if (input.windowState === "OUTSIDE") flags.push("WINDOW_OUTSIDE");
  if (input.planStatus !== "NOT_SUBMITTED") {
    if (input.mode === "VERSIONED" && !input.hasProvidedVersion) flags.push("VERSION_MISSING");
    if (input.mode === "FEATURE_ONLY" && !input.featurePlanComplete) flags.push("FEATURE_UNPLANNED");
  }
  return { ready: flags.length === 0, flags };
}
