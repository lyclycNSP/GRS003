"use client";

import type { TrackProfile } from "@/lib/track-profile";

export function ProfileInspector({ profile, onChange }: { profile: TrackProfile; onChange(profile: TrackProfile): void }) {
  return <section className="form-card"><h2>Profile Inspector</h2>
    <label>trackId<input data-testid="track-id" value={profile.trackId} onChange={(event) => onChange({ ...profile, trackId: event.target.value, background: { ...profile.background, assetId: `${event.target.value}-background-${profile.version}` } })} /></label>
    <label>名称<input data-testid="track-name" value={profile.name} onChange={(event) => onChange({ ...profile, name: event.target.value })} /></label>
    <label>版本<input data-testid="track-version" value={profile.version} onChange={(event) => onChange({ ...profile, version: event.target.value })} /></label>
    <p>{profile.centerline.points.length} centerline points · {profile.lanes.length} lanes</p>
    <button type="button" onClick={() => onChange({ ...profile, lanes: [...profile.lanes, { laneId: `lane-${profile.lanes.length + 1}`, offset: profile.lanes.at(-1)!.offset + 10, displayOrder: profile.lanes.length + 1 }] })}>增加 Lane</button>
    <button type="button" disabled={profile.lanes.length <= 8} onClick={() => onChange({ ...profile, lanes: profile.lanes.slice(0, -1) })}>删除最后 Lane</button>
    <button type="button" onClick={() => onChange({ ...profile, checkpoints: [...profile.checkpoints, { checkpointId: `checkpoint-${profile.checkpoints.length + 1}`, label: `Checkpoint ${profile.checkpoints.length + 1}`, s: 0.5 }] })}>增加 Checkpoint</button>
    <button type="button" onClick={() => onChange({ ...profile, messageZones: [...profile.messageZones, { zoneId: `message-zone-${profile.messageZones.length + 1}`, priority: profile.messageZones.length, polygon: [{ x: 100, y: 100 }, { x: 180, y: 100 }, { x: 140, y: 180 }] }] })}>增加 Message Zone</button>
    <button type="button" onClick={() => onChange({ ...profile, noBubbleZones: [...profile.noBubbleZones, { zoneId: `no-bubble-zone-${profile.noBubbleZones.length + 1}`, polygon: [{ x: 220, y: 120 }, { x: 300, y: 120 }, { x: 260, y: 200 }] }] })}>增加 No-bubble Zone</button>
  </section>;
}
