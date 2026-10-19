import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCapabilities, buildProductBuild } from "@/api/views";
import { buildSeed } from "@/mocks/fixtures";
import {
  monthBounds,
  overlaps,
  parseSchedule,
  scheduleDateInvalid,
  scheduleMonthInvalid,
  scheduleOrderInvalid,
} from "./schedule";

interface ScheduleCase {
  name: string;
  start: string;
  end: string;
  from: string;
  to: string;
  overlap: boolean;
}

const cases = JSON.parse(readFileSync(new URL("../../testdata/schedule-cases.json", import.meta.url), "utf8")) as ScheduleCase[];

describe("schedule overlap", () => {
  it.each(cases)("$name", (item) => {
    expect(overlaps(item.start, item.end, item.from, item.to)).toBe(item.overlap);
  });

  it("parses a month and rejects a reversed range", () => {
    expect(parseSchedule("2026-10", "", "")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthBounds("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(() => parseSchedule("2026-13", "", "")).toThrow(scheduleMonthInvalid);
    expect(() => parseSchedule("", "2026/10/01", "")).toThrow(scheduleDateInvalid);
    expect(() => parseSchedule("", "2026-11-01", "2026-10-01")).toThrow(scheduleOrderInvalid);
    expect(parseSchedule("2026-01", "2026-10-01", "2026-10-31")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("keeps October factories that have work in the demo", () => {
    const schedule = parseSchedule("2026-10", "", "");
    const db = buildSeed();
    const matrix = buildProductBuild(db, schedule);
    const names = matrix.rows.map((row) => row.factoryName);
    expect(names).toEqual(expect.arrayContaining(["新竹一廠", "台中二廠", "高雄三廠", "熊本一廠"]));
    expect(names).not.toEqual(expect.arrayContaining(["新竹二廠", "台南二廠"]));
    const kaohsiung = matrix.rows.find((row) => row.factoryName === "高雄三廠");
    const storage = db.products.find((product) => product.name === "儲存產品 Storage");
    const compute = db.products.find((product) => product.name === "運算產品 Compute");
    expect(kaohsiung?.cells.find((cell) => cell.productId === storage?.id)?.inSchedule).toBe(true);
    expect(kaohsiung?.cells.find((cell) => cell.productId === compute?.id)?.inSchedule).toBe(false);
    const versions = buildCapabilities(db, schedule);
    expect(versions.rows.some((row) => row.factoryName === "新竹二廠")).toBe(false);
    expect(versions.rows.some((row) => row.factoryName === "新竹一廠")).toBe(true);
    expect(versions.factories).toHaveLength(db.factories.length);
  });
});
