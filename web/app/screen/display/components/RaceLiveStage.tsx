import type { AryRaceLiveEntrySnapshot, RaceLiveMessageSnapshot } from "@/lib/race-live/contracts";
import { deriveHorseVisualOrientation, sampleBubblePose, sampleHorsePose, type CompiledTrack } from "@/lib/track-runtime";
import type { TrackProfile } from "@/lib/track-profile";

export function RaceLiveStage({ profile, track, entries, bubbles, backgroundAssetRef }: {
  profile: TrackProfile;
  track: CompiledTrack;
  entries: AryRaceLiveEntrySnapshot[];
  bubbles: RaceLiveMessageSnapshot[];
  backgroundAssetRef: string;
}) {
  const horsePoses = entries.map((entry, index) => ({
    entry,
    pose: sampleHorsePose({ track, entryId: entry.entryId, progress: entry.roundProgress, laneId: profile.lanes[index]?.laneId ?? profile.lanes[0]!.laneId, visualState: entry.raceStatus === "finished" ? "finished" : entry.dataStatus === "stale" ? "stale" : entry.raceStatus === "blocked" ? "blocked" : "running" }),
  }));
  return <section className="race-live-stage" data-testid="race-live-stage" style={{ backgroundImage: `url(${backgroundAssetRef})` }}>
    <span className="race-live-stage-status">LIVE · {entries.length} entries racing</span>
    {horsePoses.map(({ entry, pose }) => {
      const orientation = deriveHorseVisualOrientation(pose.rotation);
      return <article className={`race-live-horse risk-${entry.riskLevel}`} data-testid="race-live-horse" key={entry.entryId} style={{ left: `${pose.x / profile.viewBox.width * 100}%`, top: `${pose.y / profile.viewBox.height * 100}%`, zIndex: pose.zIndex }}>
        <b className="race-live-rank">{entry.rank}</b>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img data-horse-sprite src="/race-live/horse-blue.png" alt="" style={{ transform: `scaleX(${orientation.flipX ? -1 : 1}) rotate(${orientation.pitch}deg)` }} />
        <strong>{entry.entrantDisplayName}</strong><small>{Math.round(entry.roundProgress * 100)}%</small>
      </article>;
    })}
    {bubbles.map((message, slot) => {
      const entry = entries.find((candidate) => candidate.entryId === message.entryId);
      if (!entry) return null;
      const pose = sampleBubblePose({ track, entryId: entry.entryId, progress: entry.roundProgress, slot });
      if (!pose) return null;
      return <p className={`race-live-bubble severity-${message.severity}`} key={message.messageId} style={{ left: `${pose.x / profile.viewBox.width * 100}%`, top: `${pose.y / profile.viewBox.height * 100}%` }}>{message.bubbleText ?? message.factualSummary}</p>;
    })}
  </section>;
}
