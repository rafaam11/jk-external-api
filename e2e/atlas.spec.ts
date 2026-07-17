import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("search, compound filters, and Atlas selection stay connected", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("통합 검색").fill("미세먼지");
  await expect(page.getByRole("complementary", { name: /검색 결과/ }).getByText("에어코리아")).toBeVisible();
  await page.getByLabel("통합 검색").fill("");
  await page.getByRole("combobox", { name: "분야", exact: true }).selectOption("mobility");
  await page.getByRole("combobox", { name: "실시간성", exact: true }).selectOption("realtime");
  await page.getByRole("button", { name: /TAGO/ }).first().click();
  await expect(page.getByRole("complementary").last().getByRole("heading", { name: "TAGO 국가대중교통정보" })).toBeVisible();
});

test("direct detail links and preview fallback remain useful", async ({ page }) => {
  await page.goto("./sources/weather-kma/");
  await expect(page.getByRole("heading", { level: 1, name: "기상청" })).toBeVisible();
  await page.getByRole("button", { name: "예시 데이터 조회" }).click();
  await expect(page.getByText("NOT_CONFIGURED")).toBeVisible();
  await expect(page.getByRole("link", { name: "공식 원문 열기" })).toHaveAttribute("href", /weather\.go\.kr/);
});

test("comparison accepts four sources from a deep link", async ({ page }) => {
  await page.goto("./compare/?ids=weather-kma,airkorea,tago,topis,data-go-kr");
  await expect(page.locator("thead th")).toHaveCount(5);
  await expect(page.getByText("4/4")).toBeVisible();
});

test("blueprint code can be copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./blueprints/commute-condition/");
  await page.getByRole("button", { name: "코드 복사" }).first().click();
  await expect(page.getByRole("button", { name: "복사됨" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("process.env.DATA_GO_KR_API_KEY");
});

test("keyboard users can select an Atlas node", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "SVG Atlas is intentionally replaced by a list on mobile");
  await page.goto("./");
  const node = page.locator(".atlas-node").filter({ hasText: "에어코리아" });
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(node).toHaveAttribute("aria-pressed", "true");
});

test("mobile uses the equivalent text list", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only layout assertion");
  await page.goto("./");
  await expect(page.locator(".atlas-map")).toBeHidden();
  await expect(page.getByLabel("노선도의 텍스트 대체 목록")).toBeVisible();
});

test("home has no critical accessibility violations", async ({ page }) => {
  await page.goto("./");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical")).toEqual([]);
});
