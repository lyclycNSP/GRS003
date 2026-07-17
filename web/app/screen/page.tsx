import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { fromJson } from "@/lib/json";
import { getScreenSnapshot } from "@/lib/queries";
import {
  createRaceRoundAction,
  configureScreenRotationAction,
  finishRaceRoundAction,
  moveRaceRoundEntryAction,
  moveScreenDisplayGroupAction,
  pauseScreenRotationAction,
  prepareRaceLiveAction,
  publishAnnouncementAction,
  refreshRaceLiveAction,
  resumeScreenRotationAction,
  setRaceRoundEntryStatusAction,
  syncRaceRoundRosterAction,
  switchScreenModeAction,
  toggleScreenFallbackAction
} from "@/app/actions";
import { ActionOutcomePanel, KeyValueList, PendingActionButton, StatRail, StatusSummary } from "@/app/components/ui";
import { getRaceLiveManagementSnapshot } from "@/lib/race-live/management";
import styles from "./ScreenConsole.module.css";

const modes = ["live", "leaderboard", "works", "announcement"] as const;
const modeLabels: Record<(typeof modes)[number], string> = { live: "Live", leaderboard: "榜单", works: "作品", announcement: "公告" };

export default async function ScreenConsolePage({ searchParams }: { searchParams?: Promise<{ raceId?: string; error?: string; prepared?: string }> }) {
  const ctx = await getAuthContext();
  const { raceId, error, prepared } = (await searchParams) ?? {};
  const next = raceId ? `/screen?raceId=${encodeURIComponent(raceId)}` : "/screen";
  if (!ctx) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (ctx.activeRole !== "organizer") redirect("/console");
  if (!raceId) return <section className={styles.statePage}><h1>未指定 Race</h1><p>请从对应 Race Workspace 进入大屏控制台。</p></section>;
  if (!ctx.managedRaceIds.includes(raceId)) notFound();
  const snapshot = await getScreenSnapshot(raceId);
  if (!snapshot) notFound();
  const management = await getRaceLiveManagementSnapshot(raceId);
  const { race, works, stableProjection, failedProjection, screenState } = snapshot;
  const { readiness, rounds, tracks } = management;
  const canManage = true;
  const requiresAdminReason = false;
  const adminReasonField = () => requiresAdminReason ? <label>紧急操作原因<input name="reason" required /></label> : null;
  const payload = fromJson<Record<string, unknown>>(stableProjection?.payloadJson, {});
  const modeSummary: Record<string, string> = {
    live: "实时呈现 Riding Signal、过程指标和赛事事件流。",
    leaderboard: "展示已经公开的最终奖项和榜单。",
    works: `轮播 ${works.length} 个公开作品。`,
    announcement: "展示现场公告和下一轮提醒。"
  };

  return (
    <section className={styles.page} data-testid="screen-console-workspace">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Race Workspace · Screen Console</p>
          <h1>{race.title} 大屏控制台</h1>
          <p>{canManage ? "控制现场展示模式、同 Round 分组轮播与稳定 Projection fallback。" : "当前账号只能查看大屏状态；控制入口仅当前赛事 Organizer 可用。"}</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryLink} data-testid="screen-display-link" href={`/screen/display/${encodeURIComponent(race.id)}`}>打开 Screen Display</Link>
            {canManage ? <Link href={`/console/organizer/races/${encodeURIComponent(race.id)}`}>返回 Race Workspace</Link> : null}
          </div>
        </div>
        <div className={styles.liveBadge}><i /><span>OUTPUT</span><strong>{screenState.mode}</strong></div>
      </header>

      {error ? (
        <ActionOutcomePanel
          actionCode="screen_control_failed"
          description={error}
          nextAction={<a href="#race-live-setup">检查大屏准备状态</a>}
          outcome="error"
          title="大屏控制操作未完成"
        />
      ) : null}

      {prepared === "1" ? (
        <ActionOutcomePanel
          actionCode="race_live_prepared"
          description="Round、Track、参赛名单与稳定 Projection 已重新绑定。"
          entity={{ label: "当前输出", value: `${screenState.mode} · 第 ${screenState.activeGroupOrder} 组` }}
          nextAction={<Link href={`/screen/display/${encodeURIComponent(race.id)}`}>查看赛事大屏</Link>}
          outcome="success"
          title="Race Live 已准备完成"
        />
      ) : null}

      <section className={styles.liveSetup} id="race-live-setup" data-testid="race-live-setup">
        <div className={styles.panelHeading}>
          <div><p>RACE LIVE READINESS</p><h2>大屏准备与 Round 管理</h2></div>
          <span className={readiness.status === "blocked" ? styles.warningPill : styles.goodPill}>{readiness.status}</span>
        </div>
        <KeyValueList aria-label="Race Live readiness" items={[
          { label: "候选 Round", value: <>{readiness.candidateRound?.name ?? "未配置"}<small>{readiness.candidateRound?.status ?? "请先创建 Round"}</small></> },
          { label: "Track", value: <>{readiness.candidateRound?.trackName ?? "未配置"}<small>{readiness.candidateRound ? `v${readiness.candidateRound.trackVersion}` : "需要已发布版本"}</small></> },
          { label: "参赛名单", value: <>{readiness.candidateRound?.activeEntries ?? 0}<small>{readiness.candidateRound?.totalEntries ?? 0} 条 Round Entry</small></> },
          { label: "Race Live Projection", value: <>{readiness.projection?.status ?? "none"}<small>{readiness.projection?.id ?? "尚未生成"}</small></> },
        ]} />
        <StatusSummary
          eyebrow="大屏准备状态"
          title={readiness.issues.length ? `${readiness.issues.length} 项配置需要处理` : "已满足 Race Live 条件"}
          description={readiness.issues.length ? <ul className={styles.readinessIssues}>{readiness.issues.map((issue) => <li data-level={issue.level} key={issue.code}>{issue.message}</li>)}</ul> : "Round、Track 与参赛名单已就绪，可以准备或刷新大屏。"}
          tone={readiness.status === "blocked" ? "danger" : readiness.issues.length ? "warning" : "success"}
        />
        {readiness.candidateRound ? <div className={styles.setupActions}>
          {readiness.candidateRound.status === "pending" ? <form action={syncRaceRoundRosterAction}><input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="roundId" value={readiness.candidateRound.id} /><PendingActionButton label="同步已批准参赛者" pendingLabel="正在同步参赛名单…" variant="inherit" /></form> : null}
          <form action={prepareRaceLiveAction}>
            <input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="roundId" value={readiness.candidateRound.id} />
            {readiness.candidateRound.status === "pending" ? <label className={styles.confirmStart}><input name="confirmStart" type="checkbox" required />我确认启动此 pending Round</label> : null}
            <PendingActionButton disabled={readiness.status === "blocked"} label={readiness.candidateRound.status === "pending" ? "启动并准备 Race Live" : "重新准备 Race Live"} pendingLabel="正在生成稳定大屏…" testId="prepare-race-live" variant="inherit" />
          </form>
          {readiness.candidateRound.status === "running" ? <>
            <form action={refreshRaceLiveAction}><input type="hidden" name="raceId" value={race.id} /><PendingActionButton label="立即刷新 Race Live" pendingLabel="正在刷新 Projection…" testId="refresh-race-live" variant="inherit" /></form>
            <form action={finishRaceRoundAction}><input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="roundId" value={readiness.candidateRound.id} /><PendingActionButton className={styles.dangerButton} label="结束当前 Round" pendingLabel="正在结束 Round…" variant="inherit" /></form>
          </> : null}
        </div> : null}

        <details className={styles.advancedSetup}>
          <summary>高级配置：创建 Round 与调整名单</summary>
          <form className={styles.roundCreateForm} action={createRaceRoundAction}>
            <input type="hidden" name="raceId" value={race.id} />
            <label><span>Round 名称</span><input name="name" required placeholder="例如：Round 2" /></label>
            <label><span>顺序</span><input name="order" type="number" min="1" required defaultValue={rounds.length + 1} /></label>
            <label><span>计划开始</span><input name="scheduledStartAt" type="datetime-local" required /></label>
            <label><span>计划结束</span><input name="scheduledEndAt" type="datetime-local" required /></label>
            <label><span>Track 版本</span><select name="trackProfileVersionId" required>{tracks.map((version) => <option key={version.id} value={version.id}>{version.track.name} v{version.version}</option>)}</select></label>
            <PendingActionButton disabled={!tracks.length} label="创建 pending Round" pendingLabel="正在创建 Round…" variant="inherit" />
          </form>
          <div className={styles.roundManagerList}>{rounds.map((round) => <article key={round.id} className={styles.roundManagerCard}>
            <header><div><b>{round.name}</b><span>#{round.order} · {round.status}</span></div><small>{round.trackProfileVersion.track.name} v{round.trackProfileVersion.version}</small></header>
            {round.status === "pending" ? <form action={syncRaceRoundRosterAction}><input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="roundId" value={round.id} /><PendingActionButton label="同步名单" pendingLabel="正在同步…" variant="inherit" /></form> : null}
            <div className={styles.rosterList}>{round.entries.length ? round.entries.map((entry) => <div key={entry.id} data-status={entry.status}>
              <span><b>{entry.registration.team?.name ?? entry.registration.user.displayName}</b><small>#{entry.displayOrder} · {entry.registration.status} · {entry.status}</small></span>
              {round.status === "pending" ? <div>
                <form action={moveRaceRoundEntryAction}><input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="roundEntryId" value={entry.id} /><input type="hidden" name="direction" value="up" /><PendingActionButton aria-label={`上移 ${entry.registration.team?.name ?? entry.registration.user.displayName}`} label="↑" pendingLabel="…" variant="inherit" /></form>
                <form action={moveRaceRoundEntryAction}><input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="roundEntryId" value={entry.id} /><input type="hidden" name="direction" value="down" /><PendingActionButton aria-label={`下移 ${entry.registration.team?.name ?? entry.registration.user.displayName}`} label="↓" pendingLabel="…" variant="inherit" /></form>
                <form action={setRaceRoundEntryStatusAction}><input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="roundEntryId" value={entry.id} /><input type="hidden" name="status" value={entry.status === "active" ? "excluded" : "active"} /><PendingActionButton label={entry.status === "active" ? "排除" : "恢复"} pendingLabel={entry.status === "active" ? "正在排除…" : "正在恢复…"} variant="inherit" /></form>
              </div> : null}
            </div>) : <p>尚未同步参赛名单。</p>}</div>
          </article>)}</div>
        </details>
      </section>

      <StatRail aria-label="Screen overview" items={[
        { label: "当前输出", value: <span data-testid="screen-current-mode">{screenState.mode}</span>, hint: screenState.fallbackEnabled ? "fallback enabled" : "primary projection" },
        { label: "显示分组", value: `第 ${screenState.activeGroupOrder} 组`, hint: screenState.autoRotateEnabled ? `${screenState.rotationIntervalSeconds}s 自动轮播` : "轮播已暂停" },
        { label: "Stable Projection", value: stableProjection?.status ?? "none", hint: stableProjection?.id ?? "暂无稳定版本" },
        { label: "公开作品", value: works.length, hint: works.length ? "works 模式可轮播" : "暂无公开作品" },
      ]} />

      <section className={styles.workspaceGrid}>
        <div className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><p>DISPLAY MODE</p><h2>展示模式</h2></div><span data-testid="screen-output-source" className={screenState.fallbackEnabled ? styles.warningPill : styles.goodPill}>{screenState.fallbackEnabled ? "fallback enabled" : "primary projection"}</span></div>
            <div className={`${styles.outputPreview} screen-preview-card`}>
              <div><span>Current output · ARY LIVE OUTPUT</span><strong>{modeLabels[screenState.mode as keyof typeof modeLabels] ?? screenState.mode}</strong><p>{modeSummary[screenState.mode] ?? "等待选择展示模式。"}</p></div>
              <i aria-hidden="true" />
            </div>
            {canManage ? <>
              <div className={styles.modeGrid}>
                {modes.map((mode) => <form action={switchScreenModeAction} key={mode}><input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="mode" value={mode} />{adminReasonField()}<PendingActionButton className={screenState.mode === mode ? styles.activeMode : ""} label={<><strong>{modeLabels[mode]}</strong><small>{mode}</small></>} pendingLabel="切换中…" testId={`screen-mode-${mode}`} variant="inherit" /></form>)}
              </div>
              <div className={styles.controlBar}>
                <form action={moveScreenDisplayGroupAction}><input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="direction" value="previous" />{adminReasonField()}<PendingActionButton label="上一组" pendingLabel="切换中…" variant="inherit" /></form>
                <form action={moveScreenDisplayGroupAction}><input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="direction" value="next" />{adminReasonField()}<PendingActionButton label="下一组" pendingLabel="切换中…" variant="inherit" /></form>
                {screenState.autoRotateEnabled ? <form action={pauseScreenRotationAction}><input type="hidden" name="raceId" value={race.id} />{adminReasonField()}<PendingActionButton label="暂停轮播" pendingLabel="正在暂停…" variant="inherit" /></form> : <form action={resumeScreenRotationAction}><input type="hidden" name="raceId" value={race.id} />{adminReasonField()}<PendingActionButton label="继续轮播" pendingLabel="正在恢复…" variant="inherit" /></form>}
                <form className={styles.intervalForm} action={configureScreenRotationAction}><input type="hidden" name="raceId" value={race.id} /><label><span>间隔</span><input name="intervalSeconds" type="number" min="5" max="120" defaultValue={screenState.rotationIntervalSeconds} /></label>{adminReasonField()}<PendingActionButton label="更新" pendingLabel="更新中…" variant="inherit" /></form>
              </div>
              <form className={styles.fallbackForm} action={toggleScreenFallbackAction}><input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="enabled" value={screenState.fallbackEnabled ? "false" : "true"} />{adminReasonField()}<div><strong>稳定 Projection Fallback</strong><p>实时 Projection 异常时保持最近一次稳定输出。</p></div><PendingActionButton label={screenState.fallbackEnabled ? "关闭 fallback" : "开启 fallback"} pendingLabel="正在更新 fallback…" testId="screen-fallback-toggle" variant="inherit" /></form>
            </> : <p className={styles.readOnly}>只读模式：当前角色不能切换 Display Mode、轮播或 fallback。</p>}
          </section>

          {canManage ? <section className={styles.panel}>
            <div className={styles.panelHeading}><div><p>STATIC MESSAGE</p><h2>现场公告</h2></div></div>
            <form className={styles.announcementForm} action={publishAnnouncementAction}><input type="hidden" name="raceId" value={race.id} /><label><span>公告标题</span><input name="title" defaultValue="现场公告" /></label><label><span>公告正文</span><textarea name="body" defaultValue="下一轮展示即将开始。" /></label>{adminReasonField()}<PendingActionButton label="发布并切换到公告" pendingLabel="正在发布公告…" variant="inherit" /></form>
          </section> : null}
        </div>

        <aside className={styles.panel}>
          <div className={styles.panelHeading}><div><p>PROJECTION HEALTH</p><h2>输出健康度 <small>Projection Health</small></h2></div></div>
          <KeyValueList items={[
            { label: "当前模式", value: `${screenState.mode} · group ${screenState.activeGroupOrder}` },
            { label: "稳定版本", value: stableProjection?.status ?? "none", tone: stableProjection ? "success" : "neutral" },
            { label: "失败隔离", value: failedProjection ? "isolated" : "none", tone: failedProjection ? "warning" : "success" },
            { label: "Payload 字段", value: `${Object.keys(payload).length} fields` },
          ]} />
          <div className={styles.healthNote}><strong>降级原则</strong><p>展示失败时优先使用最近稳定 Projection；不可用时切换静态榜单、作品或公告。</p></div>
        </aside>
      </section>
    </section>
  );
}
