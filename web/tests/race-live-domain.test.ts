import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { getPublicRaceLiveSnapshot } from "../lib/queries";

async function main() {
  const trackVersion = await prisma.trackProfileVersion.findUnique({
    where: { id: "track-version-metro-1" },
    include: { track: true }
  });
  assert.equal(trackVersion?.track.trackId, "metro-raceway");
  assert.equal(trackVersion?.status, "published");

  const round = await prisma.raceRound.findUnique({
    where: { id: "round_bay_1" },
    include: { entries: { orderBy: { displayOrder: "asc" } } }
  });
  assert.equal(round?.raceId, "race_bay_2026");
  assert.equal(round?.trackProfileVersionId, "track-version-metro-1");
  assert.equal(round?.entries.length, 2);
  assert.deepEqual(round?.entries.map((entry) => entry.registrationId), ["reg_mira", "reg_ana"]);

  const duplicate = await prisma.raceRoundEntry.create({
    data: {
      id: "round-entry-duplicate-test",
      raceRoundId: "round_bay_1",
      registrationId: "reg_mira",
      displayOrder: 99,
      status: "active"
    }
  }).then(() => null, (error: unknown) => error);
  assert.ok(duplicate instanceof Error);

  assert.ok(await getPublicRaceLiveSnapshot("race_bay_2026"));
  await prisma.trackProfileVersion.update({ where: { id: "track-version-metro-1" }, data: { status: "draft" } });
  assert.equal(await getPublicRaceLiveSnapshot("race_bay_2026"), null);
  await prisma.trackProfileVersion.update({ where: { id: "track-version-metro-1" }, data: { status: "published" } });

  console.log("PASS persists Track Profile versions, RaceRound and unique RaceRoundEntry");
}

main().finally(() => prisma.$disconnect());
