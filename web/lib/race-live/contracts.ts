import { z } from "zod";

const nonEmptyId = z.string().trim().min(1);
const isoDateTime = z.string().datetime({ offset: true });
const normalizedProgress = z.number().finite().min(0).max(1);
const nonNegativeInteger = z.number().int().nonnegative();
const nonNegativeNumber = z.number().finite().nonnegative();

export const ARY_RACE_LIVE_SCHEMA = "ary.race-live.v1" as const;

export const RaceLiveRaceSnapshotSchema = z.object({
  raceId: nonEmptyId,
  title: z.string().trim().min(1),
  subtitle: z.string().trim().min(1).optional(),
  organizerDisplayName: z.string().trim().min(1),
  status: z.enum(["scheduled", "live", "finished"]),
  trackProfileId: nonEmptyId,
  trackProfileVersion: z.string().trim().min(1)
}).strict();

export const RaceLiveRoundSnapshotSchema = z.object({
  roundId: nonEmptyId,
  name: z.string().trim().min(1),
  order: z.number().int().positive(),
  status: z.enum(["pending", "running", "finished"]),
  scheduledStartAt: isoDateTime,
  scheduledEndAt: isoDateTime,
  actualStartedAt: isoDateTime.optional(),
  actualEndedAt: isoDateTime.optional()
}).strict();

export const RaceLiveRuntimeConfigSchema = z.object({
  staleThresholdSeconds: z.number().int().positive(),
  participantOnlineWindowSeconds: z.number().int().positive(),
  bubbleDurationSeconds: z.number().int().positive(),
  maxVisibleBubbles: z.number().int().min(1).max(3),
  maxEntriesPerGroup: z.literal(8)
}).strict();

export const RaceLiveKpiSnapshotSchema = z.object({
  raceRoundProgress: normalizedProgress,
  totalParticipants: nonNegativeInteger,
  onlineParticipants: nonNegativeInteger,
  activeEntries: nonNegativeInteger,
  totalTokens: nonNegativeNumber
}).strict().superRefine((value, context) => {
  if (value.onlineParticipants > value.totalParticipants) {
    context.addIssue({
      code: "custom",
      message: "onlineParticipants cannot exceed totalParticipants",
      path: ["onlineParticipants"]
    });
  }
});

export const AryRaceLiveEntrySnapshotSchema = z.object({
  entryId: nonEmptyId,
  registrationId: nonEmptyId,
  raceProjectId: nonEmptyId,
  participantType: z.enum(["individual", "team"]),
  entrantDisplayName: z.string().trim().min(1),
  teamId: nonEmptyId.optional(),
  participantCount: z.number().int().positive(),
  onlineParticipantCount: nonNegativeInteger,
  rank: z.number().int().positive(),
  roundProgress: normalizedProgress,
  phaseProgress: normalizedProgress.optional(),
  overallProgress: normalizedProgress,
  reachedProgressAt: isoDateTime,
  raceStatus: z.enum(["idle", "running", "blocked", "finished"]),
  dataStatus: z.enum(["fresh", "stale"]),
  riskLevel: z.enum(["none", "low", "medium", "high", "critical"]),
  agentProviders: z.array(z.enum(["codex", "claude", "other"])),
  costTokens: nonNegativeNumber.optional(),
  updatedAt: isoDateTime
}).strict().superRefine((value, context) => {
  if (value.onlineParticipantCount > value.participantCount) {
    context.addIssue({
      code: "custom",
      message: "onlineParticipantCount cannot exceed participantCount",
      path: ["onlineParticipantCount"]
    });
  }
  if (value.roundProgress === 1 && value.raceStatus !== "finished") {
    context.addIssue({
      code: "custom",
      message: "raceStatus must be finished when roundProgress is 1",
      path: ["raceStatus"]
    });
  }
});

export const ScreenDisplayGroupSchema = z.object({
  groupId: nonEmptyId,
  order: z.number().int().positive(),
  entryIds: z.array(nonEmptyId).min(1).max(8)
}).strict();

export const GlobalRankingItemSchema = z.object({
  entryId: nonEmptyId,
  rank: z.number().int().positive(),
  entrantDisplayName: z.string().trim().min(1),
  roundProgress: normalizedProgress
}).strict();

export const RaceLiveMessageSnapshotSchema = z.object({
  messageId: nonEmptyId,
  entryId: nonEmptyId,
  source: z.enum(["participant", "organizer", "system"]),
  type: z.enum(["progress_update", "milestone", "strategy_change", "quality_signal", "risk_alert", "obstacle", "violation", "pit_stop"]),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
  factualSummary: z.string().trim().min(1).max(280),
  bubbleText: z.string().trim().min(1).max(120).optional(),
  displayMode: z.enum(["none", "bubble"]),
  createdAt: isoDateTime,
  expiresAt: isoDateTime.optional()
}).strict();

export const RaceLiveAttentionSnapshotSchema = z.object({
  itemId: nonEmptyId,
  entryId: nonEmptyId,
  category: z.enum(["risk", "obstacle", "violation"]),
  source: z.enum(["participant", "organizer", "system"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  factualSummary: z.string().trim().min(1).max(280),
  status: z.enum(["open", "resolved"]),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  resolvedAt: isoDateTime.optional()
}).strict().superRefine((value, context) => {
  if (value.status === "resolved" && value.resolvedAt === undefined) {
    context.addIssue({ code: "custom", message: "resolvedAt is required for resolved items", path: ["resolvedAt"] });
  }
});

export const AryRaceLiveSnapshotSchema = z.object({
  schemaVersion: z.literal(ARY_RACE_LIVE_SCHEMA),
  raceId: nonEmptyId,
  roundId: nonEmptyId,
  sequence: z.number().int().positive(),
  generatedAt: isoDateTime,
  race: RaceLiveRaceSnapshotSchema,
  round: RaceLiveRoundSnapshotSchema,
  runtimeConfig: RaceLiveRuntimeConfigSchema,
  kpi: RaceLiveKpiSnapshotSchema,
  totalEntryCount: nonNegativeInteger,
  entries: z.array(AryRaceLiveEntrySnapshotSchema),
  displayGroups: z.array(ScreenDisplayGroupSchema),
  globalRanking: z.array(GlobalRankingItemSchema),
  ridingMessages: z.array(RaceLiveMessageSnapshotSchema),
  attentionItems: z.array(RaceLiveAttentionSnapshotSchema)
}).strict().superRefine((value, context) => {
  if (value.race.raceId !== value.raceId) {
    context.addIssue({ code: "custom", message: "race.raceId must match raceId", path: ["race", "raceId"] });
  }
  if (value.round.roundId !== value.roundId) {
    context.addIssue({ code: "custom", message: "round.roundId must match roundId", path: ["round", "roundId"] });
  }
  if (value.entries.length !== value.totalEntryCount) {
    context.addIssue({ code: "custom", message: "entries length must match totalEntryCount", path: ["entries"] });
  }
});

export type AryRaceLiveSnapshot = z.infer<typeof AryRaceLiveSnapshotSchema>;
export type AryRaceLiveEntrySnapshot = z.infer<typeof AryRaceLiveEntrySnapshotSchema>;
export type ScreenDisplayGroup = z.infer<typeof ScreenDisplayGroupSchema>;
export type RaceLiveRaceSnapshot = z.infer<typeof RaceLiveRaceSnapshotSchema>;
export type RaceLiveRoundSnapshot = z.infer<typeof RaceLiveRoundSnapshotSchema>;
export type RaceLiveRuntimeConfig = z.infer<typeof RaceLiveRuntimeConfigSchema>;
export type RaceLiveKpiSnapshot = z.infer<typeof RaceLiveKpiSnapshotSchema>;
export type RaceLiveMessageSnapshot = z.infer<typeof RaceLiveMessageSnapshotSchema>;
export type RaceLiveAttentionSnapshot = z.infer<typeof RaceLiveAttentionSnapshotSchema>;
export type GlobalRankingItem = z.infer<typeof GlobalRankingItemSchema>;
