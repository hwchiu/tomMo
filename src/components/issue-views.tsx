"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/api";
import type { IssueListItem, IssuePage } from "@/api/types";
import { issueStatusLabel, severityLabel } from "@/domain/labels";
import type { IssueSeverity, IssueStatus } from "@/domain/types";
import { useApp, WhenEditor } from "@/components/shell";
import { StatusChip } from "@/components/status-chip";
import { AsyncView, Button, EmptyState, Field, PageHeader, Panel, Skeleton, controlClass } from "@/components/ui";
import { toast } from "@/lib/toast";
import { useLiveQuery } from "@/lib/use-live-query";

export function IssueList({ factoryId, severity, status, overdue }: { factoryId: string; severity: string; status: string; overdue: boolean }) {
  const state = useLiveQuery("issues", () => api.issues());
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-80" />}>
      {(data) => <List items={data.items} asOf={data.asOf} factoryId={factoryId} severity={severity} status={status} overdue={overdue} />}
    </AsyncView>
  );
}

function List({
  items,
  asOf,
  factoryId,
  severity,
  status,
  overdue,
}: {
  items: IssueListItem[];
  asOf: string;
  factoryId: string;
  severity: string;
  status: string;
  overdue: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const factories = [...new Map(items.map((item) => [item.factoryId, item.factoryName])).entries()];
  const visible = items.filter((item) => {
    if (factoryId && item.factoryId !== factoryId) return false;
    if (severity && item.severity !== severity) return false;
    if (status && item.status !== status) return false;
    if (overdue && !item.overdue) return false;
    if (q && !`${item.title} ${item.code}`.includes(q)) return false;
    return true;
  });
  function push(next: { factory?: string; severity?: string; status?: string; overdue?: string }) {
    const params = new URLSearchParams();
    const merged = { factory: factoryId, severity, status, overdue: overdue ? "1" : "", ...next };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const text = params.toString();
    router.replace(text ? `/issues?${text}` : "/issues");
  }
  return (
    <div>
      <PageHeader kicker="Issue" title="問題與阻礙" description="跨工廠看逾期、嚴重程度與所屬工廠。開啟中的問題若過了基準日，會標成逾期。" actions={<WhenEditor><Link className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm text-white" href="/issues/new">登錄問題</Link></WhenEditor>} />
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="h-8 rounded-md border border-line px-2 text-sm" placeholder="搜尋標題" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className="h-8 rounded-md border border-line bg-white px-2 text-sm" value={factoryId} onChange={(event) => push({ factory: event.target.value })}>
          <option value="">全部工廠</option>
          {factories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select className="h-8 rounded-md border border-line bg-white px-2 text-sm" value={severity} onChange={(event) => push({ severity: event.target.value })}>
          <option value="">全部嚴重度</option>
          {Object.entries(severityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="h-8 rounded-md border border-line bg-white px-2 text-sm" value={status} onChange={(event) => push({ status: event.target.value })}>
          <option value="">全部狀態</option>
          {Object.entries(issueStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" className={`h-8 rounded-full px-3 text-sm ${overdue ? "bg-ink text-white" : "border border-line bg-white"}`} onClick={() => push({ overdue: overdue ? "" : "1" })}>
          只看逾期
        </button>
        <span className="self-center text-xs text-muted">基準日 {asOf}</span>
      </div>
      {visible.length === 0 ? <EmptyState title="沒有符合的問題" body="清除篩選，或登錄一筆新的阻礙。" action={<Link href="/issues" className="text-sm text-accent">清除篩選</Link>} /> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="p-3">問題</th><th>工廠</th><th>嚴重度</th><th>狀態</th><th>到期</th><th>負責人</th></tr></thead>
            <tbody>
              {visible.map((issue) => (
                <tr key={issue.id} className="border-t border-line">
                  <td className="p-3">
                    <Link href={`/issues/${issue.id}`} className="font-medium hover:underline">{issue.title}</Link>
                    <div className="font-mono text-[11px] text-muted">{issue.code}</div>
                  </td>
                  <td>{issue.factoryName}</td>
                  <td><StatusChip kind="severity" value={issue.severity} /></td>
                  <td><StatusChip kind="issue" value={issue.status} /></td>
                  <td className={issue.overdue ? "text-rose-700" : ""}>{issue.dueDate ?? "—"}{issue.overdue ? " 逾期" : ""}</td>
                  <td>{issue.ownerName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function IssueDetail({ id }: { id: string }) {
  const state = useLiveQuery(`issue:${id}`, () => api.issue(id));
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-80" />}>
      {(data) => <Editor data={data} />}
    </AsyncView>
  );
}

function Editor({ data }: { data: IssuePage }) {
  return (
    <div>
      <PageHeader kicker={data.code} title={data.title} description={data.factoryName} />
      <IssueForm
        initial={data}
        onSubmit={async (body) => {
          await api.updateIssue(data.id, body);
          toast("問題已更新");
        }}
      />
    </div>
  );
}

export function IssueCreate({ factoryId }: { factoryId: string }) {
  const app = useApp();
  const router = useRouter();
  if (!app) return <Skeleton className="h-40" />;
  return (
    <div>
      <PageHeader kicker="Issue" title="登錄問題" description="可掛到工廠、階段或產品。逾期會出現在總覽例外。" />
      <IssueForm
        initial={{
          title: "",
          description: "",
          factoryId,
          phaseId: null,
          productId: null,
          ownerId: app.actor.id,
          severity: "MEDIUM",
          priority: "P2",
          status: "OPEN",
          dueDate: app.asOf,
          resolution: "",
        }}
        onSubmit={async (body) => {
          const created = await api.createIssue(body);
          toast("已登錄");
          router.push(`/issues/${created.id}`);
        }}
      />
    </div>
  );
}

function IssueForm({
  initial,
  onSubmit,
}: {
  initial: {
    title: string;
    description: string;
    factoryId: string;
    phaseId: string | null;
    productId: string | null;
    ownerId: string;
    severity: IssueSeverity;
    priority: "P0" | "P1" | "P2" | "P3";
    status: IssueStatus;
    dueDate: string | null;
    resolution: string;
  };
  onSubmit: (body: {
    title: string;
    description: string;
    factoryId: string;
    phaseId: string | null;
    productId: string | null;
    ownerId: string;
    severity: IssueSeverity;
    priority: "P0" | "P1" | "P2" | "P3";
    status: IssueStatus;
    dueDate: string | null;
    resolution: string;
  }) => Promise<void>;
}) {
  const app = useApp();
  const factories = useLiveQuery("factories", () => api.factories());
  const products = useLiveQuery("products", () => api.products());
  const [factoryId, setFactoryId] = useState(initial.factoryId);
  const detail = useLiveQuery(factoryId ? `issue-factory:${factoryId}` : "issue-factory:none", () => factoryId ? api.factory(factoryId) : Promise.resolve(null));
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel className="p-4">
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void onSubmit({
            title: String(form.get("title") ?? ""),
            description: String(form.get("description") ?? ""),
            factoryId,
            phaseId: String(form.get("phaseId") ?? "") || null,
            productId: String(form.get("productId") ?? "") || null,
            ownerId: String(form.get("ownerId") ?? ""),
            severity: String(form.get("severity") ?? "MEDIUM") as IssueSeverity,
            priority: String(form.get("priority") ?? "P2") as "P0" | "P1" | "P2" | "P3",
            status: String(form.get("status") ?? "OPEN") as IssueStatus,
            dueDate: String(form.get("dueDate") ?? "") || null,
            resolution: String(form.get("resolution") ?? ""),
          }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "儲存失敗"));
        }}
      >
        <Field label="標題"><input name="title" defaultValue={initial.title} className={controlClass} required /></Field>
        <Field label="工廠">
          <select className={controlClass} value={factoryId} onChange={(event) => setFactoryId(event.target.value)}>
            {(factories.data?.items ?? []).map((factory) => <option key={factory.id} value={factory.id}>{factory.name}</option>)}
          </select>
        </Field>
        <Field label="說明" ><textarea name="description" defaultValue={initial.description} className={`${controlClass} h-24 py-2 md:col-span-2`} /></Field>
        <Field label="階段">
          <select name="phaseId" className={controlClass} defaultValue={initial.phaseId ?? ""}>
            <option value="">—</option>
            {(detail.data?.phases ?? []).map((phase) => <option key={phase.id} value={phase.id}>{phase.name}</option>)}
          </select>
        </Field>
        <Field label="產品">
          <select name="productId" className={controlClass} defaultValue={initial.productId ?? ""}>
            <option value="">—</option>
            {(products.data?.items ?? []).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </Field>
        <Field label="負責人">
          <select name="ownerId" className={controlClass} defaultValue={initial.ownerId}>
            {(app?.people ?? []).filter((person) => person.active).map((person) => <option key={person.id} value={person.id}>{person.name} · {person.department}</option>)}
          </select>
        </Field>
        <Field label="嚴重度">
          <select name="severity" className={controlClass} defaultValue={initial.severity}>
            {Object.entries(severityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="優先序">
          <select name="priority" className={controlClass} defaultValue={initial.priority}>{["P0", "P1", "P2", "P3"].map((item) => <option key={item}>{item}</option>)}</select>
        </Field>
        <Field label="狀態">
          <select name="status" className={controlClass} defaultValue={initial.status}>
            {Object.entries(issueStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="到期日"><input name="dueDate" type="date" defaultValue={initial.dueDate ?? ""} className={controlClass} /></Field>
        <Field label="處理說明"><textarea name="resolution" defaultValue={initial.resolution} className={`${controlClass} h-20 py-2`} /></Field>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <div><Button type="submit">儲存</Button></div>
      </form>
    </Panel>
  );
}
