import { describe, expect, it, vi } from "vitest";
import { createApp, type RuntimeDependencies } from "../src/app.js";

const successByPath: Record<string, string> = {
  weather: JSON.stringify({ response: { header: { resultCode: "00" }, body: { items: { item: [{ category: "T1H", obsrValue: "24.1" }] } } } }),
  "air-quality": JSON.stringify({ response: { body: { items: [{ stationName: "중구", pm10Value: "31", pm25Value: "12", khaiGrade: "1", dataTime: "2026-07-17 14:00" }] } } }),
  "transit-arrival": JSON.stringify({ response: { body: { items: { item: [{ nodeid: "SEOUL1", nodenm: "서울역" }] } } } }),
  "public-facilities": JSON.stringify({ response: { body: { items: [{ openFcltyNm: "시민회의실", latitude: "37.566", longitude: "126.978" }] } } }),
  places: JSON.stringify({ documents: [{ id: "1", place_name: "시립도서관", category_name: "문화, 도서관", address_name: "서울", road_address_name: "서울로", x: "126.978", y: "37.566", place_url: "https://place.map.kakao.com/1", distance: "120" }] }),
  performances: "<dbs><db><mt20id>PF1</mt20id><prfnm>어린이 음악회</prfnm><prfpdfrom>2026.07.17</prfpdfrom><prfpdto>2026.07.20</prfpdto><fcltynm>예술회관</fcltynm><prfstate>공연중</prfstate></db></dbs>",
};

class MemoryCache {
  private readonly entries = new Map<string, Response>();
  async match(request: RequestInfo | URL) { return this.entries.get(String(request))?.clone(); }
  async put(request: RequestInfo | URL, response: Response) { this.entries.set(String(request), response.clone()); }
  async delete(request: RequestInfo | URL) { return this.entries.delete(String(request)); }
  async add() { throw new Error("not implemented"); } async addAll() { throw new Error("not implemented"); } async keys() { return []; }
}

function env(overrides: Record<string, unknown> = {}) {
  return {
    DATA_GO_KR_API_KEY: "data-key", KAKAO_REST_API_KEY: "kakao-key", KOPIS_SERVICE_KEY: "kopis-key",
    ALLOWED_ORIGINS: "https://rafaam11.github.io,http://localhost:4321", WORKER_VERSION: "test",
    PREVIEW_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) }, ...overrides,
  } as unknown as Env;
}

function dependencies(fetcher: typeof fetch = async (input) => {
  const url = String(input);
  if (url.includes("BusSttnInfo")) return new Response(successByPath["transit-arrival"]);
  if (url.includes("ArvlInfo")) return new Response(JSON.stringify({ response: { body: { items: { item: [{ routeno: "100", arrprevstationcnt: 2, arrtime: 240 }] } } } }));
  const key = url.includes("Vilage") ? "weather" : url.includes("Arpltn") ? "air-quality" : url.includes("tn_pubr") ? "public-facilities" : url.includes("kakao") ? "places" : "performances";
  return new Response(successByPath[key]);
}): RuntimeDependencies { return { fetcher, cache: new MemoryCache(), now: () => new Date("2026-07-17T05:00:00.000Z") }; }

const requests = [
  ["weather", "lat=37.5665&lng=126.9780"], ["air-quality", "sido=서울"], ["transit-arrival", "q=서울역&cityCode=11"],
  ["public-facilities", "lat=37.5665&lng=126.9780&radiusM=1500"], ["places", "q=도서관&lat=37.5665&lng=126.9780"], ["performances", "from=2026-07-17&to=2026-07-20&region=11"],
] as const;

describe("preview Worker", () => {
  it.each(requests)("normalizes the %s adapter response", async (adapter, query) => {
    const response = await createApp(dependencies()).request(`/v1/previews/${adapter}?${query}`, { headers: { Origin: "https://rafaam11.github.io", "CF-Connecting-IP": "203.0.113.1" } }, env());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ ok: true, adapter, cache: { status: "miss", ttlSeconds: expect.any(Number) } }));
  });

  it("validates bounded input and rejects unsupported methods", async () => {
    const app = createApp(dependencies());
    expect((await app.request("/v1/previews/places?q=x&radiusM=999999", {}, env())).status).toBe(400);
    expect((await app.request("/v1/previews/weather?lat=200&lng=1", {}, env())).status).toBe(400);
    expect((await app.request("/v1/previews/weather?lat=37&lng=127", { method: "POST" }, env())).status).toBe(405);
  });

  it("enforces CORS and handles OPTIONS", async () => {
    const app = createApp(dependencies());
    const denied = await app.request("/v1/health", { headers: { Origin: "https://evil.example" } }, env());
    expect(denied.status).toBe(403);
    const allowed = await app.request("/v1/health", { method: "OPTIONS", headers: { Origin: "http://localhost:4321" } }, env());
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:4321");
  });

  it("returns health without exposing secret values", async () => {
    const response = await createApp(dependencies()).request("/v1/health", {}, env({ KOPIS_SERVICE_KEY: undefined }));
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(JSON.parse(body)).toEqual({ version: "test", adapters: expect.objectContaining({ performances: false }) });
    expect(body).not.toContain("data-key");
  });

  it("returns NOT_CONFIGURED for a missing adapter secret", async () => {
    const response = await createApp(dependencies()).request("/v1/previews/places?q=도서관", {}, env({ KAKAO_REST_API_KEY: undefined }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: "NOT_CONFIGURED" }) }));
  });

  it("maps empty, timeout, 429, 5xx, and malformed responses", async () => {
    const cases: Array<[typeof fetch, string]> = [
      [async () => new Response(JSON.stringify({ documents: [] })), "NO_RESULTS"],
      [async (_input, init) => await new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))); }), "UPSTREAM_TIMEOUT"],
      [async () => new Response("", { status: 429 }), "RATE_LIMITED"],
      [async () => new Response("", { status: 503 }), "UPSTREAM_UNAVAILABLE"],
      [async () => new Response("not-json"), "BAD_UPSTREAM_RESPONSE"],
    ];
    for (const [fetcher, code] of cases) {
      const response = await createApp({ ...dependencies(fetcher), timeoutMs: 5 }).request("/v1/previews/places?q=도서관", {}, env());
      expect((await response.json() as { error: { code: string } }).error.code).toBe(code);
    }
  });

  it("serves cache hits without calling upstream again", async () => {
    const fetcher = vi.fn(dependencies().fetcher);
    const app = createApp(dependencies(fetcher));
    const url = "/v1/previews/places?q=도서관";
    expect((await (await app.request(url, {}, env())).json() as { cache: { status: string } }).cache.status).toBe("miss");
    expect((await (await app.request(url, {}, env())).json() as { cache: { status: string } }).cache.status).toBe("hit");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns RATE_LIMITED when the Cloudflare binding denies a request", async () => {
    const limiter = { limit: vi.fn(async () => ({ success: false })) };
    const response = await createApp(dependencies()).request("/v1/previews/places?q=도서관", { headers: { "CF-Connecting-IP": "203.0.113.9" } }, env({ PREVIEW_RATE_LIMITER: limiter }));
    expect(response.status).toBe(429);
    expect((await response.json() as { error: { code: string } }).error.code).toBe("RATE_LIMITED");
  });
});
