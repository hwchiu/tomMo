"use client";

import { monthBounds, monthOf } from "@/domain/schedule";

export function ScheduleFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-muted">
        月份
        <input
          type="month"
          aria-label="時程月份"
          className="h-8 rounded-md border border-line bg-white px-2 text-sm text-ink"
          value={monthOf(from, to)}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) {
              onChange("", "");
              return;
            }
            const bounds = monthBounds(value);
            if (bounds) onChange(bounds.from, bounds.to);
          }}
        />
      </label>
      <label className="flex items-center gap-1 text-muted">
        從
        <input
          type="date"
          aria-label="時程開始"
          className="h-8 rounded-md border border-line bg-white px-2 text-sm text-ink"
          value={from}
          onChange={(event) => onChange(event.target.value, to)}
        />
      </label>
      <label className="flex items-center gap-1 text-muted">
        到
        <input
          type="date"
          aria-label="時程結束"
          className="h-8 rounded-md border border-line bg-white px-2 text-sm text-ink"
          value={to}
          onChange={(event) => onChange(from, event.target.value)}
        />
      </label>
      {from || to ? (
        <button type="button" className="h-8 rounded-full border border-line bg-white px-3" onClick={() => onChange("", "")}>
          清除時程
        </button>
      ) : null}
    </div>
  );
}
