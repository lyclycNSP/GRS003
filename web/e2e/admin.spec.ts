import { expect, test } from "@playwright/test";

test.describe("Admin E2E", () => {
  test("Admin 可维护 User.roles 并持久化", async ({ page }) => {
    await page.goto("/api/debug/login?user=admin");
    await expect(page).toHaveURL(/\/console/);
    await expect(page.getByRole("heading", { name: "Admin / User.roles" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Race 管理" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Rider View" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Judge View" })).toHaveCount(0);

    const judgeForm = page.getByTestId("admin-user-user_judge_1");
    const judgeRole = judgeForm.getByLabel("judge", { exact: true });
    const riderRole = judgeForm.getByLabel("rider", { exact: true });
    await expect(judgeRole).toBeChecked();
    await expect(riderRole).not.toBeChecked();

    await riderRole.check();
    await judgeForm.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("admin-user-user_judge_1").getByLabel("rider", { exact: true })).toBeChecked();
    await page.reload();
    await expect(page.getByTestId("admin-user-user_judge_1").getByLabel("rider", { exact: true })).toBeChecked();

    const restoredForm = page.getByTestId("admin-user-user_judge_1");
    await restoredForm.getByLabel("rider", { exact: true }).uncheck();
    await restoredForm.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("admin-user-user_judge_1").getByLabel("rider", { exact: true })).not.toBeChecked();
    await expect(page.getByTestId("admin-user-user_judge_1").getByLabel("judge", { exact: true })).toBeChecked();
  });
});
