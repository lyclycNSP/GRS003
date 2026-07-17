import { expect, test } from "@playwright/test";
import type { PrismaClient, ScreenState } from "@prisma/client";

const raceIds = ["race_bay_2026", "race_finance_2026"] as const;
let prisma: PrismaClient;
const originalStates = new Map<string, ScreenState | null>();
const originalAuditIds = new Map<string, string[]>();

function restoreData(state: ScreenState) {
  return {
    mode: state.mode,
    fallbackEnabled: state.fallbackEnabled,
    currentRoundId: state.currentRoundId,
    stableProjectionId: state.stableProjectionId,
    activeGroupOrder: state.activeGroupOrder,
    autoRotateEnabled: state.autoRotateEnabled,
    rotationIntervalSeconds: state.rotationIntervalSeconds,
    rotationEpochAt: state.rotationEpochAt,
    rotationPausedAt: state.rotationPausedAt,
    controlVersion: state.controlVersion
  };
}

async function restoreScreenFixtures() {
  for (const raceId of raceIds) {
    const retainedAuditIds = originalAuditIds.get(raceId) ?? [];
    await prisma.screenControlAuditEvent.deleteMany({
      where: { raceId, ...(retainedAuditIds.length ? { id: { notIn: retainedAuditIds } } : {}) }
    });
    const original = originalStates.get(raceId) ?? null;
    if (original) {
      await prisma.screenState.update({ where: { raceId }, data: restoreData(original) });
    } else {
      await prisma.screenState.deleteMany({ where: { raceId } });
    }
  }
}

test.beforeAll(async () => {
  process.env.DATABASE_URL = "file:./e2e.db";
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client();
  for (const raceId of raceIds) {
    originalStates.set(raceId, await prisma.screenState.findUnique({ where: { raceId } }));
    originalAuditIds.set(raceId, (await prisma.screenControlAuditEvent.findMany({ where: { raceId }, select: { id: true } })).map(({ id }) => id));
  }
});

test.beforeEach(async () => {
  await prisma.screenState.update({
    where: { raceId: "race_bay_2026" },
    data: {
      mode: "live",
      fallbackEnabled: false,
      currentRoundId: "round_bay_1",
      stableProjectionId: "projection_bay_race_live_1",
      activeGroupOrder: 1,
      autoRotateEnabled: true,
      rotationPausedAt: null
    }
  });
});

test.afterEach(async () => {
  await restoreScreenFixtures();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("Screen E2E", () => {
  test("未登录访客不能访问 Screen Console，旧 Display 不回退默认赛事", async ({ page }) => {
    await page.goto("/screen");
    await expect(page).toHaveURL(/\/login\?next=%2Fscreen/);
    await page.goto("/screen/display");
    await expect(page.getByRole("heading", { name: "未指定赛事大屏" })).toBeVisible();
    await expect(page.getByText("湾区开心游", { exact: true })).toHaveCount(0);
  });

  test("Organizer 可切换模式，已打开的 Display 轮询同步且 fallback 不改变 mode", async ({ page, context }) => {
    await page.goto("/api/debug/login?user=organizer");
    await page.goto("/screen?raceId=race_bay_2026");
    await page.getByTestId("screen-mode-live").click();
    await expect(page.getByTestId("screen-current-mode")).toHaveText("live");

    const display = await context.newPage();
    await display.goto("/screen/display/race_bay_2026");
    await expect(display.getByTestId("race-live-stage")).toBeVisible();

    await page.getByTestId("screen-mode-leaderboard").click();
    await expect(page.getByTestId("screen-current-mode")).toHaveText("leaderboard");
    const leaderboard = display.getByTestId("race-live-mode-content");
    await expect(leaderboard.getByText("实时榜单 · LEADERBOARD", { exact: true })).toBeVisible({ timeout: 6_000 });
    await expect(leaderboard.getByRole("heading", { name: "湾区开心游", exact: true })).toBeVisible();
    await expect(leaderboard.getByText("Mira Chen", { exact: true })).toBeVisible();

    await page.getByTestId("screen-fallback-toggle").click();
    await expect(page.getByTestId("screen-output-source")).toHaveText("fallback enabled");
    await expect(display.locator("[data-screen-mode]")).toHaveAttribute("data-screen-mode", "leaderboard", { timeout: 6_000 });
    await expect(display.getByTestId("race-live-mode-content").getByRole("heading", { name: "湾区开心游", exact: true })).toBeVisible();

    await page.getByTestId("screen-mode-live").click();
    await expect(display.getByTestId("race-live-stage")).toBeVisible({ timeout: 6_000 });
  });

  test("不同 Race 的 ScreenState 相互隔离且未授权 Organizer 得到 404", async ({ page }) => {
    await page.goto("/api/debug/login?user=organizer");
    await page.goto("/screen?raceId=race_bay_2026");
    await page.getByTestId("screen-mode-leaderboard").click();
    await expect(page.getByTestId("screen-current-mode")).toHaveText("leaderboard");

    await page.goto("/api/debug/login?user=organizer_alt");
    await page.goto("/screen?raceId=race_finance_2026");
    await page.getByTestId("screen-mode-works").click();
    await expect(page.getByTestId("screen-current-mode")).toHaveText("works");
    await page.goto("/screen?raceId=race_bay_2026");
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();

    await page.goto("/api/debug/login?user=organizer");
    await page.goto("/screen?raceId=race_bay_2026");
    await expect(page.getByTestId("screen-current-mode")).toHaveText("leaderboard");
  });

  test("非公开 Race Display 仅对应 Organizer 可预览", async ({ browser }) => {
    const anonymousContext = await browser.newContext();
    const anonymous = await anonymousContext.newPage();
    await anonymous.goto("/screen/display/race_submission_e2e");
    await expect(anonymous.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await anonymousContext.close();

    const organizerContext = await browser.newContext();
    const organizer = await organizerContext.newPage();
    await organizer.goto("/api/debug/login?user=organizer");
    await organizer.goto("/screen/display/race_submission_e2e");
    await expect(organizer.getByText(/作品完整性 E2E/).first()).toBeVisible();
    await organizerContext.close();
  });
});
