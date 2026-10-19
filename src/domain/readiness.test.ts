import { describe, expect, it } from "vitest";
import { cellReadiness } from "./readiness";

describe("cellReadiness", () => {
  it("is ready only when the plan, window, and version or features are complete", () => {
    expect(
      cellReadiness({
        planStatus: "APPROVED",
        windowState: "INSIDE",
        mode: "VERSIONED",
        hasProvidedVersion: true,
        featurePlanComplete: true,
      }),
    ).toEqual({ ready: true, flags: [] });
  });

  it("does not also demand a version while the plan is still missing", () => {
    const result = cellReadiness({
      planStatus: "NOT_SUBMITTED",
      windowState: "MISSING",
      mode: "VERSIONED",
      hasProvidedVersion: false,
      featurePlanComplete: false,
    });
    expect(result.ready).toBe(false);
    expect(result.flags).toEqual(["PLAN_MISSING", "WINDOW_MISSING"]);
  });

  it("flags an unapproved feature-only plan that sits outside the phase", () => {
    expect(
      cellReadiness({
        planStatus: "SUBMITTED",
        windowState: "OUTSIDE",
        mode: "FEATURE_ONLY",
        hasProvidedVersion: false,
        featurePlanComplete: false,
      }).flags,
    ).toEqual(["PLAN_NOT_APPROVED", "WINDOW_OUTSIDE", "FEATURE_UNPLANNED"]);
  });

  it("flags a submitted versioned plan that has not chosen a version", () => {
    expect(
      cellReadiness({
        planStatus: "SUBMITTED",
        windowState: "INSIDE",
        mode: "VERSIONED",
        hasProvidedVersion: false,
        featurePlanComplete: true,
      }).flags,
    ).toContain("VERSION_MISSING");
  });
});
