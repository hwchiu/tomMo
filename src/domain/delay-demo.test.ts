import { describe, expect, it } from "vitest";

import { buildProductBuild } from "@/api/views";
import { delayCatalog } from "@/domain/delay";
import { buildSeed } from "@/mocks/fixtures";

describe("demo delay reasons", () => {
  it("exercises every reason code", () => {
    const matrix = buildProductBuild(buildSeed());
    const seen = new Set<string>();
    for (const row of matrix.rows) {
      expect(row.reasonCounts).toEqual(expect.any(Array));
      expect(row.lateCount + row.gapCount).toBeLessThanOrEqual(row.cells.length);
      for (const cell of row.cells) {
        for (const reason of cell.reasons) {
          seen.add(reason.code);
          expect(reason.ownerPersonId).toBeTruthy();
          expect(reason.ownerName).not.toBe("—");
        }
      }
    }
    expect([...seen].sort()).toEqual(delayCatalog.map((item) => item.code).sort());
    const hsinchu = matrix.rows.find((row) => row.factoryName === "新竹一廠");
    const developer = hsinchu?.cells.find((cell) => cell.reasons.some((reason) => reason.code === "PLAN_NOT_SUBMITTED"));
    expect(developer?.reasons.some((reason) => reason.kind === "late" && reason.label === "施工計畫未提交")).toBe(true);
  });
});
