import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { requireManagedRace, type AuthContext } from "../auth";
import { prisma } from "../prisma";
import { parseTrackProfile } from "../track-profile";
import { isPublishedTrackAssetRef } from "../track-assets/public-ref";
import { AryRaceLiveSnapshotSchema, type AryRaceLiveEntrySnapshot, type AryRaceLiveSnapshot } from "./contracts";
import { createScreenDisplayGroups } from "./grouping";

type ProjectionBuildResult =
  | { ok: true; message: string; id: string; snapshot: AryRaceLiveSnapshot }
  | { ok: false; message: string };

type ProgressMetrics = { progressPercent?: unknown; tokens?: unknown };

const ATTENTION_ALLOWLIST = {
  cost_watch: { category: "risk", factualSummary: "Open cost monitoring signal." },
  compliance_violation: { category: "violation", factualSummary: "Open compliance signal." },
  delivery_blocker: { category: "obstacle", factualSummary: "Open delivery blocker signal." }
} as const;

export function deriveEntryProgress(metrics: ProgressMetrics): { progress: number; dataStatus: "fresh" | "stale" } {
  if (typeof metrics.progressPercent !== "number" || !Number.isFinite(metrics.progressPercent)) {
    return { progress: 0, dataStatus: "stale" };
  }
  return {
    progress: Math.max(0, Math.min(1, metrics.progressPercent / 100)),
    dataStatus: "fresh"
  };
}

export function deriveDataStatus(lastSyncedAt: Date | null, now: Date, staleThresholdSeconds = 60): "fresh" | "stale" {
  return lastSyncedAt && now.getTime() - lastSyncedAt.getTime() <= staleThresholdSeconds * 1000 ? "fresh" : "stale";
}

function parseMetrics(metricsJson: string): ProgressMetrics {
  try {
    const value = JSON.parse(metricsJson) as unknown;
    return value !== null && typeof value === "object" ? value as ProgressMetrics : {};
  } catch {
    return {};
  }
}

function riskLevel(flags: readonly { severity: string; status: string }[]): AryRaceLiveEntrySnapshot["riskLevel"] {
  const weights = { none: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;
  let result: AryRaceLiveEntrySnapshot["riskLevel"] = "none";
  for (const flag of flags.filter((item) => item.status === "open")) {
    const candidate = flag.severity === "critical" ? "critical"
      : flag.severity === "error" ? "high"
      : flag.severity === "warning" ? "medium"
      : flag.severity === "info" ? "low" : "medium";
    if (weights[candidate] > weights[result]) result = candidate;
  }
  return result;
}

function raceStatus(status: string): "scheduled" | "live" | "finished" {
  if (status === "finished" || status === "archived") return "finished";
  if (status === "running" || status === "published") return "live";
  return "scheduled";
}

function canonicalHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function buildAryRaceLiveProjection(
  ctx: AuthContext | null,
  input: { raceId: string; roundId: string; now?: Date }
): Promise<ProjectionBuildResult> {
  requireManagedRace(ctx, input.raceId);
  const now = input.now ?? new Date();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const round = await tx.raceRound.findUnique({
          where: { id: input.roundId },
          include: {
            race: { include: { createdBy: true } },
            trackProfileVersion: true,
            entries: {
              where: { status: "active", registration: { is: { raceId: input.raceId, status: "approved" } } },
              orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
              include: {
                registration: {
                  include: {
                    user: true,
                    team: { include: { members: true } },
                    raceProject: { include: { caConnections: { include: { sessions: true } } } },
                    reviewFlags: true
                  }
                }
              }
            }
          }
        });
        if (!round || round.raceId !== input.raceId) return { ok: false, message: "RaceRound不存在" };
        let trackProfile;
        try {
          trackProfile = parseTrackProfile(round.trackProfileVersion.profileJson);
        } catch {
          return { ok: false, message: "Track Profile无效" };
        }
        if (
          round.trackProfileVersion.status !== "published" || trackProfile.status !== "published" ||
          round.trackProfileVersion.trackId !== trackProfile.trackId || round.trackProfileVersion.version !== trackProfile.version ||
          round.trackProfileVersion.checksum !== trackProfile.background.checksum ||
          !isPublishedTrackAssetRef({ trackId: trackProfile.trackId, version: trackProfile.version, fileName: trackProfile.background.fileName, checksum: round.trackProfileVersion.checksum, backgroundHash: round.trackProfileVersion.backgroundHash, backgroundAssetRef: round.trackProfileVersion.backgroundAssetRef })
        ) return { ok: false, message: "Track Profile发布身份不一致" };

        const previous = await tx.projection.findFirst({
          where: { raceId: input.raceId, type: "ary_race_live", status: "stable", schemaVersion: "ary.race-live.v1" },
          orderBy: { sequence: "desc" }
        });
        let previousSnapshot: AryRaceLiveSnapshot | null = null;
        if (previous) {
          try {
            const parsed = AryRaceLiveSnapshotSchema.safeParse(JSON.parse(previous.payloadJson));
            if (parsed.success && parsed.data.roundId === input.roundId) previousSnapshot = parsed.data;
          } catch {
            previousSnapshot = null;
          }
        }
        const previousByRegistration = new Map(previousSnapshot?.entries.map((entry) => [entry.registrationId, entry]) ?? []);

        const entries = round.entries.filter(({ registration }) => registration.status === "approved" && registration.raceId === input.raceId).map(({ registration, displayOrder, id }) => {
          const project = registration.raceProject;
          const metrics = parseMetrics(project?.metricsJson ?? "{}");
          const derived = deriveEntryProgress(metrics);
          const old = previousByRegistration.get(registration.id);
          const roundProgress = Math.max(old?.roundProgress ?? 0, derived.progress);
          const overallProgress = Math.max(old?.overallProgress ?? 0, derived.progress);
          const sessions = project?.caConnections.flatMap((connection) => connection.sessions) ?? [];
          const onlineCutoff = now.getTime() - 120_000;
          const onlineParticipantCount = sessions.some((session) => (session.lastActiveAt?.getTime() ?? 0) >= onlineCutoff) ? 1 : 0;
          const participantCount = registration.team?.members.length || 1;
          const providers = [...new Set((project?.caConnections ?? []).map((connection) =>
            connection.caType === "codex" || connection.caType === "claude" ? connection.caType : "other"
          ))] as AryRaceLiveEntrySnapshot["agentProviders"];
          return {
            displayOrder,
            value: {
              entryId: id,
              registrationId: registration.id,
              raceProjectId: project?.id ?? `unconfigured:${registration.id}`,
              participantType: registration.participantType === "team" ? "team" as const : "individual" as const,
              entrantDisplayName: registration.team?.name ?? registration.user.displayName,
              ...(registration.teamId ? { teamId: registration.teamId } : {}),
              participantCount,
              onlineParticipantCount: Math.min(onlineParticipantCount, participantCount),
              rank: 1,
              roundProgress,
              overallProgress,
              reachedProgressAt: (project?.lastSyncedAt ?? registration.approvedAt ?? registration.submittedAt).toISOString(),
              raceStatus: roundProgress >= 1 ? "finished" as const : roundProgress > 0 ? "running" as const : "idle" as const,
              dataStatus: deriveDataStatus(project?.lastSyncedAt ?? null, now),
              riskLevel: riskLevel(registration.reviewFlags),
              agentProviders: providers,
              costTokens: sessions.reduce((sum, session) => sum + Math.max(0, session.tokens), 0),
              updatedAt: (project?.lastSyncedAt ?? registration.approvedAt ?? registration.submittedAt).toISOString()
            }
          };
        });

        const ranked = [...entries].sort((left, right) =>
          right.value.roundProgress - left.value.roundProgress || left.displayOrder - right.displayOrder || left.value.entryId.localeCompare(right.value.entryId)
        );
        ranked.forEach((entry, index) => { entry.value.rank = index + 1; });
        const orderedEntries = entries.sort((left, right) => left.displayOrder - right.displayOrder || left.value.entryId.localeCompare(right.value.entryId));
        const totalParticipants = orderedEntries.reduce((sum, entry) => sum + entry.value.participantCount, 0);
        const totalTokens = orderedEntries.reduce((sum, entry) => sum + (entry.value.costTokens ?? 0), 0);
        const sequenceAggregate = await tx.projection.aggregate({
          where: { raceId: input.raceId, type: "ary_race_live" },
          _max: { sequence: true }
        });
        const sequence = (sequenceAggregate._max.sequence ?? 0) + 1;
        const snapshot = AryRaceLiveSnapshotSchema.parse({
          schemaVersion: "ary.race-live.v1",
          raceId: input.raceId,
          roundId: round.id,
          sequence,
          generatedAt: now.toISOString(),
          race: {
            raceId: round.race.id,
            title: round.race.title,
            organizerDisplayName: round.race.createdBy.displayName,
            status: raceStatus(round.race.status),
            trackProfileId: round.trackProfileVersion.trackId,
            trackProfileVersion: round.trackProfileVersion.version
          },
          round: {
            roundId: round.id,
            name: round.name,
            order: round.order,
            status: round.status,
            scheduledStartAt: round.scheduledStartAt.toISOString(),
            scheduledEndAt: round.scheduledEndAt.toISOString(),
            ...(round.actualStartedAt ? { actualStartedAt: round.actualStartedAt.toISOString() } : {}),
            ...(round.actualEndedAt ? { actualEndedAt: round.actualEndedAt.toISOString() } : {})
          },
          runtimeConfig: {
            staleThresholdSeconds: 60,
            participantOnlineWindowSeconds: 120,
            bubbleDurationSeconds: 8,
            maxVisibleBubbles: 3,
            maxEntriesPerGroup: 8
          },
          kpi: {
            raceRoundProgress: orderedEntries.length ? orderedEntries.reduce((sum, entry) => sum + entry.value.roundProgress, 0) / orderedEntries.length : 0,
            totalParticipants,
            onlineParticipants: orderedEntries.reduce((sum, entry) => sum + entry.value.onlineParticipantCount, 0),
            activeEntries: orderedEntries.filter((entry) => entry.value.raceStatus === "running").length,
            totalTokens
          },
          totalEntryCount: orderedEntries.length,
          entries: orderedEntries.map((entry) => entry.value),
          displayGroups: createScreenDisplayGroups(round.id, orderedEntries.map((entry) => ({ entryId: entry.value.entryId, displayOrder: entry.displayOrder }))),
          globalRanking: ranked.map((entry) => ({
            entryId: entry.value.entryId,
            rank: entry.value.rank,
            entrantDisplayName: entry.value.entrantDisplayName,
            roundProgress: entry.value.roundProgress
          })),
          ridingMessages: [],
          attentionItems: orderedEntries.flatMap((entry) => {
            const source = round.entries.find((item) => item.id === entry.value.entryId)?.registration.reviewFlags ?? [];
            return source.flatMap((flag) => {
              const publicSignal = ATTENTION_ALLOWLIST[flag.type as keyof typeof ATTENTION_ALLOWLIST];
              if (flag.status !== "open" || flag.severity === "info" || !publicSignal) return [];
              return [{
              itemId: flag.id,
              entryId: entry.value.entryId,
              category: publicSignal.category,
              source: "system" as const,
              severity: flag.severity === "critical" ? "critical" as const : flag.severity === "error" ? "high" as const : "medium" as const,
              factualSummary: publicSignal.factualSummary,
              status: "open" as const,
              createdAt: flag.createdAt.toISOString(),
              updatedAt: (flag.resolvedAt ?? flag.createdAt).toISOString()
              }];
            });
          })
        });

        const projectionId = `projection_${randomUUID()}`;
        await tx.projection.create({
          data: {
            id: projectionId,
            raceId: input.raceId,
            type: "ary_race_live",
            status: "stable",
            payloadJson: JSON.stringify(snapshot),
            stableVersionId: projectionId,
            lastRebuiltAt: now,
            schemaVersion: snapshot.schemaVersion,
            sequence,
            generatedAt: now,
            sourceWatermark: `${round.id}:${now.toISOString()}`,
            payloadHash: canonicalHash(snapshot)
          }
        });
        await tx.screenState.upsert({
          where: { raceId: input.raceId },
          update: { currentRoundId: round.id, stableProjectionId: projectionId, activeGroupOrder: 1, rotationEpochAt: now },
          create: { id: `screen_${randomUUID()}`, raceId: input.raceId, mode: "live", currentRoundId: round.id, stableProjectionId: projectionId }
        });
        return { ok: true, message: "Race Live Projection已重建", id: projectionId, snapshot };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002");
      if (!retryable) throw error;
      if (attempt === 3) return { ok: false, message: "Projection并发冲突，请重试" };
    }
  }
  return { ok: false, message: "Projection并发冲突，请重试" };
}
