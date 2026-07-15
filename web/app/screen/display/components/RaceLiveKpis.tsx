import type { AryRaceLiveSnapshot } from "@/lib/race-live/contracts";
import type { RaceLivePresentation } from "@/lib/race-live/presentation";

export function RaceLiveKpis({ snapshot, share }: {
  snapshot: AryRaceLiveSnapshot;
  share: RaceLivePresentation["providerShare"];
}) {
  return <section className="race-live-kpi-grid" data-testid="race-live-kpis">
    <article><small>平均进度</small><b>{Math.round(snapshot.kpi.raceRoundProgress * 100)}%</b><span className="kpi-bar"><i style={{ width: `${snapshot.kpi.raceRoundProgress * 100}%` }} /></span></article>
    <article><small>Token 总量</small><b>{snapshot.kpi.totalTokens.toLocaleString()}</b><span>{snapshot.kpi.activeEntries} entries active</span></article>
    <article><small>Codex 参与</small><b>{share.codex}%</b><span className="kpi-bar"><i style={{ width: `${share.codex}%` }} /></span></article>
    <article><small>Claude 参与</small><b>{share.claude}%</b><span className="kpi-bar orange"><i style={{ width: `${share.claude}%` }} /></span></article>
  </section>;
}
