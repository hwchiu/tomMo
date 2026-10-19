"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/api";
import type { FactoryBoardRow } from "@/api/types";
import { inFactoryScope, type GroupKey } from "@/domain/select";
import { useApp } from "@/components/shell";
import { MetaChip, StatusChip } from "@/components/status-chip";
import { PortfolioTimeline } from "@/components/timeline";
import { AsyncView, EmptyState, PageHeader, Panel, Skeleton, TextLink } from "@/components/ui";
import { cn } from "@/lib/cn";
import { withQuery } from "@/lib/search";
import { useLiveQuery } from "@/lib/use-live-query";

export function PortfolioView({
  category,
  region,
  technology,
  status,
  group,
}: {
  category: string;
  region: string;
  technology: string;
  status: string;
  group: string;
}) {
  const state = useLiveQuery("portfolio", () => api.portfolio());
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-96" />}>
      {(data) => (
        <PortfolioBody
          data={data}
          category={category}
          region={region}
          technology={technology}
          status={status}
          group={(group || "none") as GroupKey}
        />
      )}
    </AsyncView>
  );
}

function PortfolioBody({
  data,
  category,
  region,
  technology,
  status,
  group,
}: {
  data: Awaited<ReturnType<typeof api.portfolio>>;
  category: string;
  region: string;
  technology: string;
  status: string;
  group: GroupKey;
}) {
  const router = useRouter();
  const app = useApp();
  const [expanded, setExpanded] = useState(false);
  const scope = { category, region, technology };
  const scoped = data.factories.filter((factory) => inFactoryScope(factory, scope));
  const visible = scoped.filter((factory) => inFactoryScope(factory, { status }));
  const enums = app?.enumerations.filter((item) => item.active) ?? [];
  const categories = enums.filter((item) => item.set === "factoryCategory");
  const regions = enums.filter((item) => item.set === "factoryRegion");
  const nodes = enums.filter((item) => item.set === "technologyNode");

  function push(next: Partial<{ category: string; region: string; technology: string; status: string; group: string }>) {
    router.replace(
      withQuery("/", {
        category,
        region,
        technology,
        status,
        group,
        ...next,
      }),
    );
  }

  const missing = scoped.reduce((sum, factory) => sum + factory.missingPlans, 0);
  const outside = scoped.reduce((sum, factory) => sum + factory.outsideWindows, 0);
  const notReady = scoped.reduce((sum, factory) => sum + factory.notReady, 0);
  const exceptions = data.exceptions.filter((item) => scoped.some((factory) => factory.name === item.factoryName) || scoped.length === data.factories.length);
  const shown = expanded ? exceptions : exceptions.slice(0, 8);

  const groups = (() => {
    const map = new Map<string, { label: string; items: FactoryBoardRow[] }>();
    for (const factory of visible) {
      const key = group === "category" ? factory.category : group === "region" ? factory.region : group === "technology" ? factory.technology : "all";
      const label = group === "category" ? factory.categoryLabel : group === "region" ? factory.regionLabel : group === "technology" ? factory.technologyLabel : "全部工廠";
      const bucket = map.get(key) ?? { label, items: [] };
      bucket.items.push(factory);
      map.set(key, bucket);
    }
    return [...map.values()];
  })();

  const milestones = data.milestones.filter((milestone) => scoped.some((factory) => factory.id === milestone.factoryId));
  const needing = data.pendingPlans.filter((plan) => scoped.some((factory) => factory.id === plan.factoryId));

  return (
    <div>
      <PageHeader
        kicker="Portfolio"
        title="組合總覽"
        description="例外先看。工廠依類別、區域、製程節點篩選。產品交付狀況的延遲與待補理由會排進同一條佇列，並標出遲到天數與負責人。施工窗彼此重疊不算衝突。"
        actions={<TextLink href="/product-build">打開產品交付狀況</TextLink>}
      />
      <Panel className="mb-4 p-4">
        <h2 className="mb-1 text-lg font-semibold">全廠時程</h2>
        <p className="mb-3 text-sm text-muted">
          全部 {data.factories.length} 座工廠，一列一座。橫軸是月份。色塊是各階段的計畫區間，紅色代表延遲。紅線是今天（{data.asOf}）。列上的數字是還在討論的例外事項。
        </p>
        <PortfolioTimeline asOf={data.asOf} factories={data.factories} />
      </Panel>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="工廠總數" value={scoped.length} hint="套用類別／區域／節點" pressed={!status} onClick={() => push({ status: "" })} />
        <Stat label="進度正常" value={scoped.filter((factory) => factory.status === "ON_TRACK").length} pressed={status === "ON_TRACK"} onClick={() => push({ status: status === "ON_TRACK" ? "" : "ON_TRACK" })} />
        <Stat label="有風險" value={scoped.filter((factory) => factory.status === "AT_RISK").length} pressed={status === "AT_RISK"} onClick={() => push({ status: status === "AT_RISK" ? "" : "AT_RISK" })} />
        <Stat label="延遲" value={scoped.filter((factory) => factory.status === "DELAYED").length} pressed={status === "DELAYED"} onClick={() => push({ status: status === "DELAYED" ? "" : "DELAYED" })} tone="danger" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link className="rounded-full bg-amber-50 px-3 py-1 text-amber-900" href="/product-build">未提報計畫 {missing}</Link>
        <Link className="rounded-full bg-rose-50 px-3 py-1 text-rose-800" href="/product-build">超出產品建立 {outside}</Link>
        <Link className="rounded-full bg-amber-50 px-3 py-1 text-amber-900" href="/product-build?exceptions=1">未就緒產品 {notReady}</Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterSelect label="類別" value={category} onChange={(value) => push({ category: value })} options={categories.map((item) => ({ value: item.code, label: item.label }))} />
        <FilterSelect label="區域" value={region} onChange={(value) => push({ region: value })} options={regions.map((item) => ({ value: item.code, label: item.label }))} />
        <FilterSelect label="製程" value={technology} onChange={(value) => push({ technology: value })} options={nodes.map((item) => ({ value: item.code, label: item.label }))} />
        <FilterSelect
          label="分組"
          value={group}
          allowEmpty={false}
          onChange={(value) => push({ group: value })}
          options={[
            { value: "none", label: "不分組" },
            { value: "category", label: "依類別" },
            { value: "region", label: "依區域" },
            { value: "technology", label: "依製程" },
          ]}
        />
      </div>
      <Panel className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">例外優先</h2>
          <span className="text-xs text-muted">{exceptions.length} 筆 · 基準日 {data.asOf}</span>
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-emerald-800">這個篩選範圍裡沒有需要插隊的例外。</p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="flex flex-wrap items-baseline justify-between gap-2 py-2 hover:bg-slate-50">
                  <span>
                    <span className={item.tone === "danger" ? "text-rose-700" : item.tone === "warning" ? "text-amber-800" : "text-sky-800"}>
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{item.detail}</span>
                    {item.reasons.length > 0 ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {item.reasons.map((reason) => (
                          <span key={reason.code} title={reason.explanation} className="rounded bg-white px-1.5 py-0.5 text-[10px] ring-1 ring-line">
                            {reason.label}{reason.daysLate != null ? ` · 晚 ${reason.daysLate} 天` : ""}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted">{item.factoryName}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {exceptions.length > 8 ? (
          <button type="button" className="mt-2 text-sm text-accent" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "收合" : `展開其餘 ${exceptions.length - 8} 筆`}
          </button>
        ) : null}
      </Panel>
      {visible.length === 0 ? (
        <EmptyState title="沒有符合的工廠" body="調整類別、區域、製程或狀態。列舉可以在設定裡增減。" action={<Link href="/" className="text-sm text-accent">清除篩選</Link>} />
      ) : (
        <div className="space-y-6">
          {groups.map((bucket) => (
            <section key={bucket.label}>
              <h2 className="mb-2 text-sm font-semibold text-muted">{bucket.label} · {bucket.items.length}</h2>
              <div className="grid gap-3">
                {bucket.items.map((factory) => (
                  <Link key={factory.id} href={`/factories/${factory.id}`} className="rounded-xl border border-line bg-panel p-4 hover:border-accent">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted">{factory.code}</span>
                          <span className="text-lg font-semibold">{factory.name}</span>
                          <StatusChip kind="factory" value={factory.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <MetaChip>{factory.categoryLabel}</MetaChip>
                          <MetaChip>{factory.regionLabel}</MetaChip>
                          <MetaChip>{factory.technologyLabel}</MetaChip>
                          <MetaChip>{factory.location}</MetaChip>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-xs text-muted">廠區 PM</div>
                        <div className="font-medium">{factory.pmName}</div>
                        <div className="text-xs text-muted">{factory.pmDepartment}</div>
                        <div className="mt-1 text-lg font-semibold tabular-nums">{factory.machineTotal} 台</div>
                        <div className="text-xs text-muted">{factory.machineRollup.map((line) => `${line.name} ${line.planned}`).join(" · ")}</div>
                        <div className={cn("text-xs", factory.openTopics ? "font-semibold text-rose-700" : "text-muted")}>例外 {factory.openTopics}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm">
                      目前第 {factory.currentPhaseOrder} 階段 · {factory.currentPhaseName}
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
                      {factory.phases.map((phase) => (
                        <span key={phase.id} title={phase.name} className={phaseColor(phase.status)} />
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                      <span className="font-medium text-ink">計畫機台 {factory.machineTotal}</span>
                      <span className={factory.notReady ? "text-amber-800" : ""}>未就緒產品 {factory.notReady}</span>
                      <span>阻礙 {factory.blockers}</span>
                      <span className={factory.missingPlans ? "text-amber-800" : ""}>未提報計畫 {factory.missingPlans}</span>
                      <span className={factory.outsideWindows ? "text-rose-700" : ""}>超出時程 {factory.outsideWindows}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel className="p-4">
          <h2 className="mb-2 font-semibold">近期里程碑</h2>
          {milestones.length === 0 ? <p className="text-sm text-muted">三週內沒有未完成里程碑。</p> : (
            <ul className="space-y-2 text-sm">
              {milestones.map((milestone) => (
                <li key={milestone.id} className="flex justify-between gap-3">
                  <span>
                    <Link href={`/factories/${milestone.factoryId}`} className="font-medium hover:underline">{milestone.name}</Link>
                    <span className="block text-xs text-muted">{milestone.factoryName} · {milestone.phaseName}</span>
                  </span>
                  <span className={milestone.overdue ? "text-rose-700" : "text-muted"}>{milestone.dueDate}{milestone.overdue ? " 逾期" : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="p-4">
          <h2 className="mb-2 font-semibold">需要 PM 核准的計畫</h2>
          {needing.length === 0 ? <p className="text-sm text-muted">沒有已提報、等待核准的產品計畫。</p> : (
            <ul className="space-y-2 text-sm">
              {needing.map((plan) => (
                <li key={plan.id} className="flex items-center justify-between gap-2">
                  <Link href={`/factories/${plan.factoryId}/plans/${plan.productId}`} className="hover:underline">
                    {plan.factoryName} · {plan.productName}
                  </Link>
                  <span className="text-xs text-muted">{plan.mode === "FEATURE_ONLY" ? "純功能開關" : "有版本"}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  pressed,
  onClick,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  pressed?: boolean;
  onClick?: () => void;
  tone?: "danger";
}) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border bg-panel p-4 text-left ${pressed ? "border-accent" : "border-line"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-mono text-3xl font-semibold ${tone === "danger" ? "text-danger" : ""}`}>{value}</div>
      {hint ? <div className="text-[11px] text-muted">{hint}</div> : null}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  allowEmpty = true,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      {label}
      <select className="h-8 rounded-md border border-line bg-white px-2 text-sm text-ink" value={value} onChange={(event) => onChange(event.target.value)}>
        {allowEmpty ? <option value="">全部</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function phaseColor(status: string): string {
  if (status === "COMPLETED") return "flex-1 bg-emerald-500";
  if (status === "IN_PROGRESS") return "flex-1 bg-sky-500";
  if (status === "AT_RISK") return "flex-1 bg-amber-500";
  if (status === "DELAYED") return "flex-1 bg-rose-500";
  return "flex-1 bg-slate-200";
}
