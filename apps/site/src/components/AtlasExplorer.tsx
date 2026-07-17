import { useMemo, useState } from "preact/hooks";
import type { Source, Technology } from "@jk-external-api/catalog";
import { addToComparison, filterSources, removeFromComparison, type SourceFilters } from "../lib/discovery.js";
import { StatusMark } from "./StatusMark.js";

type Props = { sources: Source[]; technologies: Technology[]; base: string };

const lineColors: Record<string, string> = {
  public: "#2357A5", facility: "#687C46", statistics: "#725792", seoul: "#BA3A36", local: "#9C5C27", business: "#9C5C27",
  weather: "#2357A5", environment: "#687C46", mobility: "#BA3A36", geospatial: "#725792", place: "#9C5C27", search: "#687C46", health: "#BA3A36", culture: "#725792",
};

export default function AtlasExplorer({ sources, technologies, base }: Props) {
  const [filters, setFilters] = useState<SourceFilters>({});
  const [selectedId, setSelectedId] = useState(sources[0]?.id ?? "");
  const [comparison, setComparison] = useState<string[]>([]);
  const technologyNames = Object.fromEntries(technologies.map(({ id, name }) => [id, name]));
  const matches = useMemo(() => filterSources(sources, { ...filters, technologyNames }), [sources, filters]);
  const selected = sources.find(({ id }) => id === selectedId) ?? matches[0] ?? sources[0];
  const domains = [...new Set(sources.flatMap(({ domains: values }) => values))].sort();
  const lineGroups = [...new Set(sources.flatMap(({ atlas }) => atlas.lines))].map((line) => ({ line, points: sources.filter(({ atlas }) => atlas.lines.includes(line)).map(({ atlas }) => `${atlas.x},${atlas.y}`).join(" ") }));

  const update = (key: keyof SourceFilters, value: string) => setFilters((current) => ({ ...current, [key]: value || undefined }));
  const toggleComparison = (id: string) => setComparison((current) => current.includes(id) ? removeFromComparison(current, id) : addToComparison(current, id));

  return <section class="atlas-shell" aria-label="정보원 Atlas 탐색기">
    <div class="atlas-toolbar">
      <label class="search-field"><span>통합 검색</span><input type="search" value={filters.query ?? ""} onInput={(event) => update("query", event.currentTarget.value)} placeholder="예: 미세먼지, 공연장, REST API" /></label>
      <div class="filter-row" aria-label="정보원 필터">
        <label>분야<select value={filters.domain ?? ""} onChange={(event) => update("domain", event.currentTarget.value)}><option value="">전체</option>{domains.map((domain) => <option value={domain}>{domain}</option>)}</select></label>
        <label>제공 방식<select value={filters.delivery ?? ""} onChange={(event) => update("delivery", event.currentTarget.value)}><option value="">전체</option><option value="open-api">Open API</option><option value="file">파일</option><option value="sdk">SDK</option></select></label>
        <label>인증<select value={filters.auth ?? ""} onChange={(event) => update("auth", event.currentTarget.value)}><option value="">전체</option><option value="none">없음</option><option value="api-key">API 키</option><option value="mixed">혼합</option></select></label>
        <label>실시간성<select value={filters.realtime ?? ""} onChange={(event) => update("realtime", event.currentTarget.value)}><option value="">전체</option><option value="realtime">실시간</option><option value="minutes">분 단위</option><option value="hourly">시간 단위</option><option value="daily">일 단위</option><option value="periodic">주기 갱신</option></select></label>
        <label>지역<select value={filters.geography ?? ""} onChange={(event) => update("geography", event.currentTarget.value)}><option value="">전체</option><option value="nationwide">전국</option><option value="seoul">서울</option><option value="regional">지역별</option><option value="global">전 세계</option></select></label>
      </div>
    </div>

    <div class="atlas-grid">
      <aside class="source-rail" aria-label={`검색 결과 ${matches.length}개`}>
        <div class="panel-heading"><span>정보원 레일</span><strong>{String(matches.length).padStart(2, "0")}</strong></div>
        <ol>{matches.map((source) => <li><button class={selected?.id === source.id ? "selected" : ""} onClick={() => setSelectedId(source.id)}><span class="rail-code">{source.domains[0]?.slice(0, 3).toUpperCase()}</span><span><strong>{source.name}</strong><small>{source.operator}</small></span></button></li>)}</ol>
        {matches.length === 0 && <p class="empty-state">조건과 맞는 정보원이 없습니다. 필터를 하나씩 해제해 보세요.</p>}
      </aside>

      <div class="atlas-map-wrap">
        <div class="panel-heading"><span>관계 노선도</span><small>분야선은 정보원 간 주제 연결을 뜻합니다</small></div>
        <svg class="atlas-map" viewBox="0 0 100 100" role="img" aria-labelledby="atlas-title atlas-desc">
          <title id="atlas-title">한국 외부 정보원 관계 노선도</title><desc id="atlas-desc">14개 정보원이 분야별 색 노선으로 연결되어 있습니다. 뒤의 텍스트 목록에서도 같은 정보를 탐색할 수 있습니다.</desc>
          <g class="atlas-lines">{lineGroups.map(({ line, points }) => points.includes(" ") && <polyline points={points} fill="none" stroke={lineColors[line] ?? "#687C46"} stroke-width="1.25" stroke-linecap="square" stroke-linejoin="bevel" />)}</g>
          {sources.map((source) => {
            const active = matches.some(({ id }) => id === source.id);
            const selectedNode = selected?.id === source.id;
            return <g class={`atlas-node ${active ? "active" : "muted"} ${selectedNode ? "selected" : ""}`} role="button" tabIndex={active ? 0 : -1} aria-label={`${source.name} 선택`} aria-pressed={selectedNode} onClick={() => active && setSelectedId(source.id)} onKeyDown={(event) => { if (active && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedId(source.id); } }} transform={`translate(${source.atlas.x} ${source.atlas.y})`}>
              <circle r={selectedNode ? 3.2 : 2.4} fill="#FBFBFC" stroke={lineColors[source.atlas.lines[0] ?? ""] ?? "#2357A5"} stroke-width={selectedNode ? 1.4 : 0.9} />
              <text x="3.8" y="1.1">{source.name}</text>
            </g>;
          })}
        </svg>
        <div class="mobile-source-list" aria-label="노선도의 텍스트 대체 목록">{matches.map((source) => <button onClick={() => setSelectedId(source.id)} aria-pressed={selected?.id === source.id}><span aria-hidden="true" style={{ color: lineColors[source.atlas.lines[0] ?? ""] }}>●</span> {source.name} <small>{source.domains.join(" · ")}</small></button>)}</div>
      </div>

      <aside class="source-dossier" aria-live="polite">
        <div class="panel-heading"><span>선택 기록</span><small>{selected?.id}</small></div>
        {selected && <div class="dossier-content">
          <p class="record-kicker">{selected.domains.join(" / ")}</p><h2>{selected.name}</h2><p>{selected.summary}</p>
          <div class="status-stack"><StatusMark kind="auth" value={selected.auth} /><StatusMark kind="freshness" value={selected.updateFrequency} /><StatusMark kind="preview" value={selected.previewAdapterId ? "사용 가능" : "원문 확인"} /></div>
          <dl><div><dt>운영기관</dt><dd>{selected.operator}</dd></div><div><dt>형식</dt><dd>{selected.formats.join(" · ")}</dd></div><div><dt>범위</dt><dd>{selected.geography.join(" · ")}</dd></div><div><dt>확인일</dt><dd>{selected.lastVerifiedAt}</dd></div></dl>
          <div class="dossier-actions"><a class="button primary" href={`${base}/sources/${selected.id}/`}>상세 기록</a><button class="button" onClick={() => toggleComparison(selected.id)} disabled={!comparison.includes(selected.id) && comparison.length >= 4}>{comparison.includes(selected.id) ? "비교에서 빼기" : "비교에 담기"}</button></div>
        </div>}
      </aside>
    </div>
    <div class={`comparison-dock ${comparison.length ? "visible" : ""}`} aria-live="polite"><span>비교함 {comparison.length}/4</span><span>{comparison.map((id) => sources.find((source) => source.id === id)?.name).join(" · ")}</span><a href={`${base}/compare/?ids=${comparison.join(",")}`}>비교표 열기</a></div>
  </section>;
}
