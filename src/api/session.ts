import { getDb } from "@/api/store";

export type FaultMode = "ok" | "slow" | "error";
export type AccountRole = "editor" | "viewer";

const FAULT_KEY = "fpm-fault";
const AUTH_KEY = "fpm-auth";

export interface SessionAuth {
  username: string;
  role: AccountRole;
  personId: string;
}

/**
 * Static GitHub Pages demo. Usernames map to directory people; no password is
 * stored in source. Any non-empty password is accepted so the login form still
 * works without embedding demo credentials.
 */
const DEMO_ACCOUNTS: Array<{ username: string; role: AccountRole; personName: string }> = [
  { username: "admin", role: "editor", personName: "林品均" },
  { username: "viewer", role: "viewer", personName: "陳浩宇" },
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
      const parsed = JSON.parse(raw) as SessionAuth;
      const known = getDb().people.some((item) => item.id === parsed.personId);
      auth = known ? parsed : null;
      if (!known) window.sessionStorage.removeItem(AUTH_KEY);
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
  if (password.trim() === "") throw new Error("帳號或密碼不正確");
  const found = DEMO_ACCOUNTS.find((account) => account.username === username);
  if (!found) throw new Error("帳號或密碼不正確");
  const person = getDb().people.find((item) => item.name === found.personName);
  if (!person) throw new Error(`找不到人員「${found.personName}」`);
  auth = { username: found.username, role: found.role, personId: person.id };
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
