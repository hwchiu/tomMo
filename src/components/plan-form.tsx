"use client";

import { useMemo, useState } from "react";
import { api } from "@/api";
import type { AdHocChange, PlannedFeature } from "@/domain/types";
import { productModeLabel, readinessFlagLabel, revisionActionLabel, windowReasonLabel, windowStateLabel } from "@/domain/labels";
import { cellReadiness } from "@/domain/readiness";
import { evaluateConstructionWindow } from "@/domain/windows";
import { MachineText } from "@/components/machines";
import { StatusChip } from "@/components/status-chip";
import { AsyncView, Button, Field, PageHeader, Panel, Skeleton, controlClass } from "@/components/ui";
import { toast } from "@/lib/toast";
import { useLiveQuery } from "@/lib/use-live-query";

export function PlanForm({ factoryId, productId }: { factoryId: string; productId: string }) {
  const state = useLiveQuery(`plan:${factoryId}:${productId}`, () => api.plan(factoryId, productId));
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-96" />}>
      {(data) => <Editor key={`${data.planId}-${data.revisions[0]?.id ?? "new"}-${data.status}`} data={data} />}
    </AsyncView>
  );
}

function Editor({ data }: { data: Awaited<ReturnType<typeof api.plan>> }) {
  const featureOnly = data.mode === "FEATURE_ONLY";
  const [versionId, setVersionId] = useState(data.providedVersionId ?? "");
  const [start, setStart] = useState(data.constructionStart ?? "");
  const [end, setEnd] = useState(data.constructionEnd ?? "");
  const [note, setNote] = useState(data.note);
  const [adhoc, setAdhoc] = useState<AdHocChange[]>(data.adHocChanges.map((change) => ({
    id: change.id,
    kind: change.kind,
    featureId: change.featureId,
    enabled: change.enabled,
    title: change.title,
    description: change.description,
  })));
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const feature of data.features) {
      const planned = data.plannedFeatures.find((row) => row.featureId === feature.id);
      next[feature.id] = planned ? planned.enabled : feature.defaultEnabled;
    }
    return next;
  });
  const [machines, setMachines] = useState(data.machines);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const plannedFeatures: PlannedFeature[] = data.features.map((feature) => ({ featureId: feature.id, enabled: enabled[feature.id] ?? feature.defaultEnabled }));
  const reasons = Object.fromEntries(
    plannedFeatures
      .filter((row) => {
        const feature = data.features.find((item) => item.id === row.featureId);
        return feature && row.enabled !== feature.defaultEnabled;
      })
      .map((row) => [row.featureId, adhoc.find((change) => change.featureId === row.featureId)?.description ?? ""]),
  );

  const preview = useMemo(
    () =>
      evaluateConstructionWindow(
        { start: start || null, end: end || null },
        data.phase2 ? { start: data.phase2.plannedStart, end: data.phase2.plannedEnd } : null,
      ),
    [start, end, data.phase2],
  );
  const readiness = cellReadiness({
    planStatus: data.status,
    windowState: preview.state,
    mode: data.mode,
    hasProvidedVersion: Boolean(versionId),
    featurePlanComplete: featureOnly ? plannedFeatures.length === data.features.length : true,
  });

  async function save(intent: "draft" | "submit") {
    setSaving(true);
    setError(null);
    try {
      await api.savePlan(data.factoryId, data.productId, {
        providedVersionId: featureOnly ? null : versionId || null,
        plannedFeatures: featureOnly ? plannedFeatures : [],
        reasons: featureOnly ? reasons : {},
        adHocChanges: featureOnly
          ? adhoc.filter((change) => change.kind === "CUSTOM")
          : adhoc,
        constructionStart: start || null,
        constructionEnd: end || null,
        machines: machines.map((line) => ({ machineTypeId: line.machineTypeId, planned: Math.max(0, Math.trunc(Number(line.planned) || 0)) })),
        note,
        intent,
      });
      toast(intent === "submit" ? "計畫已送出，等待 PM 核准" : "草稿已儲存");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker={`${data.factoryName} · 產品建立`}
        title={`${data.productName}施工計畫`}
        description={
          featureOnly
            ? "這個產品沒有版本，只使用功能開關。計畫要為每個功能選擇啟用或關閉。異動功能是相對預設被打開或關掉的項目。PM 核准且時程落在產品建立內，才算這個產品就緒。"
            : "產品團隊提報將提供的版本、施工時間，以及這座廠的特殊異動（功能覆寫或文字說明）。PM 核准且時程落在產品建立內，才算這個產品就緒。時程超出階段仍可核准。平行施工的重疊不需要處理。"
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <StatusChip kind="plan" value={data.status} />
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{productModeLabel[data.mode]}</span>
        <span className="text-muted">{data.accessNote}</span>
        <span className={preview.state === "OUTSIDE" ? "text-rose-700" : preview.state === "MISSING" ? "text-amber-800" : "text-emerald-800"}>
          {preview.state === "OUTSIDE" ? preview.reasons.map((reason) => windowReasonLabel[reason]).join("、") : windowStateLabel[preview.state]}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="p-4">
          <div className="grid gap-3 md:grid-cols-2">
            {featureOnly ? (
              <Field label="版本" hint="此產品為純功能開關，不使用版本。">
                <div className="flex h-10 items-center">
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">純功能開關</span>
                </div>
              </Field>
            ) : (
              <Field label="提供的版本">
                <select className={controlClass} value={versionId} disabled={!data.canEdit} onChange={(event) => setVersionId(event.target.value)}>
                  <option value="">尚未選擇</option>
                  {data.versions.map((version) => (
                    <option key={version.id} value={version.id}>{version.version} · {version.notes}</option>
                  ))}
                </select>
              </Field>
            )}
          {featureOnly ? null : (
            <Field label="實際部署版本" hint="由工程師在部署頁填報，計畫不直接改實際版本。">
                <input className={controlClass} value={data.actualVersion ?? "尚未填報"} disabled />
              </Field>
            )}
            <Field label="預計施工開始">
              <input className={controlClass} type="date" value={start} disabled={!data.canEdit} onChange={(event) => setStart(event.target.value)} />
            </Field>
            <Field label="預計施工結束">
              <input className={controlClass} type="date" value={end} disabled={!data.canEdit} onChange={(event) => setEnd(event.target.value)} />
            </Field>
          </div>
          {data.phase2 ? (
            <p className="mt-3 text-xs text-muted">
              產品建立區間 {data.phase2.plannedStart} – {data.phase2.plannedEnd}。
              {preview.state === "OUTSIDE" ? " 此時程超出階段，仍可送出，但不會視為就緒。" : " 落在區間內。"}
            </p>
          ) : null}
          <div className="mt-4">
            <h2 className="mb-1 text-sm font-semibold">計畫機台</h2>
            <p className="mb-2 text-xs text-muted">依機種填計畫數量。合計 {machines.reduce((sum, line) => sum + (Number(line.planned) || 0), 0)} 台。沒有實際到貨數。</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {machines.map((line) => (
                <Field key={line.machineTypeId} label={line.name}>
                  <input
                    className={controlClass}
                    type="number"
                    min={0}
                    step={1}
                    value={line.planned}
                    disabled={!data.canEdit}
                    onChange={(event) => {
                      const planned = Math.max(0, Math.trunc(Number(event.target.value) || 0));
                      setMachines(machines.map((item) => item.machineTypeId === line.machineTypeId ? { ...item, planned } : item));
                    }}
                  />
                </Field>
              ))}
            </div>
          </div>
          {featureOnly ? (
            <div className="mt-4">
              <h2 className="mb-1 text-sm font-semibold">功能集</h2>
              <p className="mb-2 text-xs text-muted">每個功能選擇啟用或關閉。預設值是這個產品的基準。</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr><th className="py-1">功能</th><th>預設</th><th>計畫</th></tr>
                  </thead>
                  <tbody>
                    {data.features.map((feature) => (
                      <tr key={feature.id} className="border-t border-line">
                        <td className="py-2">{feature.name}</td>
                        <td className="text-muted">{feature.defaultEnabled ? "開啟" : "關閉"}</td>
                        <td>
                          <select
                            className="h-8 rounded border border-line px-2"
                            value={enabled[feature.id] ? "on" : "off"}
                            disabled={!data.canEdit}
                            onChange={(event) => setEnabled({ ...enabled, [feature.id]: event.target.value === "on" })}
                          >
                            <option value="on">啟用</option>
                            <option value="off">關閉</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="mb-1 mt-4 text-sm font-semibold">異動說明</h3>
              <p className="mb-2 text-xs text-muted">和預設不同的功能要寫原因。與預設相同的項目不會列在這裡。</p>
              {Object.keys(reasons).length === 0 ? <p className="text-sm text-muted">與預設相同，沒有異動。</p> : (
                <ul className="space-y-2 text-sm">
                  {Object.keys(reasons).map((featureId) => (
                    <li key={featureId} className="grid gap-1">
                      <span>{(enabled[featureId] ? "+ 新增 " : "− 停用 ") + (data.features.find((feature) => feature.id === featureId)?.name ?? featureId)}</span>
                      <input
                        className={controlClass}
                        placeholder="異動說明"
                        disabled={!data.canEdit}
                        value={adhoc.find((change) => change.featureId === featureId)?.description ?? ""}
                        onChange={(event) => {
                          const description = event.target.value;
                          const existing = adhoc.find((change) => change.featureId === featureId);
                          if (existing) setAdhoc(adhoc.map((change) => change.featureId === featureId ? { ...change, description } : change));
                          else setAdhoc([...adhoc, { id: `new_${featureId}`, kind: "FEATURE_OVERRIDE", featureId, enabled: enabled[featureId], title: "", description }]);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <AdHocEditor features={data.features} changes={adhoc.filter((change) => change.kind === "CUSTOM")} disabled={!data.canEdit} onChange={(customs) => setAdhoc([...adhoc.filter((change) => change.kind !== "CUSTOM"), ...customs])} customOnly />
            </div>
          ) : (
            <AdHocEditor features={data.features} changes={adhoc} disabled={!data.canEdit} onChange={setAdhoc} />
          )}
          <div className="mt-4">
            <Field label="備註">
              <textarea className={`${controlClass} h-24 py-2`} value={note} disabled={!data.canEdit} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button tone="secondary" disabled={!data.canEdit || saving} onClick={() => void save("draft")}>儲存草稿</Button>
            <Button disabled={!data.canEdit || saving} onClick={() => void save("submit")}>送出提報</Button>
            <Button
              tone="secondary"
              disabled={!data.canApprove || saving}
              onClick={() => {
                void api.approvePlan(data.factoryId, data.productId).then(() => toast("已核准")).catch((caught: unknown) => {
                  setError(caught instanceof Error ? caught.message : "核准失敗");
                });
              }}
            >
              PM 核准
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            目前就緒判斷：{readiness.ready ? "可進入開發者進駐" : readiness.flags.map((flag) => readinessFlagLabel[flag]).join("、") || "—"}。
            主責 {data.primaryOwnerName} · 副責 {data.secondaryOwnerName} · {data.devDepartment} / {data.projectDepartment}
          </p>
        </Panel>
        <Panel className="p-4">
          <h2 className="mb-3 font-semibold">改版紀錄</h2>
          {data.revisions.length === 0 ? <p className="text-sm text-muted">還沒有提報或草稿。</p> : (
            <ol className="space-y-3">
              {data.revisions.map((revision) => (
                <li key={revision.id} className="border-l-2 border-line pl-3 text-sm">
                  <div className="text-xs text-muted">第 {revision.number} 版 · {revisionActionLabel[revision.action]} · {revision.actorName}</div>
                  <div>{featureOnly ? "純功能開關" : revision.version ?? "未選版本"} · {revision.constructionStart ?? "—"} – {revision.constructionEnd ?? "—"}</div>
                  <div className="text-xs text-muted"><MachineText lines={revision.machines} /></div>
                  <ul className="mt-1 text-xs text-muted">
                    {revision.adHocChanges.map((change) => (
                      <li key={`${revision.id}-${change.id}`}>{change.kind === "CUSTOM" ? change.title : `${change.enabled ? "+ 新增" : "− 停用"} ${change.featureName}`}{change.description ? `：${change.description}` : ""}</li>
                    ))}
                  </ul>
                  {revision.note ? <p className="text-xs">{revision.note}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

function AdHocEditor({
  features,
  changes,
  disabled,
  customOnly = false,
  onChange,
}: {
  features: Array<{ id: string; name: string }>;
  changes: AdHocChange[];
  disabled: boolean;
  customOnly?: boolean;
  onChange: (next: AdHocChange[]) => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <h2 className="text-sm font-semibold">特殊異動</h2>
      <p className="mb-2 text-xs text-muted">{customOnly ? "不綁功能的自由文字異動。" : "覆寫版本基準的功能開關，或一筆不綁功能的文字異動。"}</p>
      <div className="space-y-2">
        {changes.map((change, index) => (
          <div key={change.id || index} className="grid gap-2 md:grid-cols-[140px_1fr_1.2fr_auto]">
            {customOnly ? <span className="text-xs text-muted">文字異動</span> : (
              <select className={controlClass} value={change.kind} disabled={disabled} onChange={(event) => onChange(changes.map((item, itemIndex) => itemIndex === index ? { ...item, kind: event.target.value as AdHocChange["kind"], featureId: event.target.value === "CUSTOM" ? null : item.featureId || features[0]?.id || null } : item))}>
                <option value="FEATURE_OVERRIDE">功能覆寫</option>
                <option value="CUSTOM">文字異動</option>
              </select>
            )}
            {change.kind === "CUSTOM" ? (
              <input className={controlClass} placeholder="標題" value={change.title} disabled={disabled} onChange={(event) => onChange(changes.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} />
            ) : (
              <div className="flex gap-2">
                <select className={controlClass} value={change.featureId ?? ""} disabled={disabled} onChange={(event) => onChange(changes.map((item, itemIndex) => itemIndex === index ? { ...item, featureId: event.target.value } : item))}>
                  {features.map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}
                </select>
                <select className={controlClass} value={change.enabled ? "on" : "off"} disabled={disabled} onChange={(event) => onChange(changes.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.value === "on" } : item))}>
                  <option value="on">啟用</option>
                  <option value="off">關閉</option>
                </select>
              </div>
            )}
            <input className={controlClass} placeholder="異動說明" value={change.description} disabled={disabled} onChange={(event) => onChange(changes.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} />
            <button type="button" className="text-xs text-muted" disabled={disabled} onClick={() => onChange(changes.filter((_, itemIndex) => itemIndex !== index))}>移除</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3">
        {customOnly ? null : (
          <button type="button" className="text-sm text-accent" disabled={disabled} onClick={() => onChange([...changes, { id: `new_${Date.now()}`, kind: "FEATURE_OVERRIDE", featureId: features[0]?.id ?? null, enabled: true, title: "", description: "" }])}>新增功能覆寫</button>
        )}
        <button type="button" className="text-sm text-accent" disabled={disabled} onClick={() => onChange([...changes, { id: `new_${Date.now()}_c`, kind: "CUSTOM", featureId: null, enabled: null, title: "", description: "" }])}>新增文字異動</button>
      </div>
    </div>
  );
}
