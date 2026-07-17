import { randomUUID } from "node:crypto";
import { canManageRace, type AuthContext } from "../auth";
import { prisma } from "../prisma";
import { AryRaceLiveSnapshotSchema } from "./contracts";
import { resolveActiveGroup } from "./rotation";
export { resolveActiveGroup } from "./rotation";

type ControlResult = { ok: true; message: string; id: string } | { ok: false; message: string };

function authorize(ctx: AuthContext | null, raceId: string, reason?: string): ControlResult | null {
  if (!ctx) return { ok: false, message: "请先登录 Organizer 账号" };
  if (ctx.activeRole !== "organizer" || !canManageRace(ctx, raceId)) return { ok: false, message: "没有控制该赛事大屏的权限" };
  return null;
}

async function displayGroupCount(stableProjectionId: string | null): Promise<number> {
  if (!stableProjectionId) return 1;
  const projection = await prisma.projection.findUnique({ where: { id: stableProjectionId }, select: { payloadJson: true } });
  if (!projection) return 1;
  try {
    const parsed = AryRaceLiveSnapshotSchema.safeParse(JSON.parse(projection.payloadJson));
    return parsed.success ? Math.max(1, parsed.data.displayGroups.length) : 1;
  } catch {
    return 1;
  }
}

async function audit(input: {
  raceId: string;
  screenStateId: string;
  actorUserId: string;
  action: string;
  reason?: string;
  payload: unknown;
}) {
  return prisma.screenControlAuditEvent.create({
    data: {
      id: `screen-audit_${randomUUID()}`,
      raceId: input.raceId,
      screenStateId: input.screenStateId,
      actorUserId: input.actorUserId,
      action: input.action,
      reason: input.reason?.trim() || null,
      payloadJson: JSON.stringify(input.payload)
    }
  });
}

async function getOrCreateState(raceId: string, now: Date) {
  return prisma.screenState.upsert({
    where: { raceId },
    update: {},
    create: { id: `screen_${randomUUID()}`, raceId, mode: "live", rotationEpochAt: now }
  });
}

export async function pauseScreenRotation(
  ctx: AuthContext | null,
  input: { raceId: string; reason?: string; now?: Date }
): Promise<ControlResult> {
  const denied = authorize(ctx, input.raceId, input.reason);
  if (denied) return denied;
  const now = input.now ?? new Date();
  const state = await getOrCreateState(input.raceId, now);
  const groupCount = await displayGroupCount(state.stableProjectionId);
  const activeGroupOrder = resolveActiveGroup({
    groupCount,
    activeOrder: state.activeGroupOrder,
    autoRotateEnabled: state.autoRotateEnabled,
    rotationEpochAt: state.rotationEpochAt,
    intervalSeconds: state.rotationIntervalSeconds,
    now
  });
  await prisma.$transaction([
    prisma.screenState.update({ where: { id: state.id }, data: { activeGroupOrder, autoRotateEnabled: false, rotationPausedAt: now, controlVersion: { increment: 1 } } }),
    prisma.screenControlAuditEvent.create({ data: { id: `screen-audit_${randomUUID()}`, raceId: input.raceId, screenStateId: state.id, actorUserId: ctx!.userId, action: "rotation_paused", reason: input.reason?.trim() || null, payloadJson: JSON.stringify({ pausedAt: now.toISOString(), activeGroupOrder, groupCount }) } })
  ]);
  return { ok: true, message: "自动轮播已暂停", id: state.id };
}

export async function resumeScreenRotation(
  ctx: AuthContext | null,
  input: { raceId: string; reason?: string; now?: Date }
): Promise<ControlResult> {
  const denied = authorize(ctx, input.raceId, input.reason);
  if (denied) return denied;
  const now = input.now ?? new Date();
  const state = await getOrCreateState(input.raceId, now);
  await prisma.$transaction([
    prisma.screenState.update({ where: { id: state.id }, data: { autoRotateEnabled: true, rotationPausedAt: null, rotationEpochAt: now, controlVersion: { increment: 1 } } }),
    prisma.screenControlAuditEvent.create({ data: { id: `screen-audit_${randomUUID()}`, raceId: input.raceId, screenStateId: state.id, actorUserId: ctx!.userId, action: "rotation_resumed", reason: input.reason?.trim() || null, payloadJson: JSON.stringify({ resumedAt: now.toISOString() }) } })
  ]);
  return { ok: true, message: "自动轮播已继续", id: state.id };
}

export async function moveScreenDisplayGroup(
  ctx: AuthContext | null,
  input: { raceId: string; direction: "previous" | "next"; reason?: string; now?: Date }
): Promise<ControlResult> {
  const denied = authorize(ctx, input.raceId, input.reason);
  if (denied) return denied;
  const now = input.now ?? new Date();
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const state = await getOrCreateState(input.raceId, now);
    const groupCount = await displayGroupCount(state.stableProjectionId);
    const currentOrder = resolveActiveGroup({
      groupCount,
      activeOrder: state.activeGroupOrder,
      autoRotateEnabled: state.autoRotateEnabled,
      rotationEpochAt: state.rotationEpochAt,
      intervalSeconds: state.rotationIntervalSeconds,
      now
    });
    const delta = input.direction === "next" ? 1 : -1;
    const nextOrder = ((currentOrder - 1 + delta) % groupCount + groupCount) % groupCount + 1;
    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.screenState.updateMany({
          where: { id: state.id, controlVersion: state.controlVersion },
          data: { activeGroupOrder: nextOrder, rotationEpochAt: now, controlVersion: { increment: 1 } }
        });
        if (updated.count !== 1) throw new Error("SCREEN_CONTROL_CONFLICT");
        await tx.screenControlAuditEvent.create({ data: { id: `screen-audit_${randomUUID()}`, raceId: input.raceId, screenStateId: state.id, actorUserId: ctx!.userId, action: `group_${input.direction}`, reason: input.reason?.trim() || null, payloadJson: JSON.stringify({ previousGroupOrder: currentOrder, activeGroupOrder: nextOrder, groupCount }) } });
      });
      return { ok: true, message: `已切换到第 ${nextOrder} 组`, id: state.id };
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "SCREEN_CONTROL_CONFLICT") throw error;
      if (attempt === 3) return { ok: false, message: "大屏控制并发冲突，请重试" };
    }
  }
  return { ok: false, message: "大屏控制并发冲突，请重试" };
}

export async function configureScreenRotation(
  ctx: AuthContext | null,
  input: { raceId: string; intervalSeconds: number; reason?: string; now?: Date }
): Promise<ControlResult> {
  const denied = authorize(ctx, input.raceId, input.reason);
  if (denied) return denied;
  if (!Number.isInteger(input.intervalSeconds) || input.intervalSeconds < 5 || input.intervalSeconds > 120) {
    return { ok: false, message: "轮播间隔必须为 5 到 120 秒" };
  }
  const now = input.now ?? new Date();
  const state = await getOrCreateState(input.raceId, now);
  await prisma.$transaction([
    prisma.screenState.update({ where: { id: state.id }, data: { rotationIntervalSeconds: input.intervalSeconds, rotationEpochAt: now, controlVersion: { increment: 1 } } }),
    prisma.screenControlAuditEvent.create({ data: { id: `screen-audit_${randomUUID()}`, raceId: input.raceId, screenStateId: state.id, actorUserId: ctx!.userId, action: "rotation_configured", reason: input.reason?.trim() || null, payloadJson: JSON.stringify({ intervalSeconds: input.intervalSeconds }) } })
  ]);
  return { ok: true, message: "轮播间隔已更新", id: state.id };
}
