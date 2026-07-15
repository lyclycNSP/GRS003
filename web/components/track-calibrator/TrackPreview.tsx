"use client";

import { useMemo } from "react";
import type { TrackProfile } from "@/lib/track-profile";
import { compileTrack, sampleHorsePose } from "@/lib/track-runtime";

export function TrackPreview({ profile, backgroundUrl }: { profile: TrackProfile; backgroundUrl: string | null }) {
  const poses = useMemo(() => {
    try {
      const track = compileTrack(profile);
      return profile.lanes.slice(0, 8).map((lane, index) => sampleHorsePose({ track, entryId: `preview-${index}`, progress: (index + 1) / 10, laneId: lane.laneId, visualState: "running" }));
    } catch { return []; }
  }, [profile]);
  return <section className="form-card"><h2>8 马 Runtime Preview</h2><div className="calibrator-preview" style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined} data-testid="track-preview">
    {poses.map((pose, index) => <span key={index} style={{ left: `${pose.x / profile.viewBox.width * 100}%`, top: `${pose.y / profile.viewBox.height * 100}%`, zIndex: pose.zIndex }}>🐎</span>)}
  </div></section>;
}
