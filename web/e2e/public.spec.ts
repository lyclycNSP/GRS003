import { expect, test } from "@playwright/test";

test.describe("Public E2E", () => {
  test("公众可从 Race Gallery 观看 Live、作品、赛果和复盘", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "湾区开心游" })).toBeVisible();
    await expect(page.getByText("GBA WanderMate", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "进入 Live Hall" }).click();
    await expect(page).toHaveURL(/\/races\/bay-area-happy-trip\/live$/);
    await expect(page.getByRole("heading", { name: "湾区开心游 正在骑行" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Current Process Leaderboard" })).toBeVisible();
    await expect(page.getByText("Mira Chen", { exact: true })).toBeVisible();

    await page.goto("/works");
    await expect(page.getByRole("heading", { name: "公开作品墙" })).toBeVisible();
    await expect(page.getByText("GBA WanderMate", { exact: true })).toBeVisible();
    await expect(page.getByText("LocalJoy Agent", { exact: true })).toHaveCount(0);

    await page.goto("/races/genesis-dogfood-race/results");
    await expect(page.getByRole("heading", { name: "创世骑行挑战赛 最终榜单" })).toBeVisible();
    await expect(page.getByText("最佳自举作品", { exact: false })).toBeVisible();
    await expect(page.getByText("创世骑行挑战赛从混乱起跑到作品冲线。", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "查看 Review" }).click();
    await expect(page).toHaveURL(/\/races\/genesis-dogfood-race\/review$/);
    await expect(page.getByRole("heading", { name: "创世骑行挑战赛 评审复盘" })).toBeVisible();
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
