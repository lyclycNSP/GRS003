import { expect, test } from "@playwright/test";

test.describe("Organizer E2E", () => {
  test("Organizer Portfolio 与单场 Race Workspace 保持分层", async ({ page }) => {
    await page.goto("/api/debug/login?user=organizer");
    await expect(page).toHaveURL(/\/console\/organizer$/);
    await expect(page.getByTestId("organizer-portfolio")).toBeVisible();
    await expect(page.getByRole("heading", { name: "我的赛事", exact: true })).toBeVisible();
    await expect(page.getByTestId("organizer-race-create-form")).toBeVisible();
    await expect(page.getByLabel("MVP workflow")).toHaveCount(0);
    await expect(page.getByText("CA Trust", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Review Risk", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("organizer-race-card-race_bay_2026")).toContainText("Owner");
    await expect(page.getByTestId("organizer-race-card-race_genesis_2026")).toBeVisible();
    await expect(page.getByTestId("organizer-race-card-race_finance_2026")).toHaveCount(0);

    await page.getByTestId("organizer-race-card-race_bay_2026").getByRole("link", { name: /进入赛事/ }).click();
    await expect(page).toHaveURL(/\/console\/organizer\/races\/race_bay_2026$/);
    await expect(page.getByTestId("race-workspace")).toBeVisible();
    await expect(page.getByTestId("console-current-race-identity")).toContainText("bay-area-happy-trip");
    await expect(page.getByLabel("MVP workflow")).toBeVisible();
    await expect(page.getByRole("link", { name: /返回我的赛事/ })).toBeVisible();
  });

  test("Owner 与 Collaborator 数据隔离且未授权 Race 返回 404", async ({ page }) => {
    await page.goto("/api/debug/login?user=organizer_alt");
    await expect(page).toHaveURL(/\/console\/organizer$/);
    await expect(page.getByTestId("organizer-race-card-race_finance_2026")).toContainText("Owner");
    await expect(page.getByTestId("organizer-race-card-race_bay_2026")).toHaveCount(0);

    await page.goto("/console/organizer/races/race_bay_2026");
    await expect(page.getByRole("heading", { name: /404|not found/i })).toBeVisible();

    await page.goto("/api/debug/login?user=multi");
    await expect(page.getByTestId("organizer-race-card-race_bay_2026")).toContainText("Collaborator");
    await expect(page.getByTestId("organizer-race-card-race_finance_2026")).toHaveCount(0);
    await page.goto("/console/organizer/races/race_bay_2026");
    await expect(page.getByTestId("race-workspace")).toBeVisible();
  });

  test("Organizer 使用 Judge 池与三席覆盖矩阵，并从待审核队列进入参赛选手库", async ({ page }) => {
    await page.goto("/api/debug/login?user=organizer");
    await page.goto("/console/organizer/races/race_bay_2026");
    await expect(page.getByTestId("registration-review-queue")).toBeVisible();
    await expect(page.getByTestId("registration-review-empty")).toBeVisible();
    await expect(page.getByTestId("judge-assignment-form")).toContainText("赛事 Judge 池");
    await expect(page.getByTestId("judge-assignment-list")).toContainText("GBA WanderMate");
    await expect(page.getByTestId("judge-assignment-list")).toContainText("LocalJoy Agent");
    await expect(page.getByTestId("judge-assignment-matrix-row")).toHaveCount(2);
    await expect(page.getByTestId("judge-assignment-list")).toContainText("3/3 assigned");
    await expect(page.getByTestId("judge-allocation-preview")).toContainText("6");
    await expect(page.getByTestId("judge-allocation-ready")).toContainText("保留 6 个合法席位");
    await expect(page.getByTestId("allocate-race-judges")).toBeEnabled();

    await page.getByTestId("participant-library-link").click();
    await expect(page).toHaveURL(/\/console\/organizer\/races\/race_bay_2026\/participants$/);
    await expect(page.getByTestId("organizer-participant-library")).toBeVisible();
    await expect(page.getByTestId("participant-library-row")).toHaveCount(2);
    await expect(page.getByText("Mira Chen", { exact: true }).first()).toBeVisible();

    await page.getByRole("link", { name: "历史记录" }).click();
    await expect(page).toHaveURL(/status=history/);
    await expect(page.getByRole("heading", { name: "审核与退出历史" })).toBeVisible();
  });

  test("Organizer 可创建、区分同名 Race 并发布", async ({ page, request }) => {
    const raceTitle = "E2E Organizer Race";
    await page.goto("/api/debug/login?user=organizer");

    const createRace = async () => {
      const createForm = page.getByTestId("organizer-race-create-form");
      await createForm.getByLabel("赛事名 *").fill(raceTitle);
      await createForm.getByLabel("挑战说明 *").fill("验证 Organizer Portfolio 到 Race Workspace 的隔离流程。");
      await createForm.getByLabel("赛事摘要").fill("由 Playwright E2E 创建的隔离赛事。");
      await createForm.getByRole("button", { name: "创建 Race" }).click();
      await expect(page).toHaveURL(/\/console\/organizer\/races\/[^?]+\?action=race-created&entityId=/);
      const outcome = page.locator('[data-action-code="race-created"]');
      await expect(outcome).toContainText("Race 私有草稿已创建");
      await expect(outcome).toContainText("Race ID");
      await expect(outcome.getByRole("link", { name: "继续配置当前 Race" })).toBeVisible();
      const id = new URL(page.url()).pathname.split("/").at(-1);
      expect(id).toBeTruthy();
      return id!;
    };

    const firstRaceId = await createRace();
    await page.getByRole("link", { name: /返回我的赛事/ }).click();
    const secondRaceId = await createRace();
    expect(secondRaceId).not.toBe(firstRaceId);

    await expect(page.getByRole("heading", { name: `${raceTitle} 指挥席` })).toBeVisible();
    await expect(page.getByTestId("console-current-race-status")).toHaveText("draft");
    await expect(page.getByTestId("console-current-race-identity")).toContainText("private");
    await page.getByRole("button", { name: "发布当前 Race" }).click();
    await expect(page).toHaveURL(/action=race-published&entityId=/);
    await expect(page.locator('[data-action-code="race-published"]')).toContainText("Race 已发布到公共赛事中心");
    await expect(page.locator('[data-action-code="race-published"]')).toContainText("查看公开 Race Page");
    await expect(page.getByTestId("console-current-race-status")).toHaveText("running");

    await page.getByRole("link", { name: /返回我的赛事/ }).click();
    await expect(page.getByText(raceTitle, { exact: true })).toHaveCount(2);
    const firstRaceShortId = page.getByTestId(`organizer-race-card-${firstRaceId}`).locator("code");
    await expect(firstRaceShortId).toHaveAttribute("title", firstRaceId);
    await expect(firstRaceShortId).toHaveText(`#${firstRaceId.slice(-8)}`);
    const secondRaceShortId = page.getByTestId(`organizer-race-card-${secondRaceId}`).locator("code");
    await expect(secondRaceShortId).toHaveAttribute("title", secondRaceId);
    await expect(secondRaceShortId).toHaveText(`#${secondRaceId.slice(-8)}`);

    const response = await request.get("/api/public/races");
    expect(response.ok()).toBeTruthy();
    const races = await response.json() as Array<{ title: string; status: string; visibility: string }>;
    expect(races.some((race) => race.title === raceTitle && race.status === "running" && race.visibility === "public")).toBeTruthy();
  });

  test("旧链接兼容跳转，旧 Organizer 页面在会话角色变化后不抛 Runtime Error", async ({ page, context }) => {
    await page.goto("/api/debug/login?user=organizer");
    await page.goto("/console/organizer?raceId=race_bay_2026");
    await expect(page).toHaveURL(/\/console\/organizer\/races\/race_bay_2026$/);
    await page.goto("/console?raceId=race_bay_2026");
    await expect(page).toHaveURL(/\/console\/organizer\/races\/race_bay_2026$/);
    await page.goto("/console/organizer");

    const sessionPage = await context.newPage();
    await sessionPage.goto("/api/debug/login?user=rider");
    await expect(sessionPage).toHaveURL(/\/console\/rider/);
    await sessionPage.close();

    const staleForm = page.getByTestId("organizer-race-create-form");
    await staleForm.getByLabel("赛事名 *").fill("Stale role race");
    await staleForm.getByLabel("挑战说明 *").fill("验证过期页面不会越权提交。");
    await staleForm.getByRole("button", { name: "创建 Race" }).click();
    await expect(page).toHaveURL(/\/console\/rider/);
    await expect(page.getByTestId("rider-portfolio")).toBeVisible();
    await expect(page.getByTestId("race-create-outcome")).toHaveCount(0);
    await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
  });
});
