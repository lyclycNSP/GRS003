import type { AryRaceLiveSnapshot } from "@/lib/race-live/contracts";
import type { RaceLivePresentation } from "@/lib/race-live/presentation";

export function RaceLiveFooter({ snapshot, presentation, autoRotateEnabled, rotationIntervalSeconds, now }: {
  snapshot: AryRaceLiveSnapshot;
  presentation: RaceLivePresentation;
  autoRotateEnabled: boolean;
  rotationIntervalSeconds: number;
  now: Date;
}) {
  return <footer className="race-live-footer" data-testid="race-live-footer">
    <b>● LIVE</b><span>Organizer：{snapshot.race.organizerDisplayName}</span><span>Round {snapshot.round.order} · Group {presentation.groupOrder}/{presentation.groupCount}</span><span>{autoRotateEnabled ? `${rotationIntervalSeconds}s 自动轮播` : "轮播暂停"}</span><time>{now.toLocaleTimeString("zh-CN", { hour12: false })}</time>
  </footer>;
}
