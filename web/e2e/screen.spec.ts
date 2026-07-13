import { expect, test } from "@playwright/test";

test.describe("Screen E2E", () => {
  test("未登录访客只能查看 Screen 状态", async ({ page }) => {
    await page.goto("/screen");
    await expect(page.getByText("当前账号只能查看大屏状态；控制入口仅 Organizer / Admin 可用。", { exact: true })).toBeVisible();
    await expect(page.getByTestId("screen-mode-live")).toHaveCount(0);
    await expect(page.getByTestId("screen-fallback-toggle")).toHaveCount(0);
    await expect(page.getByTestId("screen-current-mode")).toHaveText("live");
  });

  test("Organizer 可切换模式，Display 同步并可启用 fallback", async ({ page }) => {
    await page.goto("/api/debug/login?user=organizer");
    await page.goto("/screen");
    await expect(page.getByTestId("screen-current-mode")).toHaveText("live");

    await page.getByTestId("screen-mode-leaderboard").click();
    await expect(page.getByTestId("screen-current-mode")).toHaveText("leaderboard");
    await page.getByTestId("screen-display-link").click();
    await expect(page).toHaveURL(/\/screen\/display$/);
    await expect(page.getByTestId("screen-display-mode")).toContainText("leaderboard");
    await expect(page.getByText("Mira Chen", { exact: true })).toBeVisible();

    await page.goto("/screen");
    await page.getByTestId("screen-fallback-toggle").click();
    await expect(page.getByTestId("screen-output-source")).toHaveText("fallback enabled");
    await page.goto("/screen/display");
    await expect(page.getByTestId("screen-display-mode")).toContainText("fallback");
    await expect(page.getByRole("heading", { name: "Fallback: stable Projection / public works / announcement ready." })).toBeVisible();
  });
});
