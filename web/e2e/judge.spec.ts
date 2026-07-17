import { expect, test } from "@playwright/test";

test.describe("Judge E2E", () => {
  test("review-only 作品不会向未登录访客暴露", async ({ page }) => {
    const response = await page.goto("/works/work-localjoy/judge");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  });

  test("已分配 Judge 可从 Console 提交并持久化评审", async ({ page }) => {
    await page.goto("/api/debug/login?user=judge");
    await expect(page).toHaveURL(/\/console/);
    await expect(page.getByRole("heading", { name: "Judge View" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Organizer View" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "账号与角色资格管理" })).toHaveCount(0);

    await page.locator(".table-row", { hasText: "LocalJoy Agent" }).getByRole("link", { name: "Open Judge View" }).click();
    await expect(page).toHaveURL(/\/works\/work-localjoy\/judge$/);
    await expect(page.getByTestId("authenticated-app-shell")).toBeVisible();
    await expect(page.locator('aside[aria-label="Judge 主导航"]')).toBeVisible();
    await expect(page.locator("header.deck-header")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Judge View", exact: true })).toBeVisible();
    await expect(page.getByTestId("judge-assigned-work")).toContainText("LocalJoy Agent");
    await expect(page.getByTestId("judge-assigned-work")).toContainText("cost_watch");
    await expect(page.getByTestId("judge-work-version")).toContainText("v1");
    await expect(page.getByTestId("judge-work-version")).toContainText("3".repeat(40));

    await page.getByLabel("score_result").fill("93");
    await page.getByLabel("score_riding").fill("89");
    await page.getByLabel("comments").fill("E2E: 路线验证完整，风险说明清晰。");
    await page.getByRole("button", { name: "提交评审" }).click();

    await expect(page).toHaveURL(/\/works\/work-localjoy\/judge\?action=judging-submitted&entityId=/);
    await expect(page.getByTestId("judge-save-confirmation")).toBeVisible();
    await expect(page.getByLabel("score_result")).toHaveValue("93");
    await expect(page.getByLabel("score_riding")).toHaveValue("89");
    await expect(page.getByLabel("comments")).toHaveValue("E2E: 路线验证完整，风险说明清晰。");

    await page.reload();
    await expect(page.getByLabel("score_result")).toHaveValue("93");
    await expect(page.getByText("当前记录：reviewed / submitted", { exact: true })).toBeVisible();

    await page.goto("/works/work-gba-wander");
    await expect(page.locator("header.deck-header")).toBeVisible();
    await expect(page.getByTestId("authenticated-app-shell")).toHaveCount(0);
  });
});
