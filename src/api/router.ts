import { ApiError } from "./errors";
import { getAuth } from "./session";
import {
  approvePlan,
  createEnumeration,
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
  updateEnumeration,
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
  const publicCall = pathname === "/api/v1/login" || pathname === "/api/v1/logout";
  if (!publicCall && !session) throw new ApiError("請先登入", 401);
  if (session && method !== "GET" && session.role !== "editor" && pathname !== "/api/v1/logout") {
    throw new ApiError("使用者只能閱讀", 403);
  }
  const actorId = session?.personId ?? "";

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
  if (method === "GET" && pathname === "/api/v1/people") return { items: db.people } as T;
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
  if (method === "GET" && pathname === "/api/v1/issues") return buildIssues(db) as T;
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
  if (method === "GET" && pathname === "/api/v1/activity") return buildActivity(db) as T;
  if (method === "POST" && pathname === "/api/v1/enumerations") return createEnumeration(db, actorId, body as never) as T;
  if (method === "POST" && pathname === "/api/v1/machine-types") return createMachineType(db, actorId, body as never) as T;
  if (method === "PATCH" && parts[2] === "machine-types" && parts.length === 4) {
    return updateMachineType(db, actorId, parts[3], body as never) as T;
  }
  if (method === "PATCH" && parts[2] === "enumerations" && parts.length === 4) {
    return updateEnumeration(db, actorId, parts[3], body as never) as T;
  }
  if (method === "GET" && parts[2] === "feature-diff") {
    return { changes: diffVersionFeatures(db, url.searchParams.get("from"), url.searchParams.get("to") ?? "") } as T;
  }

  throw new ApiError(`沒有這個 API：${method} ${pathname}`, 404);
}
