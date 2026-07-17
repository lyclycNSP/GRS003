import { fromJson } from "@/lib/json";
import { getEntrantDisplay, getPublicRaceLiveSnapshot, getScreenSnapshot } from "@/lib/queries";
import { getRaceLiveReadiness } from "@/lib/race-live/management";
import { UnifiedScreenClient, type RaceLivePayload } from "./UnifiedScreenClient";
import type { StaticPayload } from "./StaticScreenClient";

type ProjectionPayload = {
  headlineMetrics?: Record<string, unknown>;
  processLeaderboard?: Array<{ rank: number; name: string; score: number; label: string }>;
  totals?: Record<string, unknown>;
  entries?: Array<{ riderName: string; ingestion: string; workTitle?: string | null }>;
};

export async function ScreenDisplayContent({ raceId }: { raceId: string }) {
  const snapshot = await getScreenSnapshot(raceId);
  if (!snapshot) return null;
  const { race, works, stableProjection, screenState } = snapshot;
  const raceLive = await getPublicRaceLiveSnapshot(race.id);
  const readiness = raceLive ? null : await getRaceLiveReadiness(race.id);
  const payload = fromJson<ProjectionPayload>(stableProjection?.payloadJson, {});
  const announcement = race.announcements[0];
  const mode = screenState.mode;
  const publicWorks = works.map((work) => ({ id: work.id, title: work.title, summary: work.summary, entrantDisplayName: getEntrantDisplay(work.registration).name }));
  const publicAnnouncement = announcement ? { title: announcement.title, body: announcement.body } : null;
  const initial: RaceLivePayload | StaticPayload = raceLive ? {
    kind: "race_live", snapshot: raceLive.snapshot, trackProfile: raceLive.trackProfile, backgroundAssetRef: raceLive.backgroundAssetRef,
    screenState: raceLive.screenState, announcement: publicAnnouncement, works: publicWorks
  } : {
      kind: "static", race: { id: race.id, slug: race.slug, title: race.title, status: race.status },
      screenState: { mode, fallbackEnabled: screenState.fallbackEnabled }, metrics: { riders: race._count.registrations, works: publicWorks.length },
      announcement: publicAnnouncement, works: publicWorks,
      readiness: readiness ? { issues: readiness.issues.map(({ code, message }) => ({ code, message })) } : undefined,
      leaderboard: [...(payload.processLeaderboard ?? []).map((entry) => ({ name: entry.name, detail: `${entry.score} / ${entry.label}` })), ...(payload.entries ?? []).map((entry) => ({ name: entry.riderName, detail: entry.ingestion }))]
    };
  return <section className="screen-display"><main><UnifiedScreenClient raceSlug={race.slug} initial={initial} /></main></section>;
}
