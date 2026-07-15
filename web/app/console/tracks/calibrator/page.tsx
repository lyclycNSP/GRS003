import { getAuthContext, canManageRace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTrackCalibratorVersions } from "@/lib/queries";
import { TrackCalibratorClient } from "./TrackCalibratorClient";

export default async function TrackCalibratorPage({ searchParams }: { searchParams?: Promise<{ raceId?: string }> }) {
  const ctx = await getAuthContext();
  const { raceId = ctx?.managedRaceIds[0] ?? "race_bay_2026" } = (await searchParams) ?? {};
  if (!ctx || (!ctx.roles.includes("organizer") && !ctx.roles.includes("admin")) || !canManageRace(ctx, raceId)) return <section className="route-page"><h1>无权打开 Track Calibrator</h1></section>;
  const version = await prisma.trackProfileVersion.findFirst({ where: { status: "published", track: { is: { OR: [{ raceId: null }, { raceId }] } } }, orderBy: { publishedAt: "asc" } });
  if (!version) return <section className="route-page"><h1>没有可复制的已发布 Track</h1></section>;
  const versions = await getTrackCalibratorVersions(raceId);
  return <section className="route-page"><TrackCalibratorClient raceId={raceId} initialProfile={JSON.parse(version.profileJson)} initialBackgroundAssetRef={version.backgroundAssetRef} versions={versions} /></section>;
}
