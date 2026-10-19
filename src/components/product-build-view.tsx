"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/api";
import type { BuildCell, BuildRow } from "@/api/types";
import { audienceLabel, productAudiences, type ProductAudience } from "@/domain/audience";
import { factoryCategories, factoryRegions } from "@/domain/factory-attr";
import { productModeLabel, readinessFlagLabel, windowReasonLabel } from "@/domain/labels";
import { inFactoryScope } from "@/domain/select";
import { MetaChip, StatusChip } from "@/components/status-chip";
import { AsyncView, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MachineText } from "@/components/machines";
import { shortDate } from "@/domain/dates";
import { withQuery } from "@/lib/search";
import { useLiveQuery } from "@/lib/use-live-query";

export function ProductBuildView({
  category,
  region,
  audience,
  onlyExceptions,
}: {
  category: string;
  region: string;
  audience: "" | ProductAudience;
  onlyExceptions: boolean;
}) {
  const state = useLiveQuery("product-build", () => api.productBuild());
  return (
    <AsyncView state={state} skeleton={<Skeleton className="h-[32rem]" />}>
      {(data) => (
        <Body data={data} category={category} region={region} audience={audience} onlyExceptions={onlyExceptions} />
      )}
    </AsyncView>
  );
}

function Body({
  data,
  category,
  region,
  audience,
  onlyExceptions,
}: {
  data: Awaited<ReturnType<typeof api.productBuild>>;
  category: string;
  region: string;
  audience: "" | ProductAudience;
  onlyExceptions: boolean;
}) {
  const router = useRouter();
  const products = data.products.filter((product) => !audience || product.audience === audience);
  const rows = data.rows.filter((row) => inFactoryScope(row, { category, region }));
  function cellsOf(row: BuildRow) {
    return row.cells.filter((cell) => products.some((product) => product.id === cell.productId));
  }
  const visible = onlyExceptions ? rows.filter((row) => cellsOf(row).some((cell) => !cell.ready)) : rows;

  function push(next: Partial<{ category: string; region: string; audience: string; exceptions: string }>) {
    router.replace(
      withQuery("/product-build", {
        category,
        region,
        audience,
        exceptions: onlyExceptions ? "1" : "",
        ...next,
      }),
    );
  }

  return (
    <div>
      <PageHeader
        kicker="交付"
        title="產品交付狀況"
        description="每一格是一座工廠上的一個產品：部署狀態、版本或功能開關、主責與副責、機台數，以及計畫是否就緒。未提報與超出階段會先被標出來。對外是交給使用者的產品，對內多半是對外產品的依賴。各產品平行施工，時程重疊不算衝突。"
      />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <Select label="類別" value={category} onChange={(value) => push({ category: value })} options={factoryCategories} />
        <Select label="區域" value={region} onChange={(value) => push({ region: value })} options={factoryRegions} />
        <Select label="可見範圍" value={audience} onChange={(value) => push({ audience: value })} options={productAudiences} />
        <button
          type="button"
          className={cn("h-8 rounded-full px-3", onlyExceptions ? "bg-ink text-white" : "border border-line bg-white")}
          onClick={() => push({ exceptions: onlyExceptions ? "" : "1" })}
        >
          只看未就緒
        </button>
        <span className="text-muted">基準日 {data.asOf}</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-muted">
        <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">就緒：已核准、時程在階段內、版本或功能集已規劃</span>
        <span className="rounded bg-amber-50 px-2 py-1 text-amber-900">未提報</span>
        <span className="rounded bg-rose-50 px-2 py-1 text-rose-800">超出階段</span>
        <span>重疊：允許，不標示</span>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="沒有要看的工廠" body="沒有符合篩選的列。清除篩選後會看到全部工廠。" action={<button type="button" className="text-sm text-accent" onClick={() => router.replace("/product-build")}>清除篩選</button>} />
      ) : (
        <>
          <div className="hidden overflow-auto rounded-xl border border-line bg-panel lg:block">
            <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 min-w-[220px] border-b border-r border-line bg-white p-3 text-xs font-medium text-muted">工廠</th>
                  <th className="sticky top-0 z-20 min-w-[140px] border-b border-line bg-white p-3 text-xs font-medium text-muted">計畫機台合計</th>
                  {products.map((product) => (
                    <th key={product.id} className="sticky top-0 z-20 min-w-[210px] border-b border-line bg-white p-3">
                      <div className="text-sm font-semibold">{product.name}</div>
                      <div className="mt-1 inline-flex rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-900">{audienceLabel(product.audience)}</div>
                      {product.mode === "FEATURE_ONLY" ? (
                        <div className="mt-1 ml-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">{productModeLabel.FEATURE_ONLY}</div>
                      ) : (
                        <div className="text-[11px] font-normal text-muted">{productModeLabel.VERSIONED}</div>
                      )}
                      <div className="text-[11px] font-normal text-muted">主責 {product.primaryOwnerName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.factoryId}>
                    <th className="sticky left-0 z-10 border-b border-r border-line bg-white p-3 align-top font-normal">
                      <RowHead row={row} readyCount={cellsOf(row).filter((cell) => cell.ready).length} total={cellsOf(row).length} />
                    </th>
                    <td className="border-b border-line bg-slate-50 p-3 align-top">
                      <div className="text-2xl font-semibold tabular-nums">{row.machineTotal}</div>
                      <div className="mt-1 text-[11px] text-muted"><MachineText lines={row.machineRollup} /></div>
                    </td>
                    {cellsOf(row).map((cell) => (
                      <td key={cell.productId} className="border-b border-line p-2 align-top">
                        <Cell cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-ink text-white">
                  <th className="sticky left-0 border-r border-white/10 bg-ink p-3 text-left text-sm font-semibold">可見工廠合計</th>
                  <td className="p-3">
                    <div className="text-2xl font-semibold tabular-nums">{visible.reduce((sum, row) => sum + row.machineTotal, 0)}</div>
                    <div className="mt-1 text-[11px] text-slate-300">各廠計畫機台加總，依目前篩選</div>
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="p-3 align-top text-sm">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-lg font-semibold tabular-nums">
                        {visible.reduce((sum, row) => sum + (row.cells.find((cell) => cell.productId === product.id)?.plannedTotal ?? 0), 0)}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="space-y-3 lg:hidden">
            {visible.map((row) => (
              <article key={row.factoryId} className="rounded-xl border border-line bg-panel p-3">
                <RowHead row={row} readyCount={cellsOf(row).filter((cell) => cell.ready).length} total={cellsOf(row).length} />
                <div className="mt-3 space-y-2">
                  {cellsOf(row).map((cell) => (
                    <div key={cell.productId}>
                      <div className="mb-1 text-xs font-medium text-muted">
                        {products.find((product) => product.id === cell.productId)?.name}
                        <span className="ml-1 rounded bg-teal-50 px-1 py-0.5 text-[10px] text-teal-900">{audienceLabel(products.find((product) => product.id === cell.productId)?.audience ?? "")}</span>
                      </div>
                      <Cell cell={cell} />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RowHead({ row, readyCount, total }: { row: BuildRow; readyCount: number; total: number }) {
  return (
    <div>
      <Link href={`/factories/${row.factoryId}#timeline`} className="font-semibold hover:underline">{row.factoryName}</Link>
      <div className="font-mono text-[11px] text-muted">{row.factoryCode}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        <MetaChip>{row.categoryLabel}</MetaChip>
        <MetaChip>{row.regionLabel}</MetaChip>
      </div>
      <div className="mt-2"><StatusChip kind="factory" value={row.status} /></div>
      {row.phase2 ? (
        <p className="mt-2 text-[11px] text-muted">
          交付階段 {row.phase2.plannedStart.slice(5)} – {row.phase2.plannedEnd.slice(5)} · <StatusChip kind="phase" value={row.phase2.status} />
        </p>
      ) : null}
      <p className="mt-2 text-lg font-semibold tabular-nums">{row.machineTotal}</p>
      <p className="text-[11px] text-muted">計畫機台合計 · <MachineText lines={row.machineRollup} /></p>
      <p className={cn("mt-1 text-xs", readyCount === total ? "text-emerald-800" : "text-amber-900")}>
        就緒 {readyCount}/{total}
      </p>
    </div>
  );
}

function Cell({ cell }: { cell: BuildCell }) {
  const missing = cell.flags.includes("PLAN_MISSING");
  const outside = cell.windowState === "OUTSIDE";
  return (
    <Link
      href={cell.planId ? `/factories/${cell.factoryId}/plans/${cell.productId}` : `/factories/${cell.factoryId}`}
      className={cn(
        "block rounded-lg border p-2 text-xs leading-5",
        cell.ready && "border-emerald-200 bg-emerald-50/70",
        missing && "border-amber-300 bg-amber-50",
        outside && "border-rose-300 bg-rose-50",
        !cell.ready && !missing && !outside && "border-amber-200 bg-amber-50/40",
      )}
    >
      <div className="mb-1 flex flex-wrap gap-1">
        <StatusChip kind="deployment" value={cell.deploymentStatus} />
        <StatusChip kind="plan" value={cell.planStatus} />
      </div>
      {cell.mode === "VERSIONED" ? (
        <>
          <div>提供 {cell.providedVersion ?? "—"}</div>
          <div className={cell.versionGap ? "text-amber-900" : ""}>實際 {cell.actualVersion ?? "未填"}{cell.versionGap ? " · 與提供版本不同" : ""}</div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">{productModeLabel.FEATURE_ONLY}</span>
          <span className="text-muted">異動 {cell.changeCount}</span>
        </div>
      )}
      <div className="text-muted">主責 {cell.primaryOwnerName}</div>
      <div className="text-muted">副責 {cell.secondaryOwnerName}</div>
      <div><MachineText lines={cell.machines} /></div>
      <div>
        時程 {shortDate(cell.windowStart)} – {shortDate(cell.windowEnd)}
        {outside ? <span className="text-rose-700"> · {cell.windowReasons.map((reason) => windowReasonLabel[reason]).join("、")}</span> : null}
      </div>
      <div className={cell.ready ? "text-emerald-800" : "text-ink"}>
        {cell.ready ? "計畫就緒" : cell.flags.map((flag) => readinessFlagLabel[flag]).join(" · ")}
      </div>
    </Link>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ code: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-muted">
      {label}
      <select className="h-8 rounded-md border border-line bg-white px-2 text-sm text-ink" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">全部</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
