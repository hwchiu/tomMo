import { ApiError } from "./errors";
import { invalidate } from "./live";
import { mockRoute } from "./router";
import { getActorId, getFault, hydrateSession } from "./session";

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
  const fault = getFault();
  if (fault === "error") {
    await sleep(180);
    throw new ApiError("無法連線到協調服務", 503);
  }
  await sleep(fault === "slow" ? 1100 : 140);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  let result: T;
  if (!base) {
    result = mockRoute<T>({ method, path, body: options.body });
  } else {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-actor-id": getActorId(),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) throw new ApiError(payload.message || `請求失敗（${response.status}）`, response.status);
    result = payload as T;
  }
  if (method !== "GET") invalidate();
  return result;
}
