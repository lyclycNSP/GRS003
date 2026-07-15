import Link from "next/link";
import { canManageRace, getAuthContext } from "@/lib/auth";
import { fromJson } from "@/lib/json";
import { getScreenSnapshot } from "@/lib/queries";
import {
  configureScreenRotationAction,
  moveScreenDisplayGroupAction,
  pauseScreenRotationAction,
  publishAnnouncementAction,
  resumeScreenRotationAction,
  switchScreenModeAction,
  toggleScreenFallbackAction
} from "@/app/actions";

export default async function ScreenConsolePage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const ctx = await getAuthContext();
  const { error } = (await searchParams) ?? {};
  const snapshot = await getScreenSnapshot();
  if (!snapshot) return <section className="route-page"><h1>No race seeded</h1></section>;
  const { race, works, stableProjection, failedProjection, screenState } = snapshot;
  const canManage = canManageRace(ctx, race.id);
  const requiresAdminReason = Boolean(ctx?.roles.includes("admin") && !ctx.managedRaceIds.includes(race.id));
  const adminReasonField = () => requiresAdminReason ? <label>紧急操作原因<input name="reason" required /></label> : null;
  const payload = fromJson<Record<string, unknown>>(stableProjection?.payloadJson, {});
  const modes = ["live", "leaderboard", "works", "announcement"];
  const modeSummary: Record<string, string> = {
    live: "展示实时 Riding Signal、过程指标和事件流。",
    leaderboard: "展示最终奖项和榜单。",
    works: `轮播 ${works.length} 个公开作品。`,
    announcement: "展示现场公告和下一轮提醒。"
  };

  return (
    <section className="route-page">
      <section className="module-title">
        <p className="section-kicker">Screen Console / {ctx?.roles.join(", ") || "未登录"}</p>
        <h1>{race.title} 大屏控制台</h1>
        <p className="module-summary">{canManage ? "切换现场大屏模式，Projection 异常时可落到稳定版本或静态公告。" : "当前账号只能查看大屏状态；控制入口仅 Organizer / Admin 可用。"}</p>
        {error ? <p className="status-pill risk">Screen action rejected: {error}</p> : null}
      </section>
      <section className="app-grid">
        <div className="app-stack">
          <section className="form-card">
            <h2>Display Mode</h2>
            <div className="screen-preview-card">
              <span>Current output</span>
              <b data-testid="screen-current-mode">{screenState.mode}</b>
              <p>{modeSummary[screenState.mode] ?? "等待选择展示模式。"}</p>
              <em data-testid="screen-output-source">{screenState.fallbackEnabled ? "fallback enabled" : "primary projection"}</em>
            </div>
            {canManage ? (
              <>
                <div className="screen-mode-grid">
                  {modes.map((mode) => (
                    <form action={switchScreenModeAction} key={mode}>
                      <input type="hidden" name="raceId" value={race.id} />
                      <input type="hidden" name="mode" value={mode} />
                      {adminReasonField()}
                      <button className={screenState.mode === mode ? "active" : ""} data-testid={`screen-mode-${mode}`} type="submit">{mode}</button>
                    </form>
                  ))}
                </div>
                <form action={toggleScreenFallbackAction}>
                  <input type="hidden" name="raceId" value={race.id} />
                  <input type="hidden" name="enabled" value={screenState.fallbackEnabled ? "false" : "true"} />
                  {adminReasonField()}
                  <button data-testid="screen-fallback-toggle" type="submit">{screenState.fallbackEnabled ? "关闭 fallback" : "开启 fallback"}</button>
                </form>
                <div className="screen-mode-grid">
                  <form action={moveScreenDisplayGroupAction}><input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="direction" value="previous" />{adminReasonField()}<button type="submit">上一组</button></form>
                  <form action={moveScreenDisplayGroupAction}><input type="hidden" name="raceId" value={race.id} /><input type="hidden" name="direction" value="next" />{adminReasonField()}<button type="submit">下一组</button></form>
                  {screenState.autoRotateEnabled ? (
                    <form action={pauseScreenRotationAction}><input type="hidden" name="raceId" value={race.id} />{adminReasonField()}<button type="submit">暂停轮播</button></form>
                  ) : (
                    <form action={resumeScreenRotationAction}><input type="hidden" name="raceId" value={race.id} />{adminReasonField()}<button type="submit">继续轮播</button></form>
                  )}
                </div>
                <form action={configureScreenRotationAction}>
                  <input type="hidden" name="raceId" value={race.id} />
                  <label>轮播间隔（5–120 秒）<input name="intervalSeconds" type="number" min="5" max="120" defaultValue={screenState.rotationIntervalSeconds} /></label>
                  {adminReasonField()}
                  <button type="submit">更新轮播</button>
                </form>
              </>
            ) : (
              <p>只读模式：当前角色不能切换 Display Mode 或 fallback。</p>
            )}
            <Link className="inline-action" data-testid="screen-display-link" href="/screen/display">打开 Screen Display</Link>
          </section>
          {canManage ? <section className="form-card">
            <h2>Announcement</h2>
            <form action={publishAnnouncementAction}>
              <input type="hidden" name="raceId" value={race.id} />
              <input name="title" defaultValue="现场公告" />
              <textarea name="body" defaultValue="下一轮展示即将开始。" />
              {adminReasonField()}
              <button type="submit">发布公告并切到 announcement</button>
            </form>
          </section> : null}
        </div>
        <aside className="form-card">
          <h2>Projection Health</h2>
          <div className="ops-grid compact">
            <article><span>current</span><b>{screenState.mode}</b><p>第 {screenState.activeGroupOrder} 组 · {screenState.autoRotateEnabled ? `${screenState.rotationIntervalSeconds}s 自动轮播` : "已暂停"}</p></article>
            <article><span>stable</span><b>{stableProjection?.status ?? "none"}</b><p>{stableProjection?.id ?? "no stable projection"}</p></article>
            <article><span>failed</span><b>{failedProjection ? "isolated" : "none"}</b><p>{failedProjection?.stableVersionId ?? "no failed projection"}</p></article>
            <article><span>payload</span><b>{Object.keys(payload).length}</b><p>projection fields</p></article>
          </div>
        </aside>
      </section>
    </section>
  );
}
