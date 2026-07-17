import { expect, test } from "@playwright/test";

test.describe("Public E2E", () => {
  test("首页精选赛事支持箭头与圆点切换", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByTestId("home-hero-carousel");
    await expect(carousel).toBeVisible();
    const firstTitle = await carousel.getByRole("heading", { level: 1 }).innerText();
    const dots = carousel.getByRole("tab");
    expect(await dots.count()).toBeGreaterThan(1);
    await carousel.getByRole("button", { name: "下一场赛事" }).click();
    await expect(carousel.getByRole("heading", { level: 1 })).not.toHaveText(firstTitle);
    // The carousel intentionally locks repeated input during its visible 520 ms slide.
    await page.waitForTimeout(650);
    await dots.first().click();
    await page.waitForTimeout(650);
    await expect(carousel.getByRole("heading", { level: 1 })).toHaveText(firstTitle);
  });

  test("未登录公共页面使用公共顶栏而非认证侧栏", async ({ page }) => {
    await page.goto("/");
    const publicHeader = page.locator('header[aria-label="ARY navigation"]');
    await expect(publicHeader).toHaveCount(1);
    await expect(publicHeader.getByRole("navigation", { name: "公共站点导航" })).toBeVisible();
    await expect(publicHeader.getByRole("link", { name: "登录", exact: true })).toBeVisible();
    await expect(page.getByTestId("authenticated-app-shell")).toHaveCount(0);
    await expect(page.getByTestId("workspace-shell")).toHaveCount(0);
    await expect(page.getByTestId("role-switcher")).toHaveCount(0);
  });

  test("Rider 目录支持 q 与 skill 筛选且仅展示公开档案", async ({ page }) => {
    await page.goto("/riders?q=Ana");
    let directory = page.getByTestId("public-rider-directory");
    await expect(directory).toBeVisible();
    await expect(directory.getByLabel("搜索 Rider")).toHaveValue("Ana");
    await expect(directory.getByRole("heading", { name: "Ana Ruiz", exact: true })).toBeVisible();
    await expect(directory.getByRole("heading", { name: "Mira Chen", exact: true })).toHaveCount(0);

    await page.goto("/riders?skill=TypeScript");
    directory = page.getByTestId("public-rider-directory");
    await expect(directory.getByLabel("按技能筛选")).toHaveValue("TypeScript");
    await expect(directory.getByRole("heading", { name: "Mira Chen", exact: true })).toBeVisible();
    await expect(directory.getByRole("heading", { name: "Ana Ruiz", exact: true })).toHaveCount(0);

    await page.goto("/riders?q=Ana&skill=TypeScript");
    directory = page.getByTestId("public-rider-directory");
    await expect(directory.getByRole("heading", { name: "没有匹配的 Rider" })).toBeVisible();
  });

  test("公众可从 Race Gallery 观看 Live、作品、赛果和复盘", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "湾区开心游" })).toBeVisible();
    await expect(page.getByText("GBA WanderMate", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "进入 Live Hall" }).click();
    await expect(page).toHaveURL(/\/races\/bay-area-happy-trip\/live$/);
    await expect(page.getByRole("heading", { name: "湾区开心游 · 实况" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "过程榜单", exact: true })).toBeVisible();
    await expect(page.getByText("Mira Chen", { exact: true })).toBeVisible();

    await page.goto("/works");
    await expect(page.getByRole("heading", { name: "公开作品墙" })).toBeVisible();
    await expect(page.getByText("GBA WanderMate", { exact: true })).toBeVisible();
    await expect(page.getByText("LocalJoy Agent", { exact: true })).toHaveCount(0);

    await page.goto("/works/work-gba-wander");
    await expect(page.getByTestId("public-work-version")).toContainText("v1");
    await expect(page.getByTestId("public-work-version")).toContainText("1".repeat(40));

    await page.goto("/races/genesis-dogfood-race/results");
    await expect(page.getByRole("heading", { name: "创世骑行挑战赛 · 最终榜单" })).toBeVisible();
    await expect(page.getByText("最佳自举作品", { exact: false })).toBeVisible();
    await expect(page.getByText("创世骑行挑战赛从混乱起跑到作品冲线。", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "查看 Review" }).click();
    await expect(page).toHaveURL(/\/races\/genesis-dogfood-race\/review$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "创世骑行挑战赛 · 评审复盘" })).toBeVisible();
    await expect(page.getByText("评审总结已发布，包含高光案例和评委摘录。", { exact: true })).toBeVisible();
  });

  test("公共页面和 API 都不会泄露 review-only 作品", async ({ page, request }) => {
    const pageResponse = await page.goto("/works/work-localjoy");
    expect(pageResponse?.status()).toBe(404);

    const listResponse = await request.get("/api/public/works");
    expect(listResponse.ok()).toBeTruthy();
    const works = await listResponse.json() as Array<{ slug: string }>;
    expect(works.some((work) => work.slug === "work-localjoy")).toBeFalsy();

    const detailResponse = await request.get("/api/public/works/work-localjoy");
    expect(detailResponse.status()).toBe(404);
  });
});
