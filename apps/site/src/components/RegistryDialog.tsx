import { useEffect, useRef, useState } from "preact/hooks";
import type { Catalog } from "@jk-external-api/catalog";
import { formatSkillCategory, formatTechnologyCategory } from "../lib/labels.js";
import { parseRegistryView, serializeRegistryView, type RegistryKind, type RegistryView } from "../lib/registry.js";

type Props = {
  catalog: Catalog;
  base: string;
  view: RegistryView | null;
  onRequestClose: () => void;
};

const kindLabels: Record<RegistryKind, string> = {
  source: "정보원",
  skill: "k-skill",
  blueprint: "청사진",
  technology: "기술",
};

const states: Record<RegistryKind, string> = {
  source: "verified",
  skill: "upstream",
  blueprint: "read-only",
  technology: "linked",
};

export function registryAvailability(catalog: Catalog): Record<RegistryKind, Set<string>> {
  return {
    source: new Set(catalog.sources.map(({ id }) => id)),
    skill: new Set(catalog.skills.map(({ id }) => id)),
    blueprint: new Set(catalog.blueprints.map(({ id }) => id)),
    technology: new Set(catalog.technologies.map(({ id }) => id)),
  };
}

export function useRegistryDialog(catalog: Catalog) {
  const [view, setView] = useState<RegistryView | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const available = registryAvailability(catalog);

  useEffect(() => {
    const sync = () => setView(parseRegistryView(window.location.search, available));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [catalog]);

  const writeView = (next: RegistryView | null) => {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("view", serializeRegistryView(next));
    else url.searchParams.delete("view");
    window.history.pushState({}, "", url);
    setView(next);
  };

  const open = (next: RegistryView, trigger?: HTMLElement | null) => {
    returnFocus.current = trigger ?? null;
    writeView(next);
  };

  const close = () => {
    writeView(null);
    const target = returnFocus.current;
    returnFocus.current = null;
    window.setTimeout(() => target?.focus(), 0);
  };

  return { view, open, close };
}

function RelationList({ title, items }: { title: string; items: Array<{ id: string; name: string; href: string }> }) {
  return <div><dt>{title}</dt><dd>{items.length ? items.map((item) => <a href={item.href} key={item.id}>{item.name}</a>) : <span>연결 기록 없음</span>}</dd></div>;
}

export default function RegistryDialog({ catalog, base, view, onRequestClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (view && !dialog.open) dialog.showModal();
    if (!view && dialog.open) dialog.close();
  }, [view]);

  const source = view?.kind === "source" ? catalog.sources.find(({ id }) => id === view.id) : undefined;
  const skill = view?.kind === "skill" ? catalog.skills.find(({ id }) => id === view.id) : undefined;
  const blueprint = view?.kind === "blueprint" ? catalog.blueprints.find(({ id }) => id === view.id) : undefined;
  const technology = view?.kind === "technology" ? catalog.technologies.find(({ id }) => id === view.id) : undefined;
  const title = source?.name ?? skill?.name ?? blueprint?.name ?? technology?.name ?? "";
  const summary = source?.summary ?? skill?.description ?? blueprint?.problem ?? technology?.summary ?? "";
  const detailHref = source ? `${base}/sources/${source.id}/` : skill ? `${base}/skills/${skill.id}/` : blueprint ? `${base}/blueprints/${blueprint.id}/` : technology ? `${base}/technologies/#${technology.id}` : "#";

  return <dialog
    ref={dialogRef}
    class="registry-dialog"
    aria-labelledby="registry-dialog-title"
    onCancel={(event) => { event.preventDefault(); onRequestClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onRequestClose(); }}
  >
    {view && <div class="registry-dialog-card">
      <div class="registry-record-tab" aria-label="기록 상태">
        <span>{view.kind} / {kindLabels[view.kind]}</span><code>{view.id}</code><strong>{states[view.kind]}</strong>
      </div>
      <button class="registry-dialog-close" type="button" onClick={onRequestClose} aria-label="대화상자 닫기">×</button>
      <header><p class="record-kicker">{kindLabels[view.kind]} 핵심 기록</p><h2 id="registry-dialog-title">{title}</h2><p>{summary}</p></header>
      <dl class="registry-dialog-facts">
        {source && <>
          <div><dt>운영기관</dt><dd>{source.operator}</dd></div><div><dt>인증</dt><dd>{source.auth}</dd></div><div><dt>갱신</dt><dd>{source.updateFrequency}</dd></div><div><dt>형식</dt><dd>{source.formats.join(" · ")}</dd></div>
          <RelationList title="연결 항목" items={[
            ...catalog.skills.filter((item) => item.sourceIds.includes(source.id)).map((item) => ({ id: item.id, name: item.name, href: `${base}/skills/${item.id}/` })),
            ...catalog.blueprints.filter((item) => item.sourceIds.includes(source.id)).map((item) => ({ id: item.id, name: item.name, href: `${base}/blueprints/${item.id}/` })),
          ]} />
        </>}
        {skill && <>
          <div><dt>분류</dt><dd>{formatSkillCategory(skill.category)}</dd></div><div><dt>실행 환경</dt><dd>{skill.runtimes.join(" · ") || "문서 확인"}</dd></div><div><dt>인증 단서</dt><dd>{skill.auth.join(" · ") || "없음"}</dd></div>
          <RelationList title="연결 정보원" items={catalog.sources.filter((item) => skill.sourceIds.includes(item.id)).map((item) => ({ id: item.id, name: item.name, href: `${base}/sources/${item.id}/` }))} />
        </>}
        {blueprint && <>
          <div><dt>주요 출력</dt><dd>{blueprint.outputs[0]}</dd></div><div><dt>정보원</dt><dd>{blueprint.sourceIds.length}개 조합</dd></div>
          <RelationList title="연결 정보원" items={catalog.sources.filter((item) => blueprint.sourceIds.includes(item.id)).map((item) => ({ id: item.id, name: item.name, href: `${base}/sources/${item.id}/` }))} />
        </>}
        {technology && <>
          <div><dt>분류</dt><dd>{formatTechnologyCategory(technology.category)}</dd></div><div><dt>정보원</dt><dd>{catalog.sources.filter((item) => item.technologyIds.includes(technology.id)).length}개</dd></div><div><dt>k-skill</dt><dd>{catalog.skills.filter((item) => item.technologyIds.includes(technology.id)).length}개</dd></div>
          <RelationList title="연결 정보원" items={catalog.sources.filter((item) => item.technologyIds.includes(technology.id)).map((item) => ({ id: item.id, name: item.name, href: `${base}/sources/${item.id}/` }))} />
        </>}
      </dl>
      <footer>
        {source && <><a href={source.officialUrl}>공식 서비스 ↗</a><a href={source.docsUrl}>개발 문서 ↗</a></>}
        {skill && <a href={skill.upstreamUrl}>공식 원문 ↗</a>}
        <a class="button primary" href={detailHref}>전체 상세 보기</a>
      </footer>
    </div>}
  </dialog>;
}
