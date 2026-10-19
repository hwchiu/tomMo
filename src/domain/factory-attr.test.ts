import { describe, expect, it } from "vitest";
import {
  factoryCategories,
  factoryCategoryInvalid,
  factoryCategoryLabel,
  factoryRegionInvalid,
  factoryRegionLabel,
  factoryRegions,
  normalizeFactoryCategory,
  normalizeFactoryRegion,
} from "./factory-attr";

describe("factory attributes", () => {
  it("keeps category and region fixed", () => {
    expect(factoryCategories.map((item) => item.label)).toEqual(["Giga", "Phase"]);
    expect(factoryRegions.map((item) => item.code)).toEqual(["HQ", "JP", "AZ", "EU"]);
    expect(factoryCategoryLabel("GIGA")).toBe("Giga");
    expect(factoryRegionLabel("JP")).toBe("JP");
    expect(normalizeFactoryCategory("phase")).toBe("PHASE");
    expect(normalizeFactoryRegion("eu")).toBe("EU");
    expect(() => normalizeFactoryCategory("LAB")).toThrow(factoryCategoryInvalid);
    expect(() => normalizeFactoryRegion("OVERSEA")).toThrow(factoryRegionInvalid);
  });
});
