import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { PreviewAdapterId, PreviewErrorCode, PreviewResponse } from "@jk-external-api/catalog";
import { adapters, type SecretName } from "./adapters.js";
import { normalizedCacheUrl, queryObject, querySchemas } from "./query.js";
import { AdapterError } from "./upstream.js";

type SecretBindings = Partial<Record<SecretName, string>>;
type Bindings = Env & SecretBindings;
type CacheLike = Pick<Cache, "match" | "put">;
export type RuntimeDependencies = { fetcher: typeof fetch; cache: CacheLike; now: () => Date; timeoutMs?: number; waitUntil?: (promise: Promise<unknown>) => void };

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" };
const adapterIds = Object.keys(adapters) as PreviewAdapterId[];

function failure(adapter: PreviewAdapterId, code: PreviewErrorCode, message: string, retryable: boolean): PreviewResponse<never> {
  return { ok: false, sourceId: adapters[adapter].sourceId, adapter, fetchedAt: new Date().toISOString(), error: { code, message, retryable } };
}

function statusFor(code: PreviewErrorCode): ContentfulStatusCode {
  return code === "INVALID_QUERY" ? 400 : code === "RATE_LIMITED" ? 429 : code === "NOT_CONFIGURED" ? 503 : code === "NO_RESULTS" ? 404 : code === "UPSTREAM_TIMEOUT" ? 504 : 502;
}

export function createApp(dependencies: RuntimeDependencies) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use("*", async (context, next) => {
    const origin = context.req.header("Origin");
    const allowed = new Set(context.env.ALLOWED_ORIGINS.split(",").map((item) => item.trim()));
    if (origin && !allowed.has(origin)) return context.json({ error: "ORIGIN_NOT_ALLOWED" }, 403, jsonHeaders);
    if (context.req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" } : {} });
    }
    if (context.req.method !== "GET") return context.json({ error: "METHOD_NOT_ALLOWED" }, 405, { ...jsonHeaders, Allow: "GET, OPTIONS" });
    await next();
    if (origin) { context.header("Access-Control-Allow-Origin", origin); context.header("Vary", "Origin"); }
    context.header("X-Content-Type-Options", "nosniff");
  });

  app.get("/v1/health", (context) => context.json({
    version: context.env.WORKER_VERSION,
    adapters: Object.fromEntries(adapterIds.map((adapterId) => [adapterId, Boolean(context.env[adapters[adapterId].secret])])),
  }, 200, jsonHeaders));

  app.get("/v1/previews/:adapter", async (context) => {
    const adapterId = context.req.param("adapter") as PreviewAdapterId;
    if (!adapterIds.includes(adapterId)) return context.json({ error: "NOT_FOUND" }, 404, jsonHeaders);
    const adapter = adapters[adapterId];
    const parsed = querySchemas[adapterId].safeParse(queryObject(new URL(context.req.url)));
    if (!parsed.success) return context.json(failure(adapterId, "INVALID_QUERY", parsed.error.issues.map(({ message }) => message).join(" "), false), 400, jsonHeaders);
    if (!context.env[adapter.secret]) return context.json(failure(adapterId, "NOT_CONFIGURED", `${adapterId} 미리보기에 필요한 서버 비밀키가 설정되지 않았습니다.`, false), 503, jsonHeaders);
    const clientKey = context.req.header("CF-Connecting-IP") ?? "unknown";
    const { success: withinLimit } = await context.env.PREVIEW_RATE_LIMITER.limit({ key: clientKey });
    if (!withinLimit) return context.json(failure(adapterId, "RATE_LIMITED", "60초 동안 미리보기 요청은 30회까지 가능합니다.", true), 429, jsonHeaders);

    const cacheRequest = new Request(normalizedCacheUrl(new URL(context.req.url)));
    const cached = await dependencies.cache.match(cacheRequest);
    if (cached) {
      const body = await cached.json() as PreviewResponse<unknown>;
      if (body.ok) body.cache.status = "hit";
      return context.json(body, 200, { ...jsonHeaders, "X-KSource-Cache": "hit" });
    }

    try {
      const data = await adapter.run(parsed.data as Record<string, unknown>, { fetcher: dependencies.fetcher, timeoutMs: dependencies.timeoutMs ?? 5_000, now: dependencies.now, secrets: context.env });
      const response: PreviewResponse<unknown> = { ok: true, sourceId: adapter.sourceId, adapter: adapterId, fetchedAt: dependencies.now().toISOString(), cache: { status: "miss", ttlSeconds: adapter.ttlSeconds }, attribution: adapter.attribution, data };
      const cacheResponse = new Response(JSON.stringify(response), { headers: { ...jsonHeaders, "Cache-Control": `public, max-age=${adapter.ttlSeconds}` } });
      const cachePromise = dependencies.cache.put(cacheRequest, cacheResponse);
      if (dependencies.waitUntil) dependencies.waitUntil(cachePromise); else await cachePromise;
      return context.json(response, 200, { ...jsonHeaders, "Cache-Control": `public, max-age=${adapter.ttlSeconds}`, "X-KSource-Cache": "miss" });
    } catch (error) {
      const adapterError = error instanceof AdapterError ? error : new AdapterError("UPSTREAM_UNAVAILABLE", "미리보기를 가져올 수 없습니다.");
      return context.json(failure(adapterId, adapterError.code, adapterError.message, adapterError.code !== "BAD_UPSTREAM_RESPONSE"), statusFor(adapterError.code), jsonHeaders);
    }
  });

  app.notFound((context) => context.json({ error: "NOT_FOUND" }, 404, jsonHeaders));
  return app;
}
