import { useState } from "preact/hooks";
import type { PreviewAdapterId, PreviewResponse } from "@k-source-atlas/catalog";

type Props = { adapter: PreviewAdapterId; sourceId: string; officialUrl: string; apiBase?: string };

const examples: Record<PreviewAdapterId, Record<string, string>> = {
  weather: { lat: "37.5665", lng: "126.9780" },
  "air-quality": { sido: "서울" },
  "transit-arrival": { q: "서울역" },
  "public-facilities": { lat: "37.5665", lng: "126.9780", radiusM: "1500" },
  places: { q: "도서관", lat: "37.5665", lng: "126.9780", radiusM: "2000" },
  performances: { from: new Date().toISOString().slice(0, 10), to: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10), region: "11" },
};

export default function PreviewWidget({ adapter, sourceId, officialUrl, apiBase }: Props) {
  const [state, setState] = useState<{ loading: boolean; result?: PreviewResponse<unknown> }>({ loading: false });
  const run = async () => {
    if (!apiBase) return setState({ loading: false, result: { ok: false, sourceId, adapter, fetchedAt: new Date().toISOString(), error: { code: "NOT_CONFIGURED", message: "운영 미리보기 주소가 아직 연결되지 않았습니다.", retryable: false } } });
    setState({ loading: true });
    try {
      const query = new URLSearchParams(examples[adapter]);
      const response = await fetch(`${apiBase.replace(/\/$/, "")}/v1/previews/${adapter}?${query}`);
      setState({ loading: false, result: await response.json() as PreviewResponse<unknown> });
    } catch {
      setState({ loading: false, result: { ok: false, sourceId, adapter, fetchedAt: new Date().toISOString(), error: { code: "UPSTREAM_UNAVAILABLE", message: "미리보기 서비스에 연결할 수 없습니다.", retryable: true } } });
    }
  };
  return <section class="preview-widget" aria-labelledby="preview-title">
    <div><p class="record-kicker">읽기 전용 · 예시 위치</p><h2 id="preview-title">실시간 미리보기</h2><p>브라우저 위치 권한 없이 공개 예시값으로 조회합니다. 입력은 저장하지 않습니다.</p></div>
    <button class="button primary" onClick={run} disabled={state.loading}>{state.loading ? "조회 중…" : "예시 데이터 조회"}</button>
    {state.result && (state.result.ok
      ? <div class="preview-result success"><strong>조회 완료</strong><small>{state.result.fetchedAt} · cache {state.result.cache.status}</small><pre>{JSON.stringify(state.result.data, null, 2)}</pre></div>
      : <div class="preview-result error" role="status"><strong>{state.result.error.code}</strong><p>{state.result.error.message}</p><small>{state.result.error.retryable ? "잠시 후 재시도할 수 있습니다." : "설정 또는 입력 확인이 필요합니다."}</small> <a href={officialUrl}>공식 원문 열기</a></div>)}
  </section>;
}
