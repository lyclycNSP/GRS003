import { expect, test } from "@playwright/test";
import type { PrismaClient, ScreenState } from "@prisma/client";

const raceId = "race_bay_2026";
let prisma: PrismaClient;
let originalState: ScreenState;
let projectionIdsBefore: string[] = [];

test.beforeAll(async () => {
  process.env.DATABASE_URL = "file:./e2e.db";
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client();
  originalState = await prisma.screenState.findUniqueOrThrow({ where: { raceId } });
  projectionIdsBefore = (await prisma.projection.findMany({ where: { raceId }, select: { id: true } })).map(({ id }) => id);
  // Simulate a stale operator-selected mode without depending on development-only
  // test rounds or projections that are intentionally absent from a clean E2E seed.
  await prisma.screenState.update({ where: { raceId }, data: { mode: "announcement" } });
});

test.afterAll(async () => {
  try {
    await prisma.screenState.update({ where: { raceId }, data: {
      mode: originalState.mode, fallbackEnabled: originalState.fallbackEnabled, currentRoundId: originalState.currentRoundId,
      stableProjectionId: originalState.stableProjectionId, activeGroupOrder: originalState.activeGroupOrder,
      autoRotateEnabled: originalState.autoRotateEnabled, rotationIntervalSeconds: originalState.rotationIntervalSeconds,
      rotationEpochAt: originalState.rotationEpochAt, rotationPausedAt: originalState.rotationPausedAt, controlVersion: originalState.controlVersion
    } });
    await prisma.projection.deleteMany({ where: { raceId, id: { notIn: projectionIdsBefore } } });
  } finally {
    await prisma.$disconnect();
  }
});

test("Organizer can repair a stale ScreenState and launch the complete Race Live display from the web console", async ({ page }) => {
  await page.goto("/api/debug/login?user=organizer");
  await page.goto(`/screen?raceId=${raceId}`);
  const setup = page.getByTestId("race-live-setup");
  await expect(setup).toContainText("Round 1");
  await expect(setup).toContainText("Metro Raceway");
  await page.getByTestId("prepare-race-live").click();
  await expect(page).toHaveURL(/prepared=1/);
  await expect(page.getByTestId("screen-current-mode")).toHaveText("live");

  await page.goto(`/screen/display/${raceId}`);
  await expect(page.getByTestId("race-live-stage")).toBeVisible();
  await expect(page.getByTestId("race-live-horse")).toHaveCount(2);
  await expect(page.locator("[data-screen-mode]")).toHaveAttribute("data-screen-mode", "live");
});
