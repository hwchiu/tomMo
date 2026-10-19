import type { ReadinessFlag } from "@/domain/readiness";
import type {
  Activity,
  DeploymentStatus,
  FactoryStatus,
  IssueSeverity,
  IssueStatus,
  PhaseLinkRelation,
  PhaseStatus,
  PlanStatus,
  AdHocChange,
  Person,
  PlannedFeature,
  ProductMode,
  TopicStatus,
  RevisionAction,
} from "@/domain/types";
import type { MachineType } from "@/domain/types";
import type { WindowReason, WindowState } from "@/domain/windows";

export interface MachineLineView {
  machineTypeId: string;
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
  pmId: string;
  pmName: string;
  pmDepartment: string;
  machineTotal: number;
  machineRollup: MachineLineView[];
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
  productId: string;
  productName: string;
  status: PlanStatus;
  mode: ProductMode;
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
  productId: string;
  deploymentId: string;
  planId: string;
  deploymentStatus: DeploymentStatus;
  planStatus: PlanStatus;
  mode: ProductMode;
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
  machineTotal: number;
  machineRollup: MachineLineView[];
}

export interface ProductBuild {
  asOf: string;
  products: Array<{
    id: string;
    name: string;
    primaryOwnerName: string;
    mode: ProductMode;
    audience: "EXTERNAL" | "INTERNAL";
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
  pmId: string;
  pmName: string;
  pmDepartment: string;
  machineTotal: number;
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
    productId: string;
    productName: string;
    mode: ProductMode;
    status: PlanStatus;
    providedVersion: string | null;
    changeCount: number;
    adHocChanges: AdHocView[];
    windowStart: string | null;
    windowEnd: string | null;
    windowState: WindowState;
    windowReasons: WindowReason[];
    revisionCount: number;
  }>;
  deployments: Array<{
    id: string;
    productId: string;
    productName: string;
    mode: ProductMode;
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
  productId: string | null;
  productName: string | null;
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

export interface ProductSummary {
  id: string;
  name: string;
  description: string;
  devDepartment: string;
  projectDepartment: string;
  primaryOwnerId: string;
  primaryOwnerName: string;
  mode: ProductMode;
  audience: "EXTERNAL" | "INTERNAL";
  versionCount: number;
  latestVersion: string | null;
  outdatedFactories: number;
}

export interface ProductDetail extends ProductSummary {
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

export type CapabilityTone = "UNPLANNED" | "UNCHANGED_ON" | "UNCHANGED_OFF" | "ADDED" | "REMOVED";

export interface CapabilityCell {
  featureId: string;
  tone: CapabilityTone;
  planned: boolean | null;
  baseline: boolean | null;
  adhoc: boolean;
  note: string;
}

export interface AdHocView {
  id: string;
  kind: AdHocChange["kind"];
  featureId: string | null;
  featureName: string | null;
  enabled: boolean | null;
  title: string;
  description: string;
}

export interface CapabilityRow {
  deploymentId: string;
  factoryId: string;
  factoryName: string;
  productId: string;
  productName: string;
  mode: ProductMode;
  versionLabel: string | null;
  cells: CapabilityCell[];
  adHocChanges: AdHocView[];
}

export interface CapabilityMatrix {
  asOf: string;
  features: Array<{ id: string; code: string; name: string; productId: string; productName: string }>;
  rows: CapabilityRow[];
  factories: NamedRef[];
  products: Array<NamedRef & { mode: ProductMode }>;
}

export interface PlanPage {
  asOf: string;
  factoryId: string;
  factoryName: string;
  productId: string;
  productName: string;
  mode: ProductMode;
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
  adHocChanges: AdHocView[];
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
    adHocChanges: AdHocView[];
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
  productId: string;
  productName: string;
  mode: ProductMode;
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
  people: Person[];
  phases: Array<{ id: string; name: string }>;
  links: Array<{ phaseId: string; relation: PhaseLinkRelation }>;
  features: Array<{ id: string; name: string; defaultEnabled: boolean; desired: boolean; actual: boolean | null; supportedByActual: boolean | null }>;
}

export interface Bootstrap {
  asOf: string;
  role: "editor" | "viewer";
  username: string;
  actor: Person;
  people: Person[];
  machineTypes: MachineType[];
  phaseTemplates: Array<{ id: string; name: string; order: number; defaultDurationDays: number }>;
}

export interface FactoryFormOptions {
  people: Person[];
  templates: Bootstrap["phaseTemplates"];
}
