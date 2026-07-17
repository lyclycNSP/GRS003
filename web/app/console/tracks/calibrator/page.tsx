import { getAuthContext, canManageRace } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTrackCalibratorVersions } from "@/lib/queries";
import { TrackCalibratorClient } from "./TrackCalibratorClient";
import styles from "../TrackTools.module.css";

export default async function TrackCalibratorPage({ searchParams }: { searchParams?: Promise<{ raceId?: string }> }) {
  const ctx = await getAuthContext();
  const { raceId } = (await searchParams) ?? {};
  if (!ctx) {
    const next = `/console/tracks/calibrator${raceId ? `?raceId=${encodeURIComponent(raceId)}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!raceId) return <section className={styles.statePage}><h1>请先进入一场 Race</h1><p>Track Calibrator 不会自动选择其他 Race，请从 Race Workspace 的赛道管理入口进入。</p></section>;
  if (ctx.activeRole !== "organizer" || !canManageRace(ctx, raceId)) return <section className={styles.statePage}><h1>无权打开 Track Calibrator</h1></section>;
  const version = await prisma.trackProfileVersion.findFirst({ where: { status: "published", track: { is: { OR: [{ raceId: null }, { raceId }] } } }, orderBy: { publishedAt: "asc" } });
  if (!version) return <section className={styles.statePage}><h1>没有可复制的已发布 Track</h1></section>;
  const versions = await getTrackCalibratorVersions(raceId);
  return <section className={styles.calibratorRoute} data-testid="track-calibrator-workspace"><TrackCalibratorClient raceId={raceId} initialProfile={JSON.parse(version.profileJson)} initialBackgroundAssetRef={version.backgroundAssetRef} versions={versions} /></section>;
}
