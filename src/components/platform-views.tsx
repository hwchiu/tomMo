"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/api";
import { useApp } from "@/components/shell";
import { MachineText } from "@/components/machines";
import { StatusChip } from "@/components/status-chip";
import { AsyncView, Button, Field, PageHeader, Panel, Skeleton, controlClass } from "@/components/ui";
import { toast } from "@/lib/toast";
import { useLiveQuery } from "@/lib/use-live-query";

export function PlatformList() {
  const state = useLiveQuery("platforms", () => api.platforms());
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-80" />}>
      {(data) => (
        <div>
          <PageHeader
            kicker="Platform"
            title="平台"
            description="平台是全域定義，再部署到各工廠。開發部門、專案部門、主責與估計機台數在這裡維護；各廠的副責與機台覆寫在部署上。"
            actions={<Link href="/platforms/new" className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm text-white">新增平台</Link>}
          />
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((platform) => (
              <Link key={platform.id} href={`/platforms/${platform.id}`} className="rounded-xl border border-line bg-panel p-4 hover:border-accent">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs text-muted">{platform.code}</div>
                    <h2 className="text-lg font-semibold">{platform.name}</h2>
                  </div>
                  <span className="text-sm text-muted">{platform.latestVersion ?? "無版本"}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{platform.description}</p>
                <p className="mt-2 text-xs text-muted">{platform.devDepartment} · {platform.projectDepartment}</p>
                <p className="text-xs">主責 {platform.primaryOwnerName}</p>
                <p className="mt-1 text-xs">{platform.outdatedFactories ? <span className="text-amber-800">{platform.outdatedFactories} 座工廠落後最新版本</span> : "沒有工廠落後最新版本"}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </AsyncView>
  );
}

export function PlatformDetailView({ id }: { id: string }) {
  const state = useLiveQuery(`platform:${id}`, () => api.platform(id));
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-96" />}>
      {(data) => (
        <div>
          <PageHeader
            kicker={data.code}
            title={data.name}
            description={data.description}
            actions={<Link href={`/platforms/${data.id}/edit`} className="text-sm text-accent">編輯名稱與主責</Link>}
          />
          <div className="mb-4 text-sm text-muted">{data.devDepartment} / {data.projectDepartment} · 主責 {data.primaryOwnerName} · 最新 {data.latestVersion ?? "—"}</div>
          <Panel className="mb-4 p-4">
            <h2 className="mb-3 font-semibold">版本與支援功能</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {data.versions.map((version) => (
                <div key={version.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="font-mono font-semibold">{version.version}</div>
                  <p className="text-xs text-muted">{version.notes}</p>
                  <ul className="mt-2 text-xs">
                    {version.features.map((feature) => (
                      <li key={feature.id} className={feature.supported ? "" : "text-slate-400"}>{feature.supported ? "支援" : "不含"} {feature.name}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="p-4">
            <h2 className="mb-3 font-semibold">哪些工廠部署了它</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs text-muted"><tr><th className="py-2">工廠</th><th>狀態</th><th>計畫 / 實際</th><th>計畫狀態</th><th>副責</th><th>機台</th></tr></thead>
                <tbody>
                  {data.deployments.map((deployment) => (
                    <tr key={deployment.id} className="border-t border-line">
                      <td className="py-2"><Link className="hover:underline" href={`/factories/${deployment.factoryId}`}>{deployment.factoryName}</Link></td>
                      <td><StatusChip kind="deployment" value={deployment.status} /></td>
                      <td>
                        {deployment.plannedVersion ?? "—"} / {deployment.actualVersion ?? "未填"}
                        {deployment.behindLatest ? <span className="ml-1 text-amber-800">落後最新</span> : null}
                      </td>
                      <td><Link href={`/factories/${deployment.factoryId}/plans/${data.id}`}><StatusChip kind="plan" value={deployment.planStatus} /></Link></td>
                      <td>{deployment.secondaryOwnerName}</td>
                      <td><MachineText lines={deployment.machines} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </AsyncView>
  );
}

export function PlatformEditor({ id }: { id?: string }) {
  const app = useApp();
  const existing = useLiveQuery(id ? `platform-edit:${id}` : "platform-edit:new", () => id ? api.platform(id) : Promise.resolve(null));
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (!app || (id && existing.loading && !existing.data)) return <Skeleton className="h-64" />;
  const data = existing.data;
  return (
    <div>
      <PageHeader kicker="Platform" title={id ? `編輯 ${data?.name ?? ""}` : "新增平台"} description="新增後，每座工廠會出現一筆已規劃部署與未提報的施工計畫。" />
      <Panel className="p-4">
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const body = {
              code: String(form.get("code") ?? ""),
              name: String(form.get("name") ?? ""),
              description: String(form.get("description") ?? ""),
              devDepartment: String(form.get("devDepartment") ?? ""),
              projectDepartment: String(form.get("projectDepartment") ?? ""),
              primaryOwnerId: String(form.get("primaryOwnerId") ?? ""),
            };
            const action = id ? api.updatePlatform(id, body) : api.createPlatform(body);
            void action.then((result) => {
              toast(id ? "平台已更新" : "平台已建立");
              router.push(`/platforms/${result.id}`);
            }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "儲存失敗"));
          }}
        >
          <Field label="代碼"><input name="code" defaultValue={data?.code ?? ""} className={controlClass} required /></Field>
          <Field label="名稱"><input name="name" defaultValue={data?.name ?? ""} className={controlClass} required /></Field>
          <Field label="開發部門"><input name="devDepartment" defaultValue={data?.devDepartment ?? ""} className={controlClass} /></Field>
          <Field label="專案部門"><input name="projectDepartment" defaultValue={data?.projectDepartment ?? ""} className={controlClass} /></Field>
          <Field label="主責">
            <select name="primaryOwnerId" className={controlClass} defaultValue={data?.primaryOwnerId ?? app.currentUser.id}>
              {app.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </Field>
          <Field label="說明"><textarea name="description" defaultValue={data?.description ?? ""} className={`${controlClass} h-24 py-2 md:col-span-2`} /></Field>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <div><Button type="submit">儲存</Button></div>
        </form>
      </Panel>
    </div>
  );
}
