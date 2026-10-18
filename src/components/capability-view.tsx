"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api";
import { platformModeLabel } from "@/domain/labels";
import { AsyncView, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { withQuery } from "@/lib/search";
import { useLiveQuery } from "@/lib/use-live-query";

export function CapabilityView({
  factoryId,
  platformId,
  featureId,
}: {
  factoryId: string;
  platformId: string;
  featureId: string;
}) {
  const state = useLiveQuery("capabilities", () => api.capabilities());
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-96" />}>
      {(data) => <Matrix data={data} factoryId={factoryId} platformId={platformId} featureId={featureId} />}
    </AsyncView>
  );
}

function Matrix({
  data,
  factoryId,
  platformId,
  featureId,
}: {
  data: Awaited<ReturnType<typeof api.capabilities>>;
  factoryId: string;
  platformId: string;
  featureId: string;
}) {
  const router = useRouter();
  const [localFeature, setLocalFeature] = useState(featureId);
  const features = data.features
    .filter((feature) => !platformId || feature.platformId === platformId)
    .filter((feature) => !localFeature || feature.id === localFeature);
  const rows = useMemo(
    () =>
      data.rows.filter((row) => {
        if (factoryId && row.factoryId !== factoryId) return false;
        if (platformId && row.platformId !== platformId) return false;
        return true;
      }),
    [data.rows, factoryId, platformId],
  );

  function push(next: Record<string, string>) {
    router.replace(withQuery("/capabilities", { factory: factoryId, platform: platformId, feature: localFeature, ...next }));
  }

  return (
    <div>
      <PageHeader
        kicker="Capability"
        title="能力矩陣"
        description="每一列是一座工廠上的一個平台，每一欄是一項功能。格子是計畫要開或關。有版本的平台依提供版本與異動推導；只有功能開關的平台直接用計畫裡的啟用狀態。尚未規劃是 —。"
      />
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Pick label="工廠" value={factoryId} onChange={(value) => push({ factory: value })} options={data.factories.map((item) => ({ id: item.id, label: item.name }))} />
        <Pick label="平台" value={platformId} onChange={(value) => push({ platform: value, feature: "" })} options={data.platforms.map((item) => ({ id: item.id, label: item.name }))} />
        <Pick
          label="功能"
          value={localFeature}
          onChange={(value) => {
            setLocalFeature(value);
            push({ feature: value });
          }}
          options={data.features.filter((feature) => !platformId || feature.platformId === platformId).map((feature) => ({ id: feature.id, label: feature.name }))}
        />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1"><PlannedMark planned /> 計畫開啟</span>
        <span className="inline-flex items-center gap-1"><PlannedMark planned={false} /> 計畫關閉</span>
        <span className="inline-flex items-center gap-1"><PlannedMark planned={null} /> 尚未規劃</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">feature-flag only</span>
      </div>
      {rows.length === 0 || features.length === 0 ? (
        <EmptyState title="這個篩選沒有格子" body="放寬工廠或平台。沒有選平台時，其他平台的功能會顯示 —。" />
      ) : (
        <div className="overflow-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-[180px] border-b border-r border-line bg-white p-2">工廠 × 平台</th>
                {features.map((feature) => (
                  <th key={feature.id} className="sticky top-0 z-20 min-w-[88px] border-b border-line bg-white p-2 text-center">
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
                    <div>{row.platformName}</div>
                    {row.mode === "VERSIONED" ? (
                      <div className="font-mono text-muted">{row.versionLabel ?? "—"}</div>
                    ) : (
                      <div className="mt-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">{platformModeLabel.FEATURE_ONLY}</div>
                    )}
                  </th>
                  {features.map((feature) => {
                    const cell = row.cells.find((item) => item.featureId === feature.id);
                    if (!cell) return <td key={feature.id} className="border-b border-line p-2 text-center text-muted">—</td>;
                    return (
                      <td key={feature.id} className={cn("border-b border-line p-2 text-center", cell.planned === true && "bg-emerald-50/70", cell.planned === false && "bg-slate-50")}>
                        <PlannedMark planned={cell.planned} />
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

function PlannedMark({ planned }: { planned: boolean | null }) {
  if (planned === null) return <span className="text-base text-muted" title="尚未規劃">—</span>;
  if (planned) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-800" title="計畫開啟" aria-label="計畫開啟">
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
          <path d="M3.5 8.2 6.4 11l6.1-6.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-600" title="計畫關閉" aria-label="計畫關閉">
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
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
