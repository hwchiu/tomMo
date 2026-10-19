export const productAudiences = [
  { code: "EXTERNAL", label: "對外" },
  { code: "INTERNAL", label: "對內" },
] as const;

export type ProductAudience = (typeof productAudiences)[number]["code"];

export const audienceInvalid = "可見範圍只能是對外或對內";

/** Issue product choice that is not a configured product. */
export const issueProductOther = "other";

export function audienceLabel(code: string): string {
  return code === "INTERNAL" ? "對內" : "對外";
}

export function normalizeAudience(raw: string): ProductAudience {
  const key = raw.trim();
  if (key === "" || key.toUpperCase() === "EXTERNAL" || key === "對外") return "EXTERNAL";
  if (key.toUpperCase() === "INTERNAL" || key === "對內") return "INTERNAL";
  throw new Error(audienceInvalid);
}

export function audienceFilter(value: string | null): "" | ProductAudience {
  if (value === "EXTERNAL" || value === "INTERNAL") return value;
  return "";
}
