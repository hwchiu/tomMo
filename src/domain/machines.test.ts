import { describe, expect, it } from "vitest";
import { plannedTotal, rollupPlanned } from "./machines";

describe("planned machine quantities", () => {
  it("sums a platform deployment and ignores blank or negative input", () => {
    expect(plannedTotal([{ planned: 120 }, { planned: 40 }, { planned: 0 }, { planned: -3 }])).toBe(160);
  });

  it("rolls a factory up by machine type across platforms", () => {
    const compute = [
      { machineTypeId: "mt_a", planned: 420 },
      { machineTypeId: "mt_b", planned: 220 },
    ];
    const storage = [
      { machineTypeId: "mt_a", planned: 180 },
      { machineTypeId: "mt_b", planned: 120 },
    ];
    expect(rollupPlanned([compute, storage])).toEqual([
      { machineTypeId: "mt_a", planned: 600 },
      { machineTypeId: "mt_b", planned: 340 },
    ]);
    expect(plannedTotal(rollupPlanned([compute, storage]))).toBe(940);
  });
});
