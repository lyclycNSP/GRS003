import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { switchScreenMode, toggleScreenFallback } from "../lib/domain";
import {
  configureScreenRotation,
  moveScreenDisplayGroup,
  pauseScreenRotation,
  resolveActiveGroup,
  resumeScreenRotation
} from "../lib/race-live/controls";

const organizer = { userId: "user_org_1", roles: ["organizer" as const], profileCompleted: true, managedRaceIds: ["race_bay_2026"], approvedRegistrationIds: [], assignedWorkIds: [] };
const rider = { ...organizer, userId: "user_rider_1", roles: ["rider" as const], managedRaceIds: [] };
const admin = { ...organizer, roles: ["admin" as const], managedRaceIds: [] };

async function main() {
  const epoch = new Date("2026-07-14T12:00:00.000Z");
  assert.equal(resolveActiveGroup({ groupCount: 3, activeOrder: 1, autoRotateEnabled: true, rotationEpochAt: epoch, intervalSeconds: 10, now: new Date("2026-07-14T12:00:25.000Z") }), 3);
  assert.equal(resolveActiveGroup({ groupCount: 3, activeOrder: 2, autoRotateEnabled: false, rotationEpochAt: epoch, intervalSeconds: 10, now: new Date("2026-07-14T12:10:00.000Z") }), 2);
  assert.equal(resolveActiveGroup({ groupCount: 1, activeOrder: 9, autoRotateEnabled: true, rotationEpochAt: epoch, intervalSeconds: 10, now: new Date("2026-07-14T12:10:00.000Z") }), 1);
  assert.throws(() => resolveActiveGroup({ groupCount: 2, activeOrder: 1, autoRotateEnabled: true, rotationEpochAt: epoch, intervalSeconds: 4, now: epoch }), /5/);

  const currentScreen = await prisma.screenState.findUniqueOrThrow({ where: { raceId: "race_bay_2026" } });
  const projection = await prisma.projection.findUniqueOrThrow({ where: { id: currentScreen.stableProjectionId! } });
  const payload = JSON.parse(projection.payloadJson) as { displayGroups: Array<{ groupId: string; order: number; entryIds: string[] }> };
  payload.displayGroups = [1, 2, 3].map((order) => ({ groupId: `round_bay_1:group:${order}`, order, entryIds: ["round-entry-mira"] }));
  await prisma.projection.update({ where: { id: projection.id }, data: { payloadJson: JSON.stringify(payload) } });
  await prisma.screenState.update({ where: { raceId: "race_bay_2026" }, data: { activeGroupOrder: 1, autoRotateEnabled: true, rotationIntervalSeconds: 10, rotationEpochAt: epoch } });
  await assert.rejects(() => pauseScreenRotation(rider, { raceId: "race_bay_2026", now: epoch }), /FORBIDDEN/);
  assert.equal((await pauseScreenRotation(organizer, { raceId: "race_bay_2026", now: new Date("2026-07-14T12:00:25.000Z") })).ok, true);
  assert.equal((await prisma.screenState.findUniqueOrThrow({ where: { raceId: "race_bay_2026" } })).activeGroupOrder, 3);
  assert.equal((await moveScreenDisplayGroup(organizer, { raceId: "race_bay_2026", direction: "next", now: new Date(epoch.getTime() + 1000) })).ok, true);
  assert.equal((await prisma.screenState.findUniqueOrThrow({ where: { raceId: "race_bay_2026" } })).activeGroupOrder, 1);
  assert.equal((await resumeScreenRotation(organizer, { raceId: "race_bay_2026", now: new Date(epoch.getTime() + 2000) })).ok, true);
  assert.equal((await moveScreenDisplayGroup(organizer, { raceId: "race_bay_2026", direction: "next", now: new Date(epoch.getTime() + 24_000) })).ok, true);
  assert.equal((await prisma.screenState.findUniqueOrThrow({ where: { raceId: "race_bay_2026" } })).activeGroupOrder, 1);
  const state = await prisma.screenState.findUniqueOrThrow({ where: { raceId: "race_bay_2026" } });
  assert.equal(state.autoRotateEnabled, true);
  assert.equal(state.rotationPausedAt, null);
  assert.ok(await prisma.screenControlAuditEvent.count({ where: { raceId: "race_bay_2026" } }) >= 3);
  const auditBeforeLegacyControls = await prisma.screenControlAuditEvent.count({ where: { raceId: "race_bay_2026" } });
  assert.equal((await switchScreenMode(organizer, "race_bay_2026", "leaderboard")).ok, true);
  assert.equal((await toggleScreenFallback(organizer, "race_bay_2026", true)).ok, true);
  assert.equal(await prisma.screenControlAuditEvent.count({ where: { raceId: "race_bay_2026" } }), auditBeforeLegacyControls + 2);
  assert.equal((await prisma.screenState.findUniqueOrThrow({ where: { raceId: "race_bay_2026" } })).mode, "leaderboard");

  const missingReason = await configureScreenRotation(admin, { raceId: "race_finance_2026", intervalSeconds: 20 });
  assert.equal(missingReason.ok, false);
  assert.equal((await toggleScreenFallback(admin, "race_finance_2026", true)).ok, false);
  const override = await configureScreenRotation(admin, { raceId: "race_finance_2026", intervalSeconds: 20, reason: "Emergency venue support" });
  assert.equal(override.ok, true);

  console.log("PASS controls deterministic rotation with race-scoped audit authorization");
}

main().finally(() => prisma.$disconnect());
