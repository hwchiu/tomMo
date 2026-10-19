import { dayDiff } from "./dates";

/** How far ahead a missing or unapproved plan still counts as 待補. */
export const DUE_SOON_DAYS = 14;

export const DELAY_KIND_LATE = "late";
export const DELAY_KIND_GAP = "gap";

export const delayCatalog = [
  {
    code: "PHASE2_DATES_MISSING",
    label: "第二階段日期未設定",
    explanation: "這座廠沒有第二階段，或是計畫開始、結束日還沒填。算待補，不算已經遲到。",
  },
  {
    code: "PLAN_NOT_SUBMITTED",
    label: "施工計畫未提交",
    explanation: "計畫仍是未提交。第二階段已開始（或狀態已在進行）算延遲；開始日在 14 天內算待補；更遠則不列。",
  },
  {
    code: "PLAN_NOT_APPROVED",
    label: "計畫未核准",
    explanation: "計畫已提交但尚未核准。時間判斷與施工計畫未提交相同，不和未提交重複計算。",
  },
  {
    code: "VERSION_MISSING",
    label: "未指定提供版本",
    explanation: "有版本的產品已提出計畫，卻沒有指定提供版本。階段已開始算延遲，否則算待補。",
  },
  {
    code: "FEATURE_UNPLANNED",
    label: "功能開關未定",
    explanation: "純功能開關產品已提出計畫，卻還沒為每個功能選擇開或關。階段已開始算延遲，否則算待補。",
  },
  {
    code: "WINDOW_MISSING",
    label: "施工時窗未填",
    explanation: "已提交或已核准的計畫少了施工開始或結束日。未提交的計畫不另列這項。階段已開始算延遲，否則算待補。",
  },
  {
    code: "WINDOW_STARTS_BEFORE",
    label: "施工時窗早於第二階段",
    explanation: "施工開始日早於第二階段開始日。這是時程不符，算待補，不計遲到天數。",
  },
  {
    code: "WINDOW_ENDS_AFTER",
    label: "施工時窗晚於第二階段",
    explanation: "施工結束日晚於第二階段結束日。這是時程不符，算待補，不計遲到天數。",
  },
  {
    code: "CONSTRUCTION_OVERDUE",
    label: "已過預計完工日尚未完成",
    explanation: "施工結束日早於基準日，部署狀態還不是已驗收。遲到天數是基準日減結束日。",
  },
  {
    code: "ISSUE_OVERDUE",
    label: "有逾期未解問題",
    explanation: "這座廠或這個產品有未結案問題（待處理、處理中、受阻），到期日早於基準日。沒有指定產品的問題會計入每一格。",
  },
] as const;

export type DelayCode = (typeof delayCatalog)[number]["code"];
export type DelayKind = "late" | "gap";
export type DelayOwnerRole = "primary" | "secondary" | "pm" | "issue";

export interface DelayIssueInput {
  productId: string | null;
  status: string;
  dueDate: string | null;
  ownerId: string;
}

export interface DelayInput {
  asOf: string;
  phaseStart: string;
  phaseEnd: string;
  phaseStatus: string;
  phaseOwnerId: string;
  factoryPmId: string;
  planStatus: string;
  mode: string;
  hasProvidedVersion: boolean;
  featurePlanComplete: boolean;
  windowStart: string | null;
  windowEnd: string | null;
  deploymentStatus: string;
  secondaryOwnerId: string;
  primaryOwnerId: string;
  productId: string;
  issues: DelayIssueInput[];
}

export interface DelayReason {
  code: DelayCode;
  label: string;
  explanation: string;
  kind: DelayKind;
  daysLate: number | null;
  ownerPersonId: string;
  ownerRole: DelayOwnerRole;
}

interface PhaseClock {
  late: boolean;
  soon: boolean;
  days: number | null;
}

/**
 * Reasons for one factory × product cell. `late` is already past the as-of date.
 * `gap` is missing or mismatched information that is not late yet. `daysLate` is
 * a calendar count only when the reason is late against a date; 0 means Phase 2
 * started on the as-of date.
 */
export function delayReasons(input: DelayInput): DelayReason[] {
  const out: DelayReason[] = [];
  const plan = input.planStatus || "NOT_SUBMITTED";
  const deployment = input.deploymentStatus || "PLANNED";
  const start = input.windowStart ?? "";
  const end = input.windowEnd ?? "";
  const clock = phaseTiming(input);
  const phase = phaseOwnerOf(input);
  const primary = primaryOwnerOf(input);
  const secondary = secondaryOwnerOf(input);

  if (!input.phaseStart || !input.phaseEnd) {
    out.push(reason("PHASE2_DATES_MISSING", "gap", null, phase));
  }
  if (plan === "NOT_SUBMITTED") {
    const listedKind = listed(clock, false);
    if (listedKind) out.push(reason("PLAN_NOT_SUBMITTED", listedKind, clock.days, primary));
  } else if (plan === "SUBMITTED") {
    const listedKind = listed(clock, false);
    if (listedKind) out.push(reason("PLAN_NOT_APPROVED", listedKind, clock.days, primary));
  }
  if (plan === "SUBMITTED" || plan === "APPROVED") {
    if (input.mode === "VERSIONED" && !input.hasProvidedVersion) {
      const kind = listed(clock, true) ?? "gap";
      out.push(reason("VERSION_MISSING", kind, kind === "late" ? clock.days : null, primary));
    }
    if (input.mode === "FEATURE_ONLY" && !input.featurePlanComplete) {
      const kind = listed(clock, true) ?? "gap";
      out.push(reason("FEATURE_UNPLANNED", kind, kind === "late" ? clock.days : null, primary));
    }
    if (!start || !end) {
      const kind = listed(clock, true) ?? "gap";
      out.push(reason("WINDOW_MISSING", kind, kind === "late" ? clock.days : null, secondary));
    }
  }
  if (start && end && input.phaseStart && input.phaseEnd) {
    if (start < input.phaseStart) out.push(reason("WINDOW_STARTS_BEFORE", "gap", null, secondary));
    if (end > input.phaseEnd) out.push(reason("WINDOW_ENDS_AFTER", "gap", null, secondary));
  }
  if (end && end < input.asOf && deployment !== "ACCEPTED") {
    out.push(reason("CONSTRUCTION_OVERDUE", "late", dayDiff(input.asOf, end), secondary));
  }
  const issue = worstIssue(input);
  if (issue) out.push(reason("ISSUE_OVERDUE", "late", issue.days, { id: issue.ownerId, role: "issue" }));
  return out;
}

export function ownerRoleLabel(role: string): string {
  switch (role) {
    case "primary":
      return "產品主責";
    case "secondary":
      return "工廠副責";
    case "issue":
      return "問題負責人";
    default:
      return "廠務 PM";
  }
}

function reason(
  code: DelayCode,
  kind: DelayKind,
  daysLate: number | null,
  owner: { id: string; role: DelayOwnerRole },
): DelayReason {
  const spec = delayCatalog.find((item) => item.code === code);
  return {
    code,
    label: spec?.label ?? code,
    explanation: spec?.explanation ?? "",
    kind,
    daysLate: kind === "late" ? daysLate : null,
    ownerPersonId: owner.id,
    ownerRole: owner.role,
  };
}

function phaseTiming(input: DelayInput): PhaseClock {
  const status = input.phaseStatus;
  const active = status === "IN_PROGRESS" || status === "AT_RISK" || status === "DELAYED" || status === "COMPLETED";
  const ended = status === "COMPLETED" || (Boolean(input.phaseEnd) && input.asOf > input.phaseEnd);
  if (active || ended || (input.phaseStart && input.asOf >= input.phaseStart)) {
    const days = input.phaseStart && input.asOf >= input.phaseStart ? dayDiff(input.asOf, input.phaseStart) : null;
    return { late: true, soon: false, days };
  }
  if (input.phaseStart && input.asOf < input.phaseStart && dayDiff(input.phaseStart, input.asOf) <= DUE_SOON_DAYS) {
    return { late: false, soon: true, days: null };
  }
  return { late: false, soon: false, days: null };
}

function listed(clock: PhaseClock, alwaysGap: boolean): DelayKind | null {
  if (clock.late) return "late";
  if (clock.soon || alwaysGap) return "gap";
  return null;
}

function worstIssue(input: DelayInput): { ownerId: string; days: number } | null {
  let best: { ownerId: string; days: number } | null = null;
  for (const issue of input.issues ?? []) {
    if (issue.status !== "OPEN" && issue.status !== "IN_PROGRESS" && issue.status !== "BLOCKED") continue;
    if (!issue.dueDate || issue.dueDate >= input.asOf) continue;
    if (issue.productId && issue.productId !== input.productId) continue;
    const days = dayDiff(input.asOf, issue.dueDate);
    if (!best || days > best.days) best = { ownerId: issue.ownerId, days };
  }
  return best;
}

function primaryOwnerOf(input: DelayInput): { id: string; role: DelayOwnerRole } {
  if (input.primaryOwnerId) return { id: input.primaryOwnerId, role: "primary" };
  return { id: input.factoryPmId, role: "pm" };
}

function secondaryOwnerOf(input: DelayInput): { id: string; role: DelayOwnerRole } {
  if (input.secondaryOwnerId) return { id: input.secondaryOwnerId, role: "secondary" };
  return { id: input.factoryPmId, role: "pm" };
}

function phaseOwnerOf(input: DelayInput): { id: string; role: DelayOwnerRole } {
  if (input.phaseOwnerId) return { id: input.phaseOwnerId, role: "pm" };
  return { id: input.factoryPmId, role: "pm" };
}
