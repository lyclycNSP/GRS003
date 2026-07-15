import { expect, test } from "@playwright/test";

test.describe("Screen E2E", () => {
  test("未登录访客只能查看 Screen 状态", async ({ page }) => {
    await page.goto("/screen");
    await expect(page.getByText("当前账号只能查看大屏状态；控制入口仅 Organizer / Admin 可用。", { exact: true })).toBeVisible();
    await expect(page.getByTestId("screen-mode-live")).toHaveCount(0);
    await expect(page.getByTestId("screen-fallback-toggle")).toHaveCount(0);
    await expect(page.getByTestId("screen-current-mode")).toHaveText("live");
  });

  test("Organizer 可切换模式，已打开的 Display 轮询同步且 fallback 不改变 mode", async ({ page, context }) => {
    await page.goto("/api/debug/login?user=organizer");
    await page.goto("/screen");
    await expect(page.getByTestId("screen-current-mode")).toHaveText("live");

    const display = await context.newPage();
    await display.goto("/screen/display");
    await expect(display.getByTestId("race-live-stage")).toBeVisible();

    await page.getByTestId("screen-mode-leaderboard").click();
    await expect(page.getByTestId("screen-current-mode")).toHaveText("leaderboard");
    await expect(display.getByText("湾区开心游 榜单", { exact: true })).toBeVisible({ timeout: 6_000 });
    await expect(display.getByText("Mira Chen", { exact: true })).toBeVisible();

    await page.getByTestId("screen-fallback-toggle").click();
    await expect(page.getByTestId("screen-output-source")).toHaveText("fallback enabled");
    await expect(display.getByText("stable fallback source", { exact: true })).toBeVisible({ timeout: 6_000 });
    await expect(display.getByText("湾区开心游 榜单", { exact: true })).toBeVisible();

    await page.getByTestId("screen-mode-live").click();
    await expect(display.getByTestId("race-live-stage")).toBeVisible({ timeout: 6_000 });
  });
});
