import type { AryRaceLiveEntrySnapshot } from "@/lib/race-live/contracts";
import { sampleMiniMapPose, type CompiledTrack } from "@/lib/track-runtime";
import type { TrackProfile } from "@/lib/track-profile";

export function RaceLiveMiniMap({ profile, track, entries, backgroundAssetRef }: {
  profile: TrackProfile;
  track: CompiledTrack;
  entries: AryRaceLiveEntrySnapshot[];
  backgroundAssetRef: string;
}) {
  return <aside className="race-live-minimap" data-testid="race-live-minimap">
    <div><b>赛道地图</b><small>{profile.name}</small></div>
    <svg viewBox={`0 0 ${profile.viewBox.width} ${profile.viewBox.height}`} aria-label="Race mini map">
      <image href={backgroundAssetRef} x="0" y="0" width={profile.viewBox.width} height={profile.viewBox.height} preserveAspectRatio="xMidYMid slice" />
      <polyline points={profile.centerline.points.map((point) => `${point.x},${point.y}`).join(" ")} />
      {entries.map((entry, index) => {
        const pose = sampleMiniMapPose(track, entry.roundProgress);
        return <g key={entry.entryId} transform={`translate(${pose.x} ${pose.y})`}><circle r="32" /><text textAnchor="middle" dy="12">{index + 1}</text></g>;
      })}
    </svg>
    <ol>{entries.map((entry, index) => <li key={entry.entryId}><b>{index + 1}</b><span>{entry.entrantDisplayName}</span></li>)}</ol>
  </aside>;
}
