import { useEffect, useMemo, useState } from "preact/hooks";
import type { Catalog, Source } from "@jk-external-api/catalog";
import { addToComparison, removeFromComparison } from "../lib/discovery.js";
import RegistryDialog, { useRegistryDialog } from "./RegistryDialog.js";

type Props = { catalog: Catalog; initialIds: string[]; base: string };
export default function CompareTable({ catalog, initialIds, base }: Props) {
  const { sources, technologies } = catalog;
  const [ids, setIds] = useState(initialIds.slice(0, 4));
  const dialog = useRegistryDialog(catalog);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("ids")?.split(",").filter((id) => sources.some((source) => source.id === id)).slice(0, 4) ?? [];
    if (fromUrl.length > 0) setIds(fromUrl);
  }, [sources]);
  const chosen = useMemo(() => ids.map((id) => sources.find((source) => source.id === id)).filter((source): source is Source => Boolean(source)), [ids]);
  const names = Object.fromEntries(technologies.map(({ id, name }) => [id, name]));
  return <div class="compare-builder">
    <div class="compare-picker"><label>정보원 추가<select value="" onChange={(event) => { setIds((current) => addToComparison(current, event.currentTarget.value)); event.currentTarget.value = ""; }} disabled={ids.length >= 4}><option value="">선택하세요</option>{sources.filter(({ id }) => !ids.includes(id)).map((source) => <option value={source.id}>{source.name}</option>)}</select></label><span>{ids.length}/4</span></div>
    {chosen.length === 0 ? <p class="empty-state">비교할 정보원을 최대 4개 선택하세요.</p> : <div class="table-scroll"><table><caption>선택한 정보원 비교</caption><thead><tr><th scope="col">항목</th>{chosen.map((source) => <th scope="col"><a href={`${base}/sources/${source.id}/`} onClick={(event) => { if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); dialog.open({ kind: "source", id: source.id }, event.currentTarget); }}>{source.name}</a><button class="text-button" onClick={() => setIds((current) => removeFromComparison(current, source.id))}>제거</button></th>)}</tr></thead><tbody>
      {[ ["인증", (s: Source) => s.auth], ["비용", (s: Source) => s.cost], ["형식", (s: Source) => s.formats.join(" · ")], ["갱신", (s: Source) => s.updateFrequency], ["지역", (s: Source) => s.geography.join(" · ")], ["미리보기", (s: Source) => s.previewAdapterId ?? "없음"], ["기술", (s: Source) => s.technologyIds.map((id) => names[id] ?? id).join(" · ")] ].map(([label, getter]) => <tr><th scope="row">{label as string}</th>{chosen.map((source) => <td>{(getter as (source: Source) => string)(source)}</td>)}</tr>)}
    </tbody></table></div>}
    <RegistryDialog catalog={catalog} base={base} view={dialog.view} onRequestClose={dialog.close} />
  </div>;
}
