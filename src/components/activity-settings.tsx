"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/api";
import type { ProductSummary } from "@/api/types";
import { productModeLabel } from "@/domain/labels";
import type { MachineType, Person, ProductMode } from "@/domain/types";
import { useApp, useEditor } from "@/components/shell";
import { AsyncView, Button, Field, Panel, Skeleton, controlClass } from "@/components/ui";
import { toast } from "@/lib/toast";
import { useLiveQuery } from "@/lib/use-live-query";

export function ProductSettingsPanel() {
  const app = useApp();
  const editor = useEditor();
  const [error, setError] = useState<string | null>(null);
  if (!app) return <Skeleton className="h-40" />;
  return (
    <>
      <ProductSettings people={app.people} editor={editor} actorId={app.actor.id} onError={setError} />
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </>
  );
}

export function MachineSettingsPanel() {
  const app = useApp();
  const editor = useEditor();
  const [error, setError] = useState<string | null>(null);
  if (!app) return <Skeleton className="h-40" />;
  return (
    <Panel className="p-4">
      <h2 className="mb-1 font-semibold">機器設定</h2>
      <p className="mb-3 text-xs text-muted">機種名稱使用英文，例如 EIA-1。每座工廠、每個產品的計畫機台用這些名稱填，沒有實際到貨數。</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {app.machineTypes.map((item) => (
          <MachineTypeRow key={item.id} item={item} editor={editor} onError={setError} />
        ))}
      </ul>
      {editor ? <form
        className="mt-4 grid gap-2 border-t border-line pt-3 md:grid-cols-[1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void api.createMachineType({
            name: String(form.get("name") ?? ""),
          }).then(() => {
            toast("已新增機種");
            event.currentTarget.reset();
          }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "失敗"));
        }}
      >
        <Field label="名稱"><input name="name" className={controlClass} placeholder="EIA-5" /></Field>
        <div className="self-end"><Button type="submit">新增機種</Button></div>
      </form> : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </Panel>
  );
}

function ProductSettings({
  people,
  editor,
  actorId,
  onError,
}: {
  people: Person[];
  editor: boolean;
  actorId: string;
  onError: (message: string) => void;
}) {
  const state = useLiveQuery("settings-products", () => api.products());
  return (
    <Panel className="p-4">
      <h2 className="mb-1 font-semibold">產品設定</h2>
      <p className="mb-3 text-xs text-muted">新增與修改產品。版本與各廠部署仍在產品頁。這裡沒有刪除。</p>
      <AsyncView state={state} skeleton={<Skeleton className="h-40" />}>
        {(data) => (
          <ul className="divide-y divide-line">
            {data.items.map((product) => (
              <ProductRow key={product.id} product={product} people={people} editor={editor} onError={onError} />
            ))}
          </ul>
        )}
      </AsyncView>
      {editor ? <CreateProductForm people={people} actorId={actorId} onError={onError} /> : null}
    </Panel>
  );
}

function ProductRow({
  product,
  people,
  editor,
  onError,
}: {
  product: ProductSummary;
  people: Person[];
  editor: boolean;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [devDepartment, setDevDepartment] = useState(product.devDepartment);
  const [projectDepartment, setProjectDepartment] = useState(product.projectDepartment);
  const [primaryOwnerId, setPrimaryOwnerId] = useState(product.primaryOwnerId);
  const [mode, setMode] = useState<ProductMode>(product.mode === "FEATURE_ONLY" ? "FEATURE_ONLY" : "VERSIONED");
  return (
    <li className="py-3 text-sm">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <Link href={`/products/${product.id}`} className="font-medium hover:underline">{product.name}</Link>
        <span className="text-xs text-muted">{product.mode === "FEATURE_ONLY" ? productModeLabel.FEATURE_ONLY : product.latestVersion ?? "有版本"}</span>
      </div>
      {editor ? (
        <div className="grid gap-2 md:grid-cols-2">
          <Field label="名稱"><input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="主責">
            <select className={controlClass} value={primaryOwnerId} onChange={(event) => setPrimaryOwnerId(event.target.value)}>
              {people.filter((person) => person.active || person.id === product.primaryOwnerId).map((person) => (
                <option key={person.id} value={person.id}>{person.name} · {person.department}</option>
              ))}
            </select>
          </Field>
          <Field label="開發部門"><input className={controlClass} value={devDepartment} onChange={(event) => setDevDepartment(event.target.value)} /></Field>
          <Field label="專案部門"><input className={controlClass} value={projectDepartment} onChange={(event) => setProjectDepartment(event.target.value)} /></Field>
          <Field label="版本模式">
            <select className={controlClass} value={mode} onChange={(event) => setMode(event.target.value as ProductMode)}>
              <option value="VERSIONED">有版本</option>
              <option value="FEATURE_ONLY">純功能開關</option>
            </select>
          </Field>
          <Field label="說明"><input className={controlClass} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <div>
            <Button
              type="button"
              onClick={() => {
                void api.updateProduct(product.id, {
                  name,
                  description,
                  devDepartment,
                  projectDepartment,
                  primaryOwnerId,
                  mode,
                }).then(() => toast("產品已更新")).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "失敗"));
              }}
            >
              儲存產品
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">{product.devDepartment} · {product.projectDepartment} · 主責 {product.primaryOwnerName}</p>
      )}
    </li>
  );
}

function CreateProductForm({
  people,
  actorId,
  onError,
}: {
  people: Person[];
  actorId: string;
  onError: (message: string) => void;
}) {
  return (
    <form
      className="mt-4 grid gap-2 border-t border-line pt-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void api.createProduct({
          name: String(form.get("name") ?? ""),
          description: String(form.get("description") ?? ""),
          devDepartment: String(form.get("devDepartment") ?? ""),
          projectDepartment: String(form.get("projectDepartment") ?? ""),
          primaryOwnerId: String(form.get("primaryOwnerId") ?? ""),
          mode: String(form.get("mode") ?? "VERSIONED") as ProductMode,
        }).then(() => {
          toast("產品已建立");
          event.currentTarget.reset();
        }).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "失敗"));
      }}
    >
      <Field label="新產品名稱"><input name="name" className={controlClass} required /></Field>
      <Field label="主責">
        <select name="primaryOwnerId" className={controlClass} defaultValue={actorId}>
          {people.filter((person) => person.active).map((person) => (
            <option key={person.id} value={person.id}>{person.name} · {person.department}</option>
          ))}
        </select>
      </Field>
      <Field label="開發部門"><input name="devDepartment" className={controlClass} /></Field>
      <Field label="專案部門"><input name="projectDepartment" className={controlClass} /></Field>
      <Field label="版本模式">
        <select name="mode" className={controlClass} defaultValue="VERSIONED">
          <option value="VERSIONED">有版本</option>
          <option value="FEATURE_ONLY">純功能開關</option>
        </select>
      </Field>
      <Field label="說明"><input name="description" className={controlClass} /></Field>
      <div><Button type="submit">新增產品</Button></div>
    </form>
  );
}

function MachineTypeRow({ item, editor, onError }: { item: MachineType; editor: boolean; onError: (message: string) => void }) {
  const [name, setName] = useState(item.name);
  const [active, setActive] = useState(item.active);
  return (
    <li className="text-sm">
      <input className={`${controlClass} mt-1`} value={name} disabled={!editor} onChange={(event) => setName(event.target.value)} />
      <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={active} disabled={!editor} onChange={(event) => setActive(event.target.checked)} />啟用</label>
      {editor ? <button
        type="button"
        className="mt-1 text-xs text-accent"
        onClick={() => {
          void api.updateMachineType(item.id, { name, active }).then(() => toast("機種已更新")).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "失敗"));
        }}
      >
        儲存名稱
      </button> : null}
    </li>
  );
}
