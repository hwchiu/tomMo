import { ApiError } from "./errors";
import { getAuth } from "./session";
import {
  approvePlan,
  createFactory,
  createTopic,
  createMachineType,
  createIssue,
  createMilestone,
  createPhase,
  createPerson,
  createProduct,
  diffVersionFeatures,
  getDb,
  resetDb,
  savePlan,
  updateDeployment,
  updateFactory,
  updateTopic,
  updateMachineType,
  updateIssue,
  updateMilestone,
  updatePhase,
  updatePerson,
  updateProduct,
} from "./store";
import {
  buildActivity,
  buildBootstrap,
  buildCapabilities,
  buildDeployment,
  buildFactories,
  buildFactory,
  buildIssue,
  buildIssues,
  buildPlan,
  buildProduct,
  buildProductBuild,
  buildProducts,
  buildPortfolio,
} from "./views";

interface Call {
  method: string;
  path: string;
  body: unknown;
}

export function mockRoute<T>({ method, path, body }: Call): T {
  const url = new URL(path, "http://mock.local");
  const pathname = url.pathname.replace(/\/$/, "") || "/";
  const session = getAuth();
  const db = getDb();
  const parts = pathname.split("/").filter(Boolean);
  const publicCall = pathname === "/api/v1/login" || pathname === "/api/v1/logout" || pathname === "/api/v1/login-config";
  if (!publicCall && !session) throw new ApiError("請先登入", 401);
  if (session && method !== "GET" && session.role !== "editor" && pathname !== "/api/v1/logout") {
    throw new ApiError("使用者只能閱讀", 403);
  }
  const actorId = session?.personId ?? "";

  if (method === "GET" && pathname === "/api/v1/login-config") {
    return { showDemoHint: true } as T;
  }
  if (method === "POST" && pathname === "/api/v1/login") {
    return { ok: true } as T;
  }
  if (method === "POST" && pathname === "/api/v1/logout") {
    return { ok: true } as T;
  }
  if (method === "POST" && pathname === "/api/v1/session/reset") {
    resetDb();
    return { ok: true } as T;
  }
  if (method === "GET" && pathname === "/api/v1/bootstrap") {
    return buildBootstrap(db, actorId, { role: session?.role ?? "viewer", username: session?.username ?? "" }) as T;
  }
  if (method === "GET" && pathname === "/api/v1/people") {
    const active = url.searchParams.get("active");
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const people = db.people.filter((person) => {
      if (active === "1" || active === "true") return person.active;
      if (active === "0" || active === "false") return !person.active;
      return true;
    }).filter((person) => !q || `${person.name} ${person.department}`.toLowerCase().includes(q));
    return pageOf(people, url) as T;
  }
  if (method === "POST" && pathname === "/api/v1/people") return createPerson(db, actorId, body as never) as T;
  if (method === "PATCH" && parts[2] === "people" && parts.length === 4) return updatePerson(db, actorId, parts[3], body as never) as T;
  if (method === "GET" && pathname === "/api/v1/portfolio") return buildPortfolio(db) as T;
  if (method === "GET" && pathname === "/api/v1/product-build") return buildProductBuild(db) as T;
  if (method === "GET" && pathname === "/api/v1/factories") return buildFactories(db) as T;
  if (method === "POST" && pathname === "/api/v1/factories") return createFactory(db, actorId, body as never) as T;
  if (method === "GET" && parts[0] === "api" && parts[2] === "factories" && parts.length === 4) return buildFactory(db, parts[3]) as T;
  if (method === "PATCH" && parts[0] === "api" && parts[2] === "factories" && parts.length === 4) {
    return updateFactory(db, actorId, parts[3], body as never) as T;
  }
  if (method === "POST" && parts[2] === "factories" && parts[4] === "topics" && parts.length === 5) {
    return createTopic(db, actorId, parts[3], body as never) as T;
  }
  if (method === "PATCH" && parts[2] === "topics" && parts.length === 4) {
    return updateTopic(db, actorId, parts[3], body as never) as T;
  }
  if (method === "POST" && parts[2] === "factories" && parts[4] === "phases" && parts.length === 5) {
    return createPhase(db, actorId, parts[3], body as never) as T;
  }
  if (method === "PATCH" && parts[2] === "phases" && parts.length === 4) return updatePhase(db, actorId, parts[3], body as never) as T;
  if (method === "POST" && parts[2] === "phases" && parts[4] === "milestones") {
    return createMilestone(db, actorId, parts[3], body as never) as T;
  }
  if (method === "PATCH" && parts[2] === "milestones" && parts.length === 4) {
    return updateMilestone(db, actorId, parts[3], body as never) as T;
  }
  if (method === "GET" && pathname === "/api/v1/issues") {
    const list = buildIssues(db);
    const factory = url.searchParams.get("factory") ?? "";
    const severity = url.searchParams.get("severity") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const overdue = url.searchParams.get("overdue");
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = list.items.filter((item) => {
      if (factory && item.factoryId !== factory) return false;
      if (severity && item.severity !== severity) return false;
      if (status && item.status !== status) return false;
      if ((overdue === "1" || overdue === "true") && !item.overdue) return false;
      if ((overdue === "0" || overdue === "false") && item.overdue) return false;
      if (q && !`${item.title} ${item.code}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return { asOf: list.asOf, ...pageOf(items, url) } as T;
  }
  if (method === "POST" && pathname === "/api/v1/issues") return createIssue(db, actorId, body as never) as T;
  if (method === "GET" && parts[2] === "issues" && parts.length === 4) return buildIssue(db, parts[3]) as T;
  if (method === "PATCH" && parts[2] === "issues" && parts.length === 4) return updateIssue(db, actorId, parts[3], body as never) as T;
  if (method === "GET" && pathname === "/api/v1/products") return buildProducts(db) as T;
  if (method === "POST" && pathname === "/api/v1/products") return createProduct(db, actorId, body as never) as T;
  if (method === "GET" && parts[2] === "products" && parts.length === 4) return buildProduct(db, parts[3]) as T;
  if (method === "PATCH" && parts[2] === "products" && parts.length === 4) return updateProduct(db, actorId, parts[3], body as never) as T;
  if (method === "GET" && pathname === "/api/v1/capabilities") return buildCapabilities(db) as T;
  if (method === "GET" && parts[2] === "deployments" && parts.length === 4) return buildDeployment(db, parts[3]) as T;
  if (method === "PATCH" && parts[2] === "deployments" && parts.length === 4) {
    return updateDeployment(db, actorId, parts[3], body as never) as T;
  }
  if (method === "GET" && parts[2] === "factories" && parts[4] === "products" && parts[6] === "plan") {
    return buildPlan(db, parts[3], parts[5], actorId, session?.role ?? "viewer") as T;
  }
  if (method === "PUT" && parts[2] === "factories" && parts[4] === "products" && parts[6] === "plan") {
    return savePlan(db, actorId, parts[3], parts[5], body as never) as T;
  }
  if (method === "POST" && parts[2] === "factories" && parts[4] === "products" && parts[6] === "plan" && parts[7] === "approve") {
    return approvePlan(db, actorId, parts[3], parts[5]) as T;
  }
  if (method === "GET" && pathname === "/api/v1/activity") {
    const list = buildActivity(db);
    const entityType = url.searchParams.get("entityType") ?? "";
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = list.items.filter((item) => {
      if (entityType && item.entityType !== entityType) return false;
      if (q && !item.summary.toLowerCase().includes(q)) return false;
      return true;
    });
    return { asOf: list.asOf, ...pageOf(items, url) } as T;
  }
  if (method === "POST" && pathname === "/api/v1/machine-types") return createMachineType(db, actorId, body as never) as T;
  if (method === "PATCH" && parts[2] === "machine-types" && parts.length === 4) {
    return updateMachineType(db, actorId, parts[3], body as never) as T;
  }
  if (method === "GET" && parts[2] === "feature-diff") {
    return { changes: diffVersionFeatures(db, url.searchParams.get("from"), url.searchParams.get("to") ?? "") } as T;
  }

  throw new ApiError(`沒有這個 API：${method} ${pathname}`, 404);
}

function pageOf<T>(items: T[], url: URL): { items: T[]; total: number; limit: number; offset: number } {
  const total = items.length;
  let limit = Number(url.searchParams.get("limit") ?? "200");
  let offset = Number(url.searchParams.get("offset") ?? "0");
  if (!Number.isFinite(limit) || limit <= 0) limit = 200;
  if (limit > 500) limit = 500;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  return { items: items.slice(offset, offset + limit), total, limit, offset };
}
