import type { ReactNode } from "react";
import Link from "next/link";
import { addDays, dayDiff, shortDate } from "@/domain/dates";
import { phaseStatusLabel, windowReasonLabel } from "@/domain/labels";
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
  milestones?: TimelineMilestone[];
}

export interface TimelineMilestone {
  id: string;
  name: string;
  dueDate: string;
  done: boolean;
  overdue: boolean;
}

export interface TimelineWindow {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
  state: WindowState;
  reasons: WindowReason[];
}

export interface PortfolioTimelineFactory {
  id: string;
  code: string;
  name: string;
  status: string;
  pmName: string;
  pmDepartment: string;
  openTopics: number;
  phases: Array<{
    id: string;
    name: string;
    order: number;
    status: PhaseStatus;
    plannedStart: string;
    plannedEnd: string;
    actualStart: string | null;
    actualEnd: string | null;
  }>;
}

const WEEK_PX = 52;
const MONTH_PX = 112;
const LABEL_PX = 248;

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
    ...phases.flatMap((phase) => [phase.plannedStart, phase.plannedEnd, phase.actualStart, phase.actualEnd, ...(phase.milestones ?? []).map((item) => item.dueDate)].filter(Boolean) as string[]),
    ...windows.flatMap((window) => [window.start, window.end].filter(Boolean) as string[]),
  ];
  const scale = makeScale(dates);
  const focus = phases.find((phase) => phase.focus);

  return (
    <div data-timeline="factory">
      <Gantt
        scale={scale}
        asOf={asOf}
        axis="week"
        labelWidth={LABEL_PX}
        corner="階段"
        rows={phases.flatMap((phase) => {
          const late = slipped(phase, asOf);
          const rows: GanttRow[] = [
            {
              key: phase.id,
              height: 72,
              label: (
                <Label
                  title={`${phase.order}. ${chineseName(phase.name)}`}
                  subtitle={phase.name.includes(" ") ? phase.name.split(" ").slice(1).join(" ") : phaseStatusLabel[phase.status]}
                  meta={`${shortDate(phase.plannedStart)} – ${shortDate(phase.plannedEnd)}`}
                  alert={late ? "延遲" : undefined}
                />
              ),
              content: (
                <>
                  <RangeBar
                    scale={scale}
                    start={phase.plannedStart}
                    end={phase.plannedEnd}
                    top={8}
                    height={26}
                    className="border-2 border-slate-700 bg-white text-slate-800"
                    label={`${chineseName(phase.name)}  ${shortDate(phase.plannedStart)}–${shortDate(phase.plannedEnd)}`}
                  />
                  {phase.actualStart ? (
                    <RangeBar
                      scale={scale}
                      start={phase.actualStart}
                      end={phase.actualEnd ?? asOf}
                      top={40}
                      height={22}
                      className={cn("text-white", late ? "bg-rose-600" : actualFill(phase.status))}
                      label={`實際 ${shortDate(phase.actualStart)}–${phase.actualEnd ? shortDate(phase.actualEnd) : "進行中"}`}
                    />
                  ) : null}
                </>
              ),
            },
          ];
          for (const milestone of phase.milestones ?? []) {
            rows.push({
              key: milestone.id,
              height: 36,
              label: <span className="pl-4 text-sm text-muted">里程碑</span>,
              content: <MilestoneMark scale={scale} milestone={milestone} />,
            });
          }
          if (phase.focus) {
            for (const window of windows) {
              const outside = window.state === "OUTSIDE";
              const missing = window.state === "MISSING" || !window.start || !window.end;
              rows.push({
                key: `win-${window.id}`,
                height: 48,
                label: (
                  <Label
                    title={chineseName(window.label)}
                    subtitle="產品施工窗"
                    meta={window.start && window.end ? `${shortDate(window.start)} – ${shortDate(window.end)}` : "尚未填寫"}
                    alert={outside ? "超出階段" : missing ? "未填" : undefined}
                    alertTone={missing && !outside ? "warn" : "danger"}
                    indent
                  />
                ),
                content: missing ? (
                  <span className="absolute left-3 top-3 text-sm font-medium text-amber-800">未填施工時間</span>
                ) : (
                  <RangeBar
                    scale={scale}
                    start={window.start!}
                    end={window.end!}
                    top={10}
                    height={26}
                    className={cn("text-white", outside ? "bg-rose-600" : "bg-teal-700")}
                    label={`${chineseName(window.label)}  ${shortDate(window.start)}–${shortDate(window.end)}${outside ? `  ${window.reasons.map((reason) => windowReasonLabel[reason]).join("、")}` : ""}`}
                  />
                ),
              });
            }
          }
          return rows;
        })}
      />
      {focus ? (
        <p className="mt-3 text-sm text-muted">
          產品施工窗是第 {focus.order} 階段「{chineseName(focus.name)}」的子列（{focus.plannedStart} – {focus.plannedEnd}）。各產品可平行施工，時程重疊不標示；只把超出階段或未填的窗標出來。
        </p>
      ) : null}
      <Legend />
    </div>
  );
}

export function PortfolioTimeline({
  factories,
  asOf,
}: {
  factories: PortfolioTimelineFactory[];
  asOf: string;
}) {
  const dates = [
    asOf,
    ...factories.flatMap((factory) =>
      factory.phases.flatMap((phase) => [phase.plannedStart, phase.plannedEnd, phase.actualStart, phase.actualEnd].filter(Boolean) as string[]),
    ),
  ];
  const scale = makeScale(dates.length > 1 ? dates : [asOf, addDays(asOf, 30)], "month");

  return (
    <div data-timeline="portfolio">
      <Gantt
        scale={scale}
        asOf={asOf}
        axis="month"
        labelWidth={300}
        corner="工廠"
        rows={factories.map((factory) => ({
          key: factory.id,
          height: 88,
          label: (
            <div className="min-w-0 py-1">
              <div className="flex items-center gap-2">
                <Link href={`/factories/${factory.id}#timeline`} className="truncate text-base font-semibold leading-5 hover:underline">
                  {factory.name}
                </Link>
                <Link
                  href={`/factories/${factory.id}#topics`}
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                    factory.openTopics > 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600",
                  )}
                >
                  例外 {factory.openTopics}
                </Link>
              </div>
              <div className="truncate text-sm">{factory.pmName}</div>
              <div className="truncate text-xs text-muted">{factory.pmDepartment}</div>
            </div>
          ),
          content: (
            <>
              {factory.phases.map((phase) => {
                const late = slipped(phase, asOf);
                return (
                  <RangeBar
                    key={phase.id}
                    scale={scale}
                    start={phase.plannedStart}
                    end={phase.plannedEnd}
                    top={26}
                    height={34}
                    className={cn("text-sm text-white", late ? "bg-rose-600" : actualFill(phase.status))}
                    label={chineseName(phase.name)}
                    forceInside
                  />
                );
              })}
            </>
          ),
        }))}
      />
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <LegendItem className="h-4 w-8 bg-slate-400" text="未開始" />
        <LegendItem className="h-4 w-8 bg-sky-600" text="進行中" />
        <LegendItem className="h-4 w-8 bg-amber-500" text="有風險" />
        <LegendItem className="h-4 w-8 bg-rose-600" text="延遲" />
        <LegendItem className="h-4 w-8 bg-emerald-600" text="已完成" />
        <span className="inline-flex items-center gap-2"><i className="inline-block h-4 w-0.5 bg-rose-600" />今天</span>
      </div>
    </div>
  );
}

function Legend({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink", compact && "mt-2")}>
      <LegendItem className="h-4 w-8 border-2 border-slate-700 bg-white" text="計畫（框線）" />
      <LegendItem className="h-4 w-8 bg-sky-600" text="實際進度" />
      <LegendItem className="h-4 w-8 bg-emerald-600" text="已完成" />
      <LegendItem className="h-4 w-8 bg-rose-600" text="延遲" />
      <LegendItem className="h-4 w-8 bg-teal-700" text="產品施工窗" />
      <span className="inline-flex items-center gap-2">
        <i className="inline-block h-3.5 w-3.5 rotate-45 bg-slate-700" />
        里程碑
      </span>
      <span className="inline-flex items-center gap-2">
        <i className="inline-block h-4 w-0.5 bg-rose-600" />
        今天
      </span>
    </div>
  );
}

function LegendItem({ className, text }: { className: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <i className={cn("inline-block rounded-sm", className)} />
      {text}
    </span>
  );
}

interface GanttRow {
  key: string;
  height: number;
  label: ReactNode;
  content: ReactNode;
}

function Gantt({
  scale,
  asOf,
  rows,
  axis,
  labelWidth,
  corner,
}: {
  scale: Scale;
  asOf: string;
  rows: GanttRow[];
  axis: "week" | "month";
  labelWidth: number;
  corner: string;
}) {
  const weeks = axis === "week" ? weekStarts(scale.min, scale.max) : [];
  const months = monthBands(scale);
  const header = axis === "month" ? 56 : 80;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <div className="flex min-w-max">
        <div className="sticky left-0 z-20 shrink-0 border-r border-line bg-white" style={{ width: labelWidth }}>
          <div className="flex items-end border-b border-line px-3 pb-2 text-sm font-medium text-muted" style={{ height: header }}>
            {corner}
          </div>
          {rows.map((row) => (
            <div key={row.key} className="flex items-center border-b border-slate-100 px-3" style={{ height: row.height }}>
              {row.label}
            </div>
          ))}
        </div>
        <div className="relative" style={{ width: scale.width }}>
          <div className="relative border-b border-line" style={{ height: header }}>
            {months.map((month) => (
              <div
                key={month.key}
                className={cn(
                  "absolute top-0 flex items-center justify-center border-l border-slate-300 font-semibold",
                  "h-8 text-sm",
                  month.alt ? "bg-slate-50" : "bg-white",
                )}
                style={{ left: `${month.left}%`, width: `${month.width}%` }}
              >
                {month.label}
              </div>
            ))}
            {weeks.map((week) => (
              <span key={week} className="absolute bottom-1 -translate-x-1/2 text-xs text-muted" style={{ left: `${scale.x(week)}%` }}>
                {week.slice(8)}
              </span>
            ))}
            <span className="absolute bottom-1 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-rose-600 px-1.5 py-0.5 text-xs font-semibold text-white" style={{ left: `${scale.x(asOf)}%` }}>
              今天 {shortDate(asOf)}
            </span>
          </div>
          {rows.map((row) => (
            <div key={row.key} className="relative border-b border-slate-100" style={{ height: row.height }}>
              {months.map((month) => (
                <div key={month.key} className={cn("absolute inset-y-0 border-l border-slate-200", month.alt && "bg-slate-50/80")} style={{ left: `${month.left}%`, width: `${month.width}%` }} />
              ))}
              {weeks.map((week) => (
                <div key={week} className="absolute inset-y-0 w-px bg-slate-200/80" style={{ left: `${scale.x(week)}%` }} />
              ))}
              {row.content}
            </div>
          ))}
          <div className="pointer-events-none absolute bottom-0 z-30 w-0.5 bg-rose-600" style={{ left: `${scale.x(asOf)}%`, top: header }} />
        </div>
      </div>
    </div>
  );
}

function Label({
  title,
  subtitle,
  meta,
  alert,
  alertTone = "danger",
  indent = false,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  alert?: string;
  alertTone?: "danger" | "warn";
  indent?: boolean;
}) {
  return (
    <div className={cn("min-w-0", indent && "border-l-2 border-teal-600 pl-2")}>
      <div className="flex items-center gap-2">
        <span className="truncate text-base font-semibold leading-5">{title}</span>
        {alert ? (
          <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold", alertTone === "warn" ? "bg-amber-100 text-amber-900" : "bg-rose-100 text-rose-800")}>
            {alert}
          </span>
        ) : null}
      </div>
      {subtitle ? <div className="truncate text-sm text-muted">{subtitle}</div> : null}
      {meta ? <div className="text-sm text-muted">{meta}</div> : null}
    </div>
  );
}

function RangeBar({
  scale,
  start,
  end,
  top,
  height,
  className,
  label,
  forceInside = false,
}: {
  scale: Scale;
  start: string;
  end: string;
  top: number;
  height: number;
  className: string;
  label: string;
  forceInside?: boolean;
}) {
  if (!start || !end) return null;
  const left = scale.x(start);
  const width = Math.max(scale.x(end) - left, 0.6);
  const inside = forceInside || width > 11;
  return (
    <>
      <div
        className={cn("absolute z-10 flex items-center overflow-hidden rounded-md px-2 font-medium leading-none", className)}
        style={{ left: `${left}%`, width: `${width}%`, top, height }}
      >
        {inside ? <span className="truncate">{label}</span> : null}
      </div>
      {label && !inside ? (
        <span className="absolute z-10 whitespace-nowrap text-sm font-medium text-ink" style={{ left: `calc(${left + width}% + 6px)`, top: top + 4 }}>
          {label}
        </span>
      ) : null}
    </>
  );
}

function MilestoneMark({ scale, milestone }: { scale: Scale; milestone: TimelineMilestone }) {
  const late = milestone.overdue && !milestone.done;
  return (
    <div className="absolute top-1/2 z-10 -translate-y-1/2" style={{ left: `${scale.x(milestone.dueDate)}%` }}>
      <span
        className={cn(
          "absolute left-0 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white",
          late ? "bg-rose-600" : milestone.done ? "bg-emerald-600" : "bg-slate-700",
        )}
      />
      <span className={cn("ml-3 whitespace-nowrap text-sm font-medium", late ? "text-rose-700" : "text-ink")}>
        {milestone.name} {shortDate(milestone.dueDate)}
        {late ? " 逾期" : ""}
      </span>
    </div>
  );
}

function actualFill(status: PhaseStatus): string {
  if (status === "COMPLETED") return "bg-emerald-600";
  if (status === "AT_RISK") return "bg-amber-500";
  if (status === "NOT_STARTED") return "bg-slate-400";
  return "bg-sky-600";
}

function slipped(phase: { status: PhaseStatus; plannedEnd: string; actualStart: string | null; actualEnd: string | null }, asOf: string): boolean {
  if (phase.status === "DELAYED") return true;
  if (phase.actualEnd && phase.actualEnd > phase.plannedEnd) return true;
  if (phase.actualStart && !phase.actualEnd && asOf > phase.plannedEnd) return true;
  return false;
}

function chineseName(name: string): string {
  const [head] = name.split(" ");
  return head || name;
}

interface Scale {
  min: string;
  max: string;
  width: number;
  x: (iso: string) => number;
}

function makeScale(dates: string[], axis: "week" | "month" = "week"): Scale {
  const sorted = dates.filter(Boolean).sort();
  const min = addDays(sorted[0] ?? "2026-01-01", axis === "month" ? -14 : -7);
  const max = addDays(sorted[sorted.length - 1] ?? min, axis === "month" ? 21 : 28);
  const days = Math.max(dayDiff(max, min), 1);
  const minMs = Date.parse(`${min}T00:00:00Z`);
  const span = Date.parse(`${max}T00:00:00Z`) - minMs;
  const units = axis === "month" ? Math.max(monthCount(min, max), 1) : Math.ceil(days / 7);
  const unitPx = axis === "month" ? MONTH_PX : WEEK_PX;
  return {
    min,
    max,
    width: Math.max(units * unitPx, axis === "month" ? 960 : 960),
    x: (iso: string) => ((Date.parse(`${iso}T00:00:00Z`) - minMs) / span) * 100,
  };
}

function monthCount(min: string, max: string): number {
  return (Number(max.slice(0, 4)) - Number(min.slice(0, 4))) * 12 + (Number(max.slice(5, 7)) - Number(min.slice(5, 7))) + 1;
}

function weekStarts(min: string, max: string): string[] {
  const ticks: string[] = [];
  let cursor = mondayOnOrBefore(min);
  while (cursor <= max) {
    if (cursor >= min) ticks.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return ticks;
}

function mondayOnOrBefore(iso: string): string {
  const day = new Date(Date.parse(`${iso}T00:00:00Z`)).getUTCDay();
  const delta = day === 0 ? 6 : day - 1;
  return addDays(iso, -delta);
}

function monthBands(scale: Scale): Array<{ key: string; left: number; width: number; label: string; alt: boolean }> {
  const bands: Array<{ key: string; left: number; width: number; label: string; alt: boolean }> = [];
  let year = Number(scale.min.slice(0, 4));
  let month = Number(scale.min.slice(5, 7));
  const endYear = Number(scale.max.slice(0, 4));
  const endMonth = Number(scale.max.slice(5, 7));
  let index = 0;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const next = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
    const leftIso = start < scale.min ? scale.min : start;
    const rightIso = next > scale.max ? scale.max : next;
    const left = scale.x(leftIso);
    const width = Math.max(scale.x(rightIso) - left, 0);
    bands.push({ key: start, left, width, label: `${year}年${month}月`, alt: index % 2 === 1 });
    index += 1;
    month = nextMonth;
    year = nextYear;
  }
  return bands;
}
