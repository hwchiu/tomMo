export type FaultMode = "ok" | "slow" | "error";

const FAULT_KEY = "fpm-fault";

const PM_ID = "u_lin";
let actorId = PM_ID;
let fault: FaultMode = "ok";
let hydrated = false;
const faultListeners = new Set<() => void>();

export function subscribeFault(listener: () => void): () => void {
  faultListeners.add(listener);
  return () => faultListeners.delete(listener);
}

export function hydrateSession(): void {
  if (hydrated || typeof window === "undefined") return;
  actorId = PM_ID;
  const stored = window.sessionStorage.getItem(FAULT_KEY);
  if (stored === "slow" || stored === "error" || stored === "ok") fault = stored;
  hydrated = true;
}

export function getActorId(): string {
  hydrateSession();
  return actorId;
}

export function setActorId(): void {
  hydrateSession();
  actorId = PM_ID;
}

export function getFault(): FaultMode {
  hydrateSession();
  return fault;
}

export function setFault(next: FaultMode): void {
  hydrateSession();
  fault = next;
  if (typeof window !== "undefined") window.sessionStorage.setItem(FAULT_KEY, next);
  faultListeners.forEach((listener) => listener());
}

export function getFaultServer(): FaultMode {
  return "ok";
}
