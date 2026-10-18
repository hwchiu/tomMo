import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildSeed } from "@/mocks/fixtures";

const seed = buildSeed();

if (process.env.EXPORT_SEED) {
  writeFileSync(process.env.EXPORT_SEED, JSON.stringify(seed));
}

describe("demo seed", () => {
  it("is deterministic", () => {
    expect(JSON.stringify(buildSeed())).toBe(JSON.stringify(buildSeed()));
  });

  it("covers factories, products, people, and machine types", () => {
    expect(seed.factories).toHaveLength(12);
    expect(seed.people).toHaveLength(25);
    expect(seed.products).toHaveLength(7);
    expect(seed.machineTypes.map((item) => item.name)).toEqual(["機種A", "機種B", "機種C", "機種D"]);
    expect(seed.products.filter((item) => item.mode === "VERSIONED").length).toBeGreaterThanOrEqual(3);
    expect(seed.products.filter((item) => item.mode === "FEATURE_ONLY").length).toBeGreaterThanOrEqual(4);
    expect(seed.people.some((person) => person.source === "external" && person.externalId === "emp-2048")).toBe(true);
    expect(new Set(seed.factories.map((factory) => factory.status))).toEqual(new Set(["ON_TRACK", "AT_RISK", "DELAYED", "COMPLETED"]));
    expect(new Set(seed.factories.map((factory) => factory.category))).toEqual(new Set(["GIGA", "PHASE"]));
    expect(new Set(seed.factories.map((factory) => factory.region))).toEqual(new Set(["HQ", "OVERSEA"]));
    expect(new Set(seed.factories.map((factory) => factory.technology))).toEqual(new Set(["N3", "N2"]));
  });

  it("gives every factory products, topics, and machine totals", () => {
    for (const factory of seed.factories) {
      expect(seed.topics.filter((topic) => topic.factoryId === factory.id).length).toBeGreaterThanOrEqual(1);
      for (const product of seed.products) {
        const deployment = seed.deployments.find((item) => item.factoryId === factory.id && item.productId === product.id);
        expect(deployment, `${factory.id} ${product.id}`).toBeTruthy();
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
    const hscStorage = seed.plans.find((plan) => plan.factoryId === "f_hsc" && plan.productId === "plt_storage");
    expect(hscStorage?.status).toBe("SUBMITTED");
    const compute = seed.deployments.find((item) => item.id === "dep_f_hsc_plt_compute");
    const quantities = seed.machineQuantities.filter((row) => row.deploymentId === compute?.id);
    expect(quantities.map((row) => row.planned)).toEqual([320, 160, 96, 64]);
  });

  it("spreads issue severity and status", () => {
    expect(new Set(seed.issues.map((issue) => issue.severity))).toEqual(new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]));
    expect(new Set(seed.issues.map((issue) => issue.status))).toEqual(new Set(["OPEN", "IN_PROGRESS", "BLOCKED", "RESOLVED", "CLOSED"]));
    expect(seed.issues.length).toBeGreaterThanOrEqual(20);
  });
});
