import { expect, test } from "@playwright/test";

test("Organizer can discover Track Management from Console", async ({ page }) => {
  await page.goto("/api/debug/login?user=organizer");
  await page.goto("/console?raceId=race_bay_2026");
  const entry = page.getByRole("link", { name: "Track Management" });
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page).toHaveURL(/\/console\/tracks\?raceId=race_bay_2026/);
  await expect(page.getByRole("link", { name: "打开 Track Calibrator" })).toBeVisible();
});

test("Rider cannot open Track Calibrator", async ({ page }) => {
  await page.goto("/api/debug/login?user=rider");
  await page.goto("/console/tracks/calibrator?raceId=race_bay_2026");
  await expect(page.getByRole("heading", { name: "无权打开 Track Calibrator" })).toBeVisible();
});

test("Organizer can use the complete Track Calibrator workbench", async ({ page }) => {
  await page.goto("/api/debug/login?user=organizer");
  await page.goto("/console/tracks/calibrator?raceId=race_bay_2026");
  await expect(page.getByTestId("import-draft")).toBeVisible();
  await expect(page.getByTestId("manual-validation-item")).toHaveCount(8);
  await page.getByTestId("reverse-direction").click();
  await page.getByTestId("undo-track-change").click();
  await page.getByTestId("redo-track-change").click();
  await page.getByTestId("preview-horse-count").selectOption("8");
  await page.getByTestId("preview-scenario").selectOption("clustered");
  await page.getByTestId("preview-progress").fill("0.72");
  await expect(page.getByTestId("track-preview-entry")).toHaveCount(8);
  await page.getByTestId("validate-track").click();
  await page.getByTestId("track-name").fill("Edited after validation");
  await expect(page.getByTestId("validation-state")).toHaveText("dirty / not validated");
});

test("Organizer draft recovery, shared preview, validation and publish", async ({ page }) => {
  await page.goto("/api/debug/login?user=organizer");
  await page.goto("/console/tracks/calibrator?raceId=race_bay_2026");
  await expect(page.getByTestId("track-preview").locator("span")).toHaveCount(8);
  await page.getByTestId("track-id").fill("calibrator-e2e-track");
  await page.getByTestId("track-name").fill("Calibrator E2E Track");
  await page.getByTestId("save-draft").click();
  await expect(page.getByTestId("draft-message")).toHaveText("本地 Draft 已保存");

  await page.reload();
  await expect(page.getByTestId("track-id")).toHaveValue("calibrator-e2e-track");
  await expect(page.getByTestId("draft-message")).toHaveText("已恢复浏览器本地 Draft");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-draft").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("calibrator-e2e-track-1.0.0");
  await page.getByTestId("calibrator-canvas").click({ position: { x: 200, y: 160 } });
  await expect(page.getByTestId("validation-state")).toHaveText("dirty / not validated");
  await page.getByTestId("validate-track").click();
  await expect(page.getByTestId("validation-state")).toHaveText("ready");
  for (const item of await page.getByTestId("manual-validation-item").all()) await item.locator("input[type=checkbox]").check();
  await page.getByTestId("publish-track").click();
  await expect(page.getByTestId("publish-state")).toHaveText("published", { timeout: 15_000 });
  await expect(page.getByTestId("draft-message")).toHaveText("Track版本已发布");
  await page.getByTestId("copy-track-draft").click();
  await expect(page.getByTestId("track-version")).toHaveValue("1.0.1");

  await page.goto("/console/tracks?raceId=race_bay_2026");
  await expect(page.getByRole("heading", { name: "Calibrator E2E Track 1.0.0" })).toBeVisible();
});
