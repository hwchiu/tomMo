import { addDays, isIsoDate } from "@/domain/dates";
import { nonNegativeInt } from "@/domain/machines";
import { compareSemver } from "@/domain/semver";
import { HANDOFF_TRANSITIONS } from "@/domain/transitions";
import type {
  ActivityEntity,
  Database,
  DeploymentStatus,
  FactoryStatus,
  FeatureChange,
  HandoffStatus,
  IssueSeverity,
  IssueStatus,
  PhaseLinkRelation,
  PhaseStatus,
  PmContact,
  TopicStatus,
} from "@/domain/types";
import { TOPIC_STATUSES } from "@/domain/types";
import { buildSeed } from "@/mocks/fixtures";
import { ApiError } from "./errors";

const DB_KEY = "fpm-db-v3";
let memory: Database | null = null;

export function getDb(): Database {
  if (!memory) {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(DB_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Database;
          if (Array.isArray(parsed.machineTypes) && Array.isArray(parsed.machineQuantities) && Array.isArray(parsed.topics) && parsed.factories.every((factory) => Boolean(factory.pmContact?.name))) {
            memory = parsed;
          }
        } catch {
          memory = null;
        }
      }
    }
    if (!memory) memory = buildSeed();
  }
  return memory;
}

export function resetDb(): Database {
  memory = buildSeed();
  if (typeof window !== "undefined") window.localStorage.removeItem(DB_KEY);
  return memory;
}

function persist(): void {
  if (typeof window !== "undefined" && memory) {
    window.localStorage.setItem(DB_KEY, JSON.stringify(memory));
  }
}

function nextId(db: Database, prefix: string): string {
  db.seq += 1;
  return `${prefix}_${db.seq}`;
}

function log(db: Database, actorId: string, entityType: ActivityEntity, entityId: string, action: string, summary: string): void {
  db.activity.unshift({
    id: nextId(db, "act"),
    entityType,
    entityId,
    action,
    summary,
    actorId,
    createdAt: new Date().toISOString(),
  });
}

function actor(db: Database, actorId: string) {
  const user = db.users.find((item) => item.id === actorId);
  if (!user) throw new ApiError("找不到目前的操作者", 401);
  return user;
}

function requireDate(value: string, label: string): string {
  if (!isIsoDate(value)) throw new ApiError(`${label}需要 YYYY-MM-DD`, 400);
  return value;
}

function optionalDate(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isIsoDate(value)) throw new ApiError("日期需要 YYYY-MM-DD", 400);
  return value;
}

export interface FactoryInput {
  code: string;
  name: string;
  location: string;
  description: string;
  category: string;
  region: string;
  technology: string;
  pmId: string;
  pmContact: PmContact;
  plannedStart: string;
  status: FactoryStatus;
}

export function createFactory(db: Database, actorId: string, input: FactoryInput) {
  actor(db, actorId);
  const code = input.code.trim().toUpperCase();
  if (!code || !input.name.trim()) throw new ApiError("工廠代碼與名稱必填", 400);
  if (db.factories.some((factory) => factory.code === code)) throw new ApiError("工廠代碼已存在", 400);
  assertEnum(db, "factoryCategory", input.category);
  assertEnum(db, "factoryRegion", input.region);
  assertEnum(db, "technologyNode", input.technology);
  if (!db.users.some((user) => user.id === input.pmId)) throw new ApiError("找不到 PM", 400);
  const pmContact = requireContact(input.pmContact);
  const start = requireDate(input.plannedStart, "計畫開始");
  const id = nextId(db, "fac");
  let cursor = start;
  const templates = [...db.phaseTemplates].sort((a, b) => a.order - b.order);
  const phaseIds: string[] = [];
  for (const template of templates) {
    const phaseId = nextId(db, "ph");
    const end = addDays(cursor, Math.max(template.defaultDurationDays, 1) - 1);
    db.phases.push({
      id: phaseId,
      factoryId: id,
      templateId: template.id,
      name: template.name,
      order: template.order,
      ownerId: input.pmId,
      plannedStart: cursor,
      plannedEnd: end,
      actualStart: null,
      actualEnd: null,
      status: "NOT_STARTED",
      riskNote: "",
      dependsOnPhaseIds: phaseIds.length ? [phaseIds[phaseIds.length - 1]] : [],
    });
    phaseIds.push(phaseId);
    cursor = addDays(end, 1);
  }
  const end = db.phases.filter((phase) => phase.factoryId === id).at(-1)?.plannedEnd ?? start;
  db.factories.push({
    id,
    code,
    name: input.name.trim(),
    location: input.location.trim(),
    description: input.description.trim(),
    category: input.category,
    region: input.region,
    technology: input.technology,
    pmId: input.pmId,
    pmContact,
    plannedStart: start,
    plannedEnd: end,
    actualStart: null,
    actualEnd: null,
    status: input.status,
  });
  for (const platform of db.platforms) {
    ensureDeployment(db, id, platform.id, input.pmId);
  }
  log(db, actorId, "FACTORY", id, "CREATE", `建立工廠 ${input.name.trim()}（${code}），並從四階段範本複製時程。`);
  persist();
  return { id };
}

export function updateFactory(db: Database, actorId: string, id: string, input: FactoryInput & { plannedEnd: string }) {
  const user = actor(db, actorId);
  const factory = must(db.factories, id, "找不到這座工廠");
  assertEnum(db, "factoryCategory", input.category);
  assertEnum(db, "factoryRegion", input.region);
  assertEnum(db, "technologyNode", input.technology);
  const previous = factory.status;
  factory.code = input.code.trim().toUpperCase();
  factory.name = input.name.trim();
  factory.location = input.location.trim();
  factory.description = input.description.trim();
  factory.category = input.category;
  factory.region = input.region;
  factory.technology = input.technology;
  factory.pmId = input.pmId;
  factory.pmContact = requireContact(input.pmContact);
  factory.plannedStart = requireDate(input.plannedStart, "計畫開始");
  factory.plannedEnd = requireDate(input.plannedEnd, "計畫結束");
  factory.status = input.status;
  if (previous !== input.status) {
    log(db, actorId, "FACTORY", id, "STATUS", `${user.name}把${factory.name}狀態改為 ${input.status}。`);
  } else {
    log(db, actorId, "FACTORY", id, "UPDATE", `${user.name}更新${factory.name}的基本資料。`);
  }
  persist();
  return { id };
}

export interface TopicInput {
  title: string;
  description: string;
  ownerId: string;
  status: TopicStatus;
  raisedOn: string;
}

export function createTopic(db: Database, actorId: string, factoryId: string, input: TopicInput) {
  const user = actor(db, actorId);
  const factory = must(db.factories, factoryId, "找不到這座工廠");
  const topic = normalizeTopic(db, input);
  const id = nextId(db, "tp");
  db.topics.push({ id, factoryId, ...topic });
  log(db, actorId, "TOPIC", id, "CREATE", `${user.name}在${factory.name}新增例外事項「${topic.title}」。`);
  persist();
  return { id, factoryId };
}

export function updateTopic(db: Database, actorId: string, id: string, input: TopicInput) {
  const user = actor(db, actorId);
  const topic = must(db.topics, id, "找不到這筆例外事項");
  const next = normalizeTopic(db, input);
  topic.title = next.title;
  topic.description = next.description;
  topic.ownerId = next.ownerId;
  topic.status = next.status;
  topic.raisedOn = next.raisedOn;
  log(db, actorId, "TOPIC", id, "UPDATE", `${user.name}更新例外事項「${topic.title}」。`);
  persist();
  return { id, factoryId: topic.factoryId };
}

function requireContact(input: PmContact | undefined): PmContact {
  const name = input?.name?.trim() ?? "";
  const email = input?.email?.trim() ?? "";
  const phone = input?.phone?.trim() ?? "";
  if (!name || !email || !phone) throw new ApiError("請填廠區 PM 姓名、信箱與電話", 400);
  if (!email.includes("@")) throw new ApiError("PM 信箱格式不正確", 400);
  return { name, email, phone };
}

function normalizeTopic(db: Database, input: TopicInput) {
  const title = input.title.trim();
  if (!title) throw new ApiError("請填例外事項標題", 400);
  if (!db.users.some((user) => user.id === input.ownerId)) throw new ApiError("找不到負責人", 400);
  if (!TOPIC_STATUSES.includes(input.status)) throw new ApiError("例外事項狀態不正確", 400);
  return {
    title,
    description: input.description.trim(),
    ownerId: input.ownerId,
    status: input.status,
    raisedOn: requireDate(input.raisedOn, "提出日期"),
  };
}

export interface PhaseInput {
  name: string;
  order: number;
  ownerId: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  status: PhaseStatus;
  riskNote: string;
  dependsOnPhaseIds: string[];
}

export function createPhase(db: Database, actorId: string, factoryId: string, input: PhaseInput) {
  const user = actor(db, actorId);
  must(db.factories, factoryId, "找不到這座工廠");
  const id = nextId(db, "ph");
  db.phases.push({
    id,
    factoryId,
    templateId: null,
    name: input.name.trim(),
    order: Number(input.order) || db.phases.filter((phase) => phase.factoryId === factoryId).length + 1,
    ownerId: input.ownerId,
    plannedStart: requireDate(input.plannedStart, "計畫開始"),
    plannedEnd: requireDate(input.plannedEnd, "計畫結束"),
    actualStart: optionalDate(input.actualStart),
    actualEnd: optionalDate(input.actualEnd),
    status: input.status,
    riskNote: input.riskNote.trim(),
    dependsOnPhaseIds: input.dependsOnPhaseIds.filter((dep) => dep !== id),
  });
  log(db, actorId, "PHASE", id, "CREATE", `${user.name}新增階段「${input.name.trim()}」。`);
  persist();
  return { id };
}

export function updatePhase(db: Database, actorId: string, id: string, input: PhaseInput) {
  const user = actor(db, actorId);
  const phase = must(db.phases, id, "找不到這個階段");
  const previous = phase.status;
  phase.name = input.name.trim();
  phase.order = Number(input.order) || phase.order;
  phase.ownerId = input.ownerId;
  phase.plannedStart = requireDate(input.plannedStart, "計畫開始");
  phase.plannedEnd = requireDate(input.plannedEnd, "計畫結束");
  phase.actualStart = optionalDate(input.actualStart);
  phase.actualEnd = optionalDate(input.actualEnd);
  phase.status = input.status;
  phase.riskNote = input.riskNote.trim();
  phase.dependsOnPhaseIds = input.dependsOnPhaseIds.filter((dep) => dep !== id);
  log(
    db,
    actorId,
    "PHASE",
    id,
    previous === input.status ? "UPDATE" : "STATUS",
    `${user.name}${previous === input.status ? "更新" : "變更"}階段「${phase.name}」。`,
  );
  persist();
  return { id: phase.factoryId };
}

export interface MilestoneInput {
  name: string;
  dueDate: string;
  deliverables: string;
  ownerId: string;
  done: boolean;
}

export function createMilestone(db: Database, actorId: string, phaseId: string, input: MilestoneInput) {
  const user = actor(db, actorId);
  const phase = must(db.phases, phaseId, "找不到這個階段");
  const id = nextId(db, "ms");
  db.milestones.push({
    id,
    phaseId,
    name: input.name.trim(),
    dueDate: requireDate(input.dueDate, "到期日"),
    deliverables: input.deliverables.trim(),
    done: input.done,
    completedAt: input.done ? new Date().toISOString() : null,
    ownerId: input.ownerId,
  });
  log(db, actorId, "MILESTONE", id, "CREATE", `${user.name}在「${phase.name}」新增里程碑「${input.name.trim()}」。`);
  persist();
  return { id, factoryId: phase.factoryId };
}

export function updateMilestone(db: Database, actorId: string, id: string, input: MilestoneInput) {
  const user = actor(db, actorId);
  const milestone = must(db.milestones, id, "找不到這個里程碑");
  const was = milestone.done;
  milestone.name = input.name.trim();
  milestone.dueDate = requireDate(input.dueDate, "到期日");
  milestone.deliverables = input.deliverables.trim();
  milestone.ownerId = input.ownerId;
  milestone.done = input.done;
  milestone.completedAt = input.done ? milestone.completedAt ?? new Date().toISOString() : null;
  const phase = must(db.phases, milestone.phaseId, "找不到這個階段");
  if (was !== input.done) {
    log(db, actorId, "MILESTONE", id, "STATUS", `${user.name}把里程碑「${milestone.name}」標為${input.done ? "完成" : "未完成"}。`);
  }
  persist();
  return { factoryId: phase.factoryId };
}

export interface HandoffInput {
  title: string;
  factoryId: string;
  fromPhaseId: string;
  toPhaseId: string;
  fromOwnerId: string;
  toOwnerId: string;
  escalationOwnerId: string | null;
  plannedDate: string;
  deliverables: string;
  acceptanceCriteria: string;
  blockers: string;
  status: HandoffStatus;
}

export function createHandoff(db: Database, actorId: string, input: HandoffInput) {
  const user = actor(db, actorId);
  const factory = must(db.factories, input.factoryId, "找不到這座工廠");
  assertSameFactory(db, input.factoryId, input.fromPhaseId, input.toPhaseId);
  const count = db.handoffs.filter((handoff) => handoff.factoryId === factory.id).length + 1;
  const id = nextId(db, "ho");
  db.handoffs.push({
    id,
    code: `HO-${factory.code.replace("FAB-", "")}-${count}`,
    title: input.title.trim(),
    factoryId: input.factoryId,
    fromPhaseId: input.fromPhaseId,
    toPhaseId: input.toPhaseId,
    fromOwnerId: input.fromOwnerId,
    toOwnerId: input.toOwnerId,
    escalationOwnerId: input.escalationOwnerId,
    plannedDate: requireDate(input.plannedDate, "計畫日"),
    actualDate: null,
    deliverables: input.deliverables.trim(),
    acceptanceCriteria: input.acceptanceCriteria.trim(),
    blockers: input.blockers.trim(),
    status: input.status,
    rejectionReason: "",
  });
  log(db, actorId, "HANDOFF", id, "CREATE", `${user.name}建立交接「${input.title.trim()}」。`);
  persist();
  return { id };
}

export function updateHandoff(db: Database, actorId: string, id: string, input: Omit<HandoffInput, "factoryId" | "status">) {
  const user = actor(db, actorId);
  const handoff = must(db.handoffs, id, "找不到這筆交接");
  assertSameFactory(db, handoff.factoryId, input.fromPhaseId, input.toPhaseId);
  handoff.title = input.title.trim();
  handoff.fromPhaseId = input.fromPhaseId;
  handoff.toPhaseId = input.toPhaseId;
  handoff.fromOwnerId = input.fromOwnerId;
  handoff.toOwnerId = input.toOwnerId;
  handoff.escalationOwnerId = input.escalationOwnerId;
  handoff.plannedDate = requireDate(input.plannedDate, "計畫日");
  handoff.deliverables = input.deliverables.trim();
  handoff.acceptanceCriteria = input.acceptanceCriteria.trim();
  handoff.blockers = input.blockers.trim();
  log(db, actorId, "HANDOFF", id, "UPDATE", `${user.name}更新交接 ${handoff.code} 的內容。`);
  persist();
  return { id };
}

export function transitionHandoff(
  db: Database,
  actorId: string,
  id: string,
  input: { status: HandoffStatus; rejectionReason?: string; blockers?: string; acknowledgeGaps?: boolean; unmet?: number },
) {
  const user = actor(db, actorId);
  const handoff = must(db.handoffs, id, "找不到這筆交接");
  const allowed = HANDOFF_TRANSITIONS[handoff.status];
  if (!allowed.includes(input.status)) throw new ApiError("這個狀態不能直接改到目標狀態", 400);
  if (input.status === "REJECTED" && !input.rejectionReason?.trim()) throw new ApiError("退回需要填原因", 400);
  if (input.status === "BLOCKED" && !(input.blockers?.trim() || handoff.blockers.trim())) throw new ApiError("受阻需要寫下阻擋原因", 400);
  if (input.status === "ACCEPTED" && (input.unmet ?? 0) > 0 && !input.acknowledgeGaps) {
    throw new ApiError("仍有未滿足條件。若仍要手動驗收，請先勾選已知悉落差。", 400);
  }
  handoff.status = input.status;
  if (input.rejectionReason) handoff.rejectionReason = input.rejectionReason.trim();
  if (input.blockers) handoff.blockers = input.blockers.trim();
  if (input.status === "ACCEPTED" && !handoff.actualDate) handoff.actualDate = db.asOf;
  const gap = input.status === "ACCEPTED" && (input.unmet ?? 0) > 0 ? "（已知悉未滿足條件）" : "";
  log(db, actorId, "HANDOFF", id, "STATUS", `${user.name}把 ${handoff.code} 改為 ${input.status}${gap}。`);
  persist();
  return { id };
}

export function createRequirement(
  db: Database,
  actorId: string,
  handoffId: string,
  input: { kind: Database["requirements"][number]["kind"]; platformId: string; minVersion: string | null; featureId: string | null; description: string },
) {
  const user = actor(db, actorId);
  const handoff = must(db.handoffs, handoffId, "找不到這筆交接");
  const id = nextId(db, "req");
  db.requirements.push({
    id,
    handoffId,
    kind: input.kind,
    platformId: input.platformId,
    minVersion: input.minVersion,
    featureId: input.featureId,
    description: input.description.trim(),
  });
  log(db, actorId, "HANDOFF", handoff.id, "REQUIREMENT", `${user.name}為 ${handoff.code} 新增條件：${input.description.trim()}。`);
  persist();
  return { id };
}

export interface IssueInput {
  title: string;
  description: string;
  factoryId: string;
  phaseId: string | null;
  platformId: string | null;
  handoffId: string | null;
  ownerId: string;
  severity: IssueSeverity;
  priority: "P0" | "P1" | "P2" | "P3";
  status: IssueStatus;
  dueDate: string | null;
  resolution: string;
}

export function createIssue(db: Database, actorId: string, input: IssueInput) {
  const user = actor(db, actorId);
  must(db.factories, input.factoryId, "找不到這座工廠");
  const id = nextId(db, "iss");
  const code = `ISS-${String(db.issues.length + 40).padStart(3, "0")}`;
  db.issues.unshift({
    id,
    code,
    title: input.title.trim(),
    description: input.description.trim(),
    factoryId: input.factoryId,
    phaseId: input.phaseId,
    milestoneId: null,
    platformId: input.platformId,
    handoffId: input.handoffId,
    ownerId: input.ownerId,
    severity: input.severity,
    priority: input.priority,
    status: input.status,
    dueDate: optionalDate(input.dueDate),
    resolution: input.resolution.trim(),
    updatedAt: new Date().toISOString(),
  });
  log(db, actorId, "ISSUE", id, "CREATE", `${user.name}登錄問題 ${code}：${input.title.trim()}。`);
  persist();
  return { id };
}

export function updateIssue(db: Database, actorId: string, id: string, input: IssueInput) {
  const user = actor(db, actorId);
  const issue = must(db.issues, id, "找不到這筆問題");
  const previous = issue.status;
  issue.title = input.title.trim();
  issue.description = input.description.trim();
  issue.factoryId = input.factoryId;
  issue.phaseId = input.phaseId;
  issue.platformId = input.platformId;
  issue.handoffId = input.handoffId;
  issue.ownerId = input.ownerId;
  issue.severity = input.severity;
  issue.priority = input.priority;
  issue.status = input.status;
  issue.dueDate = optionalDate(input.dueDate);
  issue.resolution = input.resolution.trim();
  issue.updatedAt = new Date().toISOString();
  log(
    db,
    actorId,
    "ISSUE",
    id,
    previous === input.status ? "UPDATE" : "STATUS",
    `${user.name}更新問題 ${issue.code}${previous === input.status ? "" : `，狀態改為 ${input.status}`}。`,
  );
  persist();
  return { id };
}

export interface DeploymentInput {
  plannedVersionId: string | null;
  actualVersionId: string | null;
  status: DeploymentStatus;
  secondaryOwnerId: string;
  plannedDate: string | null;
  deployedAt: string | null;
  notes: string;
  links: Array<{ phaseId: string; relation: PhaseLinkRelation }>;
  features: Array<{ featureId: string; desired: boolean; actual: boolean | null }>;
}

export function updateDeployment(db: Database, actorId: string, id: string, input: DeploymentInput) {
  const user = actor(db, actorId);
  const deployment = must(db.deployments, id, "找不到這筆部署");
  const platform = must(db.platforms, deployment.platformId, "找不到這個平台");
  if (input.status !== deployment.status) {
    log(db, actorId, "DEPLOYMENT", id, "STATUS", `${user.name}把${platform.name}部署狀態改為 ${input.status}。`);
  }
  if (input.actualVersionId !== deployment.actualVersionId) {
    const version = input.actualVersionId ? db.versions.find((item) => item.id === input.actualVersionId)?.version : "未填";
    log(db, actorId, "DEPLOYMENT", id, "ACTUAL_VERSION", `${user.name}填報${platform.name}實際版本為 ${version}。`);
  }
  if (input.plannedVersionId !== deployment.plannedVersionId) {
    const version = input.plannedVersionId ? db.versions.find((item) => item.id === input.plannedVersionId)?.version : "未填";
    log(db, actorId, "DEPLOYMENT", id, "PLANNED_VERSION", `${user.name}更新${platform.name}計畫版本為 ${version}。`);
  }
  deployment.plannedVersionId = input.plannedVersionId;
  deployment.actualVersionId = input.actualVersionId;
  deployment.status = input.status;
  deployment.secondaryOwnerId = input.secondaryOwnerId;
  deployment.plannedDate = optionalDate(input.plannedDate);
  deployment.deployedAt = optionalDate(input.deployedAt);
  deployment.notes = input.notes.trim();
  db.phaseLinks = db.phaseLinks.filter((link) => link.deploymentId !== id);
  for (const link of input.links) {
    db.phaseLinks.push({ id: nextId(db, "lnk"), deploymentId: id, phaseId: link.phaseId, relation: link.relation });
  }
  for (const feature of input.features) {
    const existing = db.featureConfigs.find((item) => item.deploymentId === id && item.featureId === feature.featureId);
    const previousDesired = existing?.desired;
    const previousActual = existing?.actual ?? null;
    if (!existing) {
      db.featureConfigs.push({ id: nextId(db, "fc"), deploymentId: id, featureId: feature.featureId, desired: feature.desired, actual: feature.actual });
    } else {
      existing.desired = feature.desired;
      existing.actual = feature.actual;
    }
    const featureName = db.features.find((item) => item.id === feature.featureId)?.name ?? feature.featureId;
    if (previousDesired !== undefined && previousDesired !== feature.desired) {
      log(db, actorId, "FEATURE", id, "DESIRED", `${user.name}把${platform.name}／${featureName}的期望改為${feature.desired ? "啟用" : "關閉"}。`);
    }
    if (previousActual !== feature.actual) {
      const label = feature.actual === null ? "未填報" : feature.actual ? "啟用" : "關閉";
      log(db, actorId, "FEATURE", id, "ACTUAL", `${user.name}填報${platform.name}／${featureName}實際為${label}。`);
    }
  }
  persist();
  return { id };
}

export interface PlanInput {
  providedVersionId: string | null;
  featureChanges: FeatureChange[];
  constructionStart: string | null;
  constructionEnd: string | null;
  machines: Array<{ machineTypeId: string; planned: number }>;
  note: string;
  intent: "draft" | "submit";
}

export function savePlan(db: Database, actorId: string, factoryId: string, platformId: string, input: PlanInput) {
  const user = actor(db, actorId);
  const platform = must(db.platforms, platformId, "找不到這個平台");
  const deployment = db.deployments.find((item) => item.factoryId === factoryId && item.platformId === platformId);
  const plan = db.plans.find((item) => item.factoryId === factoryId && item.platformId === platformId);
  if (!deployment || !plan) throw new ApiError("找不到這份平台計畫", 404);
  const start = optionalDate(input.constructionStart);
  const end = optionalDate(input.constructionEnd);
  if (start && end && end < start) throw new ApiError("施工結束日不能早於開始日", 400);
  const changes = input.featureChanges
    .filter((change) => change.featureId && change.summary.trim())
    .map((change) => ({ featureId: change.featureId, changeType: change.changeType, summary: change.summary.trim() }));
  if (input.intent === "submit") {
    if (!input.providedVersionId) throw new ApiError("送出前要選擇提供的版本", 400);
    if (!start || !end) throw new ApiError("送出前要填施工時間範圍", 400);
  }
  plan.providedVersionId = input.providedVersionId;
  plan.featureChanges = changes;
  plan.constructionStart = start;
  plan.constructionEnd = end;
  plan.note = input.note.trim();
  const machines = replaceMachines(db, deployment.id, input.machines ?? []);
  const editingLive = plan.status === "SUBMITTED" || plan.status === "APPROVED";
  if (input.intent === "submit" || editingLive) {
    plan.status = "SUBMITTED";
    plan.submittedById = user.id;
    plan.submittedAt = new Date().toISOString();
    plan.approvedById = null;
    plan.approvedAt = null;
  }
  const action = input.intent === "draft" && !editingLive ? "DRAFT" : "SUBMIT";
  const number = db.revisions.filter((revision) => revision.planId === plan.id).length + 1;
  db.revisions.push({
    id: nextId(db, "rev"),
    planId: plan.id,
    number,
    action,
    providedVersionId: plan.providedVersionId,
    featureChanges: changes,
    constructionStart: start,
    constructionEnd: end,
    machines,
    actorId: user.id,
    createdAt: new Date().toISOString(),
    note: input.note.trim(),
  });
  const verb = action === "DRAFT" ? "儲存草稿" : "送出";
  log(db, actorId, "PLAN", plan.id, action, `${user.name}${verb}${must(db.factories, factoryId, "找不到這座工廠").name}的${platform.name}計畫。`);
  persist();
  return { id: plan.id };
}

export function approvePlan(db: Database, actorId: string, factoryId: string, platformId: string) {
  const user = actor(db, actorId);
  const plan = db.plans.find((item) => item.factoryId === factoryId && item.platformId === platformId);
  if (!plan) throw new ApiError("找不到這份平台計畫", 404);
  if (plan.status !== "SUBMITTED") throw new ApiError("只有已提報的計畫可以核准", 400);
  plan.status = "APPROVED";
  plan.approvedById = user.id;
  plan.approvedAt = new Date().toISOString();
  const number = db.revisions.filter((revision) => revision.planId === plan.id).length + 1;
  db.revisions.push({
    id: nextId(db, "rev"),
    planId: plan.id,
    number,
    action: "APPROVE",
    providedVersionId: plan.providedVersionId,
    featureChanges: plan.featureChanges,
    constructionStart: plan.constructionStart,
    constructionEnd: plan.constructionEnd,
    machines: snapshotMachines(db, plan.deploymentId),
    actorId: user.id,
    createdAt: new Date().toISOString(),
    note: "PM 核准",
  });
  const platform = must(db.platforms, platformId, "找不到這個平台");
  log(db, actorId, "PLAN", plan.id, "APPROVE", `${user.name}核准${platform.name}計畫。`);
  persist();
  return { id: plan.id };
}

export interface PlatformInput {
  code: string;
  name: string;
  description: string;
  devDepartment: string;
  projectDepartment: string;
  primaryOwnerId: string;
}

export function createPlatform(db: Database, actorId: string, input: PlatformInput) {
  const user = actor(db, actorId);
  const code = input.code.trim().toUpperCase();
  if (!code || !input.name.trim()) throw new ApiError("平台代碼與名稱必填", 400);
  if (db.platforms.some((platform) => platform.code === code)) throw new ApiError("平台代碼已存在", 400);
  const id = nextId(db, "plt");
  db.platforms.push({
    id,
    code,
    name: input.name.trim(),
    description: input.description.trim(),
    devDepartment: input.devDepartment.trim(),
    projectDepartment: input.projectDepartment.trim(),
    primaryOwnerId: input.primaryOwnerId,
  });
  for (const factory of db.factories) {
    ensureDeployment(db, factory.id, id, factory.pmId);
  }
  log(db, actorId, "PLATFORM", id, "CREATE", `${user.name}新增平台「${input.name.trim()}」，並在每座工廠建立未提報的計畫。`);
  persist();
  return { id };
}

export function updatePlatform(db: Database, actorId: string, id: string, input: PlatformInput) {
  const user = actor(db, actorId);
  const platform = must(db.platforms, id, "找不到這個平台");
  platform.code = input.code.trim().toUpperCase();
  platform.name = input.name.trim();
  platform.description = input.description.trim();
  platform.devDepartment = input.devDepartment.trim();
  platform.projectDepartment = input.projectDepartment.trim();
  platform.primaryOwnerId = input.primaryOwnerId;
  log(db, actorId, "PLATFORM", id, "UPDATE", `${user.name}更新平台「${platform.name}」。`);
  persist();
  return { id };
}

export function createEnumeration(
  db: Database,
  actorId: string,
  input: { set: Database["enumerations"][number]["set"]; code: string; label: string; description: string },
) {
  const user = actor(db, actorId);
  const code = input.code.trim().toUpperCase();
  if (!code || !input.label.trim()) throw new ApiError("代碼與名稱必填", 400);
  if (db.enumerations.some((item) => item.set === input.set && item.code === code)) throw new ApiError("這個代碼已存在", 400);
  const order = db.enumerations.filter((item) => item.set === input.set).length + 1;
  const id = nextId(db, "en");
  db.enumerations.push({ id, set: input.set, code, label: input.label.trim(), description: input.description.trim(), order, active: true });
  log(db, actorId, "ENUM", id, "CREATE", `${user.name}新增列舉 ${input.set}／${input.label.trim()}。`);
  persist();
  return { id };
}

export function updateEnumeration(db: Database, actorId: string, id: string, input: { label: string; description: string; active: boolean }) {
  const user = actor(db, actorId);
  const item = must(db.enumerations, id, "找不到這個列舉");
  item.label = input.label.trim();
  item.description = input.description.trim();
  item.active = input.active;
  log(db, actorId, "ENUM", id, "UPDATE", `${user.name}更新列舉「${item.label}」。`);
  persist();
  return { id };
}

export function createMachineType(db: Database, actorId: string, input: { code: string; name: string }) {
  const user = actor(db, actorId);
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!code || !name) throw new ApiError("機種代碼與名稱必填", 400);
  if (db.machineTypes.some((item) => item.code === code)) throw new ApiError("這個機種代碼已存在", 400);
  const id = nextId(db, "mt");
  db.machineTypes.push({ id, code, name, order: db.machineTypes.length + 1, active: true });
  log(db, actorId, "MACHINE", id, "CREATE", `${user.name}新增機種「${name}」。`);
  persist();
  return { id };
}

export function updateMachineType(db: Database, actorId: string, id: string, input: { name: string; active: boolean }) {
  const user = actor(db, actorId);
  const item = must(db.machineTypes, id, "找不到這個機種");
  const name = input.name.trim();
  if (!name) throw new ApiError("機種名稱必填", 400);
  item.name = name;
  item.active = input.active;
  log(db, actorId, "MACHINE", id, "UPDATE", `${user.name}更新機種「${name}」。`);
  persist();
  return { id };
}

function replaceMachines(db: Database, deploymentId: string, rows: Array<{ machineTypeId: string; planned: number }>) {
  const seen = new Set<string>();
  const cleaned: Array<{ machineTypeId: string; planned: number }> = [];
  for (const row of rows) {
    if (seen.has(row.machineTypeId)) continue;
    seen.add(row.machineTypeId);
    if (!db.machineTypes.some((item) => item.id === row.machineTypeId)) throw new ApiError("找不到這個機種", 400);
    if (!Number.isInteger(row.planned) || row.planned < 0) throw new ApiError("計畫機台數需為 0 以上的整數", 400);
    cleaned.push({ machineTypeId: row.machineTypeId, planned: row.planned });
  }
  db.machineQuantities = db.machineQuantities.filter((row) => row.deploymentId !== deploymentId);
  for (const row of cleaned) {
    db.machineQuantities.push({ id: nextId(db, "mq"), deploymentId, machineTypeId: row.machineTypeId, planned: row.planned });
  }
  return cleaned;
}

function snapshotMachines(db: Database, deploymentId: string) {
  return db.machineQuantities
    .filter((row) => row.deploymentId === deploymentId)
    .map((row) => ({ machineTypeId: row.machineTypeId, planned: nonNegativeInt(row.planned) }));
}

export function diffVersionFeatures(db: Database, fromId: string | null, toId: string): FeatureChange[] {
  const to = db.versions.find((version) => version.id === toId);
  if (!to) return [];
  const features = db.features.filter((feature) => feature.platformId === to.platformId);
  const previous = fromId
    ? fromId
    : db.versions
        .filter((version) => version.platformId === to.platformId && version.id !== toId)
        .sort((a, b) => compareSemver(a.version, b.version) ?? 0)
        .filter((version) => (compareSemver(version.version, to.version) ?? 0) < 0)
        .at(-1)?.id ?? null;
  const supported = (versionId: string | null, featureId: string) =>
    Boolean(versionId && db.versionFeatures.some((row) => row.versionId === versionId && row.featureId === featureId && row.supported));
  const changes: FeatureChange[] = [];
  for (const feature of features) {
    const before = supported(previous, feature.id);
    const after = supported(toId, feature.id);
    if (!before && after) changes.push({ featureId: feature.id, changeType: "ADDED", summary: `相對前一版新增${feature.name}` });
    if (before && !after) changes.push({ featureId: feature.id, changeType: "REMOVED", summary: `相對前一版移除${feature.name}` });
  }
  return changes;
}

function ensureDeployment(db: Database, factoryId: string, platformId: string, ownerId: string) {
  const versions = db.versions
    .filter((version) => version.platformId === platformId)
    .sort((a, b) => compareSemver(a.version, b.version) ?? 0);
  const planned = versions.at(-1)?.id ?? null;
  const deploymentId = nextId(db, "dep");
  db.deployments.push({
    id: deploymentId,
    factoryId,
    platformId,
    plannedVersionId: planned,
    actualVersionId: null,
    status: "PLANNED",
    secondaryOwnerId: ownerId,
    plannedDate: null,
    deployedAt: null,
    notes: "",
  });
  const phase2 = db.phases.find((phase) => phase.factoryId === factoryId && phase.order === 2);
  if (phase2) {
    db.phaseLinks.push({ id: nextId(db, "lnk"), deploymentId, phaseId: phase2.id, relation: "INTRODUCED" });
  }
  for (const feature of db.features.filter((item) => item.platformId === platformId)) {
    const desired = Boolean(planned && db.versionFeatures.some((row) => row.versionId === planned && row.featureId === feature.id && row.supported));
    db.featureConfigs.push({ id: nextId(db, "fc"), deploymentId, featureId: feature.id, desired, actual: null });
  }
  db.plans.push({
    id: nextId(db, "plan"),
    factoryId,
    platformId,
    deploymentId,
    status: "NOT_SUBMITTED",
    providedVersionId: null,
    featureChanges: [],
    constructionStart: null,
    constructionEnd: null,
    note: "",
    submittedById: null,
    submittedAt: null,
    approvedById: null,
    approvedAt: null,
  });
}

function assertEnum(db: Database, set: Database["enumerations"][number]["set"], code: string) {
  const found = db.enumerations.find((item) => item.set === set && item.code === code && item.active);
  if (!found) throw new ApiError("請選擇有效的列舉值", 400);
}

function assertSameFactory(db: Database, factoryId: string, fromId: string, toId: string) {
  const from = must(db.phases, fromId, "找不到來源階段");
  const to = must(db.phases, toId, "找不到目的階段");
  if (from.factoryId !== factoryId || to.factoryId !== factoryId) throw new ApiError("交接的兩個階段必須屬於同一座工廠", 400);
}

function must<T extends { id: string }>(rows: T[], id: string, message: string): T {
  const found = rows.find((row) => row.id === id);
  if (!found) throw new ApiError(message, 404);
  return found;
}
