"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { AryRaceLiveSnapshotSchema, type AryRaceLiveSnapshot } from "@/lib/race-live/contracts";
import { resolveActiveGroup } from "@/lib/race-live/rotation";
import { buildRaceLivePresentation, parseRaceLiveInitialNow } from "@/lib/race-live/presentation";
import { compileTrack } from "@/lib/track-runtime";
import { parseTrackProfile, type TrackProfile } from "@/lib/track-profile";
import { RaceLiveAttentionTicker } from "./components/RaceLiveAttentionTicker";
import { RaceLiveFooter } from "./components/RaceLiveFooter";
import { RaceLiveHeader } from "./components/RaceLiveHeader";
import { RaceLiveKpis } from "./components/RaceLiveKpis";
import { RaceLiveMiniMap } from "./components/RaceLiveMiniMap";
import { RaceLiveStage } from "./components/RaceLiveStage";
import { RaceLiveTopThree } from "./components/RaceLiveTopThree";

const PublicScreenStateSchema = z.object({
  activeGroupOrder: z.number().int().positive(),
  autoRotateEnabled: z.boolean(),
  rotationIntervalSeconds: z.number().int().min(5).max(120),
  rotationEpochAt: z.string().datetime({ offset: true }),
  fallbackEnabled: z.boolean(),
  mode: z.enum(["live", "leaderboard", "works", "announcement"])
}).strict();
type PublicScreenState = z.infer<typeof PublicScreenStateSchema>;
type PublicScreenWork = { id: string; title: string; summary: string; entrantDisplayName: string };
type PublicAnnouncement = { title: string; body: string } | null;

export function RaceLiveClient({ raceSlug, initialNow, snapshot: initialSnapshot, trackProfile: initialTrackProfile, backgroundAssetRef: initialBackgroundAssetRef, screenState: initialScreenState, announcement: initialAnnouncement, works: initialWorks }: {
  raceSlug: string;
  initialNow: string;
  snapshot: AryRaceLiveSnapshot;
  trackProfile: TrackProfile;
  backgroundAssetRef: string;
  screenState: PublicScreenState;
  announcement: PublicAnnouncement;
  works: PublicScreenWork[];
}) {
  const [now, setNow] = useState(() => parseRaceLiveInitialNow(initialNow));
  const [raceLive, setRaceLive] = useState({ snapshot: initialSnapshot, trackProfile: initialTrackProfile, backgroundAssetRef: initialBackgroundAssetRef, screenState: initialScreenState, announcement: initialAnnouncement, works: initialWorks });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/public/races/${encodeURIComponent(raceSlug)}/screen`, { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json() as { snapshot?: unknown; trackProfile?: unknown; backgroundAssetRef?: unknown; screenState?: unknown; announcement?: PublicAnnouncement; works?: PublicScreenWork[] };
        const parsedSnapshot = AryRaceLiveSnapshotSchema.safeParse(body.snapshot);
        const parsedScreenState = PublicScreenStateSchema.safeParse(body.screenState);
        if (!parsedSnapshot.success || !parsedScreenState.success || !Array.isArray(body.works) || typeof body.backgroundAssetRef !== "string" || !body.backgroundAssetRef.startsWith("/")) return;
        const parsedTrackProfile = parseTrackProfile(body.trackProfile);
        if (active) setRaceLive({ snapshot: parsedSnapshot.data, trackProfile: parsedTrackProfile, backgroundAssetRef: body.backgroundAssetRef, screenState: parsedScreenState.data, announcement: body.announcement ?? null, works: body.works });
      } catch {
        // Keep the last stable public snapshot when polling is temporarily unavailable.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [raceSlug]);
  const { snapshot, trackProfile, backgroundAssetRef, screenState, announcement, works } = raceLive;
  const activeOrder = resolveActiveGroup({
    groupCount: snapshot.displayGroups.length,
    activeOrder: screenState.activeGroupOrder,
    autoRotateEnabled: screenState.autoRotateEnabled,
    rotationEpochAt: new Date(screenState.rotationEpochAt),
    intervalSeconds: screenState.rotationIntervalSeconds,
    now
  });
  const track = useMemo(() => compileTrack(trackProfile), [trackProfile]);
  const presentation = buildRaceLivePresentation(snapshot, activeOrder, now);

  if (screenState.mode === "announcement") return <section className="race-live-shell"><header className="race-live-header"><div><span>ARY RACE LIVE</span><h1>{announcement?.title ?? snapshot.race.title}</h1></div></header><section className="race-live-mode-panel"><h2>{announcement?.body ?? "暂无公告"}</h2></section><footer className="race-live-footer"><span>announcement</span><span>{screenState.fallbackEnabled ? "stable fallback source" : "primary projection"}</span></footer></section>;
  if (screenState.mode === "leaderboard") return <section className="race-live-shell"><header className="race-live-header"><div><span>ARY RACE LIVE</span><h1>{snapshot.race.title} 榜单</h1></div></header><section className="screen-board-list">{snapshot.globalRanking.map((entry) => <article key={entry.entryId}><b>#{entry.rank}</b><span>{entry.entrantDisplayName}</span><em>{Math.round(entry.roundProgress * 100)}%</em></article>)}</section><footer className="race-live-footer"><span>leaderboard</span><span>{screenState.fallbackEnabled ? "stable fallback source" : "primary projection"}</span></footer></section>;
  if (screenState.mode === "works") return <section className="race-live-shell"><header className="race-live-header"><div><span>ARY RACE LIVE</span><h1>{snapshot.race.title} 作品</h1></div></header><section className="screen-board-list">{works.map((work) => <article key={work.id}><b>{work.entrantDisplayName}</b><span>{work.title}</span><em>{work.summary}</em></article>)}</section><footer className="race-live-footer"><span>works</span><span>{screenState.fallbackEnabled ? "stable fallback source" : "primary projection"}</span></footer></section>;

  return <section className="race-live-shell">
    <RaceLiveHeader snapshot={snapshot} presentation={presentation} autoRotateEnabled={screenState.autoRotateEnabled} />
    <section className="race-live-summary-row">
      <RaceLiveTopThree items={presentation.top3} />
      <RaceLiveKpis snapshot={snapshot} share={presentation.providerShare} />
    </section>
    <section className="race-live-track-row">
      <RaceLiveMiniMap profile={trackProfile} track={track} entries={presentation.entries} backgroundAssetRef={backgroundAssetRef} />
      <RaceLiveStage profile={trackProfile} track={track} entries={presentation.entries} bubbles={presentation.bubbles} backgroundAssetRef={backgroundAssetRef} />
    </section>
    <RaceLiveAttentionTicker items={presentation.attentionItems} />
    <RaceLiveFooter snapshot={snapshot} presentation={presentation} autoRotateEnabled={screenState.autoRotateEnabled} rotationIntervalSeconds={screenState.rotationIntervalSeconds} now={now} />
  </section>;
}
