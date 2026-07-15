import assert from "node:assert/strict";
import metroProfile from "../public/tracks/metro-raceway/1.0.0/track.profile.json" with { type: "json" };
import { prisma } from "../lib/prisma";
import { archiveTrackProfileVersion, deleteArchivedTrackProfileVersion } from "../lib/track-calibrator/version-lifecycle";

const organizer = { userId: "user_org_1", roles: ["organizer" as const], profileCompleted: true, managedRaceIds: ["race_bay_2026"], approvedRegistrationIds: [], assignedWorkIds: [] };

async function main() {
  const suffix = `${process.pid}-${Date.now()}`;
  const trackId = `lifecycle-${suffix}`;
  const versionId = `track-version-lifecycle-${suffix}`;
  await prisma.trackProfile.create({ data: { id: `track-lifecycle-${suffix}`, trackId, raceId: "race_bay_2026", name: "Lifecycle Track", scope: "race" } });
  await prisma.trackProfileVersion.create({ data: { id: versionId, trackId, version: "1.0.0", status: "published", schemaVersion: "1.0.0", profileJson: JSON.stringify({ ...metroProfile, trackId, name: "Lifecycle Track" }), checksum: metroProfile.background.checksum, backgroundAssetRef: "/tracks/metro-raceway/1.0.0/background.webp", publishedAt: new Date() } });

  assert.equal((await archiveTrackProfileVersion(organizer, "track-version-metro-1")).ok, false);
  assert.equal((await archiveTrackProfileVersion({ ...organizer, managedRaceIds: [] }, versionId)).ok, false);
  assert.equal((await archiveTrackProfileVersion(organizer, versionId)).ok, true);
  assert.equal((await deleteArchivedTrackProfileVersion(organizer, versionId)).ok, true);
  assert.equal(await prisma.trackProfileVersion.findUnique({ where: { id: versionId } }), null);
  console.log("PASS enforces Track Profile version lifecycle");
}

main().finally(() => prisma.$disconnect());
