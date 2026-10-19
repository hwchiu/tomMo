import { describe, expect, it } from "vitest";
import { compareSemver, parseSemver } from "./semver";

describe("semver", () => {
  it("parses a leading v and missing parts", () => {
    expect(parseSemver("2.10.0")).toEqual([2, 10, 0]);
    expect(parseSemver("v2.3")).toEqual([2, 3, 0]);
    expect(parseSemver("V1")).toEqual([1, 0, 0]);
    expect(parseSemver(" 2.0.1 ")).toEqual([2, 0, 1]);
    expect(parseSemver("")).toBeNull();
    expect(parseSemver("latest")).toBeNull();
    expect(parseSemver("1.2.3.4")).toBeNull();
  });

  it("orders 2.10 ahead of 2.3 and rejects invalid input", () => {
    expect(compareSemver("2.10.0", "2.3.0")).toBeGreaterThan(0);
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemver("nope", "1.0.0")).toBeNull();
  });
});
