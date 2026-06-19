import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { fromJson } from "@/lib/json";
import { getScreenSnapshot } from "@/lib/queries";
import { publishAnnouncementAction, switchScreenModeAction, toggleScreenFallbackAction } from "@/app/actions";

export default async function ScreenConsolePage() {
  const ctx = await getAuthContext();
  const snapshot = await getScreenSnapshot();
  if (!snapshot) return <section className="route-page"><h1>No race seeded</h1></section>;
  const { race, stableProjection, failedProjection, screenState } = snapshot;
  const payload = fromJson<Record<string, unknown>>(stableProjection?.payloadJson, {});
  const modes = ["live", "leaderboard", "works", "announcement", "fallback"];

  return (
    <section className="route-page">
      <section className="module-title">
        <p className="section-kicker">Screen Console / {ctx?.roles.join(", ") || "未登录"}</p>
        <h1>{race.title} 大屏控制台</h1>
        <p className="module-summary">切换现场大屏模式，Projection 异常时可落到稳定版本或静态公告。</p>
      </section>
      <section className="app-grid">
        <div className="app-stack">
          <section className="form-card">
            <h2>Display Mode</h2>
            <div className="screen-mode-grid">
              {modes.map((mode) => (
                <form action={switchScreenModeAction} key={mode}>
                  <input type="hidden" name="raceId" value={race.id} />
                  <input type="hidden" name="mode" value={mode} />
                  <button className={screenState.mode === mode ? "active" : ""} type="submit">{mode}</button>
                </form>
              ))}
            </div>
            <form action={toggleScreenFallbackAction}>
              <input type="hidden" name="raceId" value={race.id} />
              <input type="hidden" name="enabled" value={screenState.fallbackEnabled ? "false" : "true"} />
              <button type="submit">{screenState.fallbackEnabled ? "关闭 fallback" : "开启 fallback"}</button>
            </form>
            <Link className="inline-action" href="/screen/display">打开 Screen Display</Link>
          </section>
          <section className="form-card">
            <h2>Announcement</h2>
            <form action={publishAnnouncementAction}>
              <input type="hidden" name="raceId" value={race.id} />
              <input name="title" defaultValue="现场公告" />
              <textarea name="body" defaultValue="下一轮展示即将开始。" />
              <button type="submit">发布公告并切到 announcement</button>
            </form>
          </section>
        </div>
        <aside className="form-card">
          <h2>Projection Health</h2>
          <div className="ops-grid compact">
            <article><span>current</span><b>{screenState.mode}</b><p>{screenState.fallbackEnabled ? "fallback enabled" : "primary display"}</p></article>
            <article><span>stable</span><b>{stableProjection?.status ?? "none"}</b><p>{stableProjection?.id ?? "no stable projection"}</p></article>
            <article><span>failed</span><b>{failedProjection ? "isolated" : "none"}</b><p>{failedProjection?.stableVersionId ?? "no failed projection"}</p></article>
            <article><span>payload</span><b>{Object.keys(payload).length}</b><p>projection fields</p></article>
          </div>
        </aside>
      </section>
    </section>
  );
}