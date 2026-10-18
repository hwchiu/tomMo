import type { DeploymentStatus, PlanStatus } from "./types";
import type { WindowState } from "./windows";

export type ReadinessFlag =
  | "PLAN_MISSING"
  | "PLAN_NOT_APPROVED"
  | "WINDOW_MISSING"
  | "WINDOW_OUTSIDE"
  | "DEPLOYMENT_INCOMPLETE";

const COMPLETE = new Set<DeploymentStatus>(["DEPLOYED", "ACCEPTED"]);

export function deploymentReady(status: DeploymentStatus): boolean {
  return COMPLETE.has(status);
}

/** Ready for the Phase 2 → Phase 3 handoff from this platform's point of view. */
export function cellReadiness(input: {
  planStatus: PlanStatus;
  windowState: WindowState;
  deploymentStatus: DeploymentStatus;
}): { ready: boolean; flags: ReadinessFlag[] } {
  const flags: ReadinessFlag[] = [];
  if (input.planStatus === "NOT_SUBMITTED") flags.push("PLAN_MISSING");
  else if (input.planStatus !== "APPROVED") flags.push("PLAN_NOT_APPROVED");
  if (input.windowState === "MISSING") flags.push("WINDOW_MISSING");
  if (input.windowState === "OUTSIDE") flags.push("WINDOW_OUTSIDE");
  if (!deploymentReady(input.deploymentStatus)) flags.push("DEPLOYMENT_INCOMPLETE");
  return { ready: flags.length === 0, flags };
}
