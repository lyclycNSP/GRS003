"use client";

import type { TrackProfile } from "@/lib/track-profile";

export function ProfileInspector({ profile, onChange }: { profile: TrackProfile; onChange(profile: TrackProfile): void }) {
  return <section className="form-card"><h2>Profile Inspector</h2>
    <label>trackId<input data-testid="track-id" value={profile.trackId} onChange={(event) => onChange({ ...profile, trackId: event.target.value, background: { ...profile.background, assetId: `${event.target.value}-background-${profile.version}` } })} /></label>
    <label>名称<input data-testid="track-name" value={profile.name} onChange={(event) => onChange({ ...profile, name: event.target.value })} /></label>
    <label>版本<input data-testid="track-version" value={profile.version} onChange={(event) => onChange({ ...profile, version: event.target.value })} /></label>
    <div className="inspector-inline">
      <label>方向<select value={profile.direction} onChange={(event) => onChange({ ...profile, direction: event.target.value as TrackProfile["direction"] })}><option value="clockwise">顺时针</option><option value="counterclockwise">逆时针</option></select></label>
      <label>平滑度<input type="number" min="0" max="1" step="0.05" value={profile.centerline.smoothing} onChange={(event) => onChange({ ...profile, centerline: { ...profile.centerline, smoothing: event.currentTarget.valueAsNumber } })} /></label>
    </div>
    <div className="inspector-inline">
      <label>起终点 s<input type="number" min="0" max="0.999" step="0.01" value={profile.startFinish.s} onChange={(event) => onChange({ ...profile, startFinish: { ...profile.startFinish, s: event.currentTarget.valueAsNumber } })} /></label>
      <label>起点偏移<input type="number" step="1" value={profile.startFinish.startDisplayOffset} onChange={(event) => onChange({ ...profile, startFinish: { ...profile.startFinish, startDisplayOffset: event.currentTarget.valueAsNumber } })} /></label>
      <label>终点偏移<input type="number" step="1" value={profile.startFinish.finishDisplayOffset} onChange={(event) => onChange({ ...profile, startFinish: { ...profile.startFinish, finishDisplayOffset: event.currentTarget.valueAsNumber } })} /></label>
    </div>
    <p>{profile.centerline.points.length} centerline points · {profile.lanes.length} lanes</p>
    <details><summary>Lane offsets</summary><div className="inspector-list">{profile.lanes.map((lane, index) => <label key={lane.laneId}>{lane.laneId}<input type="number" value={lane.offset} onChange={(event) => onChange({ ...profile, lanes: profile.lanes.map((item, itemIndex) => itemIndex === index ? { ...item, offset: event.currentTarget.valueAsNumber } : item) })} /></label>)}</div></details>
    <details><summary>Checkpoints</summary><div className="inspector-list">{profile.checkpoints.map((checkpoint, index) => <label key={checkpoint.checkpointId}>{checkpoint.label}<input type="number" min="0" max="1" step="0.01" value={checkpoint.s} onChange={(event) => onChange({ ...profile, checkpoints: profile.checkpoints.map((item, itemIndex) => itemIndex === index ? { ...item, s: event.currentTarget.valueAsNumber } : item) })} /></label>)}</div></details>
    <button type="button" onClick={() => onChange({ ...profile, lanes: [...profile.lanes, { laneId: `lane-${profile.lanes.length + 1}`, offset: profile.lanes.at(-1)!.offset + 10, displayOrder: profile.lanes.length + 1 }] })}>增加 Lane</button>
    <button type="button" disabled={profile.lanes.length <= 8} onClick={() => onChange({ ...profile, lanes: profile.lanes.slice(0, -1) })}>删除最后 Lane</button>
    <button type="button" onClick={() => onChange({ ...profile, checkpoints: [...profile.checkpoints, { checkpointId: `checkpoint-${profile.checkpoints.length + 1}`, label: `Checkpoint ${profile.checkpoints.length + 1}`, s: 0.5 }] })}>增加 Checkpoint</button>
    <button type="button" onClick={() => onChange({ ...profile, messageZones: [...profile.messageZones, { zoneId: `message-zone-${profile.messageZones.length + 1}`, priority: profile.messageZones.length, polygon: [{ x: 100, y: 100 }, { x: 180, y: 100 }, { x: 140, y: 180 }] }] })}>增加 Message Zone</button>
    <button type="button" onClick={() => onChange({ ...profile, noBubbleZones: [...profile.noBubbleZones, { zoneId: `no-bubble-zone-${profile.noBubbleZones.length + 1}`, polygon: [{ x: 220, y: 120 }, { x: 300, y: 120 }, { x: 260, y: 200 }] }] })}>增加 No-bubble Zone</button>
  </section>;
}
