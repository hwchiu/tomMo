"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { invalidate } from "@/api/live";
import { cn } from "@/lib/cn";
import type { QueryState } from "@/lib/use-live-query";

export const controlClass =
  "h-9 w-full rounded-md border border-line bg-white px-2 text-sm text-ink outline-none focus:border-accent";

export function Button({
  children,
  tone = "primary",
  type = "button",
  disabled,
  onClick,
  className,
}: {
  children: ReactNode;
  tone?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const tones = {
    primary: "bg-accent text-white hover:bg-accent-2",
    secondary: "border border-line bg-white hover:bg-slate-50",
    ghost: "hover:bg-white/70",
    danger: "bg-danger text-white hover:opacity-90",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn("inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium disabled:opacity-50", tones[tone], className)}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Panel({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-28 rounded-xl border border-line bg-panel", className)}>
      {children}
    </section>
  );
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker ? <p className="text-xs font-medium tracking-wide text-accent">{kicker}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-3 grid h-10 w-16 grid-cols-4 gap-1" aria-hidden>
        <span className="rounded-sm bg-slate-200" />
        <span className="rounded-sm bg-accent/70" />
        <span className="rounded-sm bg-slate-200" />
        <span className="rounded-sm bg-slate-200" />
      </div>
      <h2 className="font-medium">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, inline = false }: { message: string; inline?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900", inline ? "mb-3" : "px-6 py-8")}>
      <p className="font-medium">資料沒有讀回來</p>
      <p className="mt-1">{message}</p>
      <button type="button" className="mt-3 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-ink" onClick={() => invalidate()}>
        重試
      </button>
    </div>
  );
}

export function AsyncView<T>({
  state,
  skeleton,
  children,
  allowEmpty = false,
}: {
  state: QueryState<T>;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
  allowEmpty?: boolean;
}) {
  if (state.data == null && state.loading) return <>{skeleton}</>;
  if (state.data == null && state.error) return <ErrorState message={state.error} />;
  if (state.data == null && !allowEmpty) return null;
  const data = state.data as T;
  return (
    <div aria-busy={state.loading}>
      {state.loading ? <div className="mb-3 h-1 overflow-hidden rounded bg-slate-200"><div className="h-full w-1/3 animate-pulse bg-accent" /></div> : null}
      {state.error ? <ErrorState message={state.error} inline /> : null}
      {children(data)}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/80", className)} />;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-accent hover:underline">
      {children}
    </Link>
  );
}
