"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/api";
import type { BuildCell, BuildRow } from "@/api/types";
import { platformModeLabel, readinessFlagLabel, windowReasonLabel } from "@/domain/labels";
import { inFactoryScope } from "@/domain/select";
import { useApp } from "@/components/shell";
import { MetaChip, StatusChip } from "@/components/status-chip";
import { AsyncView, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MachineText } from "@/components/machines";
import { shortDate } from "@/domain/dates";
import { withQuery } from "@/lib/search";
import { useLiveQuery } from "@/lib/use-live-query";

export function PlatformBuildView({
  category,
  region,
  technology,
  onlyExceptions,
}: {
  category: string;
  region: string;
  technology: string;
  onlyExceptions: boolean;
}) {
  const state = useLiveQuery("platform-build", () => api.platformBuild());
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-[32rem]" />}>
      {(data) => (
        <Body data={data} category={category} region={region} technology={technology} onlyExceptions={onlyExceptions} />
      )}
    </AsyncView>
  );
}

function Body({
  data,
  category,
  region,
  technology,
  onlyExceptions,
}: {
  data: Awaited<ReturnType<typeof api.platformBuild>>;
  category: string;
  region: string;
  technology: string;
  onlyExceptions: boolean;
}) {
  const router = useRouter();
  const app = useApp();
  const enums = app?.enumerations.filter((item) => item.active) ?? [];
  const rows = data.rows.filter((row) => inFactoryScope(row, { category, region, technology }));
  const visible = onlyExceptions ? rows.filter((row) => row.cells.some((cell) => !cell.ready)) : rows;

  function push(next: Partial<{ category: string; region: string; technology: string; exceptions: string }>) {
    router.replace(
      withQuery("/platform-build", {
        category,
        region,
        technology,
        exceptions: onlyExceptions ? "1" : "",
        ...next,
      }),
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Phase 2 · 平台建立"
        title="工廠 × 平台"
        description="每一格是一座工廠上的一個平台：部署狀態、版本或功能開關、主責與副責、機台數，以及計畫是否就緒。未提報與超出平台建立區間會先被標出來。各平台平行施工，時程重疊不算衝突。"
      />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <Select label="類別" value={category} onChange={(value) => push({ category: value })} options={enums.filter((item) => item.set === "factoryCategory")} />
        <Select label="區域" value={region} onChange={(value) => push({ region: value })} options={enums.filter((item) => item.set === "factoryRegion")} />
        <Select label="製程" value={technology} onChange={(value) => push({ technology: value })} options={enums.filter((item) => item.set === "technologyNode")} />
        <button
          type="button"
          className={cn("h-8 rounded-full px-3", onlyExceptions ? "bg-ink text-white" : "border border-line bg-white")}
          onClick={() => push({ exceptions: onlyExceptions ? "" : "1" })}
        >
          只看未就緒
        </button>
        <span className="text-muted">基準日 {data.asOf}</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-muted">
        <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">就緒：已核准、時程在階段內、版本或功能集已規劃</span>
        <span className="rounded bg-amber-50 px-2 py-1 text-amber-900">未提報</span>
        <span className="rounded bg-rose-50 px-2 py-1 text-rose-800">超出平台建立</span>
        <span>重疊：允許，不標示</span>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="沒有要看的工廠" body="沒有符合篩選的列。清除篩選後會看到全部工廠。" action={<button type="button" className="text-sm text-accent" onClick={() => router.replace("/platform-build")}>清除篩選</button>} />
      ) : (
        <>
          <div className="hidden overflow-auto rounded-xl border border-line bg-panel lg:block">
            <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 min-w-[220px] border-b border-r border-line bg-white p-3 text-xs font-medium text-muted">工廠</th>
                  {data.platforms.map((platform) => (
                    <th key={platform.id} className="sticky top-0 z-20 min-w-[210px] border-b border-line bg-white p-3">
                      <div className="text-sm font-semibold">{platform.name}</div>
                      <div className="text-[11px] font-normal text-muted">{platform.code}</div>
                      {platform.mode === "FEATURE_ONLY" ? (
                        <div className="mt-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">{platformModeLabel.FEATURE_ONLY}</div>
                      ) : (
                        <div className="text-[11px] font-normal text-muted">{platformModeLabel.VERSIONED}</div>
                      )}
                      <div className="text-[11px] font-normal text-muted">主責 {platform.primaryOwnerName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.factoryId}>
                    <th className="sticky left-0 z-10 border-b border-r border-line bg-white p-3 align-top font-normal">
                      <RowHead row={row} />
                    </th>
                    {row.cells.map((cell) => (
                      <td key={cell.platformId} className="border-b border-line p-2 align-top">
                        <Cell cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 lg:hidden">
            {visible.map((row) => (
              <article key={row.factoryId} className="rounded-xl border border-line bg-panel p-3">
                <RowHead row={row} />
                <div className="mt-3 space-y-2">
                  {row.cells.map((cell) => (
                    <div key={cell.platformId}>
                      <div className="mb-1 text-xs font-medium text-muted">{data.platforms.find((platform) => platform.id === cell.platformId)?.name}</div>
                      <Cell cell={cell} />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RowHead({ row }: { row: BuildRow }) {
  return (
    <div>
      <Link href={`/factories/${row.factoryId}#timeline`} className="font-semibold hover:underline">{row.factoryName}</Link>
      <div className="font-mono text-[11px] text-muted">{row.factoryCode}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        <MetaChip>{row.categoryLabel}</MetaChip>
        <MetaChip>{row.regionLabel}</MetaChip>
        <MetaChip>{row.technologyLabel}</MetaChip>
      </div>
      <div className="mt-2"><StatusChip kind="factory" value={row.status} /></div>
      {row.phase2 ? (
        <p className="mt-2 text-[11px] text-muted">
          平台建立 {row.phase2.plannedStart.slice(5)} – {row.phase2.plannedEnd.slice(5)} · <StatusChip kind="phase" value={row.phase2.status} />
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-muted">
        <MachineText lines={rollupLines(row.cells)} />
      </p>
      <p className={cn("mt-1 text-xs", row.readyCount === row.cells.length ? "text-emerald-800" : "text-amber-900")}>
        就緒 {row.readyCount}/{row.cells.length}
      </p>
    </div>
  );
}

function rollupLines(cells: BuildCell[]) {
  const totals = new Map<string, { name: string; planned: number }>();
  for (const cell of cells) {
    for (const line of cell.machines) {
      const current = totals.get(line.machineTypeId) ?? { name: line.name, planned: 0 };
      current.planned += line.planned;
      totals.set(line.machineTypeId, current);
    }
  }
  return [...totals.values()];
}

function Cell({ cell }: { cell: BuildCell }) {
  const missing = cell.flags.includes("PLAN_MISSING");
  const outside = cell.windowState === "OUTSIDE";
  return (
    <Link
      href={cell.planId ? `/factories/${cell.factoryId}/plans/${cell.platformId}` : `/factories/${cell.factoryId}`}
      className={cn(
        "block rounded-lg border p-2 text-xs leading-5",
        cell.ready && "border-emerald-200 bg-emerald-50/70",
        missing && "border-amber-300 bg-amber-50",
        outside && "border-rose-300 bg-rose-50",
        !cell.ready && !missing && !outside && "border-amber-200 bg-amber-50/40",
      )}
    >
      <div className="mb-1 flex flex-wrap gap-1">
        <StatusChip kind="deployment" value={cell.deploymentStatus} />
        <StatusChip kind="plan" value={cell.planStatus} />
      </div>
      {cell.mode === "VERSIONED" ? (
        <>
          <div>提供 {cell.providedVersion ?? "—"}</div>
          <div className={cell.versionGap ? "text-amber-900" : ""}>實際 {cell.actualVersion ?? "未填"}{cell.versionGap ? " · 與提供版本不同" : ""}</div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">feature-flag only</span>
          <span className="text-muted">異動 {cell.changeCount}</span>
        </div>
      )}
      <div className="text-muted">主責 {cell.primaryOwnerName}</div>
      <div className="text-muted">副責 {cell.secondaryOwnerName}</div>
      <div><MachineText lines={cell.machines} /></div>
      <div>
        時程 {shortDate(cell.windowStart)} – {shortDate(cell.windowEnd)}
        {outside ? <span className="text-rose-700"> · {cell.windowReasons.map((reason) => windowReasonLabel[reason]).join("、")}</span> : null}
      </div>
      <div className={cell.ready ? "text-emerald-800" : "text-ink"}>
        {cell.ready ? "計畫就緒" : cell.flags.map((flag) => readinessFlagLabel[flag]).join(" · ")}
      </div>
    </Link>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ code: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-muted">
      {label}
      <select className="h-8 rounded-md border border-line bg-white px-2 text-sm text-ink" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">全部</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
