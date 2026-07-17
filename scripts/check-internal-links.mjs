import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/site/dist");
const htmlFiles = [];
async function walk(directory) { for (const entry of await readdir(directory, { withFileTypes: true })) { const path = join(directory, entry.name); if (entry.isDirectory()) await walk(path); else if (entry.name.endsWith(".html")) htmlFiles.push(path); } }
await walk(root);
const failures = [];
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(/href="(\/jk-external-api\/[^"#?]*)/g)) {
    const href = match[1]; if (!href) continue;
    const relative = decodeURIComponent(href.replace(/^\/jk-external-api\/?/, ""));
    const target = relative.endsWith("/") ? join(root, relative, "index.html") : join(root, relative);
    try { await access(target); } catch { failures.push(`${file}: ${href}`); }
  }
}
if (failures.length) { console.error(`Broken internal links:\n${failures.join("\n")}`); process.exit(1); }
console.log(`Checked ${htmlFiles.length} HTML files; all internal links resolve.`);
