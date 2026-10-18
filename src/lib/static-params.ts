import type { Database } from "@/domain/types";
import { buildSeed } from "@/mocks/fixtures";

function seed(): Database {
  return buildSeed();
}

export function factoryParams(): Array<{ id: string }> {
  return seed().factories.map((factory) => ({ id: factory.id }));
}

export function phaseParams(): Array<{ id: string; phaseId: string }> {
  return seed().phases.map((phase) => ({ id: phase.factoryId, phaseId: phase.id }));
}

export function planParams(): Array<{ id: string; platformId: string }> {
  const db = seed();
  return db.factories.flatMap((factory) => db.platforms.map((platform) => ({ id: factory.id, platformId: platform.id })));
}

export function deploymentParams(): Array<{ id: string }> {
  return seed().deployments.map((deployment) => ({ id: deployment.id }));
}

export function platformParams(): Array<{ id: string }> {
  return seed().platforms.map((platform) => ({ id: platform.id }));
}

export function issueParams(): Array<{ id: string }> {
  return seed().issues.map((issue) => ({ id: issue.id }));
}
