import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { canManageRace, type AuthContext } from "../auth";
import { prisma } from "../prisma";
import { LocalTrackAssetStore } from "../track-assets/local-store";
import type { TrackAssetStore } from "../track-assets/store";
import { validateTrackPublishInput, TrackPublishInputError } from "./publish-input";
import { parseTrackProfile, type TrackProfile } from "../track-profile";
import { CalibratorValidationReportSchema, ManualValidationSchema } from "./draft-types";

type PublishResult = { ok: true; message: string; id: string; profileHash: string; backgroundHash: string } | { ok: false; message: string };

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]));
  return value;
}

function sourceFingerprint(profile: TrackProfile): string {
  const { status: _status, updatedAt: _updatedAt, publishedAt: _publishedAt, ...source } = profile;
  return createHash("sha256").update(JSON.stringify(stable(source))).digest("hex");
}

export async function publishTrackProfileVersion(
  ctx: AuthContext | null,
  input: { publishRequestId: string; raceId?: string; profileJson: string; validationReportJson: string; manualValidationJson: string; background: File },
  assetStore: TrackAssetStore = new LocalTrackAssetStore()
): Promise<PublishResult> {
  if (!ctx) return { ok: false, message: "请先登录" };
  if (!ctx.roles.includes("organizer") && !ctx.roles.includes("admin")) return { ok: false, message: "只有Organizer或Admin可发布Track" };
  const requestId = input.publishRequestId.trim();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) return { ok: false, message: "publishRequestId格式无效" };
  if (input.raceId) {
    if (!canManageRace(ctx, input.raceId)) return { ok: false, message: "无权发布该Race的Track" };
  } else if (!ctx.roles.includes("admin")) return { ok: false, message: "只有Admin可发布system Track" };

  let clientValidation;
  let manualValidation;
  try {
    clientValidation = CalibratorValidationReportSchema.parse(JSON.parse(input.validationReportJson));
    manualValidation = ManualValidationSchema.parse(JSON.parse(input.manualValidationJson));
  } catch {
    return { ok: false, message: "Track发布核验数据无效" };
  }
  if (!clientValidation.valid) return { ok: false, message: "自动校验未通过，不能发布" };
  if (!Object.values(manualValidation.confirmations).every(Boolean) || !manualValidation.confirmedAt) return { ok: false, message: "请完成全部人工核验后再发布" };

  let validated;
  try { validated = await validateTrackPublishInput(input); }
  catch (error) { return { ok: false, message: error instanceof TrackPublishInputError ? error.message : "Track发布输入无效" }; }
  const idempotent = await prisma.trackProfileVersion.findUnique({ where: { publishRequestId: requestId }, include: { track: true } });
  if (idempotent?.profileHash && idempotent.backgroundHash) {
    const sameScope = idempotent.track.raceId === (input.raceId ?? null);
    let existingProfile: TrackProfile | null = null;
    try { existingProfile = parseTrackProfile(idempotent.profileJson); } catch { existingProfile = null; }
    const samePayload = idempotent.trackId === validated.profile.trackId && idempotent.version === validated.profile.version && idempotent.backgroundHash === validated.backgroundHash && existingProfile !== null && sourceFingerprint(existingProfile) === sourceFingerprint(validated.profile);
    if (!sameScope || !samePayload) return { ok: false, message: "publishRequestId已被不同发布内容使用" };
    return { ok: true, message: "Track版本已发布", id: idempotent.id, profileHash: idempotent.profileHash, backgroundHash: idempotent.backgroundHash };
  }
  const existingTrack = await prisma.trackProfile.findUnique({ where: { trackId: validated.profile.trackId }, include: { versions: { where: { version: validated.profile.version }, select: { id: true } } } });
  if (existingTrack && existingTrack.raceId !== (input.raceId ?? null)) return { ok: false, message: "trackId已属于其他Scope" };
  if (existingTrack?.versions.length) return { ok: false, message: "Track版本或发布请求已存在" };
  const now = new Date();
  const publishedProfile = { ...validated.profile, status: "published" as const, updatedAt: now.toISOString(), publishedAt: now.toISOString() };
  const publishedJson = JSON.stringify(publishedProfile);
  const profileHash = `sha256:${createHash("sha256").update(publishedJson).digest("hex")}`;
  const staged = await assetStore.stage({ publishRequestId: requestId, bytes: validated.bytes, extension: validated.extension });
  try {
    const key = `${publishedProfile.trackId}/${publishedProfile.version}/${validated.backgroundHash.slice("sha256:".length)}.${validated.extension}`;
    const { assetRef } = await assetStore.finalize(staged, key);
    const version = await prisma.$transaction(async (tx) => {
      const existingTrack = await tx.trackProfile.findUnique({ where: { trackId: publishedProfile.trackId } });
      if (existingTrack && existingTrack.raceId !== (input.raceId ?? null)) throw new Error("TRACK_SCOPE_CONFLICT");
      await tx.trackProfile.upsert({
        where: { trackId: publishedProfile.trackId },
        update: {},
        create: { id: `track_${randomUUID()}`, trackId: publishedProfile.trackId, raceId: input.raceId ?? null, name: publishedProfile.name, scope: input.raceId ? "race" : "system" }
      });
      return tx.trackProfileVersion.create({
        data: {
          id: `track-version_${randomUUID()}`,
          trackId: publishedProfile.trackId,
          version: publishedProfile.version,
          status: "published",
          schemaVersion: publishedProfile.schemaVersion,
          profileJson: publishedJson,
          checksum: validated.backgroundHash,
          backgroundAssetRef: assetRef,
          publishRequestId: requestId,
          profileHash,
          backgroundHash: validated.backgroundHash,
          validationReportJson: JSON.stringify({ client: clientValidation, server: validated.validationReport, manual: manualValidation }),
          publishedByUserId: ctx.userId,
          publishedAt: now
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { ok: true, message: "Track版本已发布", id: version.id, profileHash, backgroundHash: validated.backgroundHash };
  } catch (error) {
    await assetStore.discard(staged).catch(() => undefined);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, message: "Track版本或发布请求已存在" };
    if (error instanceof Error && error.message === "TRACK_SCOPE_CONFLICT") return { ok: false, message: "trackId已属于其他Scope" };
    return { ok: false, message: "Track发布失败，浏览器Draft已保留" };
  }
}
