"use client";

import Link from "next/link";
import { MachineSettingsPanel, ProductSettingsPanel } from "@/components/activity-settings";
import { PeopleDirectory } from "@/components/admin-view";
import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { withQuery } from "@/lib/search";

export const MANAGE_SECTIONS = [
  { id: "people", label: "人員", hint: "姓名與部門，可指派為負責人" },
  { id: "products", label: "產品設定", hint: "產品名稱、部門與主責" },
  { id: "machines", label: "機器設定", hint: "機種名稱，例如 EIA-1" },
] as const;

export type ManageSection = (typeof MANAGE_SECTIONS)[number]["id"];

export function manageSection(value: string | null): ManageSection {
  if (value === "products" || value === "machines") return value;
  return "people";
}

export function ManageView({ section }: { section: ManageSection }) {
  return (
    <div>
      <PageHeader
        kicker="Admin"
        title="管理"
        description="人員、產品與機種在同一個地方。類別只有 Giga 與 Phase，區域是 HQ、JP、AZ、EU，都不在這裡改。工廠沒有節點設定，廠名就是廠。"
      />
      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="flex gap-2 overflow-x-auto md:flex-col" aria-label="管理分區">
          {MANAGE_SECTIONS.map((item) => {
            const current = section === item.id;
            return (
              <Link
                key={item.id}
                href={withQuery("/admin", { section: item.id === "people" ? "" : item.id })}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "min-w-[9rem] rounded-lg border px-3 py-2 md:min-w-0",
                  current ? "border-accent bg-white" : "border-line bg-slate-50 hover:border-accent/40",
                )}
              >
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted">{item.hint}</span>
              </Link>
            );
          })}
        </nav>
        <div>
          {section === "people" ? <PeopleDirectory /> : null}
          {section === "products" ? <ProductSettingsPanel /> : null}
          {section === "machines" ? <MachineSettingsPanel /> : null}
        </div>
      </div>
    </div>
  );
}
