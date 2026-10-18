"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/api";
import { productModeLabel } from "@/domain/labels";
import type { ProductMode } from "@/domain/types";
import { useApp, WhenEditor } from "@/components/shell";
import { MachineText } from "@/components/machines";
import { StatusChip } from "@/components/status-chip";
import { AsyncView, Button, Field, PageHeader, Panel, Skeleton, controlClass } from "@/components/ui";
import { toast } from "@/lib/toast";
import { useLiveQuery } from "@/lib/use-live-query";

export function ProductList() {
  const state = useLiveQuery("products", () => api.products());
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-80" />}>
      {(data) => (
        <div>
          <PageHeader
            kicker="Product"
            title="產品"
            description="產品是全域定義，再部署到各工廠。開發部門、專案部門、主責與估計機台數在這裡維護；各廠的副責與機台覆寫在部署上。"
            actions={<WhenEditor><Link href="/products/new" className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm text-white">新增產品</Link></WhenEditor>}
          />
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`} className="rounded-xl border border-line bg-panel p-4 hover:border-accent">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{product.name}</h2>
                  </div>
                  <span className="text-sm text-muted">{product.mode === "FEATURE_ONLY" ? productModeLabel.FEATURE_ONLY : product.latestVersion ?? "無版本"}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{product.description}</p>
                <p className="mt-2 text-xs text-muted">{product.devDepartment} · {product.projectDepartment}</p>
                <p className="text-xs">主責 {product.primaryOwnerName}</p>
                <p className="mt-1 text-xs">{product.mode === "FEATURE_ONLY" ? "沒有版本，各廠用功能開關規劃。" : product.outdatedFactories ? <span className="text-amber-800">{product.outdatedFactories} 座工廠落後最新版本</span> : "沒有工廠落後最新版本"}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </AsyncView>
  );
}

export function ProductDetailView({ id }: { id: string }) {
  const state = useLiveQuery(`product:${id}`, () => api.product(id));
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-96" />}>
      {(data) => (
        <div>
          <PageHeader
            kicker={data.mode === "FEATURE_ONLY" ? productModeLabel.FEATURE_ONLY : "有版本"}
            title={data.name}
            description={data.description}
            actions={<WhenEditor><Link href={`/products/${data.id}/edit`} className="text-sm text-accent">編輯名稱與主責</Link></WhenEditor>}
          />
          <div className="mb-4 text-sm text-muted">{data.devDepartment} / {data.projectDepartment} · 主責 {data.primaryOwnerName} · {data.mode === "FEATURE_ONLY" ? productModeLabel.FEATURE_ONLY : `最新 ${data.latestVersion ?? "—"}`}</div>
          <Panel className="mb-4 p-4">
            {data.mode === "FEATURE_ONLY" ? (
              <>
                <h2 className="mb-1 font-semibold">功能與預設</h2>
                <p className="mb-3 text-xs text-muted">此產品沒有版本。各廠計畫相對這些預設決定要開或關。</p>
                <ul className="space-y-1 text-sm">
                  {data.features.map((feature) => (
                    <li key={feature.id}>{feature.name} · 預設{feature.defaultEnabled ? "開啟" : "關閉"}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
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
              </>
            )}
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
                        {data.mode === "FEATURE_ONLY" ? "—" : (
                          <>
                            {deployment.plannedVersion ?? "—"} / {deployment.actualVersion ?? "未填"}
                            {deployment.behindLatest ? <span className="ml-1 text-amber-800">落後最新</span> : null}
                          </>
                        )}
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

export function ProductEditor({ id }: { id?: string }) {
  const app = useApp();
  const existing = useLiveQuery(id ? `product-edit:${id}` : "product-edit:new", () => id ? api.product(id) : Promise.resolve(null));
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (!app || (id && existing.loading && !existing.data)) return <Skeleton className="h-64" />;
  const data = existing.data;
  return (
    <div>
      <PageHeader kicker="Product" title={id ? `編輯 ${data?.name ?? ""}` : "新增產品"} description="新增後，每座工廠會出現一筆已規劃部署與未提報的施工計畫。" />
      <Panel className="p-4">
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const body = {
              name: String(form.get("name") ?? ""),
              description: String(form.get("description") ?? ""),
              devDepartment: String(form.get("devDepartment") ?? ""),
              projectDepartment: String(form.get("projectDepartment") ?? ""),
              primaryOwnerId: String(form.get("primaryOwnerId") ?? ""),
              mode: String(form.get("mode") ?? "VERSIONED") as ProductMode,
            };
            const action = id ? api.updateProduct(id, body) : api.createProduct(body);
            void action.then((result) => {
              toast(id ? "產品已更新" : "產品已建立");
              router.push(`/products/${result.id}`);
            }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "儲存失敗"));
          }}
        >
          <Field label="名稱"><input name="name" defaultValue={data?.name ?? ""} className={controlClass} required /></Field>
          <Field label="開發部門"><input name="devDepartment" defaultValue={data?.devDepartment ?? ""} className={controlClass} /></Field>
          <Field label="專案部門"><input name="projectDepartment" defaultValue={data?.projectDepartment ?? ""} className={controlClass} /></Field>
          <Field label="主責">
            <select name="primaryOwnerId" className={controlClass} defaultValue={data?.primaryOwnerId ?? app.actor.id}>
              {app.people.filter((person) => person.active || person.id === data?.primaryOwnerId).map((person) => <option key={person.id} value={person.id}>{person.name} · {person.department}</option>)}
            </select>
          </Field>
          <Field label="版本模式" hint="純功能開關的產品沒有版本，各廠計畫只填功能開關。">
            <select name="mode" className={controlClass} defaultValue={data?.mode ?? "VERSIONED"}>
              <option value="VERSIONED">有版本</option>
              <option value="FEATURE_ONLY">純功能開關</option>
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
