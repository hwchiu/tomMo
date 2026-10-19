import { describe, expect, it } from "vitest";

import { buildSeed } from "@/mocks/fixtures";

const seed = buildSeed();

describe("demo seed", () => {
  it("is deterministic", () => {
    expect(JSON.stringify(buildSeed())).toBe(JSON.stringify(buildSeed()));
  });

  it("covers factories, products, people, and machine types", () => {
    expect(seed.factories).toHaveLength(12);
    expect(seed.people).toHaveLength(25);
    expect(seed.products).toHaveLength(7);
    expect(seed.machineTypes.map((item) => item.name)).toEqual(["EIA-1", "EIA-2", "EIA-3", "EIA-4"]);
    expect(seed.products.filter((item) => item.mode === "VERSIONED").length).toBeGreaterThanOrEqual(3);
    expect(seed.products.filter((item) => item.mode === "FEATURE_ONLY").length).toBeGreaterThanOrEqual(4);
    expect(seed.people.some((person) => person.source === "external" && person.externalId === "emp-2048")).toBe(true);
    expect(new Set(seed.factories.map((factory) => factory.status))).toEqual(new Set(["ON_TRACK", "AT_RISK", "DELAYED", "COMPLETED"]));
    expect(new Set(seed.factories.map((factory) => factory.category))).toEqual(new Set(["GIGA", "PHASE"]));
    expect(new Set(seed.factories.map((factory) => factory.region))).toEqual(new Set(["HQ", "OVERSEA"]));
    expect(new Set(seed.factories.map((factory) => factory.technology))).toEqual(new Set(["N3", "N2"]));
  });

  it("gives every factory products, topics, and machine totals", () => {
    const hsc = seed.factories.find((factory) => factory.name === "新竹一廠");
    const storage = seed.products.find((product) => product.name === "儲存產品 Storage");
    const computeProduct = seed.products.find((product) => product.name === "運算產品 Compute");
    expect(hsc).toBeTruthy();
    expect(storage).toBeTruthy();
    expect(computeProduct).toBeTruthy();
    for (const factory of seed.factories) {
      expect(seed.topics.filter((topic) => topic.factoryId === factory.id).length).toBeGreaterThanOrEqual(1);
      for (const product of seed.products) {
        const deployment = seed.deployments.find((item) => item.factoryId === factory.id && item.productId === product.id);
        expect(deployment, `${factory.name} ${product.name}`).toBeTruthy();
        const planned = seed.machineQuantities
          .filter((row) => row.deploymentId === deployment?.id)
          .reduce((sum, row) => sum + row.planned, 0);
        expect(planned).toBeGreaterThan(0);
        expect(seed.plans.some((plan) => plan.factoryId === factory.id && plan.productId === product.id)).toBe(true);
      }
      const plans = seed.plans.filter((plan) => plan.factoryId === factory.id);
      const adhoc = plans.reduce((sum, plan) => sum + plan.adHocChanges.length, 0);
      expect(adhoc).toBeGreaterThanOrEqual(2);
      expect(plans.some((plan) => plan.adHocChanges.some((change) => change.kind === "FEATURE_OVERRIDE"))).toBe(true);
    }
    const hscStorage = seed.plans.find((plan) => plan.factoryId === hsc?.id && plan.productId === storage?.id);
    expect(hscStorage?.status).toBe("SUBMITTED");
    const compute = seed.deployments.find((item) => item.factoryId === hsc?.id && item.productId === computeProduct?.id);
    const quantities = seed.machineQuantities.filter((row) => row.deploymentId === compute?.id);
    expect(quantities.reduce((sum, row) => sum + row.planned, 0)).toBe(640);
  });

  it("spreads issue severity and status", () => {
    expect(new Set(seed.issues.map((issue) => issue.severity))).toEqual(new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]));
    expect(new Set(seed.issues.map((issue) => issue.status))).toEqual(new Set(["OPEN", "IN_PROGRESS", "BLOCKED", "RESOLVED", "CLOSED"]));
    expect(seed.issues.length).toBeGreaterThanOrEqual(20);
  });
});
