"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DeploymentForm, FactoryForm, PhaseForm } from "@/components/entity-forms";
import { FactoryView } from "@/components/factory-view";
import { HandoffDetail } from "@/components/handoff-views";
import { IssueDetail } from "@/components/issue-views";
import { PlanForm } from "@/components/plan-form";
import { PlatformDetailView, PlatformEditor } from "@/components/platform-views";
import { basePath } from "@/lib/base-path";

function browserPath(): string {
  let path = window.location.pathname;
  if (path === basePath || path.startsWith(`${basePath}/`)) path = path.slice(basePath.length) || "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
}

/** Render a record page that was not in the static export, such as one created in this browser. */
export function StaticFallback() {
  const hint = usePathname();
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setPath(browserPath()), 0);
    return () => window.clearTimeout(timer);
  }, [hint]);
  if (!path) return <p className="text-sm text-muted">載入這個頁面…</p>;
  const view = match(path);
  if (view) return view;
  return (
    <div className="rounded-xl border border-line bg-panel p-8">
      <h1 className="text-lg font-semibold">找不到這個頁面</h1>
      <p className="mt-2 text-sm text-muted">{path}</p>
      <Link href="/" className="mt-4 inline-block text-sm text-accent">回到總覽</Link>
    </div>
  );
}

function match(path: string) {
  const factory = path.match(/^\/factories\/([^/]+)$/);
  if (factory) return <FactoryView id={decodeURIComponent(factory[1])} />;
  const edit = path.match(/^\/factories\/([^/]+)\/edit$/);
  if (edit) return <FactoryForm id={decodeURIComponent(edit[1])} />;
  const newPhase = path.match(/^\/factories\/([^/]+)\/phases\/new$/);
  if (newPhase) return <PhaseForm factoryId={decodeURIComponent(newPhase[1])} />;
  const phase = path.match(/^\/factories\/([^/]+)\/phases\/([^/]+)$/);
  if (phase) return <PhaseForm factoryId={decodeURIComponent(phase[1])} phaseId={decodeURIComponent(phase[2])} />;
  const plan = path.match(/^\/factories\/([^/]+)\/plans\/([^/]+)$/);
  if (plan) return <PlanForm factoryId={decodeURIComponent(plan[1])} platformId={decodeURIComponent(plan[2])} />;
  const deployment = path.match(/^\/deployments\/([^/]+)$/);
  if (deployment) return <DeploymentForm id={decodeURIComponent(deployment[1])} />;
  const handoff = path.match(/^\/handoffs\/([^/]+)$/);
  if (handoff) return <HandoffDetail id={decodeURIComponent(handoff[1])} />;
  const platformEdit = path.match(/^\/platforms\/([^/]+)\/edit$/);
  if (platformEdit) return <PlatformEditor id={decodeURIComponent(platformEdit[1])} />;
  const platform = path.match(/^\/platforms\/([^/]+)$/);
  if (platform) return <PlatformDetailView id={decodeURIComponent(platform[1])} />;
  const issue = path.match(/^\/issues\/([^/]+)$/);
  if (issue) return <IssueDetail id={decodeURIComponent(issue[1])} />;
  return null;
}
