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

export const PublicScreenStateSchema = z.object({
  activeGroupOrder: z.number().int().positive(),
  autoRotateEnabled: z.boolean(),
  rotationIntervalSeconds: z.number().int().min(5).max(120),
  rotationEpochAt: z.string().datetime({ offset: true }),
  fallbackEnabled: z.boolean(),
  mode: z.enum(["live", "leaderboard", "works", "announcement"])
}).strict();
export type PublicScreenState = z.infer<typeof PublicScreenStateSchema>;
export type PublicScreenWork = { id: string; title: string; summary: string; entrantDisplayName: string };
export type PublicAnnouncement = { title: string; body: string } | null;

function RaceLiveModeContent({ mode, snapshot, announcement, works }: {
  mode: PublicScreenState["mode"];
  snapshot: AryRaceLiveSnapshot;
  announcement: PublicAnnouncement;
  works: PublicScreenWork[];
}) {
  if (mode === "announcement") {
    return <section className="race-live-mode-panel race-live-announcement" data-testid="race-live-mode-content">
      <div className="race-live-mode-kicker">赛事公告 · ANNOUNCEMENT</div>
      <h1>{announcement?.title ?? snapshot.race.title}</h1>
      <p>{announcement?.body || "暂无公告，现场信息将在发布后自动更新。"}</p>
    </section>;
  }
  if (mode === "leaderboard") {
    return <section className="race-live-mode-panel" data-testid="race-live-mode-content">
      <div className="race-live-mode-heading"><span>实时榜单 · LEADERBOARD</span><h1>{snapshot.race.title}</h1></div>
      <div className="screen-board-list">{snapshot.globalRanking.length ? snapshot.globalRanking.map((entry) => <article key={entry.entryId}>
        <b>#{entry.rank}</b><span>{entry.entrantDisplayName}</span><em>{Math.round(entry.roundProgress * 100)}%</em>
      </article>) : <div className="race-live-empty">榜单尚未生成</div>}</div>
    </section>;
  }
  return <section className="race-live-mode-panel" data-testid="race-live-mode-content">
    <div className="race-live-mode-heading"><span>公开作品 · WORKS</span><h1>{snapshot.race.title}</h1></div>
    <div className="screen-board-list">{works.length ? works.map((work) => <article key={work.id}>
      <b>{work.entrantDisplayName}</b><span>{work.title}</span><em>{work.summary}</em>
    </article>) : <div className="race-live-empty">暂无公开作品</div>}</div>
  </section>;
}

export function RaceLiveClient({ raceSlug, initialNow, snapshot: initialSnapshot, trackProfile: initialTrackProfile, backgroundAssetRef: initialBackgroundAssetRef, screenState: initialScreenState, announcement: initialAnnouncement, works: initialWorks, pollingEnabled = true }: {
  raceSlug: string;
  initialNow: string;
  snapshot: AryRaceLiveSnapshot;
  trackProfile: TrackProfile;
  backgroundAssetRef: string;
  screenState: PublicScreenState;
  announcement: PublicAnnouncement;
  works: PublicScreenWork[];
  pollingEnabled?: boolean;
}) {
  const [now, setNow] = useState(() => parseRaceLiveInitialNow(initialNow));
  const [raceLive, setRaceLive] = useState({ snapshot: initialSnapshot, trackProfile: initialTrackProfile, backgroundAssetRef: initialBackgroundAssetRef, screenState: initialScreenState, announcement: initialAnnouncement, works: initialWorks });
  useEffect(() => {
    if (pollingEnabled) return;
    setRaceLive({
      snapshot: initialSnapshot,
      trackProfile: initialTrackProfile,
      backgroundAssetRef: initialBackgroundAssetRef,
      screenState: initialScreenState,
      announcement: initialAnnouncement,
      works: initialWorks
    });
  }, [pollingEnabled, initialSnapshot, initialTrackProfile, initialBackgroundAssetRef, initialScreenState, initialAnnouncement, initialWorks]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!pollingEnabled) return;
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
  }, [pollingEnabled, raceSlug]);
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

  return <section className={`race-live-shell race-live-mode-${screenState.mode}`} data-screen-mode={screenState.mode}>
    <RaceLiveHeader snapshot={snapshot} presentation={presentation} autoRotateEnabled={screenState.autoRotateEnabled} />
    <section className="race-live-summary-row">
      <RaceLiveTopThree items={presentation.top3} />
      <RaceLiveKpis snapshot={snapshot} share={presentation.providerShare} />
    </section>
    {screenState.mode === "live" ? <section className="race-live-track-row">
      <RaceLiveMiniMap profile={trackProfile} track={track} entries={presentation.entries} backgroundAssetRef={backgroundAssetRef} />
      <RaceLiveStage profile={trackProfile} track={track} entries={presentation.entries} bubbles={presentation.bubbles} backgroundAssetRef={backgroundAssetRef} />
    </section> : <RaceLiveModeContent mode={screenState.mode} snapshot={snapshot} announcement={announcement} works={works} />}
    <RaceLiveAttentionTicker items={presentation.attentionItems} />
    <RaceLiveFooter snapshot={snapshot} presentation={presentation} autoRotateEnabled={screenState.autoRotateEnabled} rotationIntervalSeconds={screenState.rotationIntervalSeconds} now={now} />
  </section>;
}
