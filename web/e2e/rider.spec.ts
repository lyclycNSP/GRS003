import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

async function validPdf() { const document = await PDFDocument.create(); document.addPage(); return Buffer.from(await document.save()); }

test.describe("Rider E2E", () => {
  test("Rider Portfolio 展示全部参赛赛事并进入独立赛事空间", async ({ page }) => {
    await page.goto("/api/debug/login?user=rider");
    await page.goto("/console/rider");
    await expect(page.getByTestId("rider-portfolio")).toBeVisible();
    await expect(page.getByTestId("rider-race-card-race_bay_2026")).toBeVisible();
    await expect(page.getByTestId("rider-race-card-race_genesis_2026")).toBeVisible();
    await page.getByTestId("rider-race-card-race_genesis_2026").getByRole("link", { name: "进入赛事空间" }).click();
    await expect(page).toHaveURL(/\/console\/rider\/races\/race_genesis_2026$/);
  });

  test("Rider 可提交不可变版本并在全场锁定后停止改稿", async ({ page }) => {
    await page.goto("/api/debug/login?user=rider_e2e");
    await expect(page).toHaveURL(/\/console/);
    await expect(page.getByRole("heading", { name: "Rider View" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Organizer View" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Judge View" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "账号与角色资格管理" })).toHaveCount(0);

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
    await expect(page.getByTestId("console-action-error")).toContainText("GitHub");
    await expect(page.getByTestId("rider-work-status")).toContainText("none");

    await workForm.getByLabel("Title").fill("E2E Rider Route Lab");
    await workForm.getByLabel("Summary").fill("E2E Rider 提交的路线约束与纠偏说明。");
    await workForm.getByLabel("Demo URL").fill("https://example.com/e2e-rider-demo");
    await workForm.getByLabel("Repo URL").fill("https://github.com/example/e2e-rider");
    await workForm.getByLabel("Commit SHA").fill("1".repeat(40));
    await workForm.getByRole("button", { name: "提交 Work" }).click();

    await expect(page.getByTestId("rider-race-action-outcome")).toContainText("赛事空间已更新");
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
    await expect(page.getByTestId("console-action-error")).toContainText("closed_manually");
    await expect(page.getByTestId("rider-work-version")).toContainText("v2");
  });

  test("Organizer 发布后 Race 出现在主页，Rider 报名获得明确反馈", async ({ page }) => {
    const raceTitle = `Registration Flow ${Date.now()}`;
    await page.goto("/api/debug/login?user=organizer");
    const createForm = page.getByTestId("organizer-race-create-form");
    await createForm.getByLabel("赛事名 *").fill(raceTitle);
    await createForm.getByLabel("挑战说明 *").fill("验证公开展示和 Rider 报名反馈。");
    await createForm.getByLabel("赛事摘要").fill("报名闭环 E2E。");
    await createForm.getByLabel("赛题 PDF（可选）").setInputFiles({ name: "rider-problem.pdf", mimeType: "application/pdf", buffer: await validPdf() });
    await createForm.getByRole("button", { name: "创建 Race" }).click();
    await expect(page).toHaveURL(/action=race-created&entityId=/, { timeout: 15_000 });
    await expect(page.locator('[data-action-code="race-created"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("console-current-race-status")).toHaveText("draft", { timeout: 15_000 });
    const identity = await page.getByTestId("console-current-race-identity").innerText();
    const raceSlug = identity.split("/").at(-1)?.trim();
    expect(raceSlug).toBeTruthy();

    await page.getByRole("button", { name: "发布当前 Race" }).click();
    await expect(page).toHaveURL(/action=race-published&entityId=/);
    const publishOutcome = page.locator('[data-action-code="race-published"]');
    await expect(publishOutcome).toContainText("Race 已发布到公共赛事中心");
    await expect(publishOutcome).toContainText("Race ID");
    await expect(page.getByTestId("console-current-race-status")).toHaveText("running");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: raceTitle, exact: true })).toBeVisible();

    await page.goto("/api/debug/login?user=rider");
    await page.goto(`/races/${raceSlug}`);
    await expect(page.getByTestId("registration-open")).toBeVisible();
    await page.getByTestId("registration-open").click();
    await expect(page.getByTestId("registration-dialog")).toBeVisible();
    await page.getByTestId("registration-submit").click();
    await expect(page).toHaveURL(/registrationMessage=/);
    await expect(page.getByTestId("registration-message")).toContainText("报名已提交");
    await expect(page.getByTestId("registration-state")).toContainText("pending");
    await expect(page.getByText("1 位 Rider", { exact: true })).toBeVisible();
    await expect(page.getByTestId("registration-open")).toHaveCount(0);
    await page.goto("/console/rider");
    const raceId = await page.locator(`[data-testid^="rider-race-card-"]`).filter({ hasText: raceTitle }).getAttribute("data-testid");
    expect(raceId).toBeTruthy();
    await page.getByTestId(raceId!).getByRole("link", { name: "进入赛事空间" }).click();
    const problem = page.getByTestId("rider-race-problem-download");
    await expect(problem).toContainText("rider-problem.pdf");
    const problemResponse = await page.request.get(await problem.getByRole("link", { name: "下载赛题 PDF" }).getAttribute("href") ?? "");
    expect(problemResponse.status()).toBe(200);
    expect(problemResponse.headers()["content-disposition"]).toContain("attachment");
  });

  test("Rider 可从 Race Page 创建团队并进入队长赛事空间", async ({ page }) => {
    const raceTitle = `Team Dialog ${Date.now()}`;
    await page.goto("/api/debug/login?user=organizer");
    const createForm = page.getByTestId("organizer-race-create-form");
    await createForm.getByLabel("赛事名 *").fill(raceTitle);
    await createForm.getByLabel("挑战说明 *").fill("验证团队报名弹窗。 ");
    await createForm.getByRole("button", { name: "创建 Race" }).click();
    const identity = await page.getByTestId("console-current-race-identity").innerText();
    const raceSlug = identity.split("/").at(-1)?.trim();
    await page.getByRole("button", { name: "发布当前 Race" }).click();

    await page.goto("/api/debug/login?user=rider");
    await page.goto(`/races/${raceSlug}`);
    await page.getByTestId("registration-open").click();
    await page.getByRole("tab", { name: "创建团队" }).click();
    const dialog = page.getByTestId("registration-dialog");
    await dialog.getByLabel("团队名称 *").fill("Blue Orbit Team");
    await dialog.getByLabel("团队简介").fill("专注可信赛事 Agent。 ");
    await dialog.getByLabel("人数上限 *").fill("5");
    await page.getByTestId("team-create-submit").click();
    await expect(page).toHaveURL(/\/console\/rider\?raceId=/);
    await expect(page.getByTestId("rider-team-panel")).toContainText("Blue Orbit Team");
    await expect(page.getByTestId("rider-team-panel")).toContainText("队长");
    await expect(page.getByTestId("team-invite-code")).toBeVisible();
  });
});
