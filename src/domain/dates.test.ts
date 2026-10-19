import { describe, expect, it } from "vitest";
import { addDays, isIsoDate } from "./dates";

describe("dates", () => {
  it("accepts calendar dates and rolls the month", () => {
    expect(isIsoDate("2026-10-18")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("18/10/2026")).toBe(false);
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });
});
