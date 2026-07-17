export class AdapterError extends Error {
  constructor(public readonly code: "NO_RESULTS" | "RATE_LIMITED" | "UPSTREAM_TIMEOUT" | "UPSTREAM_UNAVAILABLE" | "BAD_UPSTREAM_RESPONSE", message: string) { super(message); }
}

export async function fetchText(fetcher: typeof fetch, input: string, init: RequestInit, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(input, { ...init, signal: controller.signal });
    if (response.status === 429) throw new AdapterError("RATE_LIMITED", "원천 서비스의 요청 한도에 도달했습니다.");
    if (response.status >= 500) throw new AdapterError("UPSTREAM_UNAVAILABLE", `원천 서비스가 ${response.status} 상태를 반환했습니다.`);
    if (!response.ok) throw new AdapterError("BAD_UPSTREAM_RESPONSE", `원천 서비스가 ${response.status} 상태를 반환했습니다.`);
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > 1_000_000) throw new AdapterError("BAD_UPSTREAM_RESPONSE", "원천 응답이 허용 크기를 초과했습니다.");
    const text = await response.text();
    if (text.length > 1_000_000) throw new AdapterError("BAD_UPSTREAM_RESPONSE", "원천 응답이 허용 크기를 초과했습니다.");
    return text;
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new AdapterError("UPSTREAM_TIMEOUT", "원천 서비스가 5초 안에 응답하지 않았습니다.");
    throw new AdapterError("UPSTREAM_UNAVAILABLE", "원천 서비스에 연결할 수 없습니다.");
  } finally {
    clearTimeout(timeout);
  }
}

export function parseJson(text: string): unknown {
  try { return JSON.parse(text); }
  catch { throw new AdapterError("BAD_UPSTREAM_RESPONSE", "원천 JSON 형식을 해석할 수 없습니다."); }
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AdapterError("BAD_UPSTREAM_RESPONSE", "원천 응답 객체가 없습니다.");
  return value as Record<string, unknown>;
}

export function at(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => asRecord(current)[key], value);
}

export function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}
