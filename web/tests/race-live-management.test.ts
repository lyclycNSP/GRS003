import assert from "node:assert/strict";
import type { AuthContext } from "../lib/auth";
import { prisma } from "../lib/prisma";
import {
  createRaceRound,
  getRaceLiveReadiness,
  moveRaceRoundEntry,
  prepareRaceLive,
  refreshRaceLive,
  setRaceRoundEntryStatus,
  syncRaceRoundRoster
} from "../lib/race-live/management";

const organizer: AuthContext = {
  userId: "user_org_1", availableRoles: ["organizer"], activeRole: "organizer", profileCompleted: true,
  managedRaceIds: ["race_bay_2026"], approvedRegistrationIds: [], assignedWorkIds: []
};

async function main() {
  const originalState = await prisma.screenState.findUnique({ where: { raceId: "race_bay_2026" } });
  const projectionIdsBefore = new Set((await prisma.projection.findMany({ where: { raceId: "race_bay_2026" }, select: { id: true } })).map((item) => item.id));
  let temporaryRoundId: string | null = null;
  try {
    const readiness = await getRaceLiveReadiness("race_bay_2026");
    assert.equal(readiness.candidateRound?.id, "round_bay_1");
    assert.notEqual(readiness.status, "blocked");

    const prepared = await prepareRaceLive(organizer, "race_bay_2026", "round_bay_1", false);
    assert.equal(prepared.ok, true, prepared.message);
    const preparedState = await prisma.screenState.findUnique({ where: { raceId: "race_bay_2026" }, include: { stableProjection: true } });
    assert.equal(preparedState?.mode, "live");
    assert.equal(preparedState?.currentRoundId, "round_bay_1");
    assert.equal(preparedState?.stableProjection?.type, "ary_race_live");

    const firstRefresh = await refreshRaceLive(organizer, "race_bay_2026");
    const secondRefresh = await refreshRaceLive(organizer, "race_bay_2026");
    assert.equal(firstRefresh.ok, true);
    assert.equal(secondRefresh.ok, true);
    assert.equal(firstRefresh.id, secondRefresh.id, "unchanged source should reuse the stable projection");

    const trackVersion = await prisma.trackProfileVersion.findFirstOrThrow({ where: { status: "published" }, orderBy: { publishedAt: "asc" } });
    const created = await createRaceRound(organizer, {
      raceId: "race_bay_2026", name: "Management Test Round", order: 77,
      scheduledStartAt: new Date("2026-08-01T09:00:00Z"), scheduledEndAt: new Date("2026-08-01T10:00:00Z"),
      trackProfileVersionId: trackVersion.id
    });
    assert.equal(created.ok, true, created.message);
    if (!created.ok || !created.id) return;
    temporaryRoundId = created.id;
    const synced = await syncRaceRoundRoster(organizer, "race_bay_2026", created.id);
    assert.equal(synced.ok, true, synced.message);
    const entries = await prisma.raceRoundEntry.findMany({ where: { raceRoundId: created.id }, orderBy: { displayOrder: "asc" } });
    assert.ok(entries.length >= 1);
    const excluded = await setRaceRoundEntryStatus(organizer, { raceId: "race_bay_2026", roundEntryId: entries[0].id, status: "excluded" });
    assert.equal(excluded.ok, true);
    assert.equal((await prisma.raceRoundEntry.findUnique({ where: { id: entries[0].id } }))?.status, "excluded");
    if (entries.length > 1) {
      const moved = await moveRaceRoundEntry(organizer, { raceId: "race_bay_2026", roundEntryId: entries[1].id, direction: "up" });
      assert.equal(moved.ok, true);
    }
    console.log("PASS manages Round roster and prepares an idempotent Race Live projection");
  } finally {
    if (temporaryRoundId) await prisma.raceRound.delete({ where: { id: temporaryRoundId } }).catch(() => undefined);
    if (originalState) {
      await prisma.screenState.update({ where: { id: originalState.id }, data: {
        mode: originalState.mode, fallbackEnabled: originalState.fallbackEnabled, currentRoundId: originalState.currentRoundId,
        stableProjectionId: originalState.stableProjectionId, activeGroupOrder: originalState.activeGroupOrder,
        autoRotateEnabled: originalState.autoRotateEnabled, rotationIntervalSeconds: originalState.rotationIntervalSeconds,
        rotationEpochAt: originalState.rotationEpochAt, rotationPausedAt: originalState.rotationPausedAt, controlVersion: originalState.controlVersion
      } });
    }
    const createdProjectionIds = (await prisma.projection.findMany({ where: { raceId: "race_bay_2026" }, select: { id: true } }))
      .map((item) => item.id).filter((id) => !projectionIdsBefore.has(id));
    if (createdProjectionIds.length) await prisma.projection.deleteMany({ where: { id: { in: createdProjectionIds } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
