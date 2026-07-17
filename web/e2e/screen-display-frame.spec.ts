import { expect, test } from "@playwright/test";
import type { PrismaClient, ScreenState } from "@prisma/client";

const raceId = "race_bay_2026";
let prisma: PrismaClient;
let originalState: ScreenState;
let originalAuditIds: string[] = [];

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

test.beforeAll(async () => {
  process.env.DATABASE_URL = "file:./e2e.db";
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client();
  originalState = await prisma.screenState.findUniqueOrThrow({ where: { raceId } });
  originalAuditIds = (await prisma.screenControlAuditEvent.findMany({ where: { raceId }, select: { id: true } })).map(({ id }) => id);
});

test.beforeEach(async () => {
  await prisma.screenState.update({
    where: { raceId },
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

test.afterAll(async () => {
  try {
    await prisma.screenState.update({ where: { raceId }, data: restoreData(originalState) });
    await prisma.screenControlAuditEvent.deleteMany({
      where: { raceId, ...(originalAuditIds.length ? { id: { notIn: originalAuditIds } } : {}) }
    });
  } finally {
    await prisma.$disconnect();
  }
});

test("Race Live 四种模式共享赛事框架，辅助模式不再切到白色空页", async ({ page, context }) => {
  await page.goto("/api/debug/login?user=organizer");
  await page.goto("/screen?raceId=race_bay_2026");
  await page.getByTestId("screen-mode-live").click();

  const display = await context.newPage();
  await display.goto("/screen/display/race_bay_2026");
  await expect(display.getByTestId("race-live-header")).toBeVisible();
  await expect(display.getByTestId("race-live-stage")).toBeVisible();
  await expect(display.getByTestId("race-live-attention")).toBeVisible();
  await expect(display.getByTestId("race-live-footer")).toBeVisible();

  for (const mode of ["leaderboard", "works", "announcement"] as const) {
    await page.getByTestId(`screen-mode-${mode}`).click();
    await expect(display.locator("[data-screen-mode]")).toHaveAttribute("data-screen-mode", mode, { timeout: 6_000 });
    await expect(display.getByTestId("race-live-header")).toBeVisible();
    await expect(display.getByTestId("race-live-mode-content")).toBeVisible();
    await expect(display.getByTestId("race-live-attention")).toBeVisible();
    await expect(display.getByTestId("race-live-footer")).toBeVisible();
  }

  const colors = await display.locator("[data-screen-mode]").evaluate((element) => ({
    shell: getComputedStyle(element).color,
    page: getComputedStyle(document.querySelector(".screen-display")!).backgroundColor
  }));
  expect(colors.shell).not.toBe("rgb(8, 38, 83)");
  expect(colors.page).not.toBe("rgb(234, 244, 255)");
});

test("无 Projection 的赛事使用暗色静态框架并只展示真实状态", async ({ page }) => {
  await page.goto("/api/debug/login?user=organizer");
  await page.goto("/screen/display/race_submission_e2e");
  await expect(page.getByTestId("static-screen-display")).toBeVisible();
  await expect(page.getByText("作品完整性 E2E").first()).toBeVisible();
  await expect(page.getByTestId("race-live-mode-content")).toContainText(/等待 Round|暂无公开作品|榜单尚未生成|现场信息/);
  await expect(page.locator("body")).not.toContainText(/Mira Chen|Bay Area Happy Trip/);
});
