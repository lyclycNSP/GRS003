import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import metroProfile from "../public/tracks/metro-raceway/1.0.0/track.profile.json" with { type: "json" };
import { prisma } from "../lib/prisma";
import { LocalTrackAssetStore } from "../lib/track-assets/local-store";
import { publishTrackProfileVersion } from "../lib/track-calibrator/publish";
import { bindTrackVersionToRound } from "../lib/domain";
import { buildAryRaceLiveProjection } from "../lib/race-live/projection-builder";
import { getPublicRaceLiveSnapshot } from "../lib/queries";

const organizer = { userId: "user_org_1", availableRoles: ["organizer" as const], activeRole: "organizer" as const, profileCompleted: true, managedRaceIds: ["race_bay_2026"], approvedRegistrationIds: [], assignedWorkIds: [] };
const rider = { ...organizer, userId: "user_rider_1", availableRoles: ["rider" as const], activeRole: "rider" as const, managedRaceIds: [] };
const managedRider = { ...rider, managedRaceIds: ["race_bay_2026"] };
const validationEvidence = {
  validationReportJson: JSON.stringify({ generatedAt: "2026-07-15T10:00:00.000Z", valid: true, issues: [] }),
  manualValidationJson: JSON.stringify({
    confirmations: { single_horse_path: true, natural_turn_rotation: true, eight_horse_overlap: true, start_finish_spacing: true, minimap_alignment: true, bubble_candidate_visibility: true, asset_alignment: true, layout_stability: true },
    notes: "Checked in publish domain test",
    confirmedAt: "2026-07-15T10:01:00.000Z"
  })
};

async function main() {
  const assetRoot = path.join(os.tmpdir(), `ary-track-assets-${process.pid}`);
  const store = new LocalTrackAssetStore(assetRoot);
  const bytes = await readFile(new URL("../public/tracks/metro-raceway/1.0.0/background.webp", import.meta.url));
  const { publishedAt: _publishedAt, ...base } = metroProfile;
  const profile = {
    ...base,
    trackId: "bay-custom-track",
    version: "1.0.0",
    name: "Bay Custom Track",
    status: "validated",
    background: { ...base.background, assetId: "bay-custom-track-background-1.0.0" }
  };
  const background = new File([bytes], "background.webp", { type: "image/webp" });

  assert.equal((await publishTrackProfileVersion(rider, { ...validationEvidence, publishRequestId: "publish_denied_1", raceId: "race_bay_2026", profileJson: JSON.stringify(profile), background }, store)).ok, false);
  assert.equal((await publishTrackProfileVersion(managedRider, { ...validationEvidence, publishRequestId: "publish_denied_role", raceId: "race_bay_2026", profileJson: JSON.stringify(profile), background }, store)).ok, false);
  assert.equal((await publishTrackProfileVersion(organizer, { ...validationEvidence, publishRequestId: "publish_wrong_race", raceId: "race_finance_2026", profileJson: JSON.stringify(profile), background }, store)).ok, false);
  assert.equal((await publishTrackProfileVersion(organizer, { ...validationEvidence, manualValidationJson: "", publishRequestId: "publish_missing_manual", raceId: "race_bay_2026", profileJson: JSON.stringify(profile), background }, store)).ok, false);
  const first = await publishTrackProfileVersion(organizer, { ...validationEvidence, publishRequestId: "publish_bay_track_1", raceId: "race_bay_2026", profileJson: JSON.stringify(profile), background }, store);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const repeated = await publishTrackProfileVersion(organizer, { ...validationEvidence, publishRequestId: "publish_bay_track_1", raceId: "race_bay_2026", profileJson: JSON.stringify(profile), background }, store);
  assert.equal(repeated.ok, true);
  if (repeated.ok) assert.equal(repeated.id, first.id);
  assert.equal((await publishTrackProfileVersion(organizer, { ...validationEvidence, publishRequestId: "publish_bay_track_1", raceId: "race_bay_2026", profileJson: JSON.stringify({ ...profile, version: "9.9.9" }), background }, store)).ok, false);
  assert.equal((await publishTrackProfileVersion(organizer, { ...validationEvidence, publishRequestId: "publish_bay_track_1", raceId: "race_bay_2026", profileJson: JSON.stringify({ ...profile, name: "Changed Geometry Identity" }), background }, store)).ok, false);
  assert.equal((await publishTrackProfileVersion(organizer, { ...validationEvidence, publishRequestId: "publish_bay_track_2", raceId: "race_bay_2026", profileJson: JSON.stringify(profile), background }, store)).ok, false);

  const stored = await prisma.trackProfileVersion.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(stored.profileHash, first.profileHash);
  assert.equal(stored.backgroundHash, first.backgroundHash);
  assert.equal(stored.publishedByUserId, organizer.userId);
  assert.deepEqual(await readFile(path.join(assetRoot, stored.backgroundAssetRef.replace(/^\/track-assets\//, ""))), bytes);

  const winner = await store.stage({ publishRequestId: "asset-winner", bytes, extension: "webp" });
  const loser = await store.stage({ publishRequestId: "asset-loser", bytes, extension: "webp" });
  await store.finalize(winner, "concurrency/content-addressed.webp");
  await store.finalize(loser, "concurrency/content-addressed.webp");
  await store.discard(loser);
  await store.discard(winner);
  assert.deepEqual(await readFile(path.join(assetRoot, "concurrency/content-addressed.webp")), bytes);

  const tampered = { ...profile, background: { ...profile.background, checksum: "sha256:deadbeef" }, version: "1.0.1" };
  assert.equal((await publishTrackProfileVersion(organizer, { ...validationEvidence, publishRequestId: "publish_bad_hash", raceId: "race_bay_2026", profileJson: JSON.stringify(tampered), background }, store)).ok, false);
  assert.equal((await publishTrackProfileVersion(organizer, { ...validationEvidence, publishRequestId: "publish_bad_name", raceId: "race_bay_2026", profileJson: JSON.stringify({ ...profile, version: "1.0.2" }), background: new File([bytes], "../evil.webp", { type: "image/webp" }) }, store)).ok, false);
  assert.equal((await publishTrackProfileVersion(organizer, { ...validationEvidence, publishRequestId: "publish_bad_mime", raceId: "race_bay_2026", profileJson: JSON.stringify({ ...profile, version: "1.0.3" }), background: new File([bytes], "background.svg", { type: "image/svg+xml" }) }, store)).ok, false);
  assert.equal((await publishTrackProfileVersion(organizer, { ...validationEvidence, publishRequestId: "publish_big_profile", raceId: "race_bay_2026", profileJson: `${JSON.stringify(profile)}${" ".repeat(1024 * 1024)}`, background }, store)).ok, false);
  const excessiveGeometry = { ...profile, version: "1.0.4", centerline: { ...profile.centerline, points: Array.from({ length: 501 }, (_, index) => ({ x: index % 1000, y: index % 600 })) } };
  assert.equal((await publishTrackProfileVersion(organizer, { ...validationEvidence, publishRequestId: "publish_large_geometry", raceId: "race_bay_2026", profileJson: JSON.stringify(excessiveGeometry), background }, store)).ok, false);

  await prisma.raceRound.create({ data: { id: "round_bay_pending_test", raceId: "race_bay_2026", trackProfileVersionId: "track-version-metro-1", name: "Pending Track Test", order: 99, status: "pending", scheduledStartAt: new Date("2026-07-15T10:00:00Z"), scheduledEndAt: new Date("2026-07-15T12:00:00Z") } });
  await assert.rejects(() => bindTrackVersionToRound(rider, { raceRoundId: "round_bay_pending_test", trackProfileVersionId: first.id }), /FORBIDDEN/);
  assert.equal((await bindTrackVersionToRound(organizer, { raceRoundId: "round_bay_pending_test", trackProfileVersionId: first.id })).ok, true);
  assert.equal((await bindTrackVersionToRound(organizer, { raceRoundId: "round_bay_1", trackProfileVersionId: first.id })).ok, false);
  const projection = await buildAryRaceLiveProjection(organizer, { raceId: "race_bay_2026", roundId: "round_bay_pending_test", now: new Date("2026-07-15T09:00:00Z") });
  assert.equal(projection.ok, true);
  const publicRaceLive = await getPublicRaceLiveSnapshot("race_bay_2026");
  assert.equal(publicRaceLive?.backgroundAssetRef, stored.backgroundAssetRef);

  await rm(assetRoot, { recursive: true, force: true });
  console.log("PASS publishes immutable scoped Track versions and binds pending rounds");
}

main().finally(() => prisma.$disconnect());
