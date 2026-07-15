import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
  test(`Race Live renders a bounded public group at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let snapshotPolls = 0;
    page.on("request", (request) => { if (request.url().includes("/api/public/races/bay-area-happy-trip/screen")) snapshotPolls += 1; });
    await page.goto("/screen/display");
    await expect(page.getByTestId("race-live-stage")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Public site navigation" })).toHaveCount(0);
    await expect(page.getByTestId("race-live-header")).toBeVisible();
    await expect(page.getByTestId("race-live-kpis")).toContainText("Token");
    await expect(page.getByTestId("race-live-minimap")).toBeVisible();
    await expect(page.getByTestId("race-live-attention")).toBeVisible();
    await expect(page.getByTestId("race-live-footer")).toContainText(/Round|Group/);
    const horses = page.getByTestId("race-live-horse");
    await expect(horses).toHaveCount(2);
    await expect(page.getByTestId("race-live-stage").locator("img[data-horse-sprite]"))
      .toHaveCount(2);
    await expect(page.getByTestId("race-live-stage")).not.toContainText("🐎");
    expect(await horses.count()).toBeLessThanOrEqual(8);
    await expect(page.getByTestId("race-live-top3")).toContainText("Mira Chen");
    await expect(page.locator("body")).not.toContainText(/coach|cockpit|connectorId|signingKeyId/i);
    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      y: document.documentElement.scrollHeight > document.documentElement.clientHeight
    }));
    expect(overflow).toEqual({ x: false, y: false });
    await expect.poll(() => snapshotPolls, { timeout: 6_000 }).toBeGreaterThan(0);
  });
}
