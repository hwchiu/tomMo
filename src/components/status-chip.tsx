import {
  deploymentStatusLabel,
  factoryStatusLabel,
  handoffStatusLabel,
  issueStatusLabel,
  phaseStatusLabel,
  planStatusLabel,
  severityLabel,
} from "@/domain/labels";
import { cn } from "@/lib/cn";

const toneClass = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

type Tone = keyof typeof toneClass;

function toneFor(kind: string, value: string): Tone {
  if (value === "ON_TRACK" || value === "COMPLETED" || value === "ACCEPTED" || value === "APPROVED" || value === "RESOLVED" || value === "CLOSED") return "ok";
  if (value === "AT_RISK" || value === "SUBMITTED" || value === "PENDING_ACCEPTANCE" || value === "PROPOSED" || value === "MEDIUM" || value === "IN_PROGRESS") return value === "IN_PROGRESS" ? "info" : "warn";
  if (value === "DELAYED" || value === "BLOCKED" || value === "REJECTED" || value === "CRITICAL" || value === "HIGH" || value === "NOT_SUBMITTED") return value === "NOT_SUBMITTED" || value === "HIGH" ? "warn" : "danger";
  if (value === "PLANNED" || value === "NOT_STARTED" || value === "WORK_DONE" || value === "LOW" || value === "OPEN") return "neutral";
  if (kind === "severity" && value === "HIGH") return "warn";
  return "neutral";
}

const dictionaries: Record<string, Record<string, string>> = {
  factory: factoryStatusLabel,
  phase: phaseStatusLabel,
  handoff: handoffStatusLabel,
  plan: planStatusLabel,
  deployment: deploymentStatusLabel,
  issue: issueStatusLabel,
  severity: severityLabel,
};

export function StatusChip({ kind, value }: { kind: keyof typeof dictionaries; value: string }) {
  const label = dictionaries[kind][value] ?? value;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4", toneClass[toneFor(kind, value)])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function MetaChip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-line bg-white px-2 py-0.5 text-[11px] text-muted">{children}</span>;
}
