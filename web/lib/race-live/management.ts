import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { type AuthContext, canManageRace, requireManagedRace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAryRaceLiveProjection, buildAryRaceLiveProjectionInternal } from "./projection-builder";

export type RaceLiveResult = { ok: true; message: string; id?: string } | { ok: false; message: string };
export type RaceLiveReadinessIssue = { level: "warning" | "blocked"; code: string; message: string };
export type RaceLiveReadiness = {
  status: "ready" | "warning" | "blocked";
  candidateRound: null | {
    id: string;
    name: string;
    status: string;
    trackName: string;
    trackVersion: string;
    activeEntries: number;
    totalEntries: number;
  };
  runningRoundCount: number;
  issues: RaceLiveReadinessIssue[];
  projection: null | { id: string; status: string; generatedAt: Date | null; sequence: number | null };
};

const ok = (message: string, id?: string): RaceLiveResult => id ? { ok: true, message, id } : { ok: true, message };
const fail = (message: string): RaceLiveResult => ({ ok: false, message });

async function managed(ctx: AuthContext | null, raceId: string) {
  if (!canManageRace(ctx, raceId)) return false;
  return Boolean(await prisma.race.findUnique({ where: { id: raceId }, select: { id: true } }));
}

export async function getRaceLiveReadiness(raceId: string): Promise<RaceLiveReadiness> {
  const [rounds, state] = await Promise.all([
    prisma.raceRound.findMany({
      where: { raceId },
      orderBy: { order: "asc" },
      include: {
        trackProfileVersion: { include: { track: true } },
        entries: { include: { registration: { select: { raceId: true, status: true } } } }
      }
    }),
    prisma.screenState.findUnique({ where: { raceId }, include: { stableProjection: true } })
  ]);
  const running = rounds.filter((round) => round.status === "running");
  const candidate = running.length === 1 ? running[0] : running.length === 0 ? rounds.find((round) => round.status === "pending") ?? null : null;
  const issues: RaceLiveReadinessIssue[] = [];
  if (running.length > 1) issues.push({ level: "blocked", code: "multiple_running_rounds", message: "同一赛事存在多个 running Round，请先修复 Round 状态。" });
  if (!candidate) issues.push({ level: "blocked", code: "missing_round", message: "等待 Round：没有可用于大屏的 running 或 pending Round。" });
  if (candidate) {
    const version = candidate.trackProfileVersion;
    if (version.status !== "published") issues.push({ level: "blocked", code: "track_unpublished", message: "当前 Round 绑定的 Track 版本尚未发布。" });
    if (!version.backgroundAssetRef.startsWith("/tracks/")) issues.push({ level: "blocked", code: "track_asset_invalid", message: "Track 背景资源不是已发布的站内资源。" });
    const active = candidate.entries.filter((entry) => entry.status === "active" && entry.registration.raceId === raceId && entry.registration.status === "approved");
    if (!active.length) issues.push({ level: "blocked", code: "missing_entries", message: "当前 Round 没有已批准的 active 参赛者。" });
    if (candidate.status === "pending") issues.push({ level: "warning", code: "round_requires_start", message: "确认准备后将启动此 pending Round。" });
  }
  const status = issues.some((issue) => issue.level === "blocked") ? "blocked" : issues.length ? "warning" : "ready";
  return {
    status,
    candidateRound: candidate ? {
      id: candidate.id,
      name: candidate.name,
      status: candidate.status,
      trackName: candidate.trackProfileVersion.track.name,
      trackVersion: candidate.trackProfileVersion.version,
      activeEntries: candidate.entries.filter((entry) => entry.status === "active" && entry.registration.status === "approved").length,
      totalEntries: candidate.entries.length
    } : null,
    runningRoundCount: running.length,
    issues,
    projection: state?.stableProjection?.type === "ary_race_live" ? {
      id: state.stableProjection.id,
      status: state.stableProjection.status,
      generatedAt: state.stableProjection.generatedAt,
      sequence: state.stableProjection.sequence
    } : null
  };
}

export async function getRaceLiveManagementSnapshot(raceId: string) {
  const [readiness, rounds, tracks] = await Promise.all([
    getRaceLiveReadiness(raceId),
    prisma.raceRound.findMany({
      where: { raceId },
      orderBy: { order: "asc" },
      include: {
        trackProfileVersion: { include: { track: true } },
        entries: {
          orderBy: { displayOrder: "asc" },
          include: { registration: { include: { user: true, team: true } } }
        }
      }
    }),
    prisma.trackProfileVersion.findMany({
      where: { status: "published", track: { OR: [{ raceId: null }, { raceId }] } },
      orderBy: { publishedAt: "desc" },
      include: { track: true }
    })
  ]);
  return { readiness, rounds, tracks };
}

export async function createRaceRound(ctx: AuthContext | null, input: {
  raceId: string; name: string; order: number; scheduledStartAt: Date; scheduledEndAt: Date; trackProfileVersionId: string;
}): Promise<RaceLiveResult> {
  if (!await managed(ctx, input.raceId)) return fail("没有管理该赛事 Round 的权限");
  if (!input.name.trim()) return fail("请填写 Round 名称");
  if (!Number.isInteger(input.order) || input.order < 1) return fail("Round 顺序必须为正整数");
  if (!(input.scheduledStartAt < input.scheduledEndAt)) return fail("Round 结束时间必须晚于开始时间");
  const version = await prisma.trackProfileVersion.findUnique({ where: { id: input.trackProfileVersionId }, include: { track: true } });
  if (!version || version.status !== "published") return fail("只能绑定已发布的 Track 版本");
  if (version.track.raceId && version.track.raceId !== input.raceId) return fail("Race Track 不能跨赛事使用");
  try {
    const round = await prisma.raceRound.create({ data: {
      id: `round_${randomUUID()}`, raceId: input.raceId, name: input.name.trim(), order: input.order, status: "pending",
      scheduledStartAt: input.scheduledStartAt, scheduledEndAt: input.scheduledEndAt, trackProfileVersionId: version.id
    } });
    return ok("Round 已创建", round.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail("当前赛事已存在相同顺序的 Round");
    throw error;
  }
}

export async function syncRaceRoundRoster(ctx: AuthContext | null, raceId: string, roundId: string): Promise<RaceLiveResult> {
  requireManagedRace(ctx, raceId);
  return prisma.$transaction(async (tx) => {
    const round = await tx.raceRound.findUnique({ where: { id: roundId }, include: { entries: true } });
    if (!round || round.raceId !== raceId) return fail("Round 不存在");
    if (round.status !== "pending") return fail("只有 pending Round 可以同步名单");
    const approved = await tx.registration.findMany({ where: { raceId, status: "approved" }, orderBy: { submittedAt: "asc" }, select: { id: true } });
    const existing = new Set(round.entries.map((entry) => entry.registrationId));
    let nextOrder = round.entries.reduce((max, entry) => Math.max(max, entry.displayOrder), 0) + 1;
    for (const registration of approved) {
      if (existing.has(registration.id)) continue;
      await tx.raceRoundEntry.create({ data: { id: `round-entry_${randomUUID()}`, raceRoundId: round.id, registrationId: registration.id, displayOrder: nextOrder++, status: "active" } });
    }
    return ok(`名单已同步，当前 ${round.entries.length + approved.filter((item) => !existing.has(item.id)).length} 项`, round.id);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function setRaceRoundEntryStatus(ctx: AuthContext | null, input: { raceId: string; roundEntryId: string; status: "active" | "excluded" }): Promise<RaceLiveResult> {
  requireManagedRace(ctx, input.raceId);
  const entry = await prisma.raceRoundEntry.findUnique({ where: { id: input.roundEntryId }, include: { raceRound: true } });
  if (!entry || entry.raceRound.raceId !== input.raceId) return fail("Round Entry 不存在");
  if (entry.raceRound.status !== "pending") return fail("Round 启动后不能修改名单");
  await prisma.raceRoundEntry.update({ where: { id: entry.id }, data: { status: input.status } });
  return ok(input.status === "active" ? "参赛者已恢复" : "参赛者已排除", entry.id);
}

export async function moveRaceRoundEntry(ctx: AuthContext | null, input: { raceId: string; roundEntryId: string; direction: "up" | "down" }): Promise<RaceLiveResult> {
  requireManagedRace(ctx, input.raceId);
  return prisma.$transaction(async (tx) => {
    const entry = await tx.raceRoundEntry.findUnique({ where: { id: input.roundEntryId }, include: { raceRound: true } });
    if (!entry || entry.raceRound.raceId !== input.raceId) return fail("Round Entry 不存在");
    if (entry.raceRound.status !== "pending") return fail("Round 启动后不能调整顺序");
    const neighbor = await tx.raceRoundEntry.findFirst({
      where: { raceRoundId: entry.raceRoundId, displayOrder: input.direction === "up" ? { lt: entry.displayOrder } : { gt: entry.displayOrder } },
      orderBy: { displayOrder: input.direction === "up" ? "desc" : "asc" }
    });
    if (!neighbor) return ok("已经位于边界", entry.id);
    await tx.raceRoundEntry.update({ where: { id: entry.id }, data: { displayOrder: -1 } });
    await tx.raceRoundEntry.update({ where: { id: neighbor.id }, data: { displayOrder: entry.displayOrder } });
    await tx.raceRoundEntry.update({ where: { id: entry.id }, data: { displayOrder: neighbor.displayOrder } });
    return ok("显示顺序已更新", entry.id);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function recordFailedProjection(raceId: string, message: string) {
  const state = await prisma.screenState.findUnique({ where: { raceId }, select: { stableProjectionId: true } });
  await prisma.projection.create({ data: {
    id: `projection_${randomUUID()}`, raceId, type: "ary_race_live", status: "failed", stableVersionId: state?.stableProjectionId ?? null,
    payloadJson: JSON.stringify({ error: "race_live_refresh_failed", message: message.slice(0, 240) }), lastRebuiltAt: new Date(), schemaVersion: "ary.race-live.v1"
  } });
}

export async function prepareRaceLive(ctx: AuthContext | null, raceId: string, roundId: string, confirmStart: boolean): Promise<RaceLiveResult> {
  requireManagedRace(ctx, raceId);
  const readiness = await getRaceLiveReadiness(raceId);
  if (!readiness.candidateRound || readiness.candidateRound.id !== roundId) return fail("大屏候选 Round 已变化，请重新预检");
  const blocked = readiness.issues.find((issue) => issue.level === "blocked");
  if (blocked) return fail(blocked.message);
  const round = await prisma.raceRound.findUnique({ where: { id: roundId } });
  if (!round || round.raceId !== raceId) return fail("Round 不存在");
  if (round.status === "pending") {
    if (!confirmStart) return fail("请确认启动 pending Round");
    const running = await prisma.raceRound.count({ where: { raceId, status: "running" } });
    if (running) return fail("当前赛事已有 running Round");
    await prisma.raceRound.update({ where: { id: round.id }, data: { status: "running", actualStartedAt: new Date() } });
  }
  const built = await buildAryRaceLiveProjection(ctx, { raceId, roundId });
  if (!built.ok) {
    if (round.status === "pending") await prisma.raceRound.update({ where: { id: round.id }, data: { status: "pending", actualStartedAt: null } });
    await recordFailedProjection(raceId, built.message);
    return built;
  }
  await prisma.screenState.update({ where: { raceId }, data: { mode: "live", activeGroupOrder: 1, rotationEpochAt: new Date() } });
  return ok("Race Live 已准备并切换到 Live", built.id);
}

export async function refreshRaceLive(ctx: AuthContext | null, raceId: string): Promise<RaceLiveResult> {
  requireManagedRace(ctx, raceId);
  const state = await prisma.screenState.findUnique({ where: { raceId }, include: { currentRound: true } });
  if (!state?.currentRound || !["running", "finished"].includes(state.currentRound.status)) return fail("请先准备一个 running Round");
  const built = await buildAryRaceLiveProjection(ctx, { raceId, roundId: state.currentRound.id });
  if (!built.ok) await recordFailedProjection(raceId, built.message);
  return built.ok ? ok("Race Live Projection 已刷新", built.id) : built;
}

export async function refreshRaceLiveAfterSourceEvent(raceId: string): Promise<void> {
  const state = await prisma.screenState.findUnique({ where: { raceId }, include: { currentRound: true } });
  if (!state?.currentRound || state.currentRound.status !== "running") return;
  const result = await buildAryRaceLiveProjectionInternal({ raceId, roundId: state.currentRound.id });
  if (!result.ok) await recordFailedProjection(raceId, result.message);
}

export async function finishRaceRound(ctx: AuthContext | null, raceId: string, roundId: string): Promise<RaceLiveResult> {
  requireManagedRace(ctx, raceId);
  const round = await prisma.raceRound.findUnique({ where: { id: roundId } });
  if (!round || round.raceId !== raceId) return fail("Round 不存在");
  if (round.status !== "running") return fail("只有 running Round 可以结束");
  await prisma.raceRound.update({ where: { id: round.id }, data: { status: "finished", actualEndedAt: new Date() } });
  const built = await buildAryRaceLiveProjection(ctx, { raceId, roundId });
  if (!built.ok) await recordFailedProjection(raceId, built.message);
  return built.ok ? ok("Round 已结束并生成最终大屏", round.id) : built;
}
