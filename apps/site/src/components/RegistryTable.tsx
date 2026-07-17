import { useMemo, useState } from "preact/hooks";
import type { Blueprint, Catalog, Skill, Source, Technology } from "@jk-external-api/catalog";
import { deriveRegistryPage, type RegistryKind, type RegistryRowData, type RegistrySort } from "../lib/registry.js";
import RegistryDialog, { useRegistryDialog } from "./RegistryDialog.js";

type RecordByKind = { source: Source; skill: Skill; blueprint: Blueprint; technology: Technology };
type RegistryRecord = RecordByKind[RegistryKind];
type Row = RegistryRowData & { record: RegistryRecord; name: string };
type Props = {
  kind: RegistryKind;
  catalog: Catalog;
  base: string;
  records?: RegistryRecord[];
  toolbar?: boolean;
};

type Column = { key: string; label: string; low?: boolean; value: (row: Row) => string };

const kindLabels: Record<RegistryKind, string> = { source: "정보원", skill: "k-skill", blueprint: "청사진", technology: "기술" };

function detailHref(kind: RegistryKind, id: string, base: string) {
  if (kind === "technology") return `${base}/technologies/#${id}`;
  return `${base}/${kind === "source" ? "sources" : kind === "skill" ? "skills" : "blueprints"}/${id}/`;
}

function toRows(kind: RegistryKind, records: RegistryRecord[], catalog: Catalog): Row[] {
  return records.map((record) => {
    if (kind === "source") {
      const source = record as Source;
      return { record, id: source.id, name: source.name, searchText: [source.name, source.operator, source.summary, ...source.keywords, ...source.formats].join(" "), fields: { category: source.domains, auth: source.auth, name: source.name, update: source.updateFrequency, formats: source.formats, preview: source.previewAdapterId ? "사용 가능" : "원문 확인" } as Record<string, string | string[]> };
    }
    if (kind === "skill") {
      const skill = record as Skill;
      return { record, id: skill.id, name: skill.name, searchText: [skill.name, skill.description, skill.category, ...skill.runtimes, ...skill.auth].join(" "), fields: { category: skill.category, auth: skill.auth, name: skill.name, runtime: skill.runtimes, sources: String(skill.sourceIds.length).padStart(4, "0") } as Record<string, string | string[]> };
    }
    if (kind === "blueprint") {
      const blueprint = record as Blueprint;
      return { record, id: blueprint.id, name: blueprint.name, searchText: [blueprint.name, blueprint.problem, ...blueprint.outputs, ...blueprint.stack].join(" "), fields: { category: blueprint.sourceIds.map((id) => catalog.sources.find((item) => item.id === id)?.domains[0] ?? ""), name: blueprint.name, problem: blueprint.problem, sources: String(blueprint.sourceIds.length).padStart(4, "0"), output: blueprint.outputs[0] ?? "" } as Record<string, string | string[]> };
    }
    const technology = record as Technology;
    return { record, id: technology.id, name: technology.name, searchText: [technology.name, technology.category, technology.summary].join(" "), fields: { category: technology.category, name: technology.name, sources: String(catalog.sources.filter((source) => source.technologyIds.includes(technology.id)).length).padStart(4, "0"), skills: String(catalog.skills.filter((skill) => skill.technologyIds.includes(technology.id)).length).padStart(4, "0") } as Record<string, string | string[]> };
  });
}

function columnsFor(kind: RegistryKind, catalog: Catalog): Column[] {
  if (kind === "source") return [
    { key: "name", label: "이름", value: ({ record }) => (record as Source).name },
    { key: "category", label: "분야", value: ({ record }) => (record as Source).domains.join(" · ") },
    { key: "auth", label: "인증", value: ({ record }) => (record as Source).auth },
    { key: "update", label: "갱신", low: true, value: ({ record }) => (record as Source).updateFrequency },
    { key: "formats", label: "형식", low: true, value: ({ record }) => (record as Source).formats.join(" · ") },
    { key: "preview", label: "미리보기", low: true, value: ({ record }) => (record as Source).previewAdapterId ? "사용 가능" : "원문 확인" },
  ];
  if (kind === "skill") return [
    { key: "name", label: "이름", value: ({ record }) => (record as Skill).name },
    { key: "category", label: "분류", value: ({ record }) => (record as Skill).category },
    { key: "runtime", label: "실행 환경", low: true, value: ({ record }) => (record as Skill).runtimes.join(" · ") || "문서 확인" },
    { key: "auth", label: "인증 단서", low: true, value: ({ record }) => (record as Skill).auth.join(" · ") || "없음" },
    { key: "sources", label: "연결 정보원", value: ({ record }) => `${(record as Skill).sourceIds.length}개` },
  ];
  if (kind === "blueprint") return [
    { key: "name", label: "이름", value: ({ record }) => (record as Blueprint).name },
    { key: "problem", label: "해결 문제", value: ({ record }) => (record as Blueprint).problem },
    { key: "sources", label: "정보원", value: ({ record }) => `${(record as Blueprint).sourceIds.length}개` },
    { key: "output", label: "주요 출력", low: true, value: ({ record }) => (record as Blueprint).outputs[0] ?? "-" },
  ];
  return [
    { key: "name", label: "이름", value: ({ record }) => (record as Technology).name },
    { key: "category", label: "분류", value: ({ record }) => (record as Technology).category },
    { key: "sources", label: "정보원", value: ({ record }) => `${catalog.sources.filter((source) => source.technologyIds.includes(record.id)).length}개` },
    { key: "skills", label: "k-skill", value: ({ record }) => `${catalog.skills.filter((skill) => skill.technologyIds.includes(record.id)).length}개` },
  ];
}

export default function RegistryTable({ kind, catalog, base, records, toolbar = true }: Props) {
  const sourceRecords = records ?? (kind === "source" ? catalog.sources : kind === "skill" ? catalog.skills : kind === "blueprint" ? catalog.blueprints : catalog.technologies);
  const rows = useMemo(() => toRows(kind, sourceRecords as RegistryRecord[], catalog), [kind, sourceRecords, catalog]);
  const columns = columnsFor(kind, catalog);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<RegistrySort>({ key: "name", direction: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50>(25);
  const dialog = useRegistryDialog(catalog);
  const categories = [...new Set(rows.flatMap((row) => { const value = row.fields.category; return Array.isArray(value) ? value : value ? [value] : []; }))].filter(Boolean).sort();
  const result = deriveRegistryPage(rows, { query, filters: { category }, sort, page, pageSize });

  const changeSort = (key: string) => {
    setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
    setPage(1);
  };

  return <section class="registry" aria-label={`${kindLabels[kind]} 레지스트리 영역`}>
    {toolbar && <div class="registry-toolbar">
      <label><span>목록 검색</span><input type="search" value={query} onInput={(event) => { setQuery(event.currentTarget.value); setPage(1); }} placeholder={`${kindLabels[kind]} 이름·설명 검색`} /></label>
      <label><span>{kind === "source" ? "분야" : "분류"}</span><select value={category} onChange={(event) => { setCategory(event.currentTarget.value); setPage(1); }}><option value="">전체</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <p class="registry-count"><strong>{result.totalItems}</strong> / {rows.length}개 기록</p>
    </div>}
    <div class="registry-table-wrap">
      <table class="registry-table" aria-label={`${kindLabels[kind]} 레지스트리`}>
        <thead><tr>{columns.map((column) => <th class={column.low ? "low-priority" : ""} scope="col"><button type="button" onClick={() => changeSort(column.key)}>{column.label}<span aria-hidden="true">{sort.key === column.key ? sort.direction === "asc" ? " ↑" : " ↓" : ""}</span></button></th>)}</tr></thead>
        <tbody>{result.items.map((row) => <tr key={row.id}>{columns.map((column, index) => <td class={`${column.low ? "low-priority " : ""}${index === 0 ? "registry-primary-cell" : ""}`} data-label={column.label}>{index === 0 ? <a
          href={detailHref(kind, row.id, base)}
          title={row.name}
          onClick={(event) => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            dialog.open({ kind, id: row.id }, event.currentTarget);
          }}
        >{column.value(row)}</a> : <span title={column.value(row)}>{column.value(row)}</span>}</td>)}</tr>)}</tbody>
      </table>
      {result.totalItems === 0 && <p class="empty-state">조건과 맞는 기록이 없습니다. 검색어나 필터를 조정하세요.</p>}
    </div>
    {rows.length > 25 && <nav class="registry-pagination" aria-label="목록 페이지">
      <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={result.page === 1}>이전</button>
      <span>{result.page} / {result.totalPages}</span>
      <button type="button" onClick={() => setPage((current) => Math.min(result.totalPages, current + 1))} disabled={result.page === result.totalPages}>다음</button>
      <label><span>페이지당 항목</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.currentTarget.value) === 50 ? 50 : 25); setPage(1); }}><option value="25">25개</option><option value="50">50개</option></select></label>
    </nav>}
    <RegistryDialog catalog={catalog} base={base} view={dialog.view} onRequestClose={dialog.close} />
  </section>;
}
