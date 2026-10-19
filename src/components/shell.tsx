"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { api, useMock } from "@/api";
import { getAuth, getFault, getFaultServer, loginDemo, logoutDemo, subscribeFault, type FaultMode } from "@/api/session";
import type { Bootstrap } from "@/api/types";
import { accountRoleLabel } from "@/domain/labels";
import { cn } from "@/lib/cn";
import { useLiveQuery } from "@/lib/use-live-query";
import { invalidate } from "@/api/live";

const AppContext = createContext<Bootstrap | null>(null);

export function useApp(): Bootstrap | null {
  return useContext(AppContext);
}

export function useEditor(): boolean {
  return useApp()?.role === "editor";
}

export function WhenEditor({ children }: { children: ReactNode }) {
  if (!useEditor()) return null;
  return <>{children}</>;
}

const NAV = [
  { href: "/", label: "總覽", en: "Portfolio" },
  { href: "/product-build", label: "產品交付狀況", en: "Delivery", focus: true },
  { href: "/factories", label: "工廠簡介", en: "Factory" },
  { href: "/issues", label: "問題", en: "Issue" },
  { href: "/products", label: "產品", en: "Product" },
  { href: "/admin", label: "管理", en: "Admin" },
];

function active(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isLoginPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const login = isLoginPath(pathname);
  const boot = useLiveQuery(login ? "bootstrap:idle" : "bootstrap", () => {
    if (login) return Promise.resolve(null as unknown as Bootstrap);
    if (useMock && !getAuth()) return Promise.reject(new Error("請先登入"));
    return api.bootstrap();
  });
  const [toast, setToast] = useState<string | null>(null);
  const fault = useSyncExternalStore(subscribeFault, getFault, getFaultServer);
  const editor = boot.data?.role === "editor";

  useEffect(() => {
    if (login) return;
    if (useMock && !getAuth()) router.replace("/login");
  }, [login, pathname, router]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setToast(detail);
      window.setTimeout(() => setToast(null), 2800);
    };
    window.addEventListener("fpm-toast", onToast);
    return () => window.removeEventListener("fpm-toast", onToast);
  }, []);

  if (login) {
    return (
      <div className="min-h-screen bg-slate-100">
        {children}
        {toast ? <Toast message={toast} /> : null}
      </div>
    );
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* session may already be gone */
    }
    logoutDemo();
    invalidate();
    router.replace("/login");
  }

  const nav = NAV.filter((item) => editor || item.href !== "/admin");

  return (
    <AppContext.Provider value={boot.data}>
      <div className="min-h-screen md:pl-[228px]">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[228px] flex-col bg-ink text-slate-200 md:flex">
          <Brand />
          <nav className="flex flex-1 flex-col gap-0.5 px-3">
            {nav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>
          <p className="px-4 pb-4 text-[11px] leading-5 text-slate-400">
            基準日 {boot.data?.asOf ?? "—"}
            {useMock ? " · 修改存在這個瀏覽器" : " · 已連線協調服務"}
          </p>
        </aside>
        <div className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 md:px-6">
            <div className="md:hidden">
              <Brand compact />
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {useMock ? (
                <label className="flex items-center gap-1 text-xs text-muted">
                  連線預覽
                  <select
                    className="h-8 rounded-md border border-line bg-white px-2 text-xs"
                    value={fault}
                    onChange={(event) => {
                      api.setFault(event.target.value as FaultMode);
                    }}
                  >
                    <option value="ok">正常</option>
                    <option value="slow">慢速</option>
                    <option value="error">失敗</option>
                  </select>
                </label>
              ) : null}
              {boot.data ? (
                <span className="text-xs text-muted">
                  {boot.data.actor.name} · {accountRoleLabel[boot.data.role]}
                </span>
              ) : null}
              {editor ? (
                <button
                  type="button"
                  className="h-8 rounded-md border border-line px-2 text-xs"
                  onClick={() => {
                    void api.resetDemo();
                  }}
                >
                  重設示範資料
                </button>
              ) : null}
              <button type="button" className="h-8 rounded-md border border-line px-2 text-xs" onClick={() => void logout()}>
                登出
              </button>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs",
                  active(pathname, item.href) ? "bg-ink text-white" : "bg-slate-100 text-ink",
                  item.focus && !active(pathname, item.href) && "ring-1 ring-accent/40",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        {boot.error && boot.error !== "請先登入" ? (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-900 md:px-6">
            {boot.error}
            {useMock ? (
              <button type="button" className="ml-3 underline" onClick={() => api.setFault("ok")}>
                改回正常連線
              </button>
            ) : null}
          </div>
        ) : null}
        <main className="px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
      {toast ? <Toast message={toast} /> : null}
    </AppContext.Provider>
  );
}

function Toast({ message }: { message: string }) {
  return <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">{message}</div>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", compact ? "" : "px-4 py-4")}>
      <span className="grid grid-cols-4 gap-0.5" aria-hidden>
        <i className={cn("h-2 w-2 rounded-[2px]", compact ? "bg-slate-300" : "bg-white/30")} />
        <i className="h-2 w-2 rounded-[2px] bg-teal-300" />
        <i className={cn("h-2 w-2 rounded-[2px]", compact ? "bg-slate-300" : "bg-white/30")} />
        <i className={cn("h-2 w-2 rounded-[2px]", compact ? "bg-slate-300" : "bg-white/30")} />
      </span>
      <span>
        <span className={cn("block text-sm font-semibold", compact ? "text-ink" : "text-white")}>廠務協調台</span>
        {compact ? null : <span className="block text-[11px] text-slate-400">Factory coordination</span>}
      </span>
    </Link>
  );
}

function NavLink({ item, pathname }: { item: (typeof NAV)[number]; pathname: string }) {
  const on = active(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        on ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5",
        item.focus && "mt-1",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span>{item.label}</span>
        <span className="font-mono text-[10px] text-slate-500">{item.en}</span>
      </span>
    </Link>
  );
}

export async function signIn(username: string, password: string): Promise<void> {
  if (useMock) loginDemo(username, password);
  await api.login({ username, password });
  invalidate();
}
