import { ApiError } from "./errors";
import { invalidate } from "./live";
import { basePath } from "@/lib/base-path";
import { mockRoute } from "./router";
import { getFault, hydrateSession } from "./session";

/** Static GitHub Pages build keeps the in-browser mock. The Go binary sets this to "0". */
export const useMock = process.env.NEXT_PUBLIC_USE_MOCK !== "0";

interface RequestOptions {
  method?: string;
  body?: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Single HTTP seam. With NEXT_PUBLIC_API_BASE_URL unset, calls stay in the
 * in-memory mock. Point the variable at the Go service and the same paths
 * become fetch() calls. The actor travels as X-Actor-Id until real auth exists.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  hydrateSession();
  const method = options.method ?? "GET";
  const fault = useMock ? getFault() : "ok";
  if (fault === "error") {
    await sleep(180);
    throw new ApiError("無法連線到協調服務", 503);
  }
  if (useMock) await sleep(fault === "slow" ? 1100 : 80);
  let result: T;
  if (useMock) {
    result = mockRoute<T>({ method, path, body: options.body });
  } else {
    const response = await fetch(path, {
      method,
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    if (response.status === 401 && typeof window !== "undefined" && !path.endsWith("/login")) {
      const loginUrl = new URL(`${basePath}/login/`, window.location.origin);
      window.location.assign(loginUrl.href);
    }
    if (!response.ok) throw new ApiError(payload.message || `請求失敗（${response.status}）`, response.status);
    result = payload as T;
  }
  if (method !== "GET") invalidate();
  return result;
}
