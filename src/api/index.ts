import type {
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
  RequirementKind,
} from "@/domain/types";
import { apiRequest } from "./client";
import { invalidate } from "./live";
import { setActorId, setFault, type FaultMode } from "./session";
import type {
  ActivityItem,
  Bootstrap,
  CapabilityMatrix,
  DeploymentPage,
  FactoryBoardRow,
  FactoryDetail,
  HandoffListItem,
  HandoffPage,
  IssueListItem,
  IssuePage,
  PlanPage,
  PlatformBuild,
  PlatformDetail,
  PlatformSummary,
  Portfolio,
} from "./types";

export const api = {
  bootstrap: () => apiRequest<Bootstrap>("/api/v1/bootstrap"),
  portfolio: () => apiRequest<Portfolio>("/api/v1/portfolio"),
  platformBuild: () => apiRequest<PlatformBuild>("/api/v1/platform-build"),
  factories: () =>
    apiRequest<{ asOf: string; items: FactoryBoardRow[]; users: Bootstrap["users"]; enumerations: Bootstrap["enumerations"] }>("/api/v1/factories"),
  factory: (id: string) => apiRequest<FactoryDetail>(`/api/v1/factories/${id}`),
  createFactory: (body: {
    code: string;
    name: string;
    location: string;
    description: string;
    category: string;
    region: string;
    technology: string;
    pmId: string;
    plannedStart: string;
    status: FactoryStatus;
  }) => apiRequest<{ id: string }>("/api/v1/factories", { method: "POST", body }),
  updateFactory: (id: string, body: {
    code: string;
    name: string;
    location: string;
    description: string;
    category: string;
    region: string;
    technology: string;
    pmId: string;
    plannedStart: string;
    plannedEnd: string;
    status: FactoryStatus;
  }) => apiRequest<{ id: string }>(`/api/v1/factories/${id}`, { method: "PATCH", body }),
  createPhase: (factoryId: string, body: PhaseBody) =>
    apiRequest<{ id: string }>(`/api/v1/factories/${factoryId}/phases`, { method: "POST", body }),
  updatePhase: (id: string, body: PhaseBody) => apiRequest<{ id: string }>(`/api/v1/phases/${id}`, { method: "PATCH", body }),
  createMilestone: (phaseId: string, body: MilestoneBody) =>
    apiRequest<{ id: string; factoryId: string }>(`/api/v1/phases/${phaseId}/milestones`, { method: "POST", body }),
  updateMilestone: (id: string, body: MilestoneBody) =>
    apiRequest<{ factoryId: string }>(`/api/v1/milestones/${id}`, { method: "PATCH", body }),
  handoffs: () => apiRequest<{ asOf: string; items: HandoffListItem[] }>("/api/v1/handoffs"),
  handoff: (id: string) => apiRequest<HandoffPage>(`/api/v1/handoffs/${id}`),
  createHandoff: (body: HandoffBody) => apiRequest<{ id: string }>("/api/v1/handoffs", { method: "POST", body }),
  updateHandoff: (id: string, body: Omit<HandoffBody, "factoryId" | "status">) =>
    apiRequest<{ id: string }>(`/api/v1/handoffs/${id}`, { method: "PATCH", body }),
  transitionHandoff: (id: string, body: { status: HandoffStatus; rejectionReason?: string; blockers?: string; acknowledgeGaps?: boolean; unmet?: number }) =>
    apiRequest<{ id: string }>(`/api/v1/handoffs/${id}/transitions`, { method: "POST", body }),
  addRequirement: (id: string, body: { kind: RequirementKind; platformId: string; minVersion: string | null; featureId: string | null; description: string }) =>
    apiRequest<{ id: string }>(`/api/v1/handoffs/${id}/requirements`, { method: "POST", body }),
  issues: () => apiRequest<{ asOf: string; items: IssueListItem[] }>("/api/v1/issues"),
  issue: (id: string) => apiRequest<IssuePage>(`/api/v1/issues/${id}`),
  createIssue: (body: IssueBody) => apiRequest<{ id: string }>("/api/v1/issues", { method: "POST", body }),
  updateIssue: (id: string, body: IssueBody) => apiRequest<{ id: string }>(`/api/v1/issues/${id}`, { method: "PATCH", body }),
  platforms: () => apiRequest<{ asOf: string; items: PlatformSummary[] }>("/api/v1/platforms"),
  platform: (id: string) => apiRequest<PlatformDetail>(`/api/v1/platforms/${id}`),
  createPlatform: (body: PlatformBody) => apiRequest<{ id: string }>("/api/v1/platforms", { method: "POST", body }),
  updatePlatform: (id: string, body: PlatformBody) => apiRequest<{ id: string }>(`/api/v1/platforms/${id}`, { method: "PATCH", body }),
  capabilities: () => apiRequest<CapabilityMatrix>("/api/v1/capabilities"),
  deployment: (id: string) => apiRequest<DeploymentPage>(`/api/v1/deployments/${id}`),
  updateDeployment: (id: string, body: DeploymentBody) => apiRequest<{ id: string }>(`/api/v1/deployments/${id}`, { method: "PATCH", body }),
  plan: (factoryId: string, platformId: string) => apiRequest<PlanPage>(`/api/v1/factories/${factoryId}/platforms/${platformId}/plan`),
  savePlan: (factoryId: string, platformId: string, body: PlanBody) =>
    apiRequest<{ id: string }>(`/api/v1/factories/${factoryId}/platforms/${platformId}/plan`, { method: "PUT", body }),
  approvePlan: (factoryId: string, platformId: string) =>
    apiRequest<{ id: string }>(`/api/v1/factories/${factoryId}/platforms/${platformId}/plan/approve`, { method: "POST" }),
  featureDiff: (from: string | null, to: string) =>
    apiRequest<{ changes: FeatureChange[] }>(`/api/v1/feature-diff?from=${encodeURIComponent(from ?? "")}&to=${encodeURIComponent(to)}`),
  activity: () => apiRequest<{ asOf: string; items: ActivityItem[] }>("/api/v1/activity"),
  createEnumeration: (body: { set: Enumeration["set"]; code: string; label: string; description: string }) =>
    apiRequest<{ id: string }>("/api/v1/enumerations", { method: "POST", body }),
  updateEnumeration: (id: string, body: { label: string; description: string; active: boolean }) =>
    apiRequest<{ id: string }>(`/api/v1/enumerations/${id}`, { method: "PATCH", body }),
  createMachineType: (body: { code: string; name: string }) =>
    apiRequest<{ id: string }>("/api/v1/machine-types", { method: "POST", body }),
  updateMachineType: (id: string, body: { name: string; active: boolean }) =>
    apiRequest<{ id: string }>(`/api/v1/machine-types/${id}`, { method: "PATCH", body }),
  async switchUser(userId: string) {
    setActorId();
    await apiRequest("/api/v1/session", { method: "POST", body: { userId } });
  },
  setFault(mode: FaultMode) {
    setFault(mode);
    invalidate();
  },
  async resetDemo() {
    await apiRequest("/api/v1/session/reset", { method: "POST", body: {} });
  },
};

interface PhaseBody {
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

interface MilestoneBody {
  name: string;
  dueDate: string;
  deliverables: string;
  ownerId: string;
  done: boolean;
}

interface HandoffBody {
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

interface IssueBody {
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

interface PlatformBody {
  code: string;
  name: string;
  description: string;
  devDepartment: string;
  projectDepartment: string;
  primaryOwnerId: string;
}

interface DeploymentBody {
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

interface PlanBody {
  providedVersionId: string | null;
  featureChanges: Array<{ featureId: string; changeType: ChangeType; summary: string }>;
  constructionStart: string | null;
  constructionEnd: string | null;
  machines: Array<{ machineTypeId: string; planned: number }>;
  note: string;
  intent: "draft" | "submit";
}
