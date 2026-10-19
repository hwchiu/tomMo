import type { Database } from "./types";

export const scheduleDateInvalid = "時程格式須為 YYYY-MM-DD";
export const scheduleMonthInvalid = "月份格式須為 YYYY-MM";
export const scheduleOrderInvalid = "時程的開始日不能晚於結束日";

export interface Schedule {
  from: string;
  to: string;
}

const monthPattern = /^\d{4}-\d{2}$/;

export function scheduleActive(schedule: Schedule): boolean {
  return schedule.from !== "" || schedule.to !== "";
}

export function monthBounds(month: string): { from: string; to: string } | null {
  if (!monthPattern.test(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  if (start.getUTCFullYear() !== year || start.getUTCMonth() !== monthNumber - 1) return null;
  const end = new Date(Date.UTC(year, monthNumber, 0));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export function monthOf(from: string, to: string): string {
  if (!/^\d{4}-\d{2}-01$/.test(from)) return "";
  const bounds = monthBounds(from.slice(0, 7));
  return bounds && bounds.to === to ? from.slice(0, 7) : "";
}

export function parseSchedule(month: string, from: string, to: string): Schedule {
  month = month.trim();
  from = from.trim();
  to = to.trim();
  if (!from && !to && month) {
    const bounds = monthBounds(month);
    if (!bounds) throw new Error(scheduleMonthInvalid);
    from = bounds.from;
    to = bounds.to;
  }
  if (from && !iso(from)) throw new Error(scheduleDateInvalid);
  if (to && !iso(to)) throw new Error(scheduleDateInvalid);
  if (from && to && from > to) throw new Error(scheduleOrderInvalid);
  return { from, to };
}

export function overlaps(start: string, end: string, from: string, to: string): boolean {
  if (!start && !end) return false;
  if (!start) start = end;
  if (!end) end = start;
  if (start > end) [start, end] = [end, start];
  if (from && end < from) return false;
  if (to && start > to) return false;
  return true;
}

export function factoryInSchedule(db: Database, factoryId: string, schedule: Schedule): boolean {
  if (!scheduleActive(schedule)) return true;
  for (const phase of db.phases) {
    if (phase.factoryId !== factoryId || phase.order !== 2) continue;
    if (overlaps(phase.plannedStart, phase.plannedEnd, schedule.from, schedule.to)) return true;
    if (overlaps(phase.actualStart ?? "", phase.actualEnd ?? "", schedule.from, schedule.to)) return true;
  }
  for (const plan of db.plans) {
    if (plan.factoryId !== factoryId) continue;
    if (overlaps(plan.constructionStart ?? "", plan.constructionEnd ?? "", schedule.from, schedule.to)) return true;
  }
  for (const deployment of db.deployments) {
    if (deployment.factoryId === factoryId && overlaps(deployment.plannedDate ?? "", "", schedule.from, schedule.to)) return true;
  }
  for (const issue of db.issues) {
    if (issue.factoryId === factoryId && issueOpen(issue.status) && overlaps(issue.dueDate ?? "", "", schedule.from, schedule.to)) return true;
  }
  const phases = new Set(db.phases.filter((phase) => phase.factoryId === factoryId).map((phase) => phase.id));
  for (const milestone of db.milestones) {
    if (phases.has(milestone.phaseId) && overlaps(milestone.dueDate, "", schedule.from, schedule.to)) return true;
  }
  return false;
}

export function productInSchedule(db: Database, factoryId: string, productId: string, schedule: Schedule): boolean {
  if (!scheduleActive(schedule)) return true;
  for (const plan of db.plans) {
    if (plan.factoryId !== factoryId || plan.productId !== productId) continue;
    if (overlaps(plan.constructionStart ?? "", plan.constructionEnd ?? "", schedule.from, schedule.to)) return true;
  }
  for (const deployment of db.deployments) {
    if (deployment.factoryId === factoryId && deployment.productId === productId && overlaps(deployment.plannedDate ?? "", "", schedule.from, schedule.to)) {
      return true;
    }
  }
  for (const issue of db.issues) {
    if (issue.factoryId !== factoryId || issue.productId !== productId || !issueOpen(issue.status)) continue;
    if (overlaps(issue.dueDate ?? "", "", schedule.from, schedule.to)) return true;
  }
  return false;
}

export function rangeFromQuery(from: string, to: string, month: string): Schedule {
  if (from || to) return { from, to };
  return monthBounds(month) ?? { from: "", to: "" };
}

export function scheduleLabel(from: string, to: string): string {
  if (from && to) return `${from} – ${to}`;
  if (from) return `${from} 起`;
  return `至 ${to}`;
}

function issueOpen(status: string): boolean {
  return status === "OPEN" || status === "IN_PROGRESS" || status === "BLOCKED";
}

function iso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
