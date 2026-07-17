import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://127.0.0.1:4321/jk-external-api/", trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { viewport: { width: 360, height: 800 }, isMobile: true } },
  ],
  webServer: {
    command: "node node_modules/astro/astro.js preview --host 127.0.0.1 --port 4321",
    cwd: "apps/site",
    url: "http://127.0.0.1:4321/jk-external-api/",
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 120_000,
  },
});
