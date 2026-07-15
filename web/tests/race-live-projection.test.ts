import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { buildAryRaceLiveProjection, deriveDataStatus, deriveEntryProgress } from "../lib/race-live/projection-builder";

const organizer = {
  userId: "user_org_1",
  roles: ["organizer" as const],
  profileCompleted: true,
  managedRaceIds: ["race_bay_2026"],
  approvedRegistrationIds: [],
  assignedWorkIds: []
};

async function main() {
  assert.deepEqual(deriveEntryProgress({ progressPercent: 92 }), { progress: 0.92, dataStatus: "fresh" });
  assert.deepEqual(deriveEntryProgress({}), { progress: 0, dataStatus: "stale" });
  assert.equal(deriveDataStatus(new Date("2026-07-14T11:59:30.000Z"), new Date("2026-07-14T12:00:00.000Z")), "fresh");
  assert.equal(deriveDataStatus(new Date("2026-07-14T11:58:59.000Z"), new Date("2026-07-14T12:00:00.000Z")), "stale");

  await prisma.raceProject.update({
    where: { id: "rp_mira" },
    data: { metricsJson: JSON.stringify({ progressPercent: 92, tokens: 999999 }), lastSyncedAt: new Date("2026-07-14T11:59:30.000Z") }
  });
  await prisma.session.upsert({
    where: { caConnectionId_externalSessionRef: { caConnectionId: "conn_mira_codex", externalSessionRef: "projection-test" } },
    update: { tokens: 321, lastActiveAt: new Date("2026-07-14T11:59:50.000Z") },
    create: { id: "session_projection_test", caConnectionId: "conn_mira_codex", externalSessionRef: "projection-test", tokens: 321, lastActiveAt: new Date("2026-07-14T11:59:50.000Z"), snapshotJson: "{}" }
  });
  await prisma.reviewFlag.upsert({
    where: { id: "flag_internal_projection_test" },
    update: {},
    create: { id: "flag_internal_projection_test", raceId: "race_bay_2026", registrationId: "reg_mira", raceProjectId: "rp_mira", type: "secret_internal_marker", severity: "error", status: "open", judgeVisibleSummary: "must not leak", sourceRefJson: "{}" }
  });
  const expectedMiraTokens = (await prisma.cAConnection.findMany({ where: { raceProjectId: "rp_mira" }, include: { sessions: { select: { tokens: true } } } }))
    .flatMap((connection) => connection.sessions)
    .reduce((sum, session) => sum + Math.max(0, session.tokens), 0);

  const first = await buildAryRaceLiveProjection(organizer, {
    raceId: "race_bay_2026",
    roundId: "round_bay_1",
    now: new Date("2026-07-14T12:00:00.000Z")
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.snapshot.entries.length, 2);
  assert.equal(first.snapshot.globalRanking.length, 2);
  assert.equal(first.snapshot.entries.find((entry) => entry.registrationId === "reg_mira")?.dataStatus, "fresh");
  assert.equal(first.snapshot.entries.find((entry) => entry.registrationId === "reg_mira")?.costTokens, expectedMiraTokens);
  assert.equal(first.snapshot.kpi.totalTokens, first.snapshot.entries.reduce((sum, entry) => sum + (entry.costTokens ?? 0), 0));
  assert.equal(JSON.stringify(first.snapshot.attentionItems).includes("secret_internal_marker"), false);
  const serialized = JSON.stringify(first.snapshot);
  for (const forbidden of ["judgeVisibleSummary", "sourceRefJson", "connectorId", "signingKeyId", "coachId", "cockpitId"]) {
    assert.equal(serialized.includes(forbidden), false);
  }

  await prisma.raceProject.update({ where: { id: "rp_mira" }, data: { metricsJson: JSON.stringify({ progressPercent: 10, tokens: 999999 }) } });
  await prisma.registration.update({ where: { id: "reg_ana" }, data: { status: "pending" } });
  await prisma.raceRoundEntry.upsert({
    where: { raceRoundId_registrationId: { raceRoundId: "round_bay_1", registrationId: "reg_finance_ana" } },
    update: { status: "active", displayOrder: 3 },
    create: { id: "round-entry-cross-race-test", raceRoundId: "round_bay_1", registrationId: "reg_finance_ana", displayOrder: 3, status: "active" }
  });
  const second = await buildAryRaceLiveProjection(organizer, {
    raceId: "race_bay_2026",
    roundId: "round_bay_1",
    now: new Date("2026-07-14T12:01:00.000Z")
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.deepEqual(second.snapshot.entries.map((entry) => entry.registrationId), ["reg_mira"]);
  const mira = second.snapshot.entries.find((entry) => entry.registrationId === "reg_mira");
  assert.equal(mira?.roundProgress, 0.92);
  assert.equal(second.snapshot.sequence, first.snapshot.sequence + 1);
  await prisma.raceRoundEntry.delete({ where: { raceRoundId_registrationId: { raceRoundId: "round_bay_1", registrationId: "reg_finance_ana" } } });
  await prisma.registration.update({ where: { id: "reg_ana" }, data: { status: "approved" } });

  const stableBefore = await prisma.projection.findFirst({ where: { raceId: "race_bay_2026", type: "ary_race_live", status: "stable" }, orderBy: { sequence: "desc" } });
  const failed = await buildAryRaceLiveProjection(organizer, { raceId: "race_bay_2026", roundId: "missing-round" });
  assert.equal(failed.ok, false);
  const stableAfter = await prisma.projection.findFirst({ where: { raceId: "race_bay_2026", type: "ary_race_live", status: "stable" }, orderBy: { sequence: "desc" } });
  assert.equal(stableAfter?.id, stableBefore?.id);

  console.log("PASS builds safe monotonic ARY Race Live projections");
}

main().finally(() => prisma.$disconnect());
