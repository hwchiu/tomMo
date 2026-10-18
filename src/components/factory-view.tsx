"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/api";
import { topicStatusLabel, windowReasonLabel, windowStateLabel } from "@/domain/labels";
import { MetaChip, StatusChip } from "@/components/status-chip";
import { MachineText } from "@/components/machines";
import { PhaseTimeline } from "@/components/timeline";
import { AsyncView, Button, EmptyState, Field, PageHeader, Panel, Skeleton, TextLink, controlClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApp } from "@/components/shell";
import { useLiveQuery } from "@/lib/use-live-query";
import { toast } from "@/lib/toast";
import { TOPIC_STATUSES, type TopicStatus } from "@/domain/types";

export function FactoryView({ id }: { id: string }) {
  const state = useLiveQuery(`factory:${id}`, () => api.factory(id));
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-[28rem]" />}>
      {(data) => (
        <div>
          <PageHeader
            kicker={`${data.code} · ${data.categoryLabel} · ${data.regionLabel} · ${data.technologyLabel}`}
            title={data.name}
            description={data.description}
            actions={
              <>
                <TextLink href={`/factories/${data.id}/edit`}>編輯工廠</TextLink>
                <TextLink href={`/factories/${data.id}/phases/new`}>新增階段</TextLink>
                <TextLink href={`/handoffs/new?factory=${data.id}`}>新增交接</TextLink>
                <TextLink href={`/issues/new?factory=${data.id}`}>新增問題</TextLink>
              </>
            }
          />
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusChip kind="factory" value={data.status} />
              <MetaChip>{data.location}</MetaChip>
              <MetaChip>計畫 {data.plannedStart} – {data.plannedEnd}</MetaChip>
            </div>
            <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
              <div className="text-xs font-medium text-muted">廠區 PM 聯繫人</div>
              <div className="font-semibold">{data.pmContact.name}</div>
              <a className="text-accent" href={`mailto:${data.pmContact.email}`}>{data.pmContact.email}</a>
              <div>{data.pmContact.phone}</div>
            </div>
          </div>
          <nav className="mb-4 flex gap-2 overflow-x-auto text-sm">
            {[
              ["#timeline", "時程"],
              ["#topics", "例外事項"],
              ["#plans", "施工計畫"],
              ["#deployments", "部署"],
              ["#handoffs", "交接"],
              ["#issues", "問題"],
              ["#activity", "活動"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full border border-line bg-white px-3 py-1">{label}</a>
            ))}
          </nav>
          <Panel id="timeline" className="mb-4 p-4">
            <h2 className="mb-1 text-lg font-semibold">工廠時程</h2>
            <p className="mb-3 text-sm text-muted">框線是計畫，填色是實際。紅線是今天（基準日 {data.asOf}）。延遲與超出平台建立的施工窗用紅色。</p>
            <PhaseTimeline
              asOf={data.asOf}
              phases={data.phases.map((phase) => ({
                id: phase.id,
                name: phase.name,
                order: phase.order,
                status: phase.status,
                plannedStart: phase.plannedStart,
                plannedEnd: phase.plannedEnd,
                actualStart: phase.actualStart,
                actualEnd: phase.actualEnd,
                focus: phase.focus,
                milestones: phase.milestones.map((milestone) => ({
                  id: milestone.id,
                  name: milestone.name,
                  dueDate: milestone.dueDate,
                  done: milestone.done,
                  overdue: milestone.overdue,
                })),
              }))}
              windows={data.windows}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {data.phases.map((phase) => (
                <div key={phase.id} className={cn("rounded-lg border p-3", phase.focus ? "border-teal-300 bg-teal-50/40" : "border-line")}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{phase.order}. {phase.name}</div>
                      <div className="text-xs text-muted">負責人 {phase.ownerName}</div>
                    </div>
                    <StatusChip kind="phase" value={phase.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted">計畫 {phase.plannedStart} – {phase.plannedEnd}</p>
                  <p className="text-xs text-muted">實際 {phase.actualStart ?? "—"} – {phase.actualEnd ?? "—"}</p>
                  {phase.riskNote ? <p className="mt-1 text-xs text-amber-900">{phase.riskNote}</p> : null}
                  {phase.dependsOn.length ? <p className="text-xs text-muted">依賴 {phase.dependsOn.join("、")}</p> : null}
                  <Link href={`/factories/${data.id}/phases/${phase.id}`} className="mt-2 inline-block text-xs text-accent">編輯階段</Link>
                  <ul className="mt-2 space-y-1">
                    {phase.milestones.map((milestone) => (
                      <li key={milestone.id} className="flex items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => {
                            void api.updateMilestone(milestone.id, {
                              name: milestone.name,
                              dueDate: milestone.dueDate,
                              deliverables: milestone.deliverables,
                              ownerId: milestone.ownerId,
                              done: !milestone.done,
                            }).then(() => toast(milestone.done ? "里程碑改回未完成" : "里程碑已完成"));
                          }}
                        >
                          {milestone.done ? "☑" : "☐"} {milestone.name}
                        </button>
                        <span className={milestone.overdue ? "text-rose-700" : "text-muted"}>{milestone.dueDate}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
          <TopicsPanel factoryId={data.id} topics={data.topics} asOf={data.asOf} />
          <Panel id="machines" className="mb-4 p-4">
            <h2 className="mb-1 font-semibold">機台彙總</h2>
            <p className="mb-3 text-xs text-muted">這座工廠各平台的計畫機台，依機種加總。只記計畫數量。</p>
            <div className="mb-2 text-sm"><MachineText lines={data.machineRollup} /></div>
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted"><tr><th className="py-1">機種</th><th>計畫台數</th></tr></thead>
              <tbody>
                {data.machineRollup.map((line) => (
                  <tr key={line.machineTypeId} className="border-t border-line">
                    <td className="py-1">{line.name}</td>
                    <td>{line.planned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel id="plans" className="mb-4 p-4">
            <h2 className="mb-1 font-semibold">平台施工計畫</h2>
            <p className="mb-3 text-xs text-muted">未提報與超出平台建立的時程會標示。重疊不視為衝突。</p>
            {data.plans.length === 0 ? <EmptyState title="還沒有平台" body="到平台頁新增平台後，每座工廠都會出現一份未提報計畫。" /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-2">平台</th>
                      <th>狀態</th>
                      <th>提供版本</th>
                      <th>施工時程</th>
                      <th>判斷</th>
                      <th>改版</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.plans.map((plan) => (
                      <tr key={plan.platformId} className="border-t border-line">
                        <td className="py-2 font-medium">
                          <Link href={`/factories/${data.id}/plans/${plan.platformId}`} className="hover:underline">{plan.platformName}</Link>
                        </td>
                        <td><StatusChip kind="plan" value={plan.status} /></td>
                        <td>{plan.providedVersion ?? "—"}</td>
                        <td>{plan.windowStart ?? "—"} – {plan.windowEnd ?? "—"}</td>
                        <td className={plan.windowState === "OUTSIDE" ? "text-rose-700" : plan.windowState === "MISSING" ? "text-amber-800" : "text-emerald-800"}>
                          {plan.windowState === "OUTSIDE" ? plan.windowReasons.map((reason) => windowReasonLabel[reason]).join("、") : windowStateLabel[plan.windowState]}
                        </td>
                        <td>{plan.revisionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <Panel id="deployments" className="mb-4 p-4">
            <h2 className="mb-3 font-semibold">部署</h2>
            {data.deployments.length === 0 ? <EmptyState title="尚無部署" body="新增平台後會自動建立已規劃的部署，實際版本由工程師填報。" /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="text-xs text-muted"><tr><th className="py-2">平台</th><th>狀態</th><th>計畫 / 實際</th><th>副責</th><th>機台</th></tr></thead>
                  <tbody>
                    {data.deployments.map((deployment) => (
                      <tr key={deployment.id} className="border-t border-line">
                        <td className="py-2"><Link className="hover:underline" href={`/deployments/${deployment.id}`}>{deployment.platformName}</Link></td>
                        <td><StatusChip kind="deployment" value={deployment.status} /></td>
                        <td>
                          {deployment.plannedVersion ?? "—"} / {deployment.actualVersion ?? "未填"}
                          {deployment.behindPlan ? <span className="ml-1 text-rose-700">落後計畫</span> : null}
                          {deployment.behindLatest ? <span className="ml-1 text-amber-800">落後最新</span> : null}
                        </td>
                        <td>{deployment.secondaryOwnerName}</td>
                        <td><MachineText lines={deployment.machines} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel id="handoffs" className="p-4">
              <h2 className="mb-3 font-semibold">交接</h2>
              {data.handoffs.length === 0 ? <p className="text-sm text-muted">還沒有交接。</p> : data.handoffs.map((handoff) => (
                <Link key={handoff.id} href={`/handoffs/${handoff.id}`} className="flex items-center justify-between gap-2 border-t border-line py-2 text-sm">
                  <span>{handoff.code} {handoff.title}</span>
                  <StatusChip kind="handoff" value={handoff.status} />
                </Link>
              ))}
            </Panel>
            <Panel id="issues" className="p-4">
              <h2 className="mb-3 font-semibold">問題</h2>
              {data.issues.length === 0 ? <p className="text-sm text-muted">沒有問題。</p> : data.issues.map((issue) => (
                <Link key={issue.id} href={`/issues/${issue.id}`} className="flex items-center justify-between gap-2 border-t border-line py-2 text-sm">
                  <span>{issue.code} {issue.title}</span>
                  <span className={issue.overdue ? "text-rose-700" : ""}><StatusChip kind="issue" value={issue.status} /></span>
                </Link>
              ))}
            </Panel>
          </div>
          <Panel id="activity" className="mt-4 p-4">
            <h2 className="mb-3 font-semibold">活動紀錄</h2>
            {data.activity.length === 0 ? <p className="text-sm text-muted">還沒有變更。</p> : (
              <ul className="space-y-2 text-sm">
                {data.activity.map((item) => (
                  <li key={item.id}>
                    <span className="text-xs text-muted">{item.createdAt.slice(0, 16).replace("T", " ")} · {item.actorName}</span>
                    <div>{item.summary}</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </AsyncView>
  );
}

function TopicsPanel({
  factoryId,
  topics,
  asOf,
}: {
  factoryId: string;
  asOf: string;
  topics: Array<{
    id: string;
    title: string;
    description: string;
    ownerId: string;
    ownerName: string;
    status: TopicStatus;
    raisedOn: string;
  }>;
}) {
  const app = useApp();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const open = topics.filter((topic) => topic.status === "OPEN" || topic.status === "IN_DISCUSSION").length;
  return (
    <Panel id="topics" className="mb-4 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">例外事項</h2>
          <p className="text-sm text-muted">需特別討論的議題。目前 {open} 筆未結。</p>
        </div>
        <Button type="button" onClick={() => setEditing(editing === "new" ? null : "new")}>{editing === "new" ? "取消" : "新增"}</Button>
      </div>
      {editing === "new" ? (
        <TopicForm
          asOf={asOf}
          users={app?.users ?? []}
          onCancel={() => setEditing(null)}
          onSubmit={(body) => api.createTopic(factoryId, body).then(() => {
            toast("已新增例外事項");
            setEditing(null);
          })}
        />
      ) : null}
      {topics.length === 0 ? <p className="text-sm text-muted">這座工廠還沒有例外事項。</p> : (
        <ul className="divide-y divide-line">
          {topics.map((topic) => (
            <li key={topic.id} className="py-3">
              {editing === topic.id ? (
                <TopicForm
                  asOf={asOf}
                  users={app?.users ?? []}
                  initial={topic}
                  onCancel={() => setEditing(null)}
                  onSubmit={(body) => api.updateTopic(topic.id, body).then(() => {
                    toast("例外事項已更新");
                    setEditing(null);
                  })}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{topic.title}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", topic.status === "OPEN" || topic.status === "IN_DISCUSSION" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600")}>
                        {topicStatusLabel[topic.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{topic.description || "沒有補充說明。"}</p>
                    <p className="mt-1 text-sm text-muted">負責人 {topic.ownerName} · 提出 {topic.raisedOn}</p>
                  </div>
                  <button type="button" className="text-sm text-accent" onClick={() => setEditing(topic.id)}>編輯</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function TopicForm({
  asOf,
  users,
  initial,
  onCancel,
  onSubmit,
}: {
  asOf: string;
  users: Array<{ id: string; name: string }>;
  initial?: { title: string; description: string; ownerId: string; status: TopicStatus; raisedOn: string };
  onCancel: () => void;
  onSubmit: (body: { title: string; description: string; ownerId: string; status: TopicStatus; raisedOn: string }) => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mb-3 grid gap-3 rounded-lg border border-line bg-slate-50 p-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const body = {
          title: String(form.get("title") ?? ""),
          description: String(form.get("description") ?? ""),
          ownerId: String(form.get("ownerId") ?? ""),
          status: String(form.get("status") ?? "OPEN") as TopicStatus,
          raisedOn: String(form.get("raisedOn") ?? ""),
        };
        void onSubmit(body).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "儲存失敗"));
      }}
    >
      <Field label="標題"><input name="title" defaultValue={initial?.title ?? ""} className={controlClass} required /></Field>
      <Field label="狀態">
        <select name="status" className={controlClass} defaultValue={initial?.status ?? "OPEN"}>
          {TOPIC_STATUSES.map((status) => <option key={status} value={status}>{topicStatusLabel[status]}</option>)}
        </select>
      </Field>
      <Field label="負責人">
        <select name="ownerId" className={controlClass} defaultValue={initial?.ownerId ?? users[0]?.id}>
          {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
      </Field>
      <Field label="提出日期"><input name="raisedOn" type="date" defaultValue={initial?.raisedOn ?? asOf} className={controlClass} required /></Field>
      <Field label="說明"><textarea name="description" defaultValue={initial?.description ?? ""} className={`${controlClass} h-20 py-2 md:col-span-2`} /></Field>
      {error ? <p className="text-sm text-rose-700 md:col-span-2">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit">儲存</Button>
        <Button type="button" onClick={onCancel}>取消</Button>
      </div>
    </form>
  );
}
