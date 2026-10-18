export type FaultMode = "ok" | "slow" | "error";
export type AccountRole = "editor" | "viewer";

const FAULT_KEY = "fpm-fault";
const AUTH_KEY = "fpm-auth";

export interface SessionAuth {
  username: string;
  role: AccountRole;
  personId: string;
}

/** Demo accounts for the static mock. The Go server uses bcrypt instead. */
export const DEMO_ACCOUNTS: Array<SessionAuth & { password: string }> = [
  { username: "admin", password: "admin", role: "editor", personId: "u_lin" },
  { username: "viewer", password: "viewer", role: "viewer", personId: "u_chen" },
];

let auth: SessionAuth | null = null;
let fault: FaultMode = "ok";
let hydrated = false;
const faultListeners = new Set<() => void>();

export function subscribeFault(listener: () => void): () => void {
  faultListeners.add(listener);
  return () => faultListeners.delete(listener);
}

export function hydrateSession(): void {
  if (hydrated || typeof window === "undefined") return;
  const raw = window.sessionStorage.getItem(AUTH_KEY);
  if (raw) {
    try {
      auth = JSON.parse(raw) as SessionAuth;
    } catch {
      auth = null;
    }
  }
  const stored = window.sessionStorage.getItem(FAULT_KEY);
  if (stored === "slow" || stored === "error" || stored === "ok") fault = stored;
  hydrated = true;
}

export function getAuth(): SessionAuth | null {
  hydrateSession();
  return auth;
}

export function getActorId(): string {
  return getAuth()?.personId ?? "";
}

export function loginDemo(username: string, password: string): SessionAuth {
  hydrateSession();
  const found = DEMO_ACCOUNTS.find((account) => account.username === username && account.password === password);
  if (!found) throw new Error("帳號或密碼不正確");
  auth = { username: found.username, role: found.role, personId: found.personId };
  if (typeof window !== "undefined") window.sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  return auth;
}

export function logoutDemo(): void {
  hydrateSession();
  auth = null;
  if (typeof window !== "undefined") window.sessionStorage.removeItem(AUTH_KEY);
}

export function setActorId(): void {
  hydrateSession();
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
