import type { DeploymentSnapshot, RequirementInput } from "@/domain/handoff-evaluator";
import type { ReadinessFlag } from "@/domain/readiness";
import type {
  Activity,
  ChangeType,
  DeploymentStatus,
  Enumeration,
  FactoryStatus,
  FeatureChange,
  HandoffStatus,
  IssueSeverity,
  IssueStatus,
  PhaseLinkRelation,
  PhaseStatus,
  PlanStatus,
  PmContact,
  TopicStatus,
  RevisionAction,
  User,
} from "@/domain/types";
import type { MachineType } from "@/domain/types";
import type { WindowReason, WindowState } from "@/domain/windows";

export interface MachineLineView {
  machineTypeId: string;
  code: string;
  name: string;
  planned: number;
}

export interface NamedRef {
  id: string;
  name: string;
}

export interface ActivityItem {
  id: string;
  entityType: Activity["entityType"];
  entityId: string;
  action: string;
  summary: string;
  actorName: string;
  createdAt: string;
}

export interface ExceptionItem {
  id: string;
  rank: number;
  tone: "danger" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
  factoryName: string;
}

export interface PhaseBar {
  id: string;
  name: string;
  order: number;
  status: PhaseStatus;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
}

export interface FactoryBoardRow {
  id: string;
  code: string;
  name: string;
  location: string;
  status: FactoryStatus;
  category: string;
  categoryLabel: string;
  region: string;
  regionLabel: string;
  technology: string;
  technologyLabel: string;
  pmName: string;
  pmContact: PmContact;
  openTopics: number;
  currentPhaseName: string;
  currentPhaseOrder: number;
  currentPhaseStatus: PhaseStatus;
  currentOwnerName: string;
  phases: PhaseBar[];
  openHandoffs: number;
  blockers: number;
  missingPlans: number;
  outsideWindows: number;
}

export interface MilestoneRow {
  id: string;
  name: string;
  dueDate: string;
  done: boolean;
  overdue: boolean;
  factoryId: string;
  factoryName: string;
  phaseName: string;
  ownerName: string;
}

export interface HandoffListItem {
  id: string;
  code: string;
  title: string;
  factoryId: string;
  factoryName: string;
  fromPhaseId: string;
  toPhaseId: string;
  fromPhaseName: string;
  toPhaseName: string;
  fromOwnerName: string;
  toOwnerName: string;
  escalationOwnerName: string | null;
  plannedDate: string;
  actualDate: string | null;
  status: HandoffStatus;
  blockers: string;
  requirements: RequirementInput[];
  snapshots: DeploymentSnapshot[];
}

export interface Portfolio {
  asOf: string;
  counts: { total: number; onTrack: number; atRisk: number; delayed: number };
  exceptions: ExceptionItem[];
  factories: FactoryBoardRow[];
  milestones: MilestoneRow[];
  handoffs: HandoffListItem[];
}

export interface BuildCell {
  factoryId: string;
  platformId: string;
  deploymentId: string;
  planId: string;
  deploymentStatus: DeploymentStatus;
  planStatus: PlanStatus;
  providedVersion: string | null;
  actualVersion: string | null;
  versionGap: boolean;
  primaryOwnerName: string;
  secondaryOwnerName: string;
  machines: MachineLineView[];
  plannedTotal: number;
  windowStart: string | null;
  windowEnd: string | null;
  windowState: WindowState;
  windowReasons: WindowReason[];
  ready: boolean;
  flags: ReadinessFlag[];
}

export interface BuildRow {
  factoryId: string;
  factoryName: string;
  factoryCode: string;
  category: string;
  categoryLabel: string;
  region: string;
  regionLabel: string;
  technology: string;
  technologyLabel: string;
  status: FactoryStatus;
  phase2: {
    id: string;
    name: string;
    status: PhaseStatus;
    plannedStart: string;
    plannedEnd: string;
  } | null;
  handoff: {
    id: string;
    code: string;
    status: HandoffStatus;
    met: number;
    total: number;
    allMet: boolean;
  } | null;
  cells: BuildCell[];
  readyCount: number;
}

export interface PlatformBuild {
  asOf: string;
  platforms: Array<{
    id: string;
    code: string;
    name: string;
    primaryOwnerName: string;
  }>;
  rows: BuildRow[];
}

export interface TimelineWindow {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
  state: WindowState;
  reasons: WindowReason[];
}

export interface FactoryDetail {
  asOf: string;
  id: string;
  code: string;
  name: string;
  location: string;
  description: string;
  status: FactoryStatus;
  category: string;
  categoryLabel: string;
  region: string;
  regionLabel: string;
  technology: string;
  technologyLabel: string;
  pmId: string;
  pmName: string;
  pmContact: PmContact;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  phases: Array<{
    id: string;
    name: string;
    order: number;
    status: PhaseStatus;
    ownerId: string;
    ownerName: string;
    plannedStart: string;
    plannedEnd: string;
    actualStart: string | null;
    actualEnd: string | null;
    riskNote: string;
    dependsOn: string[];
    focus: boolean;
    milestones: Array<{
      id: string;
      name: string;
      dueDate: string;
      deliverables: string;
      done: boolean;
      overdue: boolean;
      ownerId: string;
      ownerName: string;
    }>;
  }>;
  windows: TimelineWindow[];
  plans: Array<{
    id: string;
    platformId: string;
    platformName: string;
    status: PlanStatus;
    providedVersion: string | null;
    windowStart: string | null;
    windowEnd: string | null;
    windowState: WindowState;
    windowReasons: WindowReason[];
    revisionCount: number;
  }>;
  deployments: Array<{
    id: string;
    platformId: string;
    platformName: string;
    status: DeploymentStatus;
    plannedVersion: string | null;
    actualVersion: string | null;
    behindPlan: boolean;
    behindLatest: boolean;
    secondaryOwnerName: string;
    machines: MachineLineView[];
    plannedTotal: number;
  }>;
  handoffs: HandoffListItem[];
  issues: IssueListItem[];
  topics: Array<{
    id: string;
    title: string;
    description: string;
    ownerId: string;
    ownerName: string;
    status: TopicStatus;
    raisedOn: string;
  }>;
  activity: ActivityItem[];
  machineRollup: MachineLineView[];
}

export interface IssueListItem {
  id: string;
  code: string;
  title: string;
  description: string;
  factoryId: string;
  factoryName: string;
  phaseId: string | null;
  phaseName: string | null;
  platformId: string | null;
  platformName: string | null;
  handoffId: string | null;
  handoffCode: string | null;
  ownerId: string;
  ownerName: string;
  severity: IssueSeverity;
  priority: "P0" | "P1" | "P2" | "P3";
  status: IssueStatus;
  dueDate: string | null;
  overdue: boolean;
  resolution: string;
  updatedAt: string;
}

export interface IssuePage extends IssueListItem {
  asOf: string;
  activity: ActivityItem[];
}

export interface HandoffPage extends HandoffListItem {
  asOf: string;
  deliverables: string;
  acceptanceCriteria: string;
  rejectionReason: string;
  fromOwnerId: string;
  toOwnerId: string;
  escalationOwnerId: string | null;
  activity: ActivityItem[];
  issues: IssueListItem[];
}

export interface PlatformSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  devDepartment: string;
  projectDepartment: string;
  primaryOwnerId: string;
  primaryOwnerName: string;
  versionCount: number;
  latestVersion: string | null;
  outdatedFactories: number;
}

export interface PlatformDetail extends PlatformSummary {
  asOf: string;
  versions: Array<{
    id: string;
    version: string;
    releasedAt: string | null;
    notes: string;
    features: Array<{ id: string; name: string; supported: boolean }>;
  }>;
  features: Array<{ id: string; code: string; name: string }>;
  deployments: Array<{
    id: string;
    factoryId: string;
    factoryName: string;
    factoryCode: string;
    status: DeploymentStatus;
    plannedVersion: string | null;
    actualVersion: string | null;
    behindPlan: boolean;
    behindLatest: boolean;
    secondaryOwnerName: string;
    machines: MachineLineView[];
    plannedTotal: number;
    planStatus: PlanStatus;
    deployedAt: string | null;
  }>;
}

export interface CapabilityCell {
  featureId: string;
  supported: boolean | null;
  desired: boolean;
  actual: boolean | null;
}

export interface CapabilityRow {
  deploymentId: string;
  factoryId: string;
  factoryName: string;
  phaseIds: string[];
  phaseNames: string[];
  platformId: string;
  platformName: string;
  versionId: string | null;
  versionLabel: string;
  versionSource: "實際" | "計畫" | "無";
  cells: CapabilityCell[];
}

export interface CapabilityMatrix {
  asOf: string;
  features: Array<{ id: string; code: string; name: string; platformId: string; platformName: string }>;
  rows: CapabilityRow[];
  factories: NamedRef[];
  phases: Array<{ id: string; name: string; factoryId: string }>;
  platforms: NamedRef[];
  versions: Array<{ id: string; label: string; platformId: string }>;
}

export interface PlanChangeView {
  featureId: string;
  featureName: string;
  changeType: ChangeType;
  summary: string;
}

export interface PlanPage {
  asOf: string;
  factoryId: string;
  factoryName: string;
  platformId: string;
  platformName: string;
  platformCode: string;
  primaryOwnerName: string;
  devDepartment: string;
  projectDepartment: string;
  phase2: { id: string; name: string; status: PhaseStatus; plannedStart: string; plannedEnd: string } | null;
  deploymentId: string;
  deploymentStatus: DeploymentStatus;
  actualVersion: string | null;
  secondaryOwnerName: string;
  planId: string;
  status: PlanStatus;
  providedVersionId: string | null;
  featureChanges: FeatureChange[];
  constructionStart: string | null;
  constructionEnd: string | null;
  note: string;
  machines: MachineLineView[];
  plannedTotal: number;
  windowState: WindowState;
  windowReasons: WindowReason[];
  versions: Array<{ id: string; version: string; notes: string }>;
  features: Array<{ id: string; code: string; name: string }>;
  revisions: Array<{
    id: string;
    number: number;
    action: RevisionAction;
    version: string | null;
    changes: PlanChangeView[];
    constructionStart: string | null;
    constructionEnd: string | null;
    machines: Array<{ machineTypeId: string; name: string; planned: number }>;
    actorName: string;
    createdAt: string;
    note: string;
  }>;
  canEdit: boolean;
  canApprove: boolean;
  accessNote: string;
}

export interface DeploymentPage {
  asOf: string;
  id: string;
  factoryId: string;
  factoryName: string;
  platformId: string;
  platformName: string;
  status: DeploymentStatus;
  plannedVersionId: string | null;
  actualVersionId: string | null;
  secondaryOwnerId: string;
  machines: MachineLineView[];
  plannedTotal: number;
  plannedDate: string | null;
  deployedAt: string | null;
  notes: string;
  versions: Array<{ id: string; version: string }>;
  users: User[];
  phases: Array<{ id: string; name: string }>;
  links: Array<{ phaseId: string; relation: PhaseLinkRelation }>;
  features: Array<{ id: string; name: string; desired: boolean; actual: boolean | null; supportedByActual: boolean | null }>;
}

export interface Bootstrap {
  asOf: string;
  currentUser: User;
  users: User[];
  enumerations: Enumeration[];
  machineTypes: MachineType[];
  phaseTemplates: Array<{ id: string; name: string; order: number; defaultDurationDays: number }>;
}

export interface FactoryFormOptions {
  users: User[];
  enumerations: Enumeration[];
  templates: Bootstrap["phaseTemplates"];
}
