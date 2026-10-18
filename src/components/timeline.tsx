import { phaseStatusLabel, windowReasonLabel, windowStateLabel } from "@/domain/labels";
import type { PhaseStatus } from "@/domain/types";
import type { WindowReason, WindowState } from "@/domain/windows";
import { cn } from "@/lib/cn";

export interface TimelinePhase {
  id: string;
  name: string;
  order: number;
  status: PhaseStatus;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  focus?: boolean;
}

export interface TimelineWindow {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
  state: WindowState;
  reasons: WindowReason[];
}

const bar: Record<PhaseStatus, string> = {
  NOT_STARTED: "bg-slate-300",
  IN_PROGRESS: "bg-sky-600",
  AT_RISK: "bg-amber-500",
  DELAYED: "bg-rose-600",
  COMPLETED: "bg-emerald-600",
};

export function PhaseTimeline({
  phases,
  windows,
  asOf,
}: {
  phases: TimelinePhase[];
  windows: TimelineWindow[];
  asOf: string;
}) {
  const dates = [
    asOf,
    ...phases.flatMap((phase) => [phase.plannedStart, phase.plannedEnd, phase.actualStart, phase.actualEnd].filter(Boolean) as string[]),
    ...windows.flatMap((window) => [window.start, window.end].filter(Boolean) as string[]),
  ].sort();
  const min = dates[0] ?? asOf;
  const max = dates[dates.length - 1] ?? asOf;
  const span = Math.max(Date.parse(`${max}T00:00:00Z`) - Date.parse(`${min}T00:00:00Z`), 1);
  const x = (iso: string) => ((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${min}T00:00:00Z`)) / span) * 100;
  const months = monthTicks(min, max);
  const focus = phases.find((phase) => phase.focus);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] px-1 pb-2">
        <div className="relative mb-2 h-6 border-b border-line text-[11px] text-muted">
          {months.map((month) => (
            <span key={month} className="absolute top-0 -translate-x-1/2" style={{ left: `${x(month)}%` }}>
              {month.slice(0, 7)}
            </span>
          ))}
          <span className="absolute top-0 h-6 border-l border-rose-500" style={{ left: `${x(asOf)}%` }} title={`基準日 ${asOf}`}>
            <span className="absolute left-1 top-0 whitespace-nowrap text-rose-700">基準日</span>
          </span>
        </div>
        <div className="space-y-2">
          {phases.map((phase) => (
            <div key={phase.id} className={cn("grid grid-cols-[180px_1fr] items-center gap-3 rounded-md px-1", phase.focus && "bg-teal-50/80 py-2")}>
              <div>
                <div className="text-sm font-medium">
                  {phase.order}. {phase.name.split(" ")[0]}
                </div>
                <div className="text-[11px] text-muted">{phaseStatusLabel[phase.status]}</div>
              </div>
              <div className="relative h-8">
                <Bar left={x(phase.plannedStart)} width={Math.max(x(phase.plannedEnd) - x(phase.plannedStart), 0.8)} className="top-1 h-2 border border-slate-400 bg-white" />
                {phase.actualStart ? (
                  <Bar
                    left={x(phase.actualStart)}
                    width={Math.max(x(phase.actualEnd ?? asOf) - x(phase.actualStart), 0.8)}
                    className={cn("top-4 h-2", bar[phase.status])}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {focus ? (
          <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50/50 p-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-accent-2">平台施工窗 · 疊在平台建立</h3>
              <p className="text-[11px] text-muted">
                階段 {focus.plannedStart} – {focus.plannedEnd}。各平台可平行施工，重疊不標示；只標超出或未填。
              </p>
            </div>
            <div className="relative mb-2 h-3 rounded bg-teal-100">
              <span className="absolute inset-y-0 bg-teal-300/70" style={{ left: `${x(focus.plannedStart)}%`, width: `${Math.max(x(focus.plannedEnd) - x(focus.plannedStart), 0)}%` }} />
            </div>
            <div className="space-y-1.5">
              {windows.map((window) => (
                <div key={window.id} className="grid grid-cols-[140px_1fr_auto] items-center gap-2 text-xs">
                  <span className="truncate font-medium">{window.label.replace(/ .*/, "")}</span>
                  <div className="relative h-4">
                    {window.start && window.end ? (
                      <Bar
                        left={x(window.start)}
                        width={Math.max(x(window.end) - x(window.start), 0.8)}
                        className={cn("top-0.5 h-3 rounded-sm", window.state === "OUTSIDE" ? "bg-rose-500" : "bg-accent")}
                      />
                    ) : (
                      <span className="text-[11px] text-amber-800">未填時程</span>
                    )}
                  </div>
                  <span className={cn("whitespace-nowrap", window.state === "OUTSIDE" ? "text-rose-700" : window.state === "MISSING" ? "text-amber-800" : "text-emerald-800")}>
                    {window.state === "OUTSIDE"
                      ? window.reasons.map((reason) => windowReasonLabel[reason]).join("、")
                      : windowStateLabel[window.state]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1"><i className="h-2 w-6 border border-slate-400 bg-white" /> 計畫</span>
          <span className="inline-flex items-center gap-1"><i className="h-2 w-6 bg-sky-600" /> 實際</span>
          <span className="inline-flex items-center gap-1"><i className="h-2 w-6 bg-accent" /> 施工窗</span>
          <span className="inline-flex items-center gap-1"><i className="h-2 w-6 bg-rose-500" /> 超出平台建立</span>
        </div>
      </div>
    </div>
  );
}

function Bar({ left, width, className }: { left: number; width: number; className: string }) {
  return <span className={cn("absolute rounded-full", className)} style={{ left: `${left}%`, width: `${width}%` }} />;
}

function monthTicks(min: string, max: string): string[] {
  const ticks: string[] = [];
  let year = Number(min.slice(0, 4));
  let month = Number(min.slice(5, 7));
  const endYear = Number(max.slice(0, 4));
  const endMonth = Number(max.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    ticks.push(`${year}-${String(month).padStart(2, "0")}-01`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return ticks.filter((_, index) => index % 2 === 0);
}
