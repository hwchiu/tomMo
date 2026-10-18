import type { ReadinessFlag } from "@/domain/readiness";
import type {
  Activity,
  ChangeType,
  DeploymentStatus,
  Enumeration,
  FactoryStatus,
  FeatureChange,
  IssueSeverity,
  IssueStatus,
  PhaseLinkRelation,
  PhaseStatus,
  PlanStatus,
  PlannedFeature,
  PlatformMode,
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
  notReady: number;
  currentPhaseName: string;
  currentPhaseOrder: number;
  currentPhaseStatus: PhaseStatus;
  currentOwnerName: string;
  phases: PhaseBar[];
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

export interface PendingPlan {
  id: string;
  factoryId: string;
  factoryName: string;
  platformId: string;
  platformName: string;
  status: PlanStatus;
  mode: PlatformMode;
}

export interface Portfolio {
  asOf: string;
  counts: { total: number; onTrack: number; atRisk: number; delayed: number };
  exceptions: ExceptionItem[];
  factories: FactoryBoardRow[];
  milestones: MilestoneRow[];
  pendingPlans: PendingPlan[];
}

export interface BuildCell {
  factoryId: string;
  platformId: string;
  deploymentId: string;
  planId: string;
  deploymentStatus: DeploymentStatus;
  planStatus: PlanStatus;
  mode: PlatformMode;
  providedVersion: string | null;
  actualVersion: string | null;
  changeCount: number;
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
    mode: PlatformMode;
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
    mode: PlatformMode;
    status: PlanStatus;
    providedVersion: string | null;
    changeCount: number;
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
    mode: PlatformMode;
    status: DeploymentStatus;
    plannedVersion: string | null;
    actualVersion: string | null;
    behindPlan: boolean;
    behindLatest: boolean;
    secondaryOwnerName: string;
    machines: MachineLineView[];
    plannedTotal: number;
  }>;
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

export interface PlatformSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  devDepartment: string;
  projectDepartment: string;
  primaryOwnerId: string;
  primaryOwnerName: string;
  mode: PlatformMode;
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
  features: Array<{ id: string; code: string; name: string; defaultEnabled: boolean }>;
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
  /** Null when this factory has not planned the feature yet. */
  planned: boolean | null;
}

export interface CapabilityRow {
  deploymentId: string;
  factoryId: string;
  factoryName: string;
  platformId: string;
  platformName: string;
  mode: PlatformMode;
  versionLabel: string | null;
  cells: CapabilityCell[];
}

export interface CapabilityMatrix {
  asOf: string;
  features: Array<{ id: string; code: string; name: string; platformId: string; platformName: string }>;
  rows: CapabilityRow[];
  factories: NamedRef[];
  platforms: Array<NamedRef & { mode: PlatformMode }>;
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
  mode: PlatformMode;
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
  plannedFeatures: PlannedFeature[];
  featureChanges: FeatureChange[];
  constructionStart: string | null;
  constructionEnd: string | null;
  note: string;
  machines: MachineLineView[];
  plannedTotal: number;
  windowState: WindowState;
  windowReasons: WindowReason[];
  versions: Array<{ id: string; version: string; notes: string }>;
  features: Array<{ id: string; code: string; name: string; defaultEnabled: boolean }>;
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
  mode: PlatformMode;
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
  features: Array<{ id: string; name: string; defaultEnabled: boolean; desired: boolean; actual: boolean | null; supportedByActual: boolean | null }>;
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
