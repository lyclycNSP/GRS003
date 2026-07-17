import { expect, test } from "@playwright/test";

test("Organizer 专业工具提供明确的操作状态与实体反馈", async ({ page }) => {
  await page.goto("/api/debug/login?user=organizer");

  await page.goto("/screen?raceId=race_bay_2026&prepared=1");
  await expect(page.getByTestId("action-outcome-panel")).toContainText("Race Live 已准备完成");
  await expect(page.getByTestId("screen-mode-live")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByTestId("screen-fallback-toggle")).toHaveAttribute("aria-busy", "false");

  await page.goto("/console/tracks?raceId=race_bay_2026");
  await expect(page.getByText("当前绑定：").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "绑定版本" }).first()).toHaveAttribute("aria-busy", "false");

  await page.goto("/console/risk-center?raceId=race_bay_2026&actionError=请补充处置说明");
  await expect(page.getByTestId("action-outcome-panel")).toContainText("风险状态没有更新");
  await expect(page.getByRole("button", { name: "应用筛选" })).toHaveAttribute("aria-busy", "false");
});

test("managed Race Organizer 的 Ops 操作声明可感知的 pending 状态", async ({ page }) => {
  await page.goto("/api/debug/login?user=organizer");
  await expect(page).toHaveURL(/\/console\/organizer/);
  await page.goto("/ops?raceId=race_bay_2026&action=backup-created&entityId=backup_feedback_test");
  await expect(page.getByTestId("ops-workspace")).toBeVisible();
  await expect(page.getByTestId("action-outcome-panel")).toContainText("备份记录已创建");
  await expect(page.getByTestId("action-outcome-panel")).toContainText("backup_feedback_test");
  await expect(page.getByTestId("ops-run-p0")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByTestId("ops-create-backup")).toHaveAttribute("aria-busy", "false");

  await page.goto("/ops?raceId=race_bay_2026&action=release-checklist-update-failed&actionError=Evidence%20%E4%B8%8D%E5%AE%8C%E6%95%B4");
  await expect(page.getByTestId("action-outcome-panel")).toContainText("发布检查项没有更新");
  await expect(page.getByTestId("action-outcome-panel")).toContainText("Evidence 不完整");
});
