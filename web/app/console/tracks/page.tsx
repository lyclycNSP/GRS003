import Link from "next/link";
import { redirect } from "next/navigation";
import { bindTrackVersionToRoundAction } from "@/app/actions";
import { ActionOutcomePanel, PendingActionButton, StatRail } from "@/app/components/ui";
import { canManageRace, getAuthContext } from "@/lib/auth";
import { getTrackManagementSnapshot } from "@/lib/queries";
import styles from "./TrackTools.module.css";

function formatDate(value?: Date | null) {
  return value ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(value) : "—";
}

export default async function TrackManagementPage({ searchParams }: { searchParams?: Promise<{ raceId?: string; error?: string }> }) {
  const ctx = await getAuthContext();
  const params = (await searchParams) ?? {};
  const raceId = params.raceId;
  if (!ctx) {
    const next = `/console/tracks${raceId ? `?raceId=${encodeURIComponent(raceId)}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!raceId) return <section className={styles.statePage}><h1>请先进入一场 Race</h1><p>Track Management 必须在明确的赛事上下文中使用，不会自动选择其他 Race。</p><Link href="/console/organizer">返回我的赛事</Link></section>;
  if (!canManageRace(ctx, raceId)) return <section className={styles.statePage}><h1>无权管理该 Race 的赛道</h1><Link href="/console/organizer">返回我的赛事</Link></section>;
  const snapshot = await getTrackManagementSnapshot(raceId);
  if (!snapshot) return <section className={styles.statePage}><h1>Race 不存在</h1><Link href="/console/organizer">返回我的赛事</Link></section>;
  const published = snapshot.tracks.flatMap((track) => track.versions
    .filter((version) => version.status === "published")
    .map((version) => ({ track, version })));
  const pendingRounds = snapshot.rounds.filter((round) => round.status === "pending").length;
  const raceVersions = published.filter(({ track }) => track.raceId === raceId).length;

  return (
    <section className={styles.page} data-testid="track-management-workspace">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Race Workspace · Track Management</p>
          <h1>{snapshot.race.title} 赛道版本</h1>
          <p>管理本场 Race 可使用的已发布版本，并把不可变版本显式绑定到 pending Round。</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryLink} href={`/console/tracks/calibrator?raceId=${encodeURIComponent(raceId)}`}>打开 Track Calibrator</Link>
            <Link href={`/console/organizer/races/${encodeURIComponent(raceId)}`}>返回 Race Workspace</Link>
          </div>
        </div>
        <div className={styles.trackGraphic} aria-hidden="true"><span /><span /><span /></div>
      </header>

      {params.error ? (
        <ActionOutcomePanel
          actionCode="track_binding_failed"
          description={params.error}
          nextAction={<a href="#round-track-binding">返回 Round 绑定</a>}
          outcome="error"
          title="Track 版本没有绑定"
        />
      ) : null}

      <StatRail aria-label="Track overview" items={[
        { label: "可用版本", value: published.length, hint: "system + 当前 Race" },
        { label: "赛事专属", value: raceVersions, hint: raceVersions ? "仅当前 Race 可用" : "暂无专属版本" },
        { label: "Pending Round", value: pendingRounds, hint: pendingRounds ? "允许更新绑定" : "暂无待绑定 Round", tone: pendingRounds ? "warning" : "neutral" },
        { label: "锁定 Round", value: snapshot.rounds.length - pendingRounds, hint: "running / finished" },
      ]} />

      <section className={styles.workspaceGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><p>PUBLISHED LIBRARY</p><h2>已发布赛道版本</h2></div><span>{published.length} versions</span></div>
          <div className={styles.versionGrid}>
            {published.length ? published.map(({ track, version }) => (
              <article className={styles.versionCard} key={version.id}>
                <div className={styles.versionPreview}><span>{track.scope === "system" ? "SYSTEM" : "RACE"}</span><i /></div>
                <div className={styles.versionBody}>
                  <div><h3>{track.name}</h3><span className={styles.goodPill}>published</span></div>
                  <p>版本 {version.version} · {track.scope}</p>
                  <dl><div><dt>发布时间</dt><dd>{formatDate(version.publishedAt)}</dd></div><div><dt>Checksum</dt><dd title={version.checksum}>{version.checksum.slice(0, 18)}…</dd></div></dl>
                  <a href={version.backgroundAssetRef} target="_blank" rel="noopener noreferrer">查看背景资产</a>
                </div>
              </article>
            )) : <div className={styles.emptyState}>暂无可绑定的已发布 Track 版本。</div>}
          </div>
        </section>

        <aside className={styles.panel} id="round-track-binding">
          <div className={styles.panelHeading}><div><p>ROUND BINDING</p><h2>绑定 Round</h2></div></div>
          <p className={styles.hint}>只有 pending Round 可以绑定。版本发布后不可覆盖，running / finished Round 不允许修改。</p>
          <div className={styles.roundList}>
            {snapshot.rounds.length ? snapshot.rounds.map((round) => (
              <form action={bindTrackVersionToRoundAction} key={round.id}>
                <input type="hidden" name="raceId" value={raceId} />
                <input type="hidden" name="raceRoundId" value={round.id} />
                <div><strong>{round.name}</strong><span className={round.status === "pending" ? styles.warningPill : styles.neutralPill}>{round.status}</span></div>
                <p className={styles.currentBinding}>当前绑定：<strong>{published.find(({ version }) => version.id === round.trackProfileVersionId)?.track.name ?? "未绑定"}</strong></p>
                <label><span>Track version</span><select name="trackProfileVersionId" defaultValue={round.trackProfileVersionId}>{published.map(({ track, version }) => <option key={version.id} value={version.id}>{track.name} {version.version}</option>)}</select></label>
                <PendingActionButton disabled={round.status !== "pending" || published.length === 0} label="绑定版本" pendingLabel="正在绑定 Track…" variant="inherit" />
              </form>
            )) : <div className={styles.emptyState}>本场 Race 尚未创建 Round。</div>}
          </div>
        </aside>
      </section>
    </section>
  );
}
