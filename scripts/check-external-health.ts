import { catalog } from "../packages/catalog/src/catalog.js";

const failures: string[] = [];
for (const source of catalog.sources) {
  try {
    const response = await fetch(source.officialUrl, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!response.ok && response.status !== 405) failures.push(`${source.id}: ${response.status}`);
  } catch (error) { failures.push(`${source.id}: ${error instanceof Error ? error.message : "request failed"}`); }
}
const previewBase = process.env.PUBLIC_PREVIEW_API_BASE_URL;
if (previewBase) {
  try { const response = await fetch(`${previewBase.replace(/\/$/, "")}/v1/health`, { signal: AbortSignal.timeout(10_000) }); if (!response.ok) failures.push(`preview: ${response.status}`); }
  catch (error) { failures.push(`preview: ${error instanceof Error ? error.message : "request failed"}`); }
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Checked ${catalog.sources.length} official links${previewBase ? " and preview health" : ""}.`);
