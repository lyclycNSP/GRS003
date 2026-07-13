import { expect, test } from "@playwright/test";

test.describe("Organizer E2E", () => {
  test("Organizer 可创建、切换并发布 Race", async ({ page, request }) => {
    const raceTitle = "E2E Organizer Race";
    await page.goto("/api/debug/login?user=organizer");
    await expect(page).toHaveURL(/\/console/);
    await expect(page.getByRole("heading", { name: "Race 管理" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rider View" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Judge View" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Admin / User.roles" })).toHaveCount(0);

    const createForm = page.getByTestId("organizer-race-create-form");
    await createForm.getByLabel("赛事名 *").fill(raceTitle);
    await createForm.getByLabel("挑战说明 *").fill("验证 Organizer 创建与发布的 Race-scoped 数据流。");
    await createForm.getByLabel("赛事摘要").fill("由 Playwright E2E 创建的隔离赛事。");
    await createForm.getByRole("button", { name: "创建 Race" }).click();

    const raceSwitch = page.getByRole("link", { name: raceTitle, exact: true });
    await expect(raceSwitch).toBeVisible();
    await raceSwitch.click();
    await expect(page.getByRole("heading", { name: `${raceTitle} 指挥席` })).toBeVisible();
    await expect(page.getByTestId("console-current-race-status")).toHaveText("draft");
    await expect(page.getByTestId("console-current-race-identity")).toContainText("private");

    await page.getByRole("button", { name: "发布当前 Race" }).click();
    await expect(page.getByTestId("console-current-race-status")).toHaveText("running");
    await expect(page.getByTestId("console-current-race-identity")).toContainText("public");

    const response = await request.get("/api/public/races");
    expect(response.ok()).toBeTruthy();
    const races = await response.json() as Array<{ title: string; status: string; visibility: string }>;
    expect(races.some((race) => race.title === raceTitle && race.status === "running" && race.visibility === "public")).toBeTruthy();
  });
});
