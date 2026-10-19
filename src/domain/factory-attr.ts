export const factoryCategories = [
  { code: "GIGA", label: "Giga" },
  { code: "PHASE", label: "Phase" },
] as const;

export const factoryRegions = [
  { code: "HQ", label: "HQ" },
  { code: "JP", label: "JP" },
  { code: "AZ", label: "AZ" },
  { code: "EU", label: "EU" },
] as const;

export type FactoryCategoryCode = (typeof factoryCategories)[number]["code"];
export type FactoryRegionCode = (typeof factoryRegions)[number]["code"];

export const factoryCategoryInvalid = "類別只能是 Giga 或 Phase";
export const factoryRegionInvalid = "區域只能是 HQ、JP、AZ、EU";

export function factoryCategoryLabel(code: string): string {
  return factoryCategories.find((item) => item.code === code)?.label ?? code;
}

export function factoryRegionLabel(code: string): string {
  return factoryRegions.find((item) => item.code === code)?.label ?? code;
}

export function normalizeFactoryCategory(raw: string): string {
  const trimmed = raw.trim();
  const key = trimmed.toUpperCase();
  const found = factoryCategories.find((item) => item.code === key || item.label.toLowerCase() === trimmed.toLowerCase());
  if (!found) throw new Error(factoryCategoryInvalid);
  return found.code;
}

export function normalizeFactoryRegion(raw: string): string {
  const key = raw.trim().toUpperCase();
  const found = factoryRegions.find((item) => item.code === key);
  if (!found) throw new Error(factoryRegionInvalid);
  return found.code;
}
