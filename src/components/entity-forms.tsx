"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/api";
import type { FactoryDetail } from "@/api/types";
import { factoryCategories, factoryRegions } from "@/domain/factory-attr";
import { factoryStatusLabel, phaseStatusLabel, relationLabel } from "@/domain/labels";
import type { DeploymentStatus, FactoryStatus, PhaseLinkRelation, PhaseStatus } from "@/domain/types";
import { deploymentStatusLabel } from "@/domain/labels";
import { MachineText } from "@/components/machines";
import { useApp, WhenEditor } from "@/components/shell";
import { AsyncView, Button, Field, PageHeader, Panel, Skeleton, controlClass } from "@/components/ui";
import { toast } from "@/lib/toast";
import { useLiveQuery } from "@/lib/use-live-query";

export function FactoryForm({ id }: { id?: string }) {
  const app = useApp();
  const state = useLiveQuery(id ? `edit-factory:${id}` : "edit-factory:new", () => (id ? api.factory(id) : Promise.resolve(null)));
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (!app) return <Skeleton className="h-40" />;
  return (
    <AsyncView state={id ? state : { loading: false, error: null, data: null }} allowEmpty={!id} skeleton={<Skeleton className="h-64" />}>
      {(data) => (
        <div>
          <PageHeader kicker="Factory" title={id ? `編輯 ${data?.name ?? ""}` : "新增工廠"} description="建立時會複製四個標準階段，之後仍可改名、排序、加階段與改日期。" />
          <Panel className="p-4">
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const body = {
                  code: String(form.get("code") ?? ""),
                  name: String(form.get("name") ?? ""),
                  location: String(form.get("location") ?? ""),
                  description: String(form.get("description") ?? ""),
                  category: String(form.get("category") ?? ""),
                  region: String(form.get("region") ?? ""),
                  pmId: String(form.get("pmId") ?? ""),
                  plannedStart: String(form.get("plannedStart") ?? ""),
                  plannedEnd: String(form.get("plannedEnd") ?? data?.plannedEnd ?? ""),
                  status: String(form.get("status") ?? "ON_TRACK") as FactoryStatus,
                };
                const action = id ? api.updateFactory(id, body) : api.createFactory(body);
                void action.then((result) => {
                  toast(id ? "工廠已更新" : "工廠已建立，四個階段已複製");
                  router.push(`/factories/${id ?? result.id}`);
                }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "儲存失敗"));
              }}
            >
              <Field label="代碼"><input name="code" defaultValue={data?.code ?? ""} className={controlClass} required /></Field>
              <Field label="名稱"><input name="name" defaultValue={data?.name ?? ""} className={controlClass} required /></Field>
              <Field label="地點"><input name="location" defaultValue={data?.location ?? ""} className={controlClass} /></Field>
              <FixedSelect name="category" label="類別 Category" options={factoryCategories} value={data?.category} />
              <FixedSelect name="region" label="區域 Region" options={factoryRegions} value={data?.region} />
              <Field label="廠區 TPM">
                <select name="pmId" className={controlClass} defaultValue={data?.pmId ?? app.actor.id}>
                  {app.people.filter((person) => person.active || person.id === data?.pmId).map((person) => <option key={person.id} value={person.id}>{person.name} · {person.department}</option>)}
                </select>
              </Field>
              <Field label="狀態">
                <select name="status" className={controlClass} defaultValue={data?.status ?? "ON_TRACK"}>
                  {Object.entries(factoryStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label={id ? "計畫開始" : "第一階段開始"}>
                <input name="plannedStart" type="date" defaultValue={data?.plannedStart ?? app.asOf} className={controlClass} required />
              </Field>
              {id ? <Field label="計畫結束"><input name="plannedEnd" type="date" defaultValue={data?.plannedEnd} className={controlClass} required /></Field> : null}
              <Field label="說明"><textarea name="description" defaultValue={data?.description ?? ""} className={`${controlClass} h-24 py-2 md:col-span-2`} /></Field>
              {error ? <p className="text-sm text-rose-700">{error}</p> : null}
              <div><Button type="submit">儲存</Button></div>
            </form>
          </Panel>
        </div>
      )}
    </AsyncView>
  );
}

function FixedSelect({ name, label, options, value }: { name: string; label: string; options: ReadonlyArray<{ code: string; label: string }>; value?: string }) {
  return (
    <Field label={label}>
      <select name={name} className={controlClass} defaultValue={value ?? options[0]?.code}>
        {options.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
      </select>
    </Field>
  );
}

export function PhaseForm({ factoryId, phaseId }: { factoryId: string; phaseId?: string }) {
  const state = useLiveQuery(`phase-form:${factoryId}`, () => api.factory(factoryId));
  const app = useApp();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-64" />}>
      {(factory) => {
        const phase = factory.phases.find((item) => item.id === phaseId);
        return (
          <div>
            <PageHeader kicker={factory.name} title={phase ? `編輯 ${phase.name}` : "新增階段"} description="階段從範本複製而來，每座工廠可以改名、改順序、改日期與依賴。" />
            <Panel className="p-4">
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const body = {
                    name: String(form.get("name") ?? ""),
                    order: Number(form.get("order") ?? 1),
                    ownerId: String(form.get("ownerId") ?? ""),
                    plannedStart: String(form.get("plannedStart") ?? ""),
                    plannedEnd: String(form.get("plannedEnd") ?? ""),
                    actualStart: String(form.get("actualStart") ?? "") || null,
                    actualEnd: String(form.get("actualEnd") ?? "") || null,
                    status: String(form.get("status") ?? "NOT_STARTED") as PhaseStatus,
                    riskNote: String(form.get("riskNote") ?? ""),
                    dependsOnPhaseIds: form.getAll("dependsOn").map(String),
                  };
                  const action = phase ? api.updatePhase(phase.id, body) : api.createPhase(factoryId, body);
                  void action.then(() => {
                    toast("階段已儲存");
                    router.push(`/factories/${factoryId}#timeline`);
                  }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "儲存失敗"));
                }}
              >
                <Field label="名稱"><input name="name" defaultValue={phase?.name ?? ""} className={controlClass} required /></Field>
                <Field label="順序"><input name="order" type="number" defaultValue={phase?.order ?? factory.phases.length + 1} className={controlClass} /></Field>
                <Field label="負責人">
                  <select name="ownerId" className={controlClass} defaultValue={phase?.ownerId ?? app?.actor.id}>
                    {(app?.people ?? []).filter((person) => person.active || person.id === phase?.ownerId).map((person) => <option key={person.id} value={person.id}>{person.name} · {person.department}</option>)}
                  </select>
                </Field>
                <Field label="狀態">
                  <select name="status" className={controlClass} defaultValue={phase?.status ?? "NOT_STARTED"}>
                    {Object.entries(phaseStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="計畫開始"><input name="plannedStart" type="date" defaultValue={phase?.plannedStart ?? factory.asOf} className={controlClass} required /></Field>
                <Field label="計畫結束"><input name="plannedEnd" type="date" defaultValue={phase?.plannedEnd ?? factory.asOf} className={controlClass} required /></Field>
                <Field label="實際開始"><input name="actualStart" type="date" defaultValue={phase?.actualStart ?? ""} className={controlClass} /></Field>
                <Field label="實際結束"><input name="actualEnd" type="date" defaultValue={phase?.actualEnd ?? ""} className={controlClass} /></Field>
                <Field label="風險"><textarea name="riskNote" defaultValue={phase?.riskNote ?? ""} className={`${controlClass} h-20 py-2 md:col-span-2`} /></Field>
                <fieldset className="md:col-span-2">
                  <legend className="mb-1 text-xs text-muted">依賴的階段</legend>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {factory.phases.filter((item) => item.id !== phase?.id).map((item) => (
                      <label key={item.id} className="flex items-center gap-1">
                        <input type="checkbox" name="dependsOn" value={item.id} defaultChecked={phase?.dependsOn.includes(item.name)} />
                        {item.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <MilestoneCreator phaseId={phase?.id} factory={factory} />
                {error ? <p className="text-sm text-rose-700">{error}</p> : null}
                <div><Button type="submit">儲存階段</Button></div>
              </form>
            </Panel>
          </div>
        );
      }}
    </AsyncView>
  );
}

function MilestoneCreator({ phaseId, factory }: { phaseId?: string; factory: FactoryDetail }) {
  const app = useApp();
  const [name, setName] = useState("");
  if (!phaseId) return null;
  return (
    <div className="md:col-span-2 rounded-lg border border-dashed border-line p-3">
      <h3 className="text-sm font-medium">加一個里程碑</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <input className={controlClass} placeholder="名稱" value={name} onChange={(event) => setName(event.target.value)} />
        <Button
          tone="secondary"
          onClick={() => {
            if (!name.trim()) return;
            void api.createMilestone(phaseId, {
              name,
              dueDate: factory.asOf,
              deliverables: "",
              ownerId: app?.actor.id ?? factory.pmId,
              done: false,
            }).then(() => {
              setName("");
              toast("已新增里程碑");
            });
          }}
        >
          加入
        </Button>
      </div>
    </div>
  );
}

export function DeploymentForm({ id }: { id: string }) {
  const state = useLiveQuery(`deployment:${id}`, () => api.deployment(id));
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-80" />}>
      {(data) => (
        <div>
          <PageHeader
            kicker={data.factoryName}
            title={`${data.productName}部署`}
            description={data.mode === "FEATURE_ONLY" ? "這個產品沒有版本。實際啟用的功能由工程師手動填報。" : "實際版本與功能由工程師手動填報。之後若要自動同步，可以走同一支更新介面，不必改畫面。"}
          />
          <Panel className="p-4">
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const links = (Object.keys(relationLabel) as PhaseLinkRelation[]).flatMap((relation) =>
                  form.getAll(`link-${relation}`).map((phaseId) => ({ phaseId: String(phaseId), relation })),
                );
                const features = data.features.map((feature) => ({
                  featureId: feature.id,
                  desired: form.get(`desired-${feature.id}`) === "on",
                  actual: form.get(`actual-${feature.id}`) === "" ? null : form.get(`actual-${feature.id}`) === "true",
                }));
                void api.updateDeployment(id, {
                  plannedVersionId: data.mode === "FEATURE_ONLY" ? null : String(form.get("plannedVersionId") ?? "") || null,
                  actualVersionId: data.mode === "FEATURE_ONLY" ? null : String(form.get("actualVersionId") ?? "") || null,
                  status: String(form.get("status") ?? "PLANNED") as DeploymentStatus,
                  secondaryOwnerId: String(form.get("secondaryOwnerId") ?? ""),
                  plannedDate: String(form.get("plannedDate") ?? "") || null,
                  deployedAt: String(form.get("deployedAt") ?? "") || null,
                  notes: String(form.get("notes") ?? ""),
                  links,
                  features,
                }).then(() => {
                  toast("部署已更新");
                  router.push(`/factories/${data.factoryId}#deployments`);
                }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "儲存失敗"));
              }}
            >
              {data.mode === "FEATURE_ONLY" ? (
                <div className="md:col-span-2">
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">純功能開關</span>
                  <p className="mt-1 text-xs text-muted">此產品不填版本。功能的期望來自施工計畫，實際狀態在下面填報。</p>
                </div>
              ) : (
                <>
                  <Field label="計畫版本">
                    <select name="plannedVersionId" className={controlClass} defaultValue={data.plannedVersionId ?? ""}>
                      <option value="">—</option>
                      {data.versions.map((version) => <option key={version.id} value={version.id}>{version.version}</option>)}
                    </select>
                  </Field>
                  <Field label="實際版本">
                    <select name="actualVersionId" className={controlClass} defaultValue={data.actualVersionId ?? ""}>
                      <option value="">尚未填報</option>
                      {data.versions.map((version) => <option key={version.id} value={version.id}>{version.version}</option>)}
                    </select>
                  </Field>
                </>
              )}
              <Field label="狀態">
                <select name="status" className={controlClass} defaultValue={data.status}>
                  {Object.entries(deploymentStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="副責">
                <select name="secondaryOwnerId" className={controlClass} defaultValue={data.secondaryOwnerId}>
                  {data.people.filter((person) => person.active || person.id === data.secondaryOwnerId).map((person) => <option key={person.id} value={person.id}>{person.name} · {person.department}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
                計畫機台在施工計畫裡填，這裡只顯示：<MachineText lines={data.machines} />
              </div>
              <Field label="計畫日期"><input name="plannedDate" type="date" defaultValue={data.plannedDate ?? ""} className={controlClass} /></Field>
              <Field label="部署日期"><input name="deployedAt" type="date" defaultValue={data.deployedAt ?? ""} className={controlClass} /></Field>
              <Field label="備註"><input name="notes" defaultValue={data.notes} className={controlClass} /></Field>
              <fieldset className="md:col-span-2">
                <legend className="mb-1 text-xs text-muted">與階段的關係</legend>
                {(Object.keys(relationLabel) as PhaseLinkRelation[]).map((relation) => (
                  <div key={relation} className="mb-2">
                    <div className="text-xs">{relationLabel[relation]}</div>
                    <div className="flex flex-wrap gap-3">
                      {data.phases.map((phase) => (
                        <label key={phase.id} className="text-sm">
                          <input type="checkbox" name={`link-${relation}`} value={phase.id} defaultChecked={data.links.some((link) => link.phaseId === phase.id && link.relation === relation)} /> {phase.name.split(" ")[0]}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>
              <div className="md:col-span-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted"><tr><th>功能</th><th>期望</th><th>實際</th><th>{data.mode === "FEATURE_ONLY" ? "預設" : "此實際版本支援"}</th></tr></thead>
                  <tbody>
                    {data.features.map((feature) => (
                      <tr key={feature.id} className="border-t border-line">
                        <td className="py-2">{feature.name}</td>
                        <td><input type="checkbox" name={`desired-${feature.id}`} defaultChecked={feature.desired} /></td>
                        <td>
                          <select name={`actual-${feature.id}`} className="h-8 rounded border border-line px-2" defaultValue={feature.actual === null ? "" : String(feature.actual)}>
                            <option value="">未填</option>
                            <option value="true">啟用</option>
                            <option value="false">關閉</option>
                          </select>
                        </td>
                        <td>{data.mode === "FEATURE_ONLY" ? (feature.defaultEnabled ? "開啟" : "關閉") : feature.supportedByActual === null ? "—" : feature.supportedByActual ? "是" : "否"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {error ? <p className="text-sm text-rose-700">{error}</p> : null}
              <div><Button type="submit">儲存實際狀態</Button></div>
            </form>
          </Panel>
        </div>
      )}
    </AsyncView>
  );
}

export function FactoryDirectory() {
  const state = useLiveQuery("factory-dir", () => api.factories());
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-64" />}>
      {(data) => (
        <div>
          <PageHeader kicker="Factory" title="工廠簡介" description="每座工廠有自己的階段副本。類別是 Giga 或 Phase，區域是 HQ、JP、AZ、EU。廠名就是這座廠。" actions={<WhenEditor><Link href="/factories/new" className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm text-white">新增工廠</Link></WhenEditor>} />
          {data.items.length === 0 ? <p className="text-sm text-muted">還沒有工廠。</p> : (
            <div className="overflow-x-auto rounded-xl border border-line bg-panel">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs text-muted"><tr><th className="p-3">工廠</th><th>類別</th><th>區域</th><th>狀態</th><th>目前階段</th><th>TPM</th></tr></thead>
                <tbody>
                  {data.items.map((factory) => (
                    <tr key={factory.id} className="border-t border-line">
                      <td className="p-3"><Link className="font-medium hover:underline" href={`/factories/${factory.id}`}>{factory.name}</Link><div className="font-mono text-[11px] text-muted">{factory.code}</div></td>
                      <td>{factory.categoryLabel}</td>
                      <td>{factory.regionLabel}</td>
                      <td>{factory.status}</td>
                      <td>{factory.currentPhaseOrder}. {factory.currentPhaseName}</td>
                      <td>{factory.pmName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AsyncView>
  );
}
