import { describe, expect, it } from "vitest";
import { evaluateConstructionWindow } from "./windows";

const phase = { start: "2026-06-16", end: "2026-11-30" };

describe("evaluateConstructionWindow", () => {
  it("accepts a window that sits on the phase boundaries", () => {
    expect(evaluateConstructionWindow({ start: "2026-06-16", end: "2026-11-30" }, phase)).toEqual({
      state: "INSIDE",
      reasons: [],
    });
  });

  it("flags a start before the phase and an end after the phase", () => {
    expect(evaluateConstructionWindow({ start: "2026-06-01", end: "2026-09-01" }, phase).reasons).toEqual([
      "STARTS_BEFORE_PHASE",
    ]);
    expect(evaluateConstructionWindow({ start: "2026-08-01", end: "2026-12-20" }, phase).reasons).toEqual([
      "ENDS_AFTER_PHASE",
    ]);
    expect(evaluateConstructionWindow({ start: "2026-06-01", end: "2026-12-20" }, phase)).toEqual({
      state: "OUTSIDE",
      reasons: ["STARTS_BEFORE_PHASE", "ENDS_AFTER_PHASE"],
    });
  });

  it("flags a missing window and a missing phase", () => {
    expect(evaluateConstructionWindow({ start: null, end: "2026-09-01" }, phase)).toEqual({
      state: "MISSING",
      reasons: ["MISSING_DATES"],
    });
    expect(evaluateConstructionWindow({ start: "2026-07-01", end: "2026-08-01" }, null)).toEqual({
      state: "OUTSIDE",
      reasons: ["MISSING_PHASE"],
    });
  });

  it("does not treat overlapping windows as conflicts", () => {
    const compute = evaluateConstructionWindow({ start: "2026-07-01", end: "2026-09-30" }, phase);
    const storage = evaluateConstructionWindow({ start: "2026-08-01", end: "2026-10-15" }, phase);
    expect(compute.state).toBe("INSIDE");
    expect(storage.state).toBe("INSIDE");
    expect([...compute.reasons, ...storage.reasons]).toEqual([]);
  });
});
