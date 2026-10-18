import type {
  ChangeType,
  DeploymentStatus,
  FactoryStatus,
  HandoffStatus,
  IssueSeverity,
  IssueStatus,
  PhaseLinkRelation,
  PhaseStatus,
  PlanStatus,
  RevisionAction,
} from "./types";
import type { ReadinessFlag } from "./readiness";
import type { WindowReason, WindowState } from "./windows";

export const factoryStatusLabel: Record<FactoryStatus, string> = {
  ON_TRACK: "進度正常",
  AT_RISK: "有風險",
  DELAYED: "延遲",
  COMPLETED: "已完成",
};

export const phaseStatusLabel: Record<PhaseStatus, string> = {
  NOT_STARTED: "未開始",
  IN_PROGRESS: "進行中",
  AT_RISK: "有風險",
  DELAYED: "延遲",
  COMPLETED: "已完成",
};

export const handoffStatusLabel: Record<HandoffStatus, string> = {
  WORK_DONE: "工作完成",
  PROPOSED: "已提出",
  PENDING_ACCEPTANCE: "待驗收",
  ACCEPTED: "已驗收",
  REJECTED: "已退回",
  BLOCKED: "受阻",
};

export const deploymentStatusLabel: Record<DeploymentStatus, string> = {
  PLANNED: "已規劃",
  IN_PROGRESS: "建置中",
  DEPLOYED: "已部署",
  ACCEPTED: "已驗收",
};

export const planStatusLabel: Record<PlanStatus, string> = {
  NOT_SUBMITTED: "未提報",
  SUBMITTED: "已提報",
  APPROVED: "PM 已核准",
};

export const changeTypeLabel: Record<ChangeType, string> = {
  ADDED: "新增",
  REMOVED: "移除",
  CHANGED: "變更",
};

export const severityLabel: Record<IssueSeverity, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "嚴重",
};

export const issueStatusLabel: Record<IssueStatus, string> = {
  OPEN: "開啟",
  IN_PROGRESS: "處理中",
  BLOCKED: "受阻",
  RESOLVED: "已解決",
  CLOSED: "已關閉",
};

export const priorityLabel = { P0: "P0", P1: "P1", P2: "P2", P3: "P3" };

export const relationLabel: Record<PhaseLinkRelation, string> = {
  INTRODUCED: "導入",
  UPGRADED: "升級",
  ACCEPTED: "驗收",
};

export const revisionActionLabel: Record<RevisionAction, string> = {
  DRAFT: "草稿",
  SUBMIT: "送出",
  APPROVE: "核准",
};

export const windowStateLabel: Record<WindowState, string> = {
  MISSING: "未填時程",
  INSIDE: "在平台建立區間內",
  OUTSIDE: "超出平台建立區間",
};

export const windowReasonLabel: Record<WindowReason, string> = {
  MISSING_DATES: "尚未填報施工起迄",
  MISSING_PHASE: "此工廠沒有平台建立階段",
  STARTS_BEFORE_PHASE: "開工早於平台建立階段",
  ENDS_AFTER_PHASE: "完工晚於平台建立階段",
};

export const readinessFlagLabel: Record<ReadinessFlag, string> = {
  PLAN_MISSING: "計畫未提報",
  PLAN_NOT_APPROVED: "計畫尚未核准",
  WINDOW_MISSING: "施工時程未填",
  WINDOW_OUTSIDE: "施工時程超出階段",
  DEPLOYMENT_INCOMPLETE: "部署尚未完成",
};

export const enumSetLabel = {
  factoryCategory: "廠別 Category",
  factoryRegion: "區域 Region",
  technologyNode: "製程節點",
} as const;

export function isOpenIssue(status: IssueStatus): boolean {
  return status === "OPEN" || status === "IN_PROGRESS" || status === "BLOCKED";
}
