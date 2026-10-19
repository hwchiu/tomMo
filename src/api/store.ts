import { addDays, isIsoDate } from "@/domain/dates";
import { featureOverrides, isFeaturePlanComplete } from "@/domain/features";
import { machineTypeNameError } from "@/domain/machine-type";
import { nonNegativeInt } from "@/domain/machines";
import { compareSemver } from "@/domain/semver";
import type {
  ActivityEntity,
  Database,
  DeploymentStatus,
  FactoryStatus,
  AdHocChange,
  FeatureChange,
  IssueSeverity,
  IssueStatus,
  Person,
  PhaseLinkRelation,
  PhaseStatus,
  PlannedFeature,
  ProductMode,
  TopicStatus,
} from "@/domain/types";
import { PRODUCT_MODES } from "@/domain/types";
import { TOPIC_STATUSES } from "@/domain/types";
import { buildSeed } from "@/mocks/fixtures";
import { factoryCategoryInvalid, factoryRegionInvalid, normalizeFactoryCategory, normalizeFactoryRegion } from "@/domain/factory-attr";
import { ApiError } from "./errors";

const DB_KEY = "fpm-db-v7";
let memory: Database | null = null;

export function getDb(): Database {
  if (!memory) {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(DB_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Database;
          if (
            Array.isArray(parsed.machineTypes) &&
            Array.isArray(parsed.machineQuantities) &&
            Array.isArray(parsed.topics) &&
            Array.isArray(parsed.people) &&
            parsed.products.every((product) => (product.mode === "VERSIONED" || product.mode === "FEATURE_ONLY") && !("code" in product)) &&
            parsed.plans.every((plan) => Array.isArray(plan.plannedFeatures) && Array.isArray(plan.adHocChanges))
          ) {
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
  const user = db.people.find((item) => item.id === actorId);
  if (!user) throw new ApiError("找不到目前的操作者", 401);
  return user;
}

function requirePerson(db: Database, id: string): Person {
  const person = db.people.find((item) => item.id === id);
  if (!person || !person.active) throw new ApiError("請從在職人員名單選擇", 400);
  return person;
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
  pmId: string;
  plannedStart: string;
  status: FactoryStatus;
}

export function createFactory(db: Database, actorId: string, input: FactoryInput) {
  actor(db, actorId);
  const code = input.code.trim().toUpperCase();
  if (!code || !input.name.trim()) throw new ApiError("工廠代碼與名稱必填", 400);
  if (db.factories.some((factory) => factory.code === code)) throw new ApiError("工廠代碼已存在", 400);
  const category = requireCategory(input.category);
  const region = requireRegion(input.region);
  requirePerson(db, input.pmId);
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
    category,
    region,
    pmId: input.pmId,
    plannedStart: start,
    plannedEnd: end,
    actualStart: null,
    actualEnd: null,
    status: input.status,
  });
  for (const product of db.products) {
    ensureDeployment(db, id, product.id, input.pmId);
  }
  log(db, actorId, "FACTORY", id, "CREATE", `建立工廠 ${input.name.trim()}（${code}），並從四階段範本複製時程。`);
  persist();
  return { id };
}

export function updateFactory(db: Database, actorId: string, id: string, input: FactoryInput & { plannedEnd: string }) {
  const user = actor(db, actorId);
  const factory = must(db.factories, id, "找不到這座工廠");
  const category = requireCategory(input.category);
  const region = requireRegion(input.region);
  const previous = factory.status;
  factory.code = input.code.trim().toUpperCase();
  factory.name = input.name.trim();
  factory.location = input.location.trim();
  factory.description = input.description.trim();
  factory.category = category;
  factory.region = region;
  requirePerson(db, input.pmId);
  factory.pmId = input.pmId;
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

function normalizeTopic(db: Database, input: TopicInput) {
  const title = input.title.trim();
  if (!title) throw new ApiError("請填例外事項標題", 400);
  requirePerson(db, input.ownerId);
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
  requirePerson(db, input.ownerId);
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
  requirePerson(db, input.ownerId);
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
  requirePerson(db, input.ownerId);
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
  requirePerson(db, input.ownerId);
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

export interface IssueInput {
  title: string;
  description: string;
  factoryId: string;
  phaseId: string | null;
  productId: string | null;
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
  requirePerson(db, input.ownerId);
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
    productId: input.productId,
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
  requirePerson(db, input.ownerId);
  const previous = issue.status;
  issue.title = input.title.trim();
  issue.description = input.description.trim();
  issue.factoryId = input.factoryId;
  issue.phaseId = input.phaseId;
  issue.productId = input.productId;
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
  requirePerson(db, input.secondaryOwnerId);
  const product = must(db.products, deployment.productId, "找不到這個產品");
  if (product.mode === "FEATURE_ONLY") {
    input = { ...input, plannedVersionId: null, actualVersionId: null };
  }
  if (input.status !== deployment.status) {
    log(db, actorId, "DEPLOYMENT", id, "STATUS", `${user.name}把${product.name}部署狀態改為 ${input.status}。`);
  }
  if (input.actualVersionId !== deployment.actualVersionId) {
    const version = input.actualVersionId ? db.versions.find((item) => item.id === input.actualVersionId)?.version : "未填";
    log(db, actorId, "DEPLOYMENT", id, "ACTUAL_VERSION", `${user.name}填報${product.name}實際版本為 ${version}。`);
  }
  if (input.plannedVersionId !== deployment.plannedVersionId) {
    const version = input.plannedVersionId ? db.versions.find((item) => item.id === input.plannedVersionId)?.version : "未填";
    log(db, actorId, "DEPLOYMENT", id, "PLANNED_VERSION", `${user.name}更新${product.name}計畫版本為 ${version}。`);
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
      log(db, actorId, "FEATURE", id, "DESIRED", `${user.name}把${product.name}／${featureName}的期望改為${feature.desired ? "啟用" : "關閉"}。`);
    }
    if (previousActual !== feature.actual) {
      const label = feature.actual === null ? "未填報" : feature.actual ? "啟用" : "關閉";
      log(db, actorId, "FEATURE", id, "ACTUAL", `${user.name}填報${product.name}／${featureName}實際為${label}。`);
    }
  }
  persist();
  return { id };
}

export interface PlanInput {
  providedVersionId: string | null;
  plannedFeatures: PlannedFeature[];
  /** Descriptions for feature-flag diffs, keyed by feature id. */
  reasons?: Record<string, string>;
  adHocChanges: AdHocChange[];
  constructionStart: string | null;
  constructionEnd: string | null;
  machines: Array<{ machineTypeId: string; planned: number }>;
  note: string;
  intent: "draft" | "submit";
}

export function savePlan(db: Database, actorId: string, factoryId: string, productId: string, input: PlanInput) {
  const user = actor(db, actorId);
  const product = must(db.products, productId, "找不到這個產品");
  const deployment = db.deployments.find((item) => item.factoryId === factoryId && item.productId === productId);
  const plan = db.plans.find((item) => item.factoryId === factoryId && item.productId === productId);
  if (!deployment || !plan) throw new ApiError("找不到這份產品計畫", 404);
  const start = optionalDate(input.constructionStart);
  const end = optionalDate(input.constructionEnd);
  if (start && end && end < start) throw new ApiError("施工結束日不能早於開始日", 400);
  const features = db.features.filter((feature) => feature.productId === productId);
  let providedVersionId: string | null = null;
  const plannedFeatures: PlannedFeature[] = [];
  let adhoc: AdHocChange[] = [];
  if (product.mode === "FEATURE_ONLY") {
    const seen = new Set<string>();
    for (const row of input.plannedFeatures ?? []) {
      if (!features.some((feature) => feature.id === row.featureId)) throw new ApiError("找不到這個功能", 400);
      if (seen.has(row.featureId)) continue;
      seen.add(row.featureId);
      plannedFeatures.push({ featureId: row.featureId, enabled: Boolean(row.enabled) });
    }
    if ((input.intent === "submit" || plan.status === "SUBMITTED" || plan.status === "APPROVED") && !isFeaturePlanComplete(features.map((feature) => feature.id), plannedFeatures)) {
      throw new ApiError("送出前要為每個功能選擇啟用或關閉", 400);
    }
    adhoc = featureOverrides(features, plannedFeatures, input.reasons ?? {}, normalizeAdHoc(db, productId, input.adHocChanges ?? [], "FEATURE_ONLY"));
    for (const row of plannedFeatures) {
      const existing = db.featureConfigs.find((item) => item.deploymentId === deployment.id && item.featureId === row.featureId);
      if (existing) existing.desired = row.enabled;
    }
  } else {
    if (input.providedVersionId && !db.versions.some((version) => version.id === input.providedVersionId && version.productId === productId)) {
      throw new ApiError("這個版本不屬於此產品", 400);
    }
    if (input.intent === "submit" && !input.providedVersionId) throw new ApiError("送出前要選擇提供的版本", 400);
    providedVersionId = input.providedVersionId;
    adhoc = normalizeAdHoc(db, productId, input.adHocChanges ?? [], "VERSIONED");
  }
  if (input.intent === "submit" && (!start || !end)) throw new ApiError("送出前要填施工時間範圍", 400);
  plan.providedVersionId = providedVersionId;
  plan.plannedFeatures = plannedFeatures;
  plan.adHocChanges = adhoc;
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
    plannedFeatures,
    adHocChanges: adhoc,
    constructionStart: start,
    constructionEnd: end,
    machines,
    actorId: user.id,
    createdAt: new Date().toISOString(),
    note: input.note.trim(),
  });
  const verb = action === "DRAFT" ? "儲存草稿" : "送出";
  log(db, actorId, "PLAN", plan.id, action, `${user.name}${verb}${must(db.factories, factoryId, "找不到這座工廠").name}的${product.name}計畫。`);
  persist();
  return { id: plan.id };
}

export function approvePlan(db: Database, actorId: string, factoryId: string, productId: string) {
  const user = actor(db, actorId);
  const plan = db.plans.find((item) => item.factoryId === factoryId && item.productId === productId);
  if (!plan) throw new ApiError("找不到這份產品計畫", 404);
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
    plannedFeatures: plan.plannedFeatures,
    adHocChanges: plan.adHocChanges,
    constructionStart: plan.constructionStart,
    constructionEnd: plan.constructionEnd,
    machines: snapshotMachines(db, plan.deploymentId),
    actorId: user.id,
    createdAt: new Date().toISOString(),
    note: "PM 核准",
  });
  const product = must(db.products, productId, "找不到這個產品");
  log(db, actorId, "PLAN", plan.id, "APPROVE", `${user.name}核准${product.name}計畫。`);
  persist();
  return { id: plan.id };
}

export interface ProductInput {
  name: string;
  description: string;
  devDepartment: string;
  projectDepartment: string;
  primaryOwnerId: string;
  mode: ProductMode;
}

export function createProduct(db: Database, actorId: string, input: ProductInput) {
  const user = actor(db, actorId);
  if (!input.name.trim()) throw new ApiError("產品名稱必填", 400);
  if (!PRODUCT_MODES.includes(input.mode)) throw new ApiError("請選擇版本模式或僅功能開關", 400);
  requirePerson(db, input.primaryOwnerId);
  const id = nextId(db, "prd");
  db.products.push({
    id,
    name: input.name.trim(),
    description: input.description.trim(),
    devDepartment: input.devDepartment.trim(),
    projectDepartment: input.projectDepartment.trim(),
    primaryOwnerId: input.primaryOwnerId,
    mode: input.mode,
  });
  for (const factory of db.factories) {
    ensureDeployment(db, factory.id, id, factory.pmId);
  }
  log(db, actorId, "PRODUCT", id, "CREATE", `${user.name}新增產品「${input.name.trim()}」，並在每座工廠建立未提報的計畫。`);
  persist();
  return { id };
}

export function updateProduct(db: Database, actorId: string, id: string, input: ProductInput) {
  const user = actor(db, actorId);
  const product = must(db.products, id, "找不到這個產品");
  if (!input.name.trim()) throw new ApiError("產品名稱必填", 400);
  requirePerson(db, input.primaryOwnerId);
  product.name = input.name.trim();
  product.description = input.description.trim();
  product.devDepartment = input.devDepartment.trim();
  product.projectDepartment = input.projectDepartment.trim();
  product.primaryOwnerId = input.primaryOwnerId;
  if (PRODUCT_MODES.includes(input.mode)) product.mode = input.mode;
  log(db, actorId, "PRODUCT", id, "UPDATE", `${user.name}更新產品「${product.name}」。`);
  persist();
  return { id };
}

export function createMachineType(db: Database, actorId: string, input: { name: string }) {
  const user = actor(db, actorId);
  const invalid = machineTypeNameError(input.name);
  if (invalid) throw new ApiError(invalid, 400);
  const name = input.name.trim();
  if (db.machineTypes.some((item) => item.name.toLowerCase() === name.toLowerCase())) throw new ApiError("這個機種名稱已存在", 400);
  const id = nextId(db, "mt");
  db.machineTypes.push({ id, name, order: db.machineTypes.length + 1, active: true });
  log(db, actorId, "MACHINE", id, "CREATE", `${user.name}新增機種「${name}」。`);
  persist();
  return { id };
}

export function updateMachineType(db: Database, actorId: string, id: string, input: { name: string; active: boolean }) {
  const user = actor(db, actorId);
  const item = must(db.machineTypes, id, "找不到這個機種");
  const invalid = machineTypeNameError(input.name);
  if (invalid) throw new ApiError(invalid, 400);
  const name = input.name.trim();
  if (db.machineTypes.some((other) => other.id !== id && other.name.toLowerCase() === name.toLowerCase())) throw new ApiError("這個機種名稱已存在", 400);
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
  const features = db.features.filter((feature) => feature.productId === to.productId);
  const previous = fromId
    ? fromId
    : db.versions
        .filter((version) => version.productId === to.productId && version.id !== toId)
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

function ensureDeployment(db: Database, factoryId: string, productId: string, ownerId: string) {
  const product = must(db.products, productId, "找不到這個產品");
  const versions = product.mode === "VERSIONED"
    ? db.versions
        .filter((version) => version.productId === productId)
        .sort((a, b) => compareSemver(a.version, b.version) ?? 0)
    : [];
  const planned = versions.at(-1)?.id ?? null;
  const deploymentId = nextId(db, "dep");
  db.deployments.push({
    id: deploymentId,
    factoryId,
    productId,
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
  for (const feature of db.features.filter((item) => item.productId === productId)) {
    const desired = product.mode === "FEATURE_ONLY"
      ? feature.defaultEnabled
      : Boolean(planned && db.versionFeatures.some((row) => row.versionId === planned && row.featureId === feature.id && row.supported));
    db.featureConfigs.push({ id: nextId(db, "fc"), deploymentId, featureId: feature.id, desired, actual: null });
  }
  db.plans.push({
    id: nextId(db, "plan"),
    factoryId,
    productId,
    deploymentId,
    status: "NOT_SUBMITTED",
    providedVersionId: null,
    plannedFeatures: [],
    adHocChanges: [],
    constructionStart: null,
    constructionEnd: null,
    note: "",
    submittedById: null,
    submittedAt: null,
    approvedById: null,
    approvedAt: null,
  });
}

function normalizeAdHoc(db: Database, productId: string, rows: AdHocChange[], mode: ProductMode): AdHocChange[] {
  const features = db.features.filter((feature) => feature.productId === productId);
  const cleaned: AdHocChange[] = [];
  for (const row of rows) {
    if (row.kind === "CUSTOM") {
      const title = row.title.trim();
      if (!title) continue;
      cleaned.push({ id: row.id || nextId(db, "ah"), kind: "CUSTOM", featureId: null, enabled: null, title, description: row.description.trim() });
      continue;
    }
    if (mode === "FEATURE_ONLY") continue;
    if (!row.featureId || !features.some((feature) => feature.id === row.featureId)) throw new ApiError("特殊異動指向不存在的功能", 400);
    cleaned.push({
      id: row.id || nextId(db, "ah"),
      kind: "FEATURE_OVERRIDE",
      featureId: row.featureId,
      enabled: Boolean(row.enabled),
      title: "",
      description: row.description.trim(),
    });
  }
  return cleaned;
}

export interface PersonInput {
  name: string;
  department: string;
  active?: boolean;
}

export function createPerson(db: Database, actorId: string, input: PersonInput) {
  const user = actor(db, actorId);
  const name = input.name.trim();
  const department = input.department.trim();
  if (!name || !department) throw new ApiError("姓名與部門必填", 400);
  const id = nextId(db, "per");
  db.people.push({ id, name, department, active: true, source: "manual", externalId: null });
  log(db, actorId, "PERSON", id, "CREATE", `${user.name}新增人員「${name}」。`);
  persist();
  return { id };
}

export function updatePerson(db: Database, actorId: string, id: string, input: PersonInput) {
  const user = actor(db, actorId);
  const person = must(db.people, id, "找不到這個人");
  if (person.source !== "manual") throw new ApiError("外部人員由目錄同步，不能在這裡修改", 400);
  const name = input.name.trim();
  const department = input.department.trim();
  if (!name || !department) throw new ApiError("姓名與部門必填", 400);
  person.name = name;
  person.department = department;
  if (typeof input.active === "boolean") person.active = input.active;
  log(db, actorId, "PERSON", id, "UPDATE", `${user.name}${person.active ? "更新" : "停用"}人員「${name}」。`);
  persist();
  return { id };
}

function requireCategory(raw: string): string {
  try {
    return normalizeFactoryCategory(raw);
  } catch (caught) {
    throw new ApiError(caught instanceof Error ? caught.message : factoryCategoryInvalid, 400);
  }
}

function requireRegion(raw: string): string {
  try {
    return normalizeFactoryRegion(raw);
  } catch (caught) {
    throw new ApiError(caught instanceof Error ? caught.message : factoryRegionInvalid, 400);
  }
}

function must<T extends { id: string }>(rows: T[], id: string, message: string): T {
  const found = rows.find((row) => row.id === id);
  if (!found) throw new ApiError(message, 404);
  return found;
}
