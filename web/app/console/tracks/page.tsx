import Link from "next/link";
import { bindTrackVersionToRoundAction } from "@/app/actions";
import { canManageRace, getAuthContext } from "@/lib/auth";
import { getTrackManagementSnapshot } from "@/lib/queries";

export default async function TrackManagementPage({ searchParams }: { searchParams?: Promise<{ raceId?: string; error?: string }> }) {
  const ctx = await getAuthContext();
  const params = (await searchParams) ?? {};
  const raceId = params.raceId ?? ctx?.managedRaceIds[0] ?? "race_bay_2026";
  if (!ctx || !canManageRace(ctx, raceId)) return <section className="route-page"><h1>无权管理该 Race 的赛道</h1></section>;
  const snapshot = await getTrackManagementSnapshot(raceId);
  if (!snapshot) return <section className="route-page"><h1>Race 不存在</h1></section>;
  const published = snapshot.tracks.flatMap((track) => track.versions.filter((version) => version.status === "published").map((version) => ({ track, version })));
  return <section className="route-page"><section className="module-title"><p className="section-kicker">Track Management</p><h1>{snapshot.race.title} 赛道版本</h1><Link className="inline-action" href={`/console/tracks/calibrator?raceId=${encodeURIComponent(raceId)}`}>打开 Track Calibrator</Link>{params.error ? <p className="status-pill risk">{params.error}</p> : null}</section>
    <section className="app-grid"><div className="app-stack">{published.map(({ track, version }) => <article className="form-card" key={version.id}><h2>{track.name} {version.version}</h2><p>{track.scope} · {version.checksum}</p><a href={version.backgroundAssetRef} target="_blank" rel="noopener noreferrer">背景资产</a></article>)}</div>
      <aside className="form-card"><h2>绑定 pending Round</h2>{snapshot.rounds.map((round) => <form action={bindTrackVersionToRoundAction} key={round.id}><input type="hidden" name="raceId" value={raceId} /><input type="hidden" name="raceRoundId" value={round.id} /><label>{round.name} ({round.status})<select name="trackProfileVersionId" defaultValue={round.trackProfileVersionId}>{published.map(({ track, version }) => <option key={version.id} value={version.id}>{track.name} {version.version}</option>)}</select></label><button disabled={round.status !== "pending"} type="submit">绑定版本</button></form>)}</aside>
    </section>
  </section>;
}
