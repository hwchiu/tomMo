"use client";

import { useSyncExternalStore } from "react";

export type NavRole = "editor" | "viewer";

const STORAGE_KEY = "fpm-nav-role";
const COOKIE = "fpm_role";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    if (part.startsWith(`${COOKIE}=`)) return decodeURIComponent(part.slice(COOKIE.length + 1));
  }
  return null;
}

function asRole(value: string | null): NavRole | null {
  if (value === "editor" || value === "viewer") return value;
  return null;
}

/** Role known without waiting for /api/v1/bootstrap. Null during static render. */
export function readNavRole(): NavRole | null {
  const fromCookie = asRole(readCookie());
  if (fromCookie) return fromCookie;
  if (typeof window === "undefined") return null;
  return asRole(window.sessionStorage.getItem(STORAGE_KEY));
}

export function rememberNavRole(role: NavRole): void {
  if (typeof window !== "undefined") window.sessionStorage.setItem(STORAGE_KEY, role);
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE}=${role}; Path=/; SameSite=Lax`;
  }
  notify();
}

export function forgetNavRole(): void {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(STORAGE_KEY);
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE}=; Path=/; Max-Age=0`;
  }
  notify();
}

export function useNavRole(): NavRole | null {
  return useSyncExternalStore(subscribe, readNavRole, () => null);
}
