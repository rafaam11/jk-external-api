import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = resolve(root, "apps/site");
const docsDir = resolve(root, "docs");
const baseURL = "http://127.0.0.1:4321/jk-external-api/";

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function captureHome(page) {
  await page.goto("./");
  await page.getByLabel("통합 검색").fill("미세먼지");
  await page.getByLabel("통합 검색").fill("");
  await page.getByRole("combobox", { name: "분야", exact: true }).selectOption("mobility");
  await page.getByRole("combobox", { name: "실시간성", exact: true }).selectOption("realtime");
  await page.getByRole("button", { name: "관계도" }).click();
  await page.getByRole("button", { name: /TAGO/ }).first().click();
  await page.getByRole("complementary").last().getByRole("heading", { name: "TAGO 국가대중교통정보" }).waitFor({ state: "visible" });
  await page.screenshot({ path: resolve(docsDir, "preview-home.png") });
}

async function captureCompare(page) {
  await page.goto("./compare/?ids=weather-kma,airkorea,tago,topis");
  await page.locator("thead th").first().waitFor({ state: "visible" });
  await page.screenshot({ path: resolve(docsDir, "preview-compare.png") });
}

async function captureSourceDetail(page) {
  await page.goto("./sources/weather-kma/");
  await page.getByRole("heading", { level: 1, name: "기상청" }).waitFor({ state: "visible" });
  await page.screenshot({ path: resolve(docsDir, "preview-source-detail.png") });
}

await mkdir(docsDir, { recursive: true });

const server = spawn("node", ["node_modules/astro/astro.js", "preview", "--host", "127.0.0.1", "--port", "4321"], {
  cwd: siteDir,
  stdio: "pipe",
});
server.on("error", (error) => {
  console.error("Failed to start preview server:", error);
  process.exit(1);
});

try {
  await waitForServer(baseURL, 30_000);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", baseURL });
  const page = await context.newPage();

  await captureHome(page);
  await captureCompare(page);
  await captureSourceDetail(page);

  await browser.close();
  console.log(`Saved screenshots to ${docsDir}`);
} finally {
  server.kill();
}
