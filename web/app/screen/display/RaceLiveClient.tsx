"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { AryRaceLiveSnapshotSchema, type AryRaceLiveSnapshot } from "@/lib/race-live/contracts";
import { resolveActiveGroup } from "@/lib/race-live/rotation";
import { RaceLiveViewModelMapper } from "@/lib/race-live/view-model";
import { compileTrack, sampleHorsePose } from "@/lib/track-runtime";
import { parseTrackProfile, type TrackProfile } from "@/lib/track-profile";

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

export function RaceLiveClient({ raceSlug, snapshot: initialSnapshot, trackProfile: initialTrackProfile, backgroundAssetRef: initialBackgroundAssetRef, screenState: initialScreenState, announcement: initialAnnouncement, works: initialWorks }: {
  raceSlug: string;
  snapshot: AryRaceLiveSnapshot;
  trackProfile: TrackProfile;
  backgroundAssetRef: string;
  screenState: PublicScreenState;
  announcement: PublicAnnouncement;
  works: PublicScreenWork[];
}) {
  const [now, setNow] = useState(() => new Date());
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
  const view = RaceLiveViewModelMapper(snapshot, activeOrder);
  const track = useMemo(() => compileTrack(trackProfile), [trackProfile]);

  if (screenState.mode === "announcement") return <section className="race-live-shell"><header className="race-live-header"><div><span>ARY RACE LIVE</span><h1>{announcement?.title ?? snapshot.race.title}</h1></div></header><section className="race-live-mode-panel"><h2>{announcement?.body ?? "暂无公告"}</h2></section><footer className="race-live-footer"><span>announcement</span><span>{screenState.fallbackEnabled ? "stable fallback source" : "primary projection"}</span></footer></section>;
  if (screenState.mode === "leaderboard") return <section className="race-live-shell"><header className="race-live-header"><div><span>ARY RACE LIVE</span><h1>{snapshot.race.title} 榜单</h1></div></header><section className="screen-board-list">{snapshot.globalRanking.map((entry) => <article key={entry.entryId}><b>#{entry.rank}</b><span>{entry.entrantDisplayName}</span><em>{Math.round(entry.roundProgress * 100)}%</em></article>)}</section><footer className="race-live-footer"><span>leaderboard</span><span>{screenState.fallbackEnabled ? "stable fallback source" : "primary projection"}</span></footer></section>;
  if (screenState.mode === "works") return <section className="race-live-shell"><header className="race-live-header"><div><span>ARY RACE LIVE</span><h1>{snapshot.race.title} 作品</h1></div></header><section className="screen-board-list">{works.map((work) => <article key={work.id}><b>{work.entrantDisplayName}</b><span>{work.title}</span><em>{work.summary}</em></article>)}</section><footer className="race-live-footer"><span>works</span><span>{screenState.fallbackEnabled ? "stable fallback source" : "primary projection"}</span></footer></section>;

  return <section className="race-live-shell">
    <header className="race-live-header">
      <div><span>ARY RACE LIVE</span><h1>{snapshot.race.title}</h1><p>{snapshot.round.name} · Group {activeOrder}/{snapshot.displayGroups.length}</p></div>
      <div className="race-live-kpis"><b>{Math.round(snapshot.kpi.raceRoundProgress * 100)}%</b><span>{snapshot.kpi.activeEntries} active · {snapshot.kpi.totalTokens.toLocaleString()} tokens</span></div>
    </header>
    <section className="race-live-top3" data-testid="race-live-top3">
      {view.top3.map((entry) => <article key={entry.entryId}><b>#{entry.rank}</b><span>{entry.entrantDisplayName}</span><em>{Math.round(entry.roundProgress * 100)}%</em></article>)}
    </section>
    <section className="race-live-stage" data-testid="race-live-stage" style={{ backgroundImage: `url(${backgroundAssetRef})` }}>
      {view.entries.map((entry, index) => {
        const pose = sampleHorsePose({ track, entryId: entry.entryId, progress: entry.roundProgress, laneId: `lane-${index + 1}`, visualState: entry.raceStatus === "finished" ? "finished" : entry.dataStatus === "stale" ? "stale" : "running" });
        return <article className={`race-live-horse risk-${entry.riskLevel}`} data-testid="race-live-horse" key={entry.entryId} style={{ left: `${pose.x / trackProfile.viewBox.width * 100}%`, top: `${pose.y / trackProfile.viewBox.height * 100}%`, zIndex: pose.zIndex }}>
          <span aria-hidden>🐎</span><strong>{entry.entrantDisplayName}</strong><small>#{entry.rank} · {Math.round(entry.roundProgress * 100)}%</small>
        </article>;
      })}
    </section>
    <footer className="race-live-footer"><span>{snapshot.race.organizerDisplayName}</span><span>Projection #{snapshot.sequence} · {screenState.fallbackEnabled ? "stable fallback source" : "primary projection"}</span><span>{screenState.autoRotateEnabled ? `${screenState.rotationIntervalSeconds}s auto` : "paused"}</span></footer>
  </section>;
}
