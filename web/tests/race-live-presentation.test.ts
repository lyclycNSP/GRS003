import assert from "node:assert/strict";
import type { AryRaceLiveSnapshot } from "../lib/race-live/contracts";
import { buildRaceLivePresentation, parseRaceLiveInitialNow } from "../lib/race-live/presentation";

assert.equal(parseRaceLiveInitialNow("2026-07-15T05:06:39.762Z").toISOString(), "2026-07-15T05:06:39.762Z");
assert.throws(() => parseRaceLiveInitialNow("invalid"), /initialNow/);

const generatedAt = "2026-07-15T10:00:00.000Z";
const entries: AryRaceLiveSnapshot["entries"] = Array.from({ length: 9 }, (_, index) => ({
  entryId: `entry-${index + 1}`,
  registrationId: `registration-${index + 1}`,
  raceProjectId: `project-${index + 1}`,
  participantType: "individual",
  entrantDisplayName: `Racer ${index + 1}`,
  participantCount: 1,
  onlineParticipantCount: 1,
  rank: index + 1,
  roundProgress: (9 - index) / 10,
  overallProgress: (9 - index) / 10,
  reachedProgressAt: generatedAt,
  raceStatus: "running",
  dataStatus: "fresh",
  riskLevel: index === 0 ? "critical" : "none",
  agentProviders: [index < 4 ? "codex" : index < 6 ? "claude" : "other"],
  costTokens: 100,
  updatedAt: generatedAt,
}));

const snapshot: AryRaceLiveSnapshot = {
  schemaVersion: "ary.race-live.v1",
  raceId: "race-1",
  roundId: "round-1",
  sequence: 3,
  generatedAt,
  race: {
    raceId: "race-1",
    title: "ARY Race",
    organizerDisplayName: "ARY",
    status: "live",
    trackProfileId: "metro-raceway",
    trackProfileVersion: "1.0.0",
  },
  round: {
    roundId: "round-1",
    name: "Round 1",
    order: 1,
    status: "running",
    scheduledStartAt: "2026-07-15T09:59:00.000Z",
    scheduledEndAt: "2026-07-15T11:00:00.000Z",
    actualStartedAt: "2026-07-15T09:59:30.000Z",
  },
  runtimeConfig: {
    staleThresholdSeconds: 60,
    participantOnlineWindowSeconds: 120,
    bubbleDurationSeconds: 8,
    maxVisibleBubbles: 3,
    maxEntriesPerGroup: 8,
  },
  kpi: {
    raceRoundProgress: 0.5,
    totalParticipants: 9,
    onlineParticipants: 9,
    activeEntries: 9,
    totalTokens: 900,
  },
  totalEntryCount: 9,
  entries,
  displayGroups: [
    { groupId: "round-1:group:1", order: 1, entryIds: entries.slice(0, 8).map((entry) => entry.entryId) },
    { groupId: "round-1:group:2", order: 2, entryIds: [entries[8]!.entryId] },
  ],
  globalRanking: entries.map((entry) => ({
    entryId: entry.entryId,
    rank: entry.rank,
    entrantDisplayName: entry.entrantDisplayName,
    roundProgress: entry.roundProgress,
  })),
  ridingMessages: [
    { messageId: "message-current", entryId: "entry-1", source: "participant", type: "milestone", severity: "info", factualSummary: "Current group", bubbleText: "冲刺", displayMode: "bubble", createdAt: generatedAt, expiresAt: "2026-07-15T10:00:20.000Z" },
    { messageId: "message-expired", entryId: "entry-2", source: "system", type: "obstacle", severity: "high", factualSummary: "Expired", bubbleText: "已过期", displayMode: "bubble", createdAt: generatedAt, expiresAt: "2026-07-15T10:00:05.000Z" },
    { messageId: "message-other-group", entryId: "entry-9", source: "participant", type: "milestone", severity: "info", factualSummary: "Other group", bubbleText: "另一组", displayMode: "bubble", createdAt: generatedAt },
  ],
  attentionItems: [
    { itemId: "attention-critical", entryId: "entry-1", category: "risk", source: "system", severity: "critical", factualSummary: "Critical risk", status: "open", createdAt: generatedAt, updatedAt: "2026-07-15T10:00:09.000Z" },
    { itemId: "attention-resolved", entryId: "entry-2", category: "obstacle", source: "organizer", severity: "high", factualSummary: "Resolved", status: "resolved", createdAt: generatedAt, updatedAt: generatedAt, resolvedAt: generatedAt },
    { itemId: "attention-other-group", entryId: "entry-9", category: "violation", source: "system", severity: "high", factualSummary: "Other group", status: "open", createdAt: generatedAt, updatedAt: generatedAt },
  ],
};

const view = buildRaceLivePresentation(snapshot, 1, new Date("2026-07-15T10:00:10.000Z"));
assert.equal(view.entries.length, 8);
assert.equal(view.top3.length, 3);
assert.deepEqual(view.providerShare, { codex: 50, claude: 25, other: 25 });
assert.deepEqual(view.bubbles.map((item) => item.messageId), ["message-current"]);
assert.deepEqual(view.attentionItems.map((item) => item.itemId), ["attention-critical"]);
assert.equal(view.elapsedSeconds, 40);
assert.ok(view.bubbles.every((item) => view.entryIds.has(item.entryId)));
assert.ok(view.attentionItems.every((item) => item.status === "open"));

console.log("PASS builds the complete Race Live presentation model");
