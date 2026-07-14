import { expect, test } from "@playwright/test";

test.describe("Rider E2E", () => {
  test("Rider 可提交不可变版本并在全场锁定后停止改稿", async ({ page }) => {
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
    await workForm.getByLabel("Title").fill("Rejected Repository");
    await workForm.getByLabel("Summary").fill("Server Action 必须拒绝非 GitHub 仓库。");
    await workForm.getByLabel("Repo URL").fill("https://example.com/not-github");
    await workForm.getByLabel("Commit SHA").fill("f".repeat(40));
    await workForm.getByRole("button", { name: "提交 Work" }).click();
    await expect(page.getByRole("status")).toContainText("GitHub");
    await expect(page.getByTestId("rider-work-status")).toContainText("none");

    await workForm.getByLabel("Title").fill("E2E Rider Route Lab");
    await workForm.getByLabel("Summary").fill("E2E Rider 提交的路线约束与纠偏说明。");
    await workForm.getByLabel("Demo URL").fill("https://example.com/e2e-rider-demo");
    await workForm.getByLabel("Repo URL").fill("https://github.com/example/e2e-rider");
    await workForm.getByLabel("Commit SHA").fill("1".repeat(40));
    await workForm.getByRole("button", { name: "提交 Work" }).click();

    await expect(page.getByTestId("rider-work-status")).toContainText("submitted");
    await expect(page.getByTestId("rider-work-status")).toContainText("E2E Rider Route Lab");
    await expect(page.getByTestId("rider-work-version")).toContainText("v1");

    await workForm.getByLabel("Title").fill("E2E Rider Route Lab v2");
    await workForm.getByLabel("Commit SHA").fill("2".repeat(40));
    await workForm.getByRole("button", { name: "提交 Work" }).click();
    await expect(page.getByTestId("rider-work-version")).toContainText("v2");
    await expect(page.getByTestId("rider-work-integrity")).toContainText("2".repeat(40));
    await page.reload();
    await expect(page.getByTestId("rider-project-status")).toContainText("active");
    await expect(page.getByTestId("rider-work-form").getByLabel("Title")).toHaveValue("E2E Rider Route Lab v2");

    await page.goto("/api/debug/login?user=organizer");
    await page.goto("/console?raceId=race_submission_e2e");
    await expect(page.getByTestId("submission-work-counts")).toContainText("1 submitted / 1 versioned / 0 legacy");
    const lockForm = page.getByTestId("submission-lock-form");
    await lockForm.getByLabel("关闭原因").fill("材料已齐，进入评审");
    await lockForm.getByRole("button", { name: "提前关闭全场提交" }).click();
    await expect(page.getByTestId("submission-window-state")).toContainText("closed_manually");

    await page.goto("/api/debug/login?user=rider_e2e");
    const lockedWorkForm = page.getByTestId("rider-work-form");
    const lockedSubmit = lockedWorkForm.getByRole("button", { name: "提交 Work" });
    await expect(lockedSubmit).toBeDisabled();
    await expect(page.getByTestId("rider-work-version")).toContainText("材料已齐，进入评审");
    await lockedWorkForm.getByLabel("Title").fill("Bypass UI Lock");
    await lockedWorkForm.getByLabel("Commit SHA").fill("3".repeat(40));
    await lockedSubmit.evaluate((button) => button.removeAttribute("disabled"));
    await lockedSubmit.click();
    await expect(page.getByRole("status")).toContainText("closed_manually");
    await expect(page.getByTestId("rider-work-version")).toContainText("v2");
  });
});
