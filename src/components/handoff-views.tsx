"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/api";
import type { HandoffListItem, HandoffPage } from "@/api/types";
import { evaluateHandoffRequirements } from "@/domain/handoff-evaluator";
import { handoffStatusLabel } from "@/domain/labels";
import { HANDOFF_TRANSITIONS } from "@/domain/transitions";
import type { HandoffStatus, RequirementKind } from "@/domain/types";
import { useApp } from "@/components/shell";
import { StatusChip } from "@/components/status-chip";
import { AsyncView, Button, EmptyState, Field, PageHeader, Panel, Skeleton, controlClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { useLiveQuery } from "@/lib/use-live-query";

const FLOW: HandoffStatus[] = ["WORK_DONE", "PROPOSED", "PENDING_ACCEPTANCE", "ACCEPTED"];

export function HandoffList({ status, factoryId }: { status: string; factoryId: string }) {
  const state = useLiveQuery("handoffs", () => api.handoffs());
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-80" />}>
      {(data) => <ListBody items={data.items} asOf={data.asOf} status={status} factoryId={factoryId} />}
    </AsyncView>
  );
}

function ListBody({ items, asOf, status, factoryId }: { items: HandoffListItem[]; asOf: string; status: string; factoryId: string }) {
  const router = useRouter();
  const factories = useMemo(() => [...new Map(items.map((item) => [item.factoryId, item.factoryName])).entries()], [items]);
  const visible = items.filter((item) => (!status || item.status === status) && (!factoryId || item.factoryId === factoryId));
  return (
    <div>
      <PageHeader
        kicker="Handoff"
        title="交接追蹤"
        description="條件會用實際版本與功能自動比對，但接收方仍要手動驗收。未滿足的條件會列出來，不會自己變成已驗收。"
        actions={<Link href="/handoffs/new" className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm text-white">新增交接</Link>}
      />
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="text-muted">基準日 {asOf}</span>
        <select className="h-8 rounded-md border border-line bg-white px-2" value={factoryId} onChange={(event) => router.replace(query({ status, factoryId: event.target.value }))}>
          <option value="">全部工廠</option>
          {factories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select className="h-8 rounded-md border border-line bg-white px-2" value={status} onChange={(event) => router.replace(query({ status: event.target.value, factoryId }))}>
          <option value="">全部狀態</option>
          {Object.entries(handoffStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="沒有符合的交接" body="換一個狀態或工廠，或建立一筆新的交接。" action={<Link href="/handoffs" className="text-sm text-accent">清除篩選</Link>} />
      ) : (
        <div className="space-y-2">
          {visible.map((item) => {
            const evaluation = evaluateHandoffRequirements(item.requirements, item.snapshots);
            return (
              <Link key={item.id} href={`/handoffs/${item.id}`} className="block rounded-xl border border-line bg-panel p-4 hover:border-accent">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs text-muted">{item.code}</span>
                    <h2 className="font-semibold">{item.title}</h2>
                    <p className="text-xs text-muted">{item.factoryName} · {item.fromPhaseName} → {item.toPhaseName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs", evaluation.allMet ? "text-emerald-800" : "text-amber-900")}>
                      條件 {evaluation.metCount}/{evaluation.results.length}
                    </span>
                    <StatusChip kind="handoff" value={item.status} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function query(values: { status: string; factoryId: string }) {
  const params = new URLSearchParams();
  if (values.status) params.set("status", values.status);
  if (values.factoryId) params.set("factory", values.factoryId);
  const text = params.toString();
  return text ? `/handoffs?${text}` : "/handoffs";
}

export function HandoffDetail({ id }: { id: string }) {
  const state = useLiveQuery(`handoff:${id}`, () => api.handoff(id));
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-96" />}>
      {(data) => <Detail data={data} />}
    </AsyncView>
  );
}

function Detail({ data }: { data: HandoffPage }) {
  const evaluation = evaluateHandoffRequirements(data.requirements, data.snapshots);
  const [reason, setReason] = useState(data.rejectionReason);
  const [blockers, setBlockers] = useState(data.blockers);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = HANDOFF_TRANSITIONS[data.status];
  const platforms = useLiveQuery("platforms", () => api.platforms());

  async function move(status: HandoffStatus) {
    setError(null);
    try {
      await api.transitionHandoff(data.id, {
        status,
        rejectionReason: reason,
        blockers,
        acknowledgeGaps: ack,
        unmet: evaluation.unmet.length,
      });
      toast(`狀態已改為${handoffStatusLabel[status]}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新失敗");
    }
  }

  return (
    <div>
      <PageHeader kicker={data.code} title={data.title} description={`${data.factoryName} · ${data.fromPhaseName} → ${data.toPhaseName}`} />
      <div className="mb-4 flex flex-wrap gap-2">
        {FLOW.map((status) => (
          <span key={status} className={cn("rounded-full px-3 py-1 text-xs", status === data.status ? "bg-ink text-white" : "bg-white text-muted")}>
            {handoffStatusLabel[status]}
          </span>
        ))}
        {data.status === "BLOCKED" || data.status === "REJECTED" ? <StatusChip kind="handoff" value={data.status} /> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Panel className={cn("p-4", evaluation.allMet ? "border-emerald-200" : "border-amber-200")}>
            <h2 className="font-semibold">{evaluation.allMet ? "條件已滿足，仍須接收方手動驗收" : `尚有 ${evaluation.unmet.length} 項未滿足`}</h2>
            <p className="mt-1 text-xs text-muted">自動比對只說明預期與實際。它不會把交接改成已驗收。</p>
            <ul className="mt-3 space-y-2">
              {evaluation.results.map((result) => (
                <li key={result.requirementId} className="rounded-lg border border-line bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{result.description}</span>
                    <span className={result.met ? "text-emerald-800" : "text-rose-700"}>{result.met ? "符合" : "未滿足"}</span>
                  </div>
                  <p className="text-xs text-muted">預期 {result.expected}</p>
                  <p className="text-xs">實際 {result.actual}</p>
                  <p className="text-xs text-muted">{result.detail}</p>
                </li>
              ))}
              {evaluation.results.length === 0 ? <li className="text-sm text-muted">這筆交接還沒有系統條件，接收方仍要看交付物後手動驗收。</li> : null}
            </ul>
          </Panel>
          <Panel className="p-4 text-sm">
            <p><span className="text-muted">交付物</span> {data.deliverables || "—"}</p>
            <p className="mt-2"><span className="text-muted">驗收標準</span> {data.acceptanceCriteria || "—"}</p>
            <p className="mt-2"><span className="text-muted">計畫日</span> {data.plannedDate} · 實際 {data.actualDate ?? "—"}</p>
            <p className="mt-2"><span className="text-muted">提出</span> {data.fromOwnerName} · <span className="text-muted">接收</span> {data.toOwnerName}</p>
            {data.escalationOwnerName ? <p className="mt-2">升級負責人 {data.escalationOwnerName}</p> : null}
          </Panel>
          <Panel className="p-4">
            <h2 className="mb-2 text-sm font-semibold">加一條條件</h2>
            <RequirementForm handoffId={data.id} platforms={platforms.data?.items ?? []} />
          </Panel>
        </div>
        <Panel className="p-4">
          <h2 className="mb-2 font-semibold">變更狀態</h2>
          <Field label="退回原因">
            <textarea className={`${controlClass} h-20 py-2`} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <div className="mt-2">
            <Field label="阻擋原因">
              <textarea className={`${controlClass} h-20 py-2`} value={blockers} onChange={(event) => setBlockers(event.target.value)} />
            </Field>
          </div>
          {!evaluation.allMet && next.includes("ACCEPTED") ? (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={ack} onChange={(event) => setAck(event.target.checked)} />
              我知道仍有未滿足條件，仍要手動驗收
            </label>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            {next.map((status) => (
              <Button key={status} tone={status === "ACCEPTED" ? "primary" : "secondary"} onClick={() => void move(status)}>
                改為{handoffStatusLabel[status]}
              </Button>
            ))}
          </div>
          {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
          <h3 className="mb-2 mt-6 text-sm font-semibold">活動</h3>
          <ul className="space-y-2 text-xs">
            {data.activity.map((item) => <li key={item.id}>{item.actorName}：{item.summary}</li>)}
            {data.activity.length === 0 ? <li className="text-muted">這筆交接還沒有新的變更。</li> : null}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function RequirementForm({ handoffId, platforms }: { handoffId: string; platforms: Array<{ id: string; name: string }> }) {
  const [kind, setKind] = useState<RequirementKind>("MIN_VERSION");
  const [platformId, setPlatformId] = useState(platforms[0]?.id ?? "");
  const [minVersion, setMinVersion] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-2 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        void api.addRequirement(handoffId, {
          kind,
          platformId,
          minVersion: kind === "MIN_VERSION" ? minVersion : null,
          featureId: null,
          description: description || "新增條件",
        }).then(() => toast("已新增條件")).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "失敗"));
      }}
    >
      <select className={controlClass} value={kind} onChange={(event) => setKind(event.target.value as RequirementKind)}>
        <option value="MIN_VERSION">最低版本</option>
        <option value="DEPLOYMENT_COMPLETE">部署完成</option>
        <option value="FEATURE_ENABLED">功能啟用</option>
      </select>
      <select className={controlClass} value={platformId} onChange={(event) => setPlatformId(event.target.value)}>
        {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
      </select>
      {kind === "MIN_VERSION" ? <input className={controlClass} placeholder="2.4.0" value={minVersion} onChange={(event) => setMinVersion(event.target.value)} /> : null}
      <input className={controlClass} placeholder="條件說明" value={description} onChange={(event) => setDescription(event.target.value)} />
      <Button type="submit">加入</Button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}

export function HandoffCreate({ factoryId }: { factoryId: string }) {
  const app = useApp();
  const factories = useLiveQuery("factories", () => api.factories());
  const [selected, setSelected] = useState(factoryId);
  const detail = useLiveQuery(selected ? `factory-for-ho:${selected}` : "factory-for-ho:none", () => selected ? api.factory(selected) : Promise.resolve(null));
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (!app) return <Skeleton className="h-40" />;
  const phases = detail.data?.phases ?? [];
  return (
    <div>
      <PageHeader kicker="Handoff" title="新增交接" description="交接屬於同一座工廠的兩個階段。建立後再補系統條件。" />
      <Panel className="p-4">
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void api.createHandoff({
              title: String(form.get("title") ?? ""),
              factoryId: selected,
              fromPhaseId: String(form.get("fromPhaseId") ?? ""),
              toPhaseId: String(form.get("toPhaseId") ?? ""),
              fromOwnerId: String(form.get("fromOwnerId") ?? ""),
              toOwnerId: String(form.get("toOwnerId") ?? ""),
              escalationOwnerId: String(form.get("escalationOwnerId") ?? "") || null,
              plannedDate: String(form.get("plannedDate") ?? ""),
              deliverables: String(form.get("deliverables") ?? ""),
              acceptanceCriteria: String(form.get("acceptanceCriteria") ?? ""),
              blockers: String(form.get("blockers") ?? ""),
              status: "WORK_DONE",
            }).then((created) => {
              toast("已建立交接");
              router.push(`/handoffs/${created.id}`);
            }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "建立失敗"));
          }}
        >
          <Field label="工廠">
            <select className={controlClass} value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">選擇工廠</option>
              {(factories.data?.items ?? []).map((factory) => <option key={factory.id} value={factory.id}>{factory.name}</option>)}
            </select>
          </Field>
          <Field label="標題"><input name="title" className={controlClass} required /></Field>
          <Field label="從階段">
            <select name="fromPhaseId" className={controlClass}>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.name}</option>)}</select>
          </Field>
          <Field label="到階段">
            <select name="toPhaseId" className={controlClass}>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.name}</option>)}</select>
          </Field>
          <Person name="fromOwnerId" label="提出人" />
          <Person name="toOwnerId" label="接收人" />
          <Person name="escalationOwnerId" label="升級負責人（可空）" optional />
          <Field label="計畫日"><input name="plannedDate" type="date" className={controlClass} required /></Field>
          <Field label="交付物"><textarea name="deliverables" className={`${controlClass} h-20 py-2`} /></Field>
          <Field label="驗收標準"><textarea name="acceptanceCriteria" className={`${controlClass} h-20 py-2`} /></Field>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <div><Button type="submit">建立</Button></div>
        </form>
      </Panel>
    </div>
  );
}

function Person({ name, label, optional = false }: { name: string; label: string; optional?: boolean }) {
  const app = useApp();
  return (
    <Field label={label}>
      <select name={name} className={controlClass} defaultValue={optional ? "" : app?.currentUser.id}>
        {optional ? <option value="">—</option> : null}
        {(app?.users ?? []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
      </select>
    </Field>
  );
}
