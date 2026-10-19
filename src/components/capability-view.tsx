"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api";
import type { CapabilityTone } from "@/api/types";
import { productModeLabel } from "@/domain/labels";
import { scheduleLabel } from "@/domain/schedule";
import { ScheduleFilter } from "@/components/schedule-filter";
import { AsyncView, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { withQuery } from "@/lib/search";
import { useLiveQuery } from "@/lib/use-live-query";

export function CapabilityView({
  factoryId,
  productId,
  featureId,
  onlyChanges,
  adhocOnly,
  from,
  to,
}: {
  factoryId: string;
  productId: string;
  featureId: string;
  onlyChanges: boolean;
  adhocOnly: boolean;
  from: string;
  to: string;
}) {
  const state = useLiveQuery(`product-versions:${from}:${to}`, () => api.productVersions({ from, to }));
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-96" />}>
      {(data) => (
        <Matrix
          data={data}
          factoryId={factoryId}
          productId={productId}
          featureId={featureId}
          onlyChanges={onlyChanges}
          adhocOnly={adhocOnly}
          from={from}
          to={to}
        />
      )}
    </AsyncView>
  );
}

function Matrix({
  data,
  factoryId,
  productId,
  featureId,
  onlyChanges,
  adhocOnly,
  from,
  to,
}: {
  data: Awaited<ReturnType<typeof api.productVersions>>;
  factoryId: string;
  productId: string;
  featureId: string;
  onlyChanges: boolean;
  adhocOnly: boolean;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    return data.rows.filter((row) => {
      if (factoryId && row.factoryId !== factoryId) return false;
      if (productId && row.productId !== productId) return false;
      if (adhocOnly && row.adHocChanges.length === 0) return false;
      if (onlyChanges && !row.cells.some((cell) => cell.tone === "ADDED" || cell.tone === "REMOVED")) return false;
      return true;
    });
  }, [data.rows, factoryId, productId, onlyChanges, adhocOnly]);
  const groups = useMemo(() => {
    const products = data.products.filter((product) => !productId || product.id === productId);
    return products.map((product) => ({
      ...product,
      features: data.features.filter((feature) => feature.productId === product.id && (!featureId || feature.id === featureId)).filter((feature) => {
        if (!onlyChanges) return true;
        return rows.some((row) => row.cells.some((cell) => cell.featureId === feature.id && (cell.tone === "ADDED" || cell.tone === "REMOVED")));
      }),
    })).filter((group) => group.features.length > 0);
  }, [data.features, data.products, featureId, onlyChanges, productId, rows]);

  function push(next: Record<string, string>) {
    router.replace(withQuery("/product-versions", {
      factory: factoryId,
      product: productId,
      feature: featureId,
      changes: onlyChanges ? "1" : "",
      adhoc: adhocOnly ? "1" : "",
      from,
      to,
      ...next,
    }));
  }

  const columns = groups.flatMap((group) => group.features);
  return (
    <div>
      <PageHeader
        kicker="產品版本管理"
        title="產品版本管理"
        description="每一列是一座工廠上的一個產品。功能欄依產品分組。灰格是和基準相同，綠色是相對基準新增，紅色是相對基準停用。版本產品的基準是所選版本；純功能開關的基準是產品預設。特殊覆寫會標 adhoc。時程留空會列出全部工廠；沒有落在區間裡的產品列會變淡。"
        actions={from || to ? <p id="schedule-range" className="text-sm font-medium text-ink">時程 {scheduleLabel(from, to)}</p> : null}
      />
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <ScheduleFilter from={from} to={to} onChange={(nextFrom, nextTo) => push({ from: nextFrom, to: nextTo })} />
        <Pick label="工廠" value={factoryId} onChange={(value) => push({ factory: value })} options={data.factories.map((item) => ({ id: item.id, label: item.name }))} />
        <Pick label="產品" value={productId} onChange={(value) => push({ product: value, feature: "" })} options={data.products.map((item) => ({ id: item.id, label: item.name }))} />
        <Pick label="功能" value={featureId} onChange={(value) => push({ feature: value })} options={data.features.filter((feature) => !productId || feature.productId === productId).map((feature) => ({ id: feature.id, label: feature.name }))} />
        <button type="button" className={cn("h-8 rounded-full px-3", onlyChanges ? "bg-ink text-white" : "border border-line bg-white")} onClick={() => push({ changes: onlyChanges ? "" : "1" })}>只看異動</button>
        <button type="button" className={cn("h-8 rounded-full px-3", adhocOnly ? "bg-ink text-white" : "border border-line bg-white")} onClick={() => push({ adhoc: adhocOnly ? "" : "1" })}>有特殊異動</button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <Legend tone="UNCHANGED_ON" label="與基準相同 · 開" />
        <Legend tone="UNCHANGED_OFF" label="與基準相同 · 關" />
        <Legend tone="ADDED" label="+ 新增" />
        <Legend tone="REMOVED" label="− 停用" />
        <Legend tone="UNPLANNED" label="尚未規劃" />
        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">adhoc</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">{productModeLabel.FEATURE_ONLY}</span>
      </div>
      {rows.length === 0 || columns.length === 0 ? (
        <EmptyState title="這個篩選沒有格子" body="放寬工廠、產品、時程，或關掉只看異動。" />
      ) : (
        <div className="overflow-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[960px] border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky left-0 top-0 z-30 min-w-[200px] border-b border-r border-line bg-white p-2">工廠 × 產品</th>
                <th rowSpan={2} className="sticky top-0 z-20 min-w-[110px] border-b border-line bg-white p-2">版本</th>
                {groups.map((group) => (
                  <th key={group.id} colSpan={group.features.length} className="sticky top-0 z-20 border-b border-l border-line bg-slate-50 p-2 text-center">{group.name}</th>
                ))}
              </tr>
              <tr>
                {columns.map((feature) => (
                  <th key={feature.id} className="sticky top-8 z-20 min-w-[92px] border-b border-line bg-white p-2 text-center font-medium">{feature.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const customs = row.adHocChanges.filter((change) => change.kind === "CUSTOM");
                return (
                  <tr key={row.deploymentId} className={cn(!row.inSchedule && "opacity-40")} data-in-schedule={row.inSchedule ? "1" : "0"}>
                    <th className="sticky left-0 z-10 border-b border-r border-line bg-white p-2 font-normal">
                      <div className="font-medium">{row.factoryName}</div>
                      <div>{row.productName}</div>
                      {customs.length > 0 ? (
                        <button type="button" className="mt-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900" onClick={() => setOpen(open === row.deploymentId ? null : row.deploymentId)}>
                          文字異動 {customs.length}
                        </button>
                      ) : null}
                      {open === row.deploymentId ? (
                        <ul className="mt-1 space-y-1 text-[11px] font-normal">
                          {customs.map((change) => <li key={change.id}><span className="font-medium">{change.title}</span> {change.description}</li>)}
                        </ul>
                      ) : null}
                    </th>
                    <td className="border-b border-line p-2 align-top">
                      {row.mode === "VERSIONED" ? <span className="font-mono">{row.versionLabel ?? "—"}</span> : (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">{productModeLabel.FEATURE_ONLY}</span>
                      )}
                    </td>
                    {columns.map((feature) => {
                      const cell = row.productId === feature.productId ? row.cells.find((item) => item.featureId === feature.id) : undefined;
                      if (!cell) return <td key={feature.id} className="border-b border-line bg-slate-50 p-2 text-center text-muted"> </td>;
                      return (
                        <td key={feature.id} className={cn("relative border-b border-line p-2 text-center", toneClass(cell.tone))} title={cell.note || undefined}>
                          <CellMark tone={cell.tone} note={cell.note} />
                          {cell.adhoc ? <span className="absolute right-1 top-1 rounded bg-amber-200 px-1 text-[9px] font-semibold text-amber-950" title={cell.note || "特殊覆寫"}>adhoc</span> : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function toneClass(tone: CapabilityTone): string {
  if (tone === "ADDED") return "bg-emerald-50";
  if (tone === "REMOVED") return "bg-rose-50";
  if (tone === "UNPLANNED") return "bg-white";
  return "bg-slate-50";
}

function CellMark({ tone, note }: { tone: CapabilityTone; note: string }) {
  if (tone === "UNPLANNED") return <span className="text-muted" title="尚未規劃">—</span>;
  if (tone === "ADDED") return <span className="font-semibold text-emerald-800" title={note || "+ 新增"}>+ 新增</span>;
  if (tone === "REMOVED") return <span className="font-semibold text-rose-800" title={note || "− 停用"}>− 停用</span>;
  if (tone === "UNCHANGED_ON") return <span className="text-slate-500" title="與基準相同，開啟">開</span>;
  return <span className="text-slate-400" title="與基準相同，關閉">關</span>;
}

function Legend({ tone, label }: { tone: CapabilityTone; label: string }) {
  return <span className={cn("rounded px-1.5 py-0.5", toneClass(tone))}>{label}</span>;
}

function Pick({ label, value, options, onChange }: { label: string; value: string; options: Array<{ id: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-1 text-muted">
      {label}
      <select className="h-8 max-w-[14rem] rounded-md border border-line bg-white px-2 text-sm text-ink" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">全部</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}
