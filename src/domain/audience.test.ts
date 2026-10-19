import { describe, expect, it } from "vitest";
import { audienceInvalid, audienceLabel, normalizeAudience, productAudiences } from "./audience";

describe("product audience", () => {
  it("keeps 對外 and 對內", () => {
    expect(productAudiences.map((item) => item.label)).toEqual(["對外", "對內"]);
    expect(audienceLabel("EXTERNAL")).toBe("對外");
    expect(audienceLabel("INTERNAL")).toBe("對內");
    expect(normalizeAudience("")).toBe("EXTERNAL");
    expect(normalizeAudience("對內")).toBe("INTERNAL");
    expect(() => normalizeAudience("公開")).toThrow(audienceInvalid);
  });
});