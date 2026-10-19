/** JSON-friendly domain model. Dates are YYYY-MM-DD; timestamps are ISO-8601. */

export const FACTORY_STATUSES = ["ON_TRACK", "AT_RISK", "DELAYED", "COMPLETED"] as const;
export type FactoryStatus = (typeof FACTORY_STATUSES)[number];

export const PHASE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "AT_RISK", "DELAYED", "COMPLETED"] as const;
export type PhaseStatus = (typeof PHASE_STATUSES)[number];

export const DEPLOYMENT_STATUSES = ["PLANNED", "IN_PROGRESS", "DEPLOYED", "ACCEPTED"] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export const ISSUE_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export const ISSUE_PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const ISSUE_STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED", "RESOLVED", "CLOSED"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const PLAN_STATUSES = ["NOT_SUBMITTED", "SUBMITTED", "APPROVED"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const CHANGE_TYPES = ["ADDED", "REMOVED", "CHANGED"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export const PHASE_LINK_RELATIONS = ["INTRODUCED", "UPGRADED", "ACCEPTED"] as const;
export type PhaseLinkRelation = (typeof PHASE_LINK_RELATIONS)[number];

export const ENUM_SETS = ["factoryCategory", "factoryRegion", "technologyNode"] as const;
export type EnumSet = (typeof ENUM_SETS)[number];

export const ACCOUNT_ROLES = ["editor", "viewer"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const PERSON_SOURCES = ["manual", "external"] as const;
export type PersonSource = (typeof PERSON_SOURCES)[number];

export const REVISION_ACTIONS = ["DRAFT", "SUBMIT", "APPROVE"] as const;
export type RevisionAction = (typeof REVISION_ACTIONS)[number];

export interface Enumeration {
  id: string;
  set: EnumSet;
  code: string;
  label: string;
  description: string;
  order: number;
  active: boolean;
}

/** Directory record. Login accounts are separate and point at a person. */
export interface Person {
  id: string;
  name: string;
  department: string;
  active: boolean;
  source: PersonSource;
  externalId: string | null;
}

export interface PhaseTemplate {
  id: string;
  code: string;
  name: string;
  description: string;
  order: number;
  defaultDurationDays: number;
}

export const TOPIC_STATUSES = ["OPEN", "IN_DISCUSSION", "RESOLVED", "CLOSED"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export interface Factory {
  id: string;
  code: string;
  name: string;
  location: string;
  description: string;
  category: string;
  region: string;
  technology: string;
  /** Factory PM, a person id from the directory. */
  pmId: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  status: FactoryStatus;
}

export interface DiscussionTopic {
  id: string;
  factoryId: string;
  title: string;
  description: string;
  ownerId: string;
  status: TopicStatus;
  raisedOn: string;
}

export interface Phase {
  id: string;
  factoryId: string;
  templateId: string | null;
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

export interface Milestone {
  id: string;
  phaseId: string;
  name: string;
  dueDate: string;
  deliverables: string;
  done: boolean;
  completedAt: string | null;
  ownerId: string;
}

export const PRODUCT_MODES = ["VERSIONED", "FEATURE_ONLY"] as const;
export type ProductMode = (typeof PRODUCT_MODES)[number];

/** A product is the product entity: globally defined, deployed per factory. */
export interface Product {
  id: string;
  name: string;
  description: string;
  devDepartment: string;
  projectDepartment: string;
  primaryOwnerId: string;
  /** VERSIONED plans pick a release. FEATURE_ONLY plans set each feature on or off. */
  mode: ProductMode;
}

export interface ProductVersion {
  id: string;
  productId: string;
  version: string;
  releasedAt: string | null;
  notes: string;
}

export interface FeatureDefinition {
  id: string;
  productId: string;
  code: string;
  name: string;
  description: string;
  /** Baseline for feature-flag products. 異動功能 is anything that differs from this. */
  defaultEnabled: boolean;
}

export interface VersionFeature {
  versionId: string;
  featureId: string;
  supported: boolean;
}

export interface ProductDeployment {
  id: string;
  factoryId: string;
  productId: string;
  plannedVersionId: string | null;
  actualVersionId: string | null;
  status: DeploymentStatus;
  secondaryOwnerId: string;
  plannedDate: string | null;
  deployedAt: string | null;
  notes: string;
}

export interface DeploymentPhaseLink {
  id: string;
  deploymentId: string;
  phaseId: string;
  relation: PhaseLinkRelation;
}

export interface FeatureConfiguration {
  id: string;
  deploymentId: string;
  featureId: string;
  desired: boolean;
  /** Null means the engineer has not reported actual state. */
  actual: boolean | null;
}

export interface FeatureChange {
  featureId: string;
  changeType: ChangeType;
  summary: string;
}

export const ADHOC_KINDS = ["FEATURE_OVERRIDE", "CUSTOM"] as const;
export type AdHocKind = (typeof ADHOC_KINDS)[number];

/** Factory-specific change on top of a version, or on top of a feature-flag default. */
export interface AdHocChange {
  id: string;
  kind: AdHocKind;
  featureId: string | null;
  enabled: boolean | null;
  title: string;
  description: string;
}

/** Planned on/off for one feature on a feature-flag product. */
export interface PlannedFeature {
  featureId: string;
  enabled: boolean;
}

/**
 * Per-factory plan submitted by the product team.
 * Current fields mirror the latest revision; history lives in PlanRevision.
 */
export interface ProductFactoryPlan {
  id: string;
  factoryId: string;
  productId: string;
  deploymentId: string;
  status: PlanStatus;
  /** Set only when the product mode is VERSIONED. */
  providedVersionId: string | null;
  /** Full feature set for FEATURE_ONLY. Empty until filled in, and empty on versioned plans. */
  plannedFeatures: PlannedFeature[];
  /** Feature overrides and free-text custom changes. */
  adHocChanges: AdHocChange[];
  constructionStart: string | null;
  constructionEnd: string | null;
  note: string;
  submittedById: string | null;
  submittedAt: string | null;
  approvedById: string | null;
  approvedAt: string | null;
}

/** Admin-managed machine type. Quantities are planned only. */
export interface MachineType {
  id: string;
  name: string;
  order: number;
  active: boolean;
}

/** Planned quantity of one machine type on one factory × product deployment. */
export interface MachineQuantity {
  id: string;
  deploymentId: string;
  machineTypeId: string;
  planned: number;
}

export interface PlannedMachine {
  machineTypeId: string;
  planned: number;
}

export interface PlanRevision {
  id: string;
  planId: string;
  number: number;
  action: RevisionAction;
  providedVersionId: string | null;
  plannedFeatures: PlannedFeature[];
  adHocChanges: AdHocChange[];
  constructionStart: string | null;
  constructionEnd: string | null;
  machines: PlannedMachine[];
  actorId: string;
  createdAt: string;
  note: string;
}

export interface Issue {
  id: string;
  code: string;
  title: string;
  description: string;
  factoryId: string;
  phaseId: string | null;
  milestoneId: string | null;
  productId: string | null;
  ownerId: string;
  severity: IssueSeverity;
  priority: IssuePriority;
  status: IssueStatus;
  dueDate: string | null;
  resolution: string;
  updatedAt: string;
}

export type ActivityEntity =
  | "FACTORY"
  | "PHASE"
  | "MILESTONE"
  | "ISSUE"
  | "TOPIC"
  | "DEPLOYMENT"
  | "FEATURE"
  | "PLAN"
  | "PRODUCT"
  | "ENUM"
  | "MACHINE"
  | "PERSON";

export interface Activity {
  id: string;
  entityType: ActivityEntity;
  entityId: string;
  action: string;
  summary: string;
  actorId: string;
  createdAt: string;
}

export interface Database {
  seq: number;
  asOf: string;
  enumerations: Enumeration[];
  machineTypes: MachineType[];
  people: Person[];
  phaseTemplates: PhaseTemplate[];
  factories: Factory[];
  phases: Phase[];
  milestones: Milestone[];
  products: Product[];
  versions: ProductVersion[];
  features: FeatureDefinition[];
  versionFeatures: VersionFeature[];
  deployments: ProductDeployment[];
  machineQuantities: MachineQuantity[];
  phaseLinks: DeploymentPhaseLink[];
  featureConfigs: FeatureConfiguration[];
  plans: ProductFactoryPlan[];
  revisions: PlanRevision[];
  issues: Issue[];
  topics: DiscussionTopic[];
  activity: Activity[];
}
