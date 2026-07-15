import assert from "node:assert/strict";
import { AryRaceLiveSnapshotSchema } from "../lib/race-live/contracts";
import { assignGroupLanes, createScreenDisplayGroups } from "../lib/race-live/grouping";

for (const [count, expected] of [[9, 2], [16, 2], [17, 3], [36, 5]] as const) {
  const entries = Array.from({ length: count }, (_, index) => ({
    entryId: `entry-${String(index + 1).padStart(2, "0")}`,
    displayOrder: index + 1
  }));
  const groups = createScreenDisplayGroups("round-1", entries);
  assert.equal(groups.length, expected);
  assert.ok(groups.every((group) => group.entryIds.length <= 8));
  assert.deepEqual(groups, createScreenDisplayGroups("round-1", [...entries].reverse()));
}

const tied = createScreenDisplayGroups("round-1", [
  { entryId: "entry-b", displayOrder: 1 },
  { entryId: "entry-a", displayOrder: 1 }
]);
assert.deepEqual(tied[0]?.entryIds, ["entry-a", "entry-b"]);
assert.deepEqual(assignGroupLanes(tied[0]!), [
  { entryId: "entry-a", laneId: "lane-1" },
  { entryId: "entry-b", laneId: "lane-2" }
]);

const validSnapshot = {
  schemaVersion: "ary.race-live.v1",
  raceId: "race-1",
  roundId: "round-1",
  sequence: 1,
  generatedAt: "2026-07-14T12:00:00.000Z",
  race: {
    raceId: "race-1",
    title: "ARY Race",
    organizerDisplayName: "ARY",
    status: "live",
    trackProfileId: "metro-raceway",
    trackProfileVersion: "1.0.0"
  },
  round: {
    roundId: "round-1",
    name: "Round 1",
    order: 1,
    status: "running",
    scheduledStartAt: "2026-07-14T11:00:00.000Z",
    scheduledEndAt: "2026-07-14T13:00:00.000Z"
  },
  runtimeConfig: {
    staleThresholdSeconds: 60,
    participantOnlineWindowSeconds: 120,
    bubbleDurationSeconds: 8,
    maxVisibleBubbles: 3,
    maxEntriesPerGroup: 8
  },
  kpi: {
    raceRoundProgress: 0.5,
    totalParticipants: 1,
    onlineParticipants: 1,
    activeEntries: 1,
    totalTokens: 100
  },
  totalEntryCount: 1,
  entries: [{
    entryId: "entry-1",
    registrationId: "registration-1",
    raceProjectId: "project-1",
    participantType: "individual",
    entrantDisplayName: "Racer One",
    participantCount: 1,
    onlineParticipantCount: 1,
    agentProviders: ["codex"],
    rank: 1,
    roundProgress: 0.5,
    overallProgress: 0.5,
    reachedProgressAt: "2026-07-14T12:00:00.000Z",
    raceStatus: "running",
    dataStatus: "fresh",
    riskLevel: "none",
    costTokens: 100,
    updatedAt: "2026-07-14T12:00:00.000Z"
  }],
  displayGroups: [{ groupId: "round-1:group:1", order: 1, entryIds: ["entry-1"] }],
  globalRanking: [{ entryId: "entry-1", rank: 1, entrantDisplayName: "Racer One", roundProgress: 0.5 }],
  ridingMessages: [],
  attentionItems: []
};

assert.equal(AryRaceLiveSnapshotSchema.safeParse(validSnapshot).success, true);
assert.equal(AryRaceLiveSnapshotSchema.safeParse({ ...validSnapshot, actorUserId: "internal-user" }).success, false);
assert.equal(AryRaceLiveSnapshotSchema.safeParse({
  ...validSnapshot,
  entries: [{ ...validSnapshot.entries[0], coachId: "coach-1", cockpitId: "cockpit-1" }]
}).success, false);

console.log("PASS validates ARY Race Live contracts and deterministic display groups");
