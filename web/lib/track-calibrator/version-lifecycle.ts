import { canManageRace, type AuthContext } from "../auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { parseTrackProfile } from "../track-profile";

type LifecycleResult = { ok: true; message: string } | { ok: false; message: string };

type VersionWithReferences = Prisma.TrackProfileVersionGetPayload<{ include: { track: true; _count: { select: { raceRounds: true } } } }>;

async function editableVersion(ctx: AuthContext | null, versionId: string): Promise<{ version: VersionWithReferences } | { error: string }> {
  if (!ctx || ctx.activeRole !== "organizer") return { error: "只有 Organizer 可管理 Track 版本" } as const;
  const version = await prisma.trackProfileVersion.findUnique({ where: { id: versionId }, include: { track: true, _count: { select: { raceRounds: true } } } });
  if (!version) return { error: "Track版本不存在" } as const;
  if (version.track.raceId !== null && !canManageRace(ctx, version.track.raceId)) return { error: "无权管理该 Race 的 Track" } as const;
  return { version } as const;
}

export async function archiveTrackProfileVersion(ctx: AuthContext | null, versionId: string): Promise<LifecycleResult> {
  const lookup = await editableVersion(ctx, versionId);
  if ("error" in lookup) return { ok: false, message: lookup.error };
  if (lookup.version.status !== "published") return { ok: false, message: "只有published版本可归档" };
  if (lookup.version._count.raceRounds > 0) return { ok: false, message: "该版本已被Round引用，不能归档" };
  let profile;
  try { profile = parseTrackProfile(lookup.version.profileJson); }
  catch { return { ok: false, message: "Track Profile内容无效，不能归档" }; }
  await prisma.trackProfileVersion.update({ where: { id: versionId }, data: { status: "archived", profileJson: JSON.stringify({ ...profile, status: "archived" }) } });
  return { ok: true, message: "Track版本已归档" };
}

export async function deleteArchivedTrackProfileVersion(ctx: AuthContext | null, versionId: string): Promise<LifecycleResult> {
  const lookup = await editableVersion(ctx, versionId);
  if ("error" in lookup) return { ok: false, message: lookup.error };
  if (lookup.version.status !== "archived") return { ok: false, message: "只有archived版本可删除" };
  if (lookup.version._count.raceRounds > 0) return { ok: false, message: "该版本已被Round引用，不能删除" };
  await prisma.trackProfileVersion.delete({ where: { id: versionId } });
  return { ok: true, message: "Track版本已删除" };
}
