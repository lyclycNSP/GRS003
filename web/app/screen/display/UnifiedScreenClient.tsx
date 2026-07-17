"use client";

import { useEffect, useState } from "react";
import { AryRaceLiveSnapshotSchema, type AryRaceLiveSnapshot } from "@/lib/race-live/contracts";
import { parseTrackProfile, type TrackProfile } from "@/lib/track-profile";
import {
  PublicScreenStateSchema,
  RaceLiveClient,
  type PublicAnnouncement,
  type PublicScreenState,
  type PublicScreenWork
} from "./RaceLiveClient";
import { StaticScreenClient, type StaticPayload } from "./StaticScreenClient";

export type RaceLivePayload = {
  kind: "race_live";
  snapshot: AryRaceLiveSnapshot;
  trackProfile: TrackProfile;
  backgroundAssetRef: string;
  screenState: PublicScreenState;
  announcement: PublicAnnouncement;
  works: PublicScreenWork[];
};

type ScreenPayload = RaceLivePayload | StaticPayload;

function parsePayload(value: unknown): ScreenPayload | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (body.kind === "static") return value as StaticPayload;
  if (body.kind !== "race_live") return null;
  const snapshot = AryRaceLiveSnapshotSchema.safeParse(body.snapshot);
  const screenState = PublicScreenStateSchema.safeParse(body.screenState);
  if (!snapshot.success || !screenState.success || !Array.isArray(body.works) || typeof body.backgroundAssetRef !== "string" || !body.backgroundAssetRef.startsWith("/")) return null;
  try {
    return {
      kind: "race_live",
      snapshot: snapshot.data,
      trackProfile: parseTrackProfile(body.trackProfile),
      backgroundAssetRef: body.backgroundAssetRef,
      screenState: screenState.data,
      announcement: (body.announcement as PublicAnnouncement | undefined) ?? null,
      works: body.works as PublicScreenWork[]
    };
  } catch {
    return null;
  }
}

export function UnifiedScreenClient({ raceSlug, initial }: { raceSlug: string; initial: ScreenPayload }) {
  const [data, setData] = useState(initial);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/public/races/${encodeURIComponent(raceSlug)}/screen`, { cache: "no-store" });
        if (!response.ok) return;
        const next = parsePayload(await response.json());
        if (active && next) setData(next);
      } catch {
        // Preserve the latest readable output during transient failures.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [raceSlug]);

  if (data.kind === "static") return <StaticScreenClient raceSlug={raceSlug} initial={data} pollingEnabled={false} />;
  return <RaceLiveClient
    key={`${data.snapshot.roundId}:${data.snapshot.sequence}`}
    raceSlug={raceSlug}
    initialNow={new Date().toISOString()}
    snapshot={data.snapshot}
    trackProfile={data.trackProfile}
    backgroundAssetRef={data.backgroundAssetRef}
    screenState={data.screenState}
    announcement={data.announcement}
    works={data.works}
    pollingEnabled={false}
  />;
}
