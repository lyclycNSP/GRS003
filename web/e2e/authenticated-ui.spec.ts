import { expect, test } from "@playwright/test";

type Box = { x: number; y: number; width: number; height: number };

async function wheelAuthenticatedContent(page: import("@playwright/test").Page) {
  const content = page.getByTestId("app-shell-content");
  await expect(content).toBeVisible();
  const metrics = await content.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      overflowY: style.overflowY,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      scrollTop: element.scrollTop
    };
  });
  expect(metrics.overflowY).toBe("auto");
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(metrics.scrollTop).toBe(0);
  const box = await content.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + Math.min(box!.height / 2, 260));
  await page.mouse.wheel(0, 900);
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
}

function expectSameBox(actual: Box | null, expected: Box | null) {
  expect(actual).toBeTruthy();
  expect(expected).toBeTruthy();
  expect(actual!.x).toBeCloseTo(expected!.x, 1);
  expect(actual!.y).toBeCloseTo(expected!.y, 1);
  expect(actual!.width).toBeCloseTo(expected!.width, 1);
  expect(actual!.height).toBeCloseTo(expected!.height, 1);
}

async function expectSingleAuthenticatedShell(page: import("@playwright/test").Page, role: string) {
  await expect(page.getByTestId("authenticated-app-shell")).toHaveCount(1);
  await expect(page.getByTestId("authenticated-app-shell")).toBeVisible();
  await expect(page.getByTestId("workspace-shell")).toHaveCount(1);
  await expect(page.getByTestId("workspace-shell")).toBeVisible();
  await expect(page.locator(`aside[aria-label="${role} 主导航"]`)).toHaveCount(1);
  await expect(page.locator("header.deck-header")).toHaveCount(0);
}

test("single-role account keeps a visible role control without exposing unavailable roles", async ({ page }) => {
  await page.goto("/api/debug/login?user=rider");
  await expect(page).toHaveURL(/\/console\/rider/);
  await expectSingleAuthenticatedShell(page, "Rider");
  const switcher = page.getByTestId("role-switcher");
  await expect(switcher).toBeVisible();
  await switcher.locator("summary").click();
  await expect(switcher.getByRole("button", { name: "rider" })).toBeDisabled();
  await expect(switcher.getByRole("button", { name: "admin" })).toHaveCount(0);
  await expect(switcher.getByRole("button", { name: "judge" })).toHaveCount(0);
  await expect(switcher.getByRole("button", { name: "organizer" })).toHaveCount(0);
});

test("账号与角色资料编辑器共享持久认证外壳", async ({ page }) => {
  await page.goto("/api/debug/login?user=organizer");
  const sidebar = page.locator('aside[aria-label="Organizer 主导航"]');
  await sidebar.getByRole("link", { name: "账号设置" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expectSingleAuthenticatedShell(page, "Organizer");
  await expect(page.getByTestId("profile-form")).toBeVisible();
  await expect(page.getByLabel("展示名")).toBeVisible();
  await expect(page.locator('select[name="email"]')).toBeVisible();

  for (const role of ["rider", "judge", "organizer"]) {
    await page.goto(`/onboarding/${role}`);
    await expectSingleAuthenticatedShell(page, "Organizer");
    await expect(page.getByTestId("profile-form")).toBeVisible();
    const roleLabel = role[0].toUpperCase() + role.slice(1);
    await expect(page.getByRole("heading", { level: 1, name: `管理 ${roleLabel} 资料`, exact: true })).toBeVisible();
  }
});

test("四角色首页只渲染一个 authenticated app shell", async ({ page }) => {
  const roles = [
    { user: "organizer", role: "organizer", label: "Organizer" },
    { user: "rider", role: "rider", label: "Rider" },
    { user: "judge", role: "judge", label: "Judge" },
    { user: "admin", role: "admin", label: "Admin" }
  ];

  for (const item of roles) {
    await page.goto(`/api/debug/login?user=${item.user}`);
    await expect(page).toHaveURL(new RegExp(`/console/${item.role}`));
    await expectSingleAuthenticatedShell(page, item.label);
    await expect(page.getByTestId("role-switcher")).toBeVisible();
  }
});

test("登录用户浏览公共页面时使用公共顶栏并可返回工作台", async ({ page }) => {
  await page.goto("/api/debug/login?user=rider");
  await expectSingleAuthenticatedShell(page, "Rider");
  const sidebar = page.locator('aside[aria-label="Rider 主导航"]');
  for (const name of ["赛事中心", "Works", "Riders", "合作与赞助"]) await expect(sidebar.getByRole("link", { name, exact: true })).toHaveCount(0);

  for (const deepLink of [
    "/races/bay-area-happy-trip",
    "/works/work-gba-wander",
    "/riders/mira-chen"
  ]) {
    await page.goto(deepLink);
    const header = page.locator('header[aria-label="ARY navigation"]');
    await expect(header).toBeVisible();
    await expect(header.getByRole("link", { name: "工作台", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: "退出", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "登录", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("authenticated-app-shell")).toHaveCount(0);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${deepLink.replaceAll("/", "\\/")}$`));
    await expect(page.locator('header[aria-label="ARY navigation"]')).toBeVisible();
  }
  await page.locator('header[aria-label="ARY navigation"]').getByRole("link", { name: "工作台", exact: true }).click();
  await expect(page).toHaveURL(/\/console\/rider$/);
  await expectSingleAuthenticatedShell(page, "Rider");
});

test("Organizer Race 上下文工具链接始终携带 raceId", async ({ page }) => {
  await page.goto("/api/debug/login?user=organizer");
  await expect(page).toHaveURL(/\/console\/organizer$/);
  await expectSingleAuthenticatedShell(page, "Organizer");
  let sidebar = page.locator('aside[aria-label="Organizer 主导航"]');
  await expect(sidebar.getByRole("link", { name: "Risk Center" })).toHaveCount(0);

  await page.getByTestId("organizer-race-card-race_bay_2026").getByRole("link", { name: /进入赛事/ }).click();
  await expect(page).toHaveURL(/\/console\/organizer\/races\/race_bay_2026$/);
  await expectSingleAuthenticatedShell(page, "Organizer");
  sidebar = page.locator('aside[aria-label="Organizer 主导航"]');

  const links = [
    ["Race Workspace", "/console/organizer/races/race_bay_2026"],
    ["Risk Center", "/console/risk-center?raceId=race_bay_2026"],
    ["Screen Console", "/screen?raceId=race_bay_2026"],
    ["Track Management", "/console/tracks?raceId=race_bay_2026"],
    ["Ops", "/ops?raceId=race_bay_2026"]
  ] as const;
  for (const [name, href] of links) {
    await expect(sidebar.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }

  await sidebar.getByRole("link", { name: "Risk Center", exact: true }).click();
  await expect(page).toHaveURL(/\/console\/risk-center\?raceId=race_bay_2026$/);
  await expect(page.getByTestId("risk-center-workspace")).toBeVisible();
  await page.reload();
  await expectSingleAuthenticatedShell(page, "Organizer");
  await expect(page.locator('aside[aria-label="Organizer 主导航"]').getByRole("link", { name: "Ops", exact: true }))
    .toHaveAttribute("href", "/ops?raceId=race_bay_2026");
});

test("PC 视口下认证外壳无横向溢出并保留既有移动基线", async ({ page }) => {
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/api/debug/login?user=rider");
    await page.goto("/works");
    await expect(page.locator('header[aria-label="ARY navigation"]')).toBeVisible();
    await expect(page.getByTestId("authenticated-app-shell")).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/api/debug/login?user=rider");
  await expect(page).toHaveURL(/\/console\/rider/);
  await expect(page.getByTestId("authenticated-app-shell")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("认证工作台由右侧内容区响应真实滚轮且侧栏与顶栏保持固定", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 560 });
  await page.goto("/api/debug/login?user=rider");
  await expectSingleAuthenticatedShell(page, "Rider");

  const sidebar = page.locator('aside[aria-label="Rider 主导航"]');
  const topbar = page.getByTestId("workspace-shell").locator("header").first();
  const sidebarBefore = await sidebar.boundingBox();
  const topbarBefore = await topbar.boundingBox();
  await wheelAuthenticatedContent(page);
  expectSameBox(await sidebar.boundingBox(), sidebarBefore);
  expectSameBox(await topbar.boundingBox(), topbarBefore);

  await page.goto("/profile");
  await page.reload();
  await expect(page).toHaveURL(/\/profile$/);
  await expectSingleAuthenticatedShell(page, "Rider");
  await wheelAuthenticatedContent(page);
});

test("未登录公共长页继续由文档响应真实滚轮", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 560 } });
  const page = await context.newPage();
  await page.goto("/works");
  await expect(page.getByTestId("authenticated-app-shell")).toHaveCount(0);
  const metrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    scrollY: window.scrollY
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(metrics.scrollY).toBe(0);
  await page.mouse.move(900, 400);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await context.close();
});
