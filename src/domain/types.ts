/** JSON-friendly domain model. Dates are YYYY-MM-DD; timestamps are ISO-8601. */

export const FACTORY_STATUSES = ["ON_TRACK", "AT_RISK", "DELAYED", "COMPLETED"] as const;
export type FactoryStatus = (typeof FACTORY_STATUSES)[number];

export const PHASE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "AT_RISK", "DELAYED", "COMPLETED"] as const;
export type PhaseStatus = (typeof PHASE_STATUSES)[number];

export const HANDOFF_STATUSES = [
  "WORK_DONE",
  "PROPOSED",
  "PENDING_ACCEPTANCE",
  "ACCEPTED",
  "REJECTED",
  "BLOCKED",
] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

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

export const REQUIREMENT_KINDS = ["MIN_VERSION", "FEATURE_ENABLED", "DEPLOYMENT_COMPLETE"] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export const ENUM_SETS = ["factoryCategory", "factoryRegion", "technologyNode"] as const;
export type EnumSet = (typeof ENUM_SETS)[number];

export const USER_ROLES = ["PM", "ENGINEER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

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

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
}

export interface PhaseTemplate {
  id: string;
  code: string;
  name: string;
  description: string;
  order: number;
  defaultDurationDays: number;
}

export interface PmContact {
  name: string;
  email: string;
  phone: string;
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
  pmId: string;
  pmContact: PmContact;
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

/** A platform is the product entity: globally defined, deployed per factory. */
export interface Platform {
  id: string;
  code: string;
  name: string;
  description: string;
  devDepartment: string;
  projectDepartment: string;
  primaryOwnerId: string;
}

export interface PlatformVersion {
  id: string;
  platformId: string;
  version: string;
  releasedAt: string | null;
  notes: string;
}

export interface FeatureDefinition {
  id: string;
  platformId: string;
  code: string;
  name: string;
  description: string;
}

export interface VersionFeature {
  versionId: string;
  featureId: string;
  supported: boolean;
}

export interface PlatformDeployment {
  id: string;
  factoryId: string;
  platformId: string;
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

/**
 * Per-factory plan submitted by the platform team.
 * Current fields mirror the latest revision; history lives in PlanRevision.
 */
export interface PlatformFactoryPlan {
  id: string;
  factoryId: string;
  platformId: string;
  deploymentId: string;
  status: PlanStatus;
  providedVersionId: string | null;
  featureChanges: FeatureChange[];
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
  code: string;
  name: string;
  order: number;
  active: boolean;
}

/** Planned quantity of one machine type on one factory × platform deployment. */
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
  featureChanges: FeatureChange[];
  constructionStart: string | null;
  constructionEnd: string | null;
  machines: PlannedMachine[];
  actorId: string;
  createdAt: string;
  note: string;
}

export interface Handoff {
  id: string;
  code: string;
  title: string;
  factoryId: string;
  fromPhaseId: string;
  toPhaseId: string;
  fromOwnerId: string;
  toOwnerId: string;
  escalationOwnerId: string | null;
  plannedDate: string;
  actualDate: string | null;
  deliverables: string;
  acceptanceCriteria: string;
  blockers: string;
  status: HandoffStatus;
  rejectionReason: string;
}

export interface HandoffRequirement {
  id: string;
  handoffId: string;
  kind: RequirementKind;
  platformId: string;
  minVersion: string | null;
  featureId: string | null;
  description: string;
}

export interface Issue {
  id: string;
  code: string;
  title: string;
  description: string;
  factoryId: string;
  phaseId: string | null;
  milestoneId: string | null;
  platformId: string | null;
  handoffId: string | null;
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
  | "HANDOFF"
  | "ISSUE"
  | "TOPIC"
  | "DEPLOYMENT"
  | "FEATURE"
  | "PLAN"
  | "PLATFORM"
  | "ENUM"
  | "MACHINE";

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
  users: User[];
  phaseTemplates: PhaseTemplate[];
  factories: Factory[];
  phases: Phase[];
  milestones: Milestone[];
  platforms: Platform[];
  versions: PlatformVersion[];
  features: FeatureDefinition[];
  versionFeatures: VersionFeature[];
  deployments: PlatformDeployment[];
  machineQuantities: MachineQuantity[];
  phaseLinks: DeploymentPhaseLink[];
  featureConfigs: FeatureConfiguration[];
  plans: PlatformFactoryPlan[];
  revisions: PlanRevision[];
  handoffs: Handoff[];
  requirements: HandoffRequirement[];
  issues: Issue[];
  topics: DiscussionTopic[];
  activity: Activity[];
}
