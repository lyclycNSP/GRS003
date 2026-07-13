import { expect, test } from "@playwright/test";

test.describe("Rider E2E", () => {
  test("Rider 可接入 CA Signal 并提交持久化 Work", async ({ page }) => {
    await page.goto("/api/debug/login?user=rider_e2e");
    await expect(page).toHaveURL(/\/console/);
    await expect(page.getByRole("heading", { name: "Rider View" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Organizer View" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Judge View" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Admin / User.roles" })).toHaveCount(0);

    await expect(page.getByTestId("rider-registration-status")).toContainText("approved");
    await expect(page.getByTestId("rider-project-status")).toContainText("connected");
    await expect(page.getByTestId("rider-work-status")).toContainText("none");

    const signalForm = page.getByTestId("rider-signal-form");
    await signalForm.getByLabel("Session ID").fill("e2e-rider-session");
    await signalForm.getByLabel("Progress %").fill("97");
    await signalForm.getByLabel("Tokens").fill("7777");
    await signalForm.getByRole("button", { name: "接入合法 CA Signal" }).click();
    await expect(page.getByTestId("rider-project-status")).toContainText("active");

    const workForm = page.getByTestId("rider-work-form");
    await workForm.getByLabel("Title").fill("E2E Rider Route Lab");
    await workForm.getByLabel("Summary").fill("E2E Rider 提交的路线约束与纠偏说明。");
    await workForm.getByLabel("Demo URL").fill("https://example.com/e2e-rider-demo");
    await workForm.getByLabel("Repo URL").fill("https://github.com/example/e2e-rider");
    await workForm.getByRole("button", { name: "提交 Work" }).click();

    await expect(page.getByTestId("rider-work-status")).toContainText("submitted");
    await expect(page.getByTestId("rider-work-status")).toContainText("E2E Rider Route Lab");
    await page.reload();
    await expect(page.getByTestId("rider-project-status")).toContainText("active");
    await expect(page.getByTestId("rider-work-form").getByLabel("Title")).toHaveValue("E2E Rider Route Lab");
  });
});
