import type { AryRaceLiveSnapshot } from "@/lib/race-live/contracts";
import type { RaceLivePresentation } from "@/lib/race-live/presentation";

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, "0")).join(":");
}

export function RaceLiveHeader({ snapshot, presentation, autoRotateEnabled }: {
  snapshot: AryRaceLiveSnapshot;
  presentation: RaceLivePresentation;
  autoRotateEnabled: boolean;
}) {
  return <header className="race-live-header" data-testid="race-live-header">
    <div className="race-live-brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-horse-compass-transparent.png" alt="" />
      <span><b>Agent Racing Yard</b><small>{snapshot.race.subtitle ?? "Hackathon Live Screen"}</small></span>
    </div>
    <div className="race-live-session">
      <div><span className="live-mark">● LIVE</span><small>当前阶段</small><b>{snapshot.round.name} · Group {presentation.groupOrder}/{presentation.groupCount}</b></div>
      <div><small>已用时</small><b>{formatDuration(presentation.elapsedSeconds)}</b></div>
      <div><small>在线 Racer</small><b>{snapshot.kpi.onlineParticipants} / {snapshot.kpi.totalParticipants}</b></div>
      <div><small>轮播</small><b>{autoRotateEnabled ? "自动" : "暂停"}</b></div>
    </div>
  </header>;
}
