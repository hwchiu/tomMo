"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api";
import type { CapabilityCell } from "@/api/types";
import { AsyncView, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { withQuery } from "@/lib/search";
import { useLiveQuery } from "@/lib/use-live-query";

export function CapabilityView({
  factoryId,
  phaseId,
  platformId,
  versionId,
  featureId,
  mismatches,
}: {
  factoryId: string;
  phaseId: string;
  platformId: string;
  versionId: string;
  featureId: string;
  mismatches: boolean;
}) {
  const state = useLiveQuery("capabilities", () => api.capabilities());
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-96" />}>
      {(data) => (
        <Matrix
          data={data}
          factoryId={factoryId}
          phaseId={phaseId}
          platformId={platformId}
          versionId={versionId}
          featureId={featureId}
          mismatches={mismatches}
        />
      )}
    </AsyncView>
  );
}

function mismatch(cell: CapabilityCell): boolean {
  if (cell.desired && cell.actual !== true) return true;
  if (!cell.desired && cell.actual === true) return true;
  if (cell.desired && cell.supported === false) return true;
  return false;
}

function Matrix({
  data,
  factoryId,
  phaseId,
  platformId,
  versionId,
  featureId,
  mismatches,
}: {
  data: Awaited<ReturnType<typeof api.capabilities>>;
  factoryId: string;
  phaseId: string;
  platformId: string;
  versionId: string;
  featureId: string;
  mismatches: boolean;
}) {
  const router = useRouter();
  const [localFeature, setLocalFeature] = useState(featureId);
  const features = data.features.filter((feature) => !platformId || feature.platformId === platformId).filter((feature) => !localFeature || feature.id === localFeature);
  const rows = useMemo(
    () =>
      data.rows.filter((row) => {
        if (factoryId && row.factoryId !== factoryId) return false;
        if (phaseId && !row.phaseIds.includes(phaseId)) return false;
        if (platformId && row.platformId !== platformId) return false;
        if (versionId && row.versionId !== versionId) return false;
        if (mismatches && !row.cells.some((cell) => features.some((feature) => feature.id === cell.featureId) && mismatch(cell))) return false;
        return true;
      }),
    [data.rows, factoryId, phaseId, platformId, versionId, mismatches, features],
  );

  function push(next: Record<string, string>) {
    router.replace(withQuery("/capabilities", { factory: factoryId, phase: phaseId, platform: platformId, version: versionId, feature: localFeature, mismatch: mismatches ? "1" : "", ...next }));
  }

  return (
    <div>
      <PageHeader
        kicker="Capability"
        title="能力矩陣"
        description="支援來自版本，期望是這座工廠想要的，實際是工程師填報的。三者分開，不一致會上色。這不是同一件事。"
      />
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Pick label="工廠" value={factoryId} onChange={(value) => push({ factory: value })} options={data.factories.map((item) => ({ id: item.id, label: item.name }))} />
        <Pick label="階段" value={phaseId} onChange={(value) => push({ phase: value })} options={data.phases.map((item) => ({ id: item.id, label: item.name }))} />
        <Pick label="平台" value={platformId} onChange={(value) => push({ platform: value })} options={data.platforms.map((item) => ({ id: item.id, label: item.name }))} />
        <Pick label="版本" value={versionId} onChange={(value) => push({ version: value })} options={data.versions.filter((item) => !platformId || item.platformId === platformId).map((item) => ({ id: item.id, label: item.label }))} />
        <Pick label="功能" value={localFeature} onChange={(value) => { setLocalFeature(value); push({ feature: value }); }} options={data.features.filter((feature) => !platformId || feature.platformId === platformId).map((feature) => ({ id: feature.id, label: feature.name }))} />
        <button type="button" className={cn("h-8 rounded-full px-3", mismatches ? "bg-ink text-white" : "border border-line bg-white")} onClick={() => push({ mismatch: mismatches ? "" : "1" })}>
          只看落差
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded bg-rose-50 px-2 py-1 text-rose-800">期望與實際不一致，或期望了版本不支援的功能</span>
        <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">期望與實際一致，且期望的功能有被版本支援</span>
      </div>
      {rows.length === 0 || features.length === 0 ? (
        <EmptyState title="這個篩選沒有格子" body="放寬工廠、階段、平台或版本。只看落差時，完全對齊的列會被藏起來。" />
      ) : (
        <div className="overflow-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-[200px] border-b border-r border-line bg-white p-2">工廠 / 階段 / 平台 / 版本</th>
                {features.map((feature) => (
                  <th key={feature.id} className="sticky top-0 z-20 min-w-[120px] border-b border-line bg-white p-2">
                    <div className="font-medium">{feature.name}</div>
                    <div className="font-normal text-muted">{feature.platformName}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.deploymentId}>
                  <th className="sticky left-0 z-10 border-b border-r border-line bg-white p-2 font-normal">
                    <div className="font-medium">{row.factoryName}</div>
                    <div className="text-muted">{row.phaseNames[0] ?? "—"}</div>
                    <div>{row.platformName}</div>
                    <div className="font-mono">{row.versionSource} {row.versionLabel}</div>
                  </th>
                  {features.map((feature) => {
                    const cell = row.cells.find((item) => item.featureId === feature.id);
                    if (!cell) return <td key={feature.id} className="border-b border-line p-2 text-muted">—</td>;
                    const bad = mismatch(cell);
                    return (
                      <td key={feature.id} className={cn("border-b border-line p-2", bad ? "bg-rose-50" : "bg-emerald-50/50")}>
                        <div>支援 {cell.supported === null ? "—" : cell.supported ? "是" : "否"}</div>
                        <div>期望 {cell.desired ? "是" : "否"}</div>
                        <div>實際 {cell.actual === null ? "未填" : cell.actual ? "是" : "否"}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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
