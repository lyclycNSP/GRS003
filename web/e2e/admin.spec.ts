import { expect, test } from "@playwright/test";

test.describe("Admin E2E", () => {
  test("Admin 可置顶、隐藏并恢复首页精选赛事", async ({ page }) => {
    await page.goto("/api/debug/login?user=admin");
    await expect(page).toHaveURL(/\/console\/admin(?:\?|$)/);
    await page.route("**/console/admin**", async (route) => {
      if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 350));
      await route.continue();
    });
    const row = page.getByTestId("homepage-curation-race_finance_2026");
    const pinButton = row.getByRole("button", { name: "置顶" });
    const pinAction = pinButton.click();
    await expect(pinButton).toHaveAttribute("aria-busy", "true");
    await expect(pinButton).toContainText("置顶中");
    await pinAction;
    await expect(row).toContainText("置顶 1");
    await expect(page.getByTestId("admin-action-outcome")).toHaveAttribute("data-action-code", "curation-pinned");
    await expect(page.getByTestId("admin-action-outcome")).toContainText("赛事已加入首页精选");
    await page.goto("/");
    await expect(page.getByTestId("home-hero-carousel").getByRole("heading", { level: 1 })).toHaveText("智能投研助理");
    await page.goto("/console/admin");
    const pinnedRow = page.getByTestId("homepage-curation-race_finance_2026");
    await pinnedRow.getByRole("button", { name: "取消置顶" }).click();
    await expect(page.getByTestId("admin-action-outcome")).toHaveAttribute("data-action-code", "curation-unpinned");
    await pinnedRow.getByRole("button", { name: "隐藏" }).click();
    await expect(pinnedRow).toContainText("已隐藏");
    await expect(page.getByTestId("admin-action-outcome")).toContainText("赛事已从首页轮播隐藏");
    await pinnedRow.getByRole("button", { name: "恢复" }).click();
    await expect(pinnedRow).toContainText("自动");
    await expect(page.getByTestId("admin-action-outcome")).toContainText("赛事已恢复首页候选");
  });

  test("Admin 只管理账号与独立角色资格", async ({ page }) => {
    await page.goto("/api/debug/login?user=admin");
    await expect(page).toHaveURL(/\/console\/admin/);
    await expect(page.getByRole("heading", { name: "账号与角色资格管理" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Organizer View" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Rider View" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Judge View" })).toHaveCount(0);

    const judgeCard = page.getByTestId("admin-user-user_judge_1");
    const judgeRole = judgeCard.locator("form").filter({ has: page.getByText("Judge", { exact: true }) });
    await expect(judgeRole.getByText("active", { exact: true })).toBeVisible();
    await judgeRole.getByRole("button", { name: "停用" }).click();
    await expect(judgeRole.getByText("suspended", { exact: true })).toBeVisible();
    await expect(page.getByTestId("admin-action-outcome")).toHaveAttribute("data-action-code", "user-role-suspended");
    await expect(page.getByTestId("admin-action-outcome")).toContainText("角色资格已停用");
    await judgeRole.getByRole("button", { name: "恢复" }).click();
    await expect(judgeRole.getByText("active", { exact: true })).toBeVisible();
    await expect(page.getByTestId("admin-action-outcome")).toContainText("角色资格已恢复");
  });
});
