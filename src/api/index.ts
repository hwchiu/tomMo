import type {
  DeploymentStatus,
  Enumeration,
  FactoryStatus,
  FeatureChange,
  IssueSeverity,
  IssueStatus,
  PhaseLinkRelation,
  TopicStatus,
  PhaseStatus,
  PlannedFeature,
  ProductMode,
} from "@/domain/types";
import { apiRequest, useMock } from "./client";

export { useMock };
import { invalidate } from "./live";
import { setActorId, setFault, type FaultMode } from "./session";
import type {
  Bootstrap,
  DeploymentPage,
  FactoryBoardRow,
  FactoryDetail,
  IssueListItem,
  IssuePage,
  PlanPage,
  ProductBuild,
  ProductDetail,
  ProductSummary,
  Portfolio,
} from "./types";

export const api = {
  bootstrap: () => apiRequest<Bootstrap>("/api/v1/bootstrap"),
  portfolio: () => apiRequest<Portfolio>("/api/v1/portfolio"),
  productBuild: () => apiRequest<ProductBuild>("/api/v1/product-build"),
  factories: () =>
    apiRequest<{ asOf: string; items: FactoryBoardRow[]; people: Bootstrap["people"]; enumerations: Bootstrap["enumerations"] }>("/api/v1/factories"),
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
  createTopic: (factoryId: string, body: TopicBody) =>
    apiRequest<{ id: string; factoryId: string }>(`/api/v1/factories/${factoryId}/topics`, { method: "POST", body }),
  updateTopic: (id: string, body: TopicBody) =>
    apiRequest<{ id: string; factoryId: string }>(`/api/v1/topics/${id}`, { method: "PATCH", body }),
  createPhase: (factoryId: string, body: PhaseBody) =>
    apiRequest<{ id: string }>(`/api/v1/factories/${factoryId}/phases`, { method: "POST", body }),
  updatePhase: (id: string, body: PhaseBody) => apiRequest<{ id: string }>(`/api/v1/phases/${id}`, { method: "PATCH", body }),
  createMilestone: (phaseId: string, body: MilestoneBody) =>
    apiRequest<{ id: string; factoryId: string }>(`/api/v1/phases/${phaseId}/milestones`, { method: "POST", body }),
  updateMilestone: (id: string, body: MilestoneBody) =>
    apiRequest<{ factoryId: string }>(`/api/v1/milestones/${id}`, { method: "PATCH", body }),
  issues: () => apiRequest<{ asOf: string; items: IssueListItem[] }>("/api/v1/issues"),
  issue: (id: string) => apiRequest<IssuePage>(`/api/v1/issues/${id}`),
  createIssue: (body: IssueBody) => apiRequest<{ id: string }>("/api/v1/issues", { method: "POST", body }),
  updateIssue: (id: string, body: IssueBody) => apiRequest<{ id: string }>(`/api/v1/issues/${id}`, { method: "PATCH", body }),
  products: () => apiRequest<{ asOf: string; items: ProductSummary[] }>("/api/v1/products"),
  product: (id: string) => apiRequest<ProductDetail>(`/api/v1/products/${id}`),
  createProduct: (body: ProductBody) => apiRequest<{ id: string }>("/api/v1/products", { method: "POST", body }),
  updateProduct: (id: string, body: ProductBody) => apiRequest<{ id: string }>(`/api/v1/products/${id}`, { method: "PATCH", body }),
  people: () => apiRequest<{ items: Bootstrap["people"] }>("/api/v1/people"),
  createPerson: (body: { name: string; department: string }) => apiRequest<{ id: string }>("/api/v1/people", { method: "POST", body }),
  updatePerson: (id: string, body: { name: string; department: string; active?: boolean }) =>
    apiRequest<{ id: string }>(`/api/v1/people/${id}`, { method: "PATCH", body }),
  login: (body: { username: string; password: string }) => apiRequest<{ ok: boolean }>("/api/v1/login", { method: "POST", body }),
  loginConfig: () => apiRequest<{ showDemoHint: boolean }>("/api/v1/login-config"),
  logout: () => apiRequest<{ ok: boolean }>("/api/v1/logout", { method: "POST", body: {} }),
  deployment: (id: string) => apiRequest<DeploymentPage>(`/api/v1/deployments/${id}`),
  updateDeployment: (id: string, body: DeploymentBody) => apiRequest<{ id: string }>(`/api/v1/deployments/${id}`, { method: "PATCH", body }),
  plan: (factoryId: string, productId: string) => apiRequest<PlanPage>(`/api/v1/factories/${factoryId}/products/${productId}/plan`),
  savePlan: (factoryId: string, productId: string, body: PlanBody) =>
    apiRequest<{ id: string }>(`/api/v1/factories/${factoryId}/products/${productId}/plan`, { method: "PUT", body }),
  approvePlan: (factoryId: string, productId: string) =>
    apiRequest<{ id: string }>(`/api/v1/factories/${factoryId}/products/${productId}/plan/approve`, { method: "POST" }),
  featureDiff: (from: string | null, to: string) =>
    apiRequest<{ changes: FeatureChange[] }>(`/api/v1/feature-diff?from=${encodeURIComponent(from ?? "")}&to=${encodeURIComponent(to)}`),
  createEnumeration: (body: { set: Enumeration["set"]; code: string; label: string; description: string }) =>
    apiRequest<{ id: string }>("/api/v1/enumerations", { method: "POST", body }),
  updateEnumeration: (id: string, body: { label: string; description: string; active: boolean }) =>
    apiRequest<{ id: string }>(`/api/v1/enumerations/${id}`, { method: "PATCH", body }),
  createMachineType: (body: { name: string }) =>
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

interface TopicBody {
  title: string;
  description: string;
  ownerId: string;
  status: TopicStatus;
  raisedOn: string;
}

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

interface IssueBody {
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

interface ProductBody {
  name: string;
  description: string;
  devDepartment: string;
  projectDepartment: string;
  primaryOwnerId: string;
  mode: ProductMode;
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
  plannedFeatures: PlannedFeature[];
  reasons?: Record<string, string>;
  adHocChanges: Array<{ id: string; kind: "FEATURE_OVERRIDE" | "CUSTOM"; featureId: string | null; enabled: boolean | null; title: string; description: string }>;
  constructionStart: string | null;
  constructionEnd: string | null;
  machines: Array<{ machineTypeId: string; planned: number }>;
  note: string;
  intent: "draft" | "submit";
}
