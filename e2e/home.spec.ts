import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("registry categories use Korean labels without changing filter values", async ({ page }) => {
  await page.goto("./sources/");
  const domain = page.getByRole("combobox", { name: "분야", exact: true });
  await expect(domain.getByRole("option", { name: "교통" })).toHaveAttribute("value", "mobility");
  await domain.selectOption("mobility");
  await expect(page.getByRole("table", { name: "정보원 레지스트리" })).toContainText("교통");
  await expect(page.getByRole("table", { name: "정보원 레지스트리" })).not.toContainText("mobility");

  await page.goto("./technologies/");
  await expect(page.getByRole("table", { name: "기술 레지스트리" })).toContainText("프로토콜");

  await page.goto("./skills/");
  const category = page.getByRole("combobox", { name: "분류", exact: true });
  await expect(category.getByRole("option", { name: "법률 문서" })).toHaveAttribute("value", "legal-documents");
});

test("search, compound filters, and home selection stay connected", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("통합 검색").fill("미세먼지");
  await expect(page.getByRole("table", { name: "정보원 레지스트리" }).getByRole("link", { name: "에어코리아" })).toBeVisible();
  await page.getByLabel("통합 검색").fill("");
  await page.getByRole("combobox", { name: "분야", exact: true }).selectOption("mobility");
  await page.getByRole("combobox", { name: "실시간성", exact: true }).selectOption("realtime");
  await page.getByRole("button", { name: "관계도" }).click();
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
  await expect(page.locator(".table-scroll thead th").first()).toHaveCSS("position", "sticky");
  await expect(page.locator(".table-scroll tbody th").first()).toHaveCSS("position", "sticky");
  await page.getByRole("link", { name: "기상청" }).click();
  await expect(page.getByRole("dialog")).toContainText("weather-kma");
});

test("blueprint code can be copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./blueprints/commute-condition/");
  await page.getByText("최소 서버 호출 예제").click();
  await page.getByRole("button", { name: "코드 복사" }).first().click();
  await expect(page.getByRole("button", { name: "복사됨" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("process.env.DATA_GO_KR_API_KEY");
});

test("keyboard users can select a home node", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "SVG home map is intentionally replaced by a list on mobile");
  await page.goto("./");
  await page.getByRole("button", { name: "관계도" }).click();
  const node = page.locator(".home-node").filter({ hasText: "에어코리아" });
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(node).toHaveAttribute("aria-pressed", "true");
});

test("mobile uses the equivalent text list", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only layout assertion");
  await page.goto("./");
  await page.getByRole("button", { name: "관계도" }).click();
  await expect(page.locator(".home-map")).toBeHidden();
  await expect(page.getByLabel("노선도의 텍스트 대체 목록")).toBeVisible();
});

test("home has no critical accessibility violations", async ({ page }) => {
  await page.goto("./");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical")).toEqual([]);
});

for (const registry of [
  { path: "./sources/", name: "기상청", kind: "source" },
  { path: "./skills/", name: "assembly-bill-vote-search", kind: "skill" },
  { path: "./blueprints/", name: "출퇴근 컨디션", kind: "blueprint" },
  { path: "./technologies/", name: "REST API", kind: "technology" },
] as const) {
  test(`${registry.kind} row opens a URL-backed registry dialog`, async ({ page }) => {
    await page.goto(registry.path);
    const trigger = page.getByRole("link", { name: registry.name }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(registry.kind);
    await expect(page).toHaveURL(new RegExp(`view=${registry.kind}%3A|view=${registry.kind}:`));
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test("direct modal URL restores, outside click closes, and history reopens it", async ({ page }) => {
  await page.goto("./sources/?view=source:weather-kma");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("기상청");
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await page.goBack();
  await expect(dialog).toContainText("기상청");
});

test("browser back closes a row dialog and restores its trigger focus", async ({ page }) => {
  await page.goto("./sources/");
  const trigger = page.getByRole("link", { name: "기상청" }).first();
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("home defaults to the list and keeps the relationship view filtered", async ({ page }, testInfo) => {
  await page.goto("./");
  await expect(page.getByRole("table", { name: "정보원 레지스트리" })).toBeVisible();
  await page.getByLabel("통합 검색").fill("미세먼지");
  await page.getByRole("button", { name: "관계도" }).click();
  if (testInfo.project.name === "mobile") await expect(page.getByLabel("노선도의 텍스트 대체 목록")).toBeVisible();
  else await expect(page.getByLabel("한국 외부 정보원 관계 노선도")).toBeVisible();
  await expect(page.locator(".home-node.active")).toHaveCount(1);
});

test("desktop registry keeps a one-line title and at least ten rows above the fold", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop density assertion");
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("./sources/");
  await expect(page.locator(".page-header h1")).toHaveCSS("white-space", "nowrap");
  const titleSize = Number.parseFloat(await page.locator(".page-header h1").evaluate((element) => getComputedStyle(element).fontSize));
  expect(titleSize).toBeGreaterThanOrEqual(28);
  expect(titleSize).toBeLessThanOrEqual(32);
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(14);
  expect((await rows.first().boundingBox())?.height).toBeGreaterThanOrEqual(40);
  expect((await rows.first().boundingBox())?.height).toBeLessThanOrEqual(44);
  expect(await rows.nth(9).boundingBox()).toMatchObject({ y: expect.any(Number) });
  expect((await rows.nth(9).boundingBox())?.y).toBeLessThan(768);
});

test("mobile registry and full-screen dialog do not overflow horizontally", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only density assertion");
  await page.goto("./sources/");
  await page.getByRole("link", { name: "기상청" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.getByRole("dialog").boundingBox()).toMatchObject({ x: 0, y: 0, width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical")).toEqual([]);
});
