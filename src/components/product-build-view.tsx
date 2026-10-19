"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/api";
import type { BuildCell, BuildRow, DelayReasonView } from "@/api/types";
import { delayCatalog, ownerRoleLabel } from "@/domain/delay";
import { scheduleLabel } from "@/domain/schedule";
import { productModeLabel, readinessFlagLabel, windowReasonLabel } from "@/domain/labels";
import { inFactoryScope } from "@/domain/select";
import { useApp } from "@/components/shell";
import { MetaChip, StatusChip } from "@/components/status-chip";
import { ScheduleFilter } from "@/components/schedule-filter";
import { AsyncView, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MachineText } from "@/components/machines";
import { shortDate } from "@/domain/dates";
import { withQuery } from "@/lib/search";
import { useLiveQuery } from "@/lib/use-live-query";

export function ProductBuildView({
  category,
  region,
  technology,
  onlyExceptions,
  reason,
  from,
  to,
}: {
  category: string;
  region: string;
  technology: string;
  onlyExceptions: boolean;
  reason: string;
  from: string;
  to: string;
}) {
  const state = useLiveQuery(`product-build:${from}:${to}`, () => api.productBuild({ from, to }));
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-[32rem]" />}>
      {(data) => (
        <Body
          data={data}
          category={category}
          region={region}
          technology={technology}
          onlyExceptions={onlyExceptions}
          reason={reason}
          from={from}
          to={to}
        />
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
  reason,
  from,
  to,
}: {
  data: Awaited<ReturnType<typeof api.productBuild>>;
  category: string;
  region: string;
  technology: string;
  onlyExceptions: boolean;
  reason: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const app = useApp();
  const enums = app?.enumerations.filter((item) => item.active) ?? [];
  const knownReason = delayCatalog.some((item) => item.code === reason);
  const activeReason = knownReason ? reason : "";
  const rows = data.rows.filter((row) => inFactoryScope(row, { category, region, technology }));
  const visible = rows.filter((row) => {
    if (onlyExceptions && row.cells.every((cell) => cell.ready)) return false;
    if (activeReason && !row.cells.some((cell) => cell.reasons.some((item) => item.code === activeReason))) return false;
    return true;
  });

  function push(next: Partial<{ category: string; region: string; technology: string; exceptions: string; reason: string; from: string; to: string }>) {
    router.replace(
      withQuery("/product-build", {
        category,
        region,
        technology,
        exceptions: onlyExceptions ? "1" : "",
        reason: activeReason,
        from,
        to,
        ...next,
      }),
    );
  }

  return (
    <div>
      <PageHeader
        kicker="產品交付狀況"
        title="產品交付狀況"
        description="每一格是一座工廠上的一個產品。延遲是相對基準日已經遲到；待補是資料還沒齊、或時程與第二階段不符，但還沒遲到。格子上列出理由、遲到天數與負責人。各產品平行施工，時程重疊不算衝突。第二階段的名稱仍是產品建立。時程留空會列出全部工廠。"
        actions={from || to ? <p id="schedule-range" className="text-sm font-medium text-ink">時程 {scheduleLabel(from, to)}</p> : null}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <ScheduleFilter from={from} to={to} onChange={(nextFrom, nextTo) => push({ from: nextFrom, to: nextTo })} />
        <Select label="類別" value={category} onChange={(value) => push({ category: value })} options={enums.filter((item) => item.set === "factoryCategory")} />
        <Select label="區域" value={region} onChange={(value) => push({ region: value })} options={enums.filter((item) => item.set === "factoryRegion")} />
        <Select label="製程" value={technology} onChange={(value) => push({ technology: value })} options={enums.filter((item) => item.set === "technologyNode")} />
        <label className="flex items-center gap-1 text-muted">
          理由
          <select
            aria-label="延遲理由"
            className="h-8 max-w-[16rem] rounded-md border border-line bg-white px-2 text-sm text-ink"
            value={activeReason}
            onChange={(event) => push({ reason: event.target.value })}
          >
            <option value="">全部</option>
            {delayCatalog.map((item) => (
              <option key={item.code} value={item.code}>{item.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={cn("h-8 rounded-full px-3", onlyExceptions ? "bg-ink text-white" : "border border-line bg-white")}
          onClick={() => push({ exceptions: onlyExceptions ? "" : "1" })}
        >
          只看未就緒
        </button>
        <span className="text-muted">基準日 {data.asOf}</span>
        {activeReason ? <span className="text-muted">篩選可分享：網址已帶理由</span> : null}
      </div>
      <section id="delay-legend" className="mb-3 grid gap-2 sm:grid-cols-2">
        {delayCatalog.map((item) => (
          <button
            key={item.code}
            type="button"
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-[11px] leading-5",
              activeReason === item.code ? "border-ink bg-slate-50" : "border-line bg-white",
            )}
            onClick={() => push({ reason: activeReason === item.code ? "" : item.code })}
          >
            <div className="font-medium text-ink">{item.label}</div>
            <div className="text-muted">{item.explanation}</div>
          </button>
        ))}
      </section>
      {visible.length === 0 ? (
        <EmptyState title="沒有要看的工廠" body="沒有符合篩選的列。清除篩選後會看到全部工廠。" action={<button type="button" className="text-sm text-accent" onClick={() => router.replace("/product-build")}>清除篩選</button>} />
      ) : (
        <>
          <div className="hidden overflow-auto rounded-xl border border-line bg-panel lg:block">
            <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 min-w-[220px] border-b border-r border-line bg-white p-3 text-xs font-medium text-muted">工廠</th>
                  <th className="sticky top-0 z-20 min-w-[140px] border-b border-line bg-white p-3 text-xs font-medium text-muted">計畫機台合計</th>
                  {data.products.map((product) => (
                    <th key={product.id} className="sticky top-0 z-20 min-w-[210px] border-b border-line bg-white p-3">
                      <div className="text-sm font-semibold">{product.name}</div>
                      {product.mode === "FEATURE_ONLY" ? (
                        <div className="mt-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">{productModeLabel.FEATURE_ONLY}</div>
                      ) : (
                        <div className="text-[11px] font-normal text-muted">{productModeLabel.VERSIONED}</div>
                      )}
                      <div className="text-[11px] font-normal text-muted">主責 {product.primaryOwnerName}</div>
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
                    <td className="border-b border-line bg-slate-50 p-3 align-top">
                      <div className="text-2xl font-semibold tabular-nums">{row.machineTotal}</div>
                      <div className="mt-1 text-[11px] text-muted"><MachineText lines={row.machineRollup} /></div>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.productId} className="border-b border-line p-2 align-top">
                        <Cell
                          cell={cell}
                          factoryName={row.factoryName}
                          productName={data.products.find((product) => product.id === cell.productId)?.name ?? ""}
                          dimmed={(Boolean(activeReason) && !cell.reasons.some((item) => item.code === activeReason)) || !cell.inSchedule}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-ink text-white">
                  <th className="sticky left-0 border-r border-white/10 bg-ink p-3 text-left text-sm font-semibold">可見工廠合計</th>
                  <td className="p-3">
                    <div className="text-2xl font-semibold tabular-nums">{visible.reduce((sum, row) => sum + row.machineTotal, 0)}</div>
                    <div className="mt-1 text-[11px] text-slate-300">各廠計畫機台加總，依目前篩選</div>
                  </td>
                  {data.products.map((product) => (
                    <td key={product.id} className="p-3 align-top text-sm">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-lg font-semibold tabular-nums">
                        {visible.reduce((sum, row) => sum + (row.cells.find((cell) => cell.productId === product.id)?.plannedTotal ?? 0), 0)}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="space-y-3 lg:hidden">
            {visible.map((row) => (
              <article key={row.factoryId} className="rounded-xl border border-line bg-panel p-3">
                <RowHead row={row} />
                <div className="mt-3 space-y-2">
                  {row.cells.map((cell) => (
                    <div key={cell.productId}>
                      <div className="mb-1 text-xs font-medium text-muted">{data.products.find((product) => product.id === cell.productId)?.name}</div>
                      <Cell
                        cell={cell}
                        factoryName={row.factoryName}
                        productName={data.products.find((product) => product.id === cell.productId)?.name ?? ""}
                        dimmed={(Boolean(activeReason) && !cell.reasons.some((item) => item.code === activeReason)) || !cell.inSchedule}
                      />
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
  const phaseDates = row.phase2?.plannedStart && row.phase2.plannedEnd
    ? `${row.phase2.plannedStart.slice(5)} – ${row.phase2.plannedEnd.slice(5)}`
    : "日期未設定";
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
          產品建立 {phaseDates} · <StatusChip kind="phase" value={row.phase2.status} />
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-muted">第二階段日期未設定</p>
      )}
      <p className="mt-2 text-lg font-semibold tabular-nums">{row.machineTotal}</p>
      <p className="text-[11px] text-muted">計畫機台合計 · <MachineText lines={row.machineRollup} /></p>
      <p className={cn("mt-1 text-xs", row.readyCount === row.cells.length ? "text-emerald-800" : "text-amber-900")}>
        就緒 {row.readyCount}/{row.cells.length}
      </p>
      <p className="mt-1 text-xs text-rose-800">延遲 {row.lateCount} · 待補 {row.gapCount}</p>
      {row.reasonCounts.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-[11px] text-muted">
          {row.reasonCounts.map((item) => (
            <li key={item.code}>{item.label} {item.count}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Cell({
  cell,
  factoryName,
  productName,
  dimmed,
}: {
  cell: BuildCell;
  factoryName: string;
  productName: string;
  dimmed: boolean;
}) {
  const late = cell.reasons.some((reason) => reason.kind === "late");
  const gap = cell.reasons.some((reason) => reason.kind === "gap");
  const outside = cell.windowState === "OUTSIDE";
  const badge = late ? "延遲" : gap ? "待補" : "";
  const tip = cell.reasons.map((reason) => `${reason.label}：${reason.explanation}`).join("\n");
  return (
    <Link
      href={cell.planId ? `/factories/${cell.factoryId}/plans/${cell.productId}` : `/factories/${cell.factoryId}`}
      data-delay-cell={`${factoryName}:${productName}`}
      title={tip || undefined}
      className={cn(
        "block rounded-lg border p-2 text-xs leading-5",
        late && "border-rose-300 bg-rose-50",
        !late && gap && "border-amber-300 bg-amber-50",
        !late && !gap && cell.ready && "border-emerald-200 bg-emerald-50/70",
        !late && !gap && !cell.ready && "border-amber-200 bg-amber-50/40",
        dimmed && "opacity-40",
      )}
    >
      <div className="mb-1 flex flex-wrap gap-1">
        <StatusChip kind="deployment" value={cell.deploymentStatus} />
        <StatusChip kind="plan" value={cell.planStatus} />
        {badge ? (
          <span className={cn("rounded px-1.5 py-0.5 font-medium", late ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900")}>{badge}</span>
        ) : null}
      </div>
      {cell.mode === "VERSIONED" ? (
        <>
          <div>提供 {cell.providedVersion ?? "—"}</div>
          <div className={cell.versionGap ? "text-amber-900" : ""}>實際 {cell.actualVersion ?? "未填"}{cell.versionGap ? " · 與提供版本不同" : ""}</div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">{productModeLabel.FEATURE_ONLY}</span>
          <span className="text-muted">異動 {cell.changeCount}</span>
        </div>
      )}
      <div className="text-muted">主責 {cell.primaryOwnerName}</div>
      <div className="text-muted">副責 {cell.secondaryOwnerName}</div>
      <div><MachineText lines={cell.machines} /></div>
      <div>
        時程 {shortDate(cell.windowStart)} – {shortDate(cell.windowEnd)}
        {outside ? <span className="text-rose-700"> · {cell.windowReasons.map((item) => windowReasonLabel[item]).join("、")}</span> : null}
      </div>
      {cell.reasons.length > 0 ? <ReasonList reasons={cell.reasons} /> : (
        <div className={cell.ready ? "text-emerald-800" : "text-ink"}>
          {cell.ready ? "計畫就緒" : cell.flags.map((flag) => readinessFlagLabel[flag]).join(" · ")}
        </div>
      )}
    </Link>
  );
}

function ReasonList({ reasons }: { reasons: DelayReasonView[] }) {
  return (
    <ul className="mt-1 space-y-1">
      {reasons.map((reason) => (
        <li key={reason.code} title={reason.explanation}>
          <span className={reason.kind === "late" ? "font-medium text-rose-800" : "font-medium text-amber-900"}>
            {reason.kind === "late" ? "延遲" : "待補"}
          </span>
          {" "}{reason.label}
          {reason.daysLate != null ? ` · 晚 ${reason.daysLate} 天` : ""}
          {" · "}{ownerRoleLabel(reason.ownerRole)} {reason.ownerName}
        </li>
      ))}
    </ul>
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
