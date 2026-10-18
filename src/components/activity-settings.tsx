"use client";

import { useState } from "react";
import { api } from "@/api";
import { enumSetLabel } from "@/domain/labels";
import type { Enumeration } from "@/domain/types";
import type { MachineType } from "@/domain/types";
import { useApp, useEditor } from "@/components/shell";
import { AsyncView, Button, Field, PageHeader, Panel, Skeleton, controlClass } from "@/components/ui";
import { formatWhen } from "@/domain/dates";
import { toast } from "@/lib/toast";
import { useLiveQuery } from "@/lib/use-live-query";

export function ActivityView() {
  const state = useLiveQuery("activity", () => api.activity());
  const [kind, setKind] = useState("");
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-80" />}>
      {(data) => {
        const items = data.items.filter((item) => !kind || item.entityType === kind);
        return (
          <div>
            <PageHeader kicker="Activity" title="活動紀錄" description="狀態、版本、功能開關與施工計畫的變更都會留在這裡。這是工廠與產品共用的軌跡。" />
            <select className="mb-3 h-8 rounded-md border border-line bg-white px-2 text-sm" value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="">全部類型</option>
              {["FACTORY", "PHASE", "MILESTONE", "ISSUE", "DEPLOYMENT", "FEATURE", "PLAN", "PRODUCT", "ENUM", "MACHINE"].map((item) => <option key={item}>{item}</option>)}
            </select>
            {items.length === 0 ? <p className="text-sm text-muted">沒有這個類型的紀錄。</p> : (
              <ol className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">
                    <div className="text-xs text-muted">{formatWhen(item.createdAt)} · {item.actorName} · {item.entityType} · {item.action}</div>
                    <div>{item.summary}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      }}
    </AsyncView>
  );
}

export function SettingsView() {
  const app = useApp();
  const editor = useEditor();
  const [error, setError] = useState<string | null>(null);
  if (!app) return <Skeleton className="h-64" />;
  const sets = ["factoryCategory", "factoryRegion", "technologyNode"] as const;
  return (
    <div>
      <PageHeader kicker="Settings" title="列舉設定" description="廠別、區域、製程節點與機種都是資料。機種用來填每座工廠、每個產品的計畫機台，沒有實際到貨數。" />
      <Panel className="mb-4 p-4">
        <h2 className="mb-3 font-semibold">機種 Machine type</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {app.machineTypes.map((item) => (
            <MachineTypeRow key={item.id} item={item} editor={editor} onError={setError} />
          ))}
        </ul>
        {editor ? <form
          className="mt-4 grid gap-2 border-t border-line pt-3 md:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void api.createMachineType({
              code: String(form.get("code") ?? ""),
              name: String(form.get("name") ?? ""),
            }).then(() => {
              toast("已新增機種");
              event.currentTarget.reset();
            }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "失敗"));
          }}
        >
          <Field label="代碼"><input name="code" className={controlClass} placeholder="C" /></Field>
          <Field label="名稱"><input name="name" className={controlClass} placeholder="機種C" /></Field>
          <div className="self-end"><Button type="submit">新增機種</Button></div>
        </form> : null}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-3">
        {sets.map((set) => (
          <Panel key={set} className="p-4">
            <h2 className="mb-3 font-semibold">{enumSetLabel[set]}</h2>
            <ul className="space-y-3">
              {app.enumerations.filter((item) => item.set === set).map((item) => (
                <EnumRow key={item.id} item={item} editor={editor} onError={setError} />
              ))}
            </ul>
            {editor ? <form
              className="mt-4 space-y-2 border-t border-line pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void api.createEnumeration({
                  set,
                  code: String(form.get("code") ?? ""),
                  label: String(form.get("label") ?? ""),
                  description: String(form.get("description") ?? ""),
                }).then(() => {
                  toast("已新增列舉");
                  event.currentTarget.reset();
                }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "失敗"));
              }}
            >
              <Field label="代碼"><input name="code" className={controlClass} placeholder="N2E" /></Field>
              <Field label="顯示名稱"><input name="label" className={controlClass} placeholder="N2E" /></Field>
              <Field label="說明"><input name="description" className={controlClass} /></Field>
              <Button type="submit">新增</Button>
            </form> : null}
          </Panel>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

function MachineTypeRow({ item, editor, onError }: { item: MachineType; editor: boolean; onError: (message: string) => void }) {
  const [name, setName] = useState(item.name);
  const [active, setActive] = useState(item.active);
  return (
    <li className="text-sm">
      <div className="font-mono text-[11px] text-muted">{item.code}</div>
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

function EnumRow({ item, editor, onError }: { item: Enumeration; editor: boolean; onError: (message: string) => void }) {
  const [label, setLabel] = useState(item.label);
  const [description, setDescription] = useState(item.description);
  const [active, setActive] = useState(item.active);
  return (
    <li className="text-sm">
      <div className="font-mono text-[11px] text-muted">{item.code}</div>
      <input className={`${controlClass} mt-1`} value={label} disabled={!editor} onChange={(event) => setLabel(event.target.value)} />
      <input className={`${controlClass} mt-1`} value={description} disabled={!editor} onChange={(event) => setDescription(event.target.value)} />
      <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={active} disabled={!editor} onChange={(event) => setActive(event.target.checked)} />啟用</label>
      {editor ? <button
        type="button"
        className="mt-1 text-xs text-accent"
        onClick={() => {
          void api.updateEnumeration(item.id, { label, description, active }).then(() => toast("已更新")).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "失敗"));
        }}
      >
        儲存
      </button> : null}
    </li>
  );
}
