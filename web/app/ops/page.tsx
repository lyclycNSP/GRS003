import { getAuthContext } from "@/lib/auth";
import { getConsoleSnapshot } from "@/lib/queries";
import { createBackupAction, markCanaryReadyAction, markProductionReleasedAction, markReleaseChecklistItemAction, recordGoNoGoAction, runP0Action } from "@/app/actions";

export default async function OpsPage() {
  const ctx = await getAuthContext();
  const { race } = await getConsoleSnapshot();
  if (!race) return <section className="route-page"><h1>No race seeded</h1></section>;
  const doneItems = race.releaseItems.filter((item) => item.status === "done");
  const releaseTotal = race.releaseItems.length;
  const releaseReady = releaseTotal > 0 && doneItems.length === releaseTotal;
  const remainingItems = race.releaseItems.filter((item) => item.status !== "done");
  return (
    <section className="route-page">
      <section className="module-title">
        <p className="section-kicker">Release / Ops / {ctx?.roles.join(", ") || "未登录"}</p>
        <h1>{race.title} 运维与发布检查</h1>
        <p className="module-summary">P0回归、发布检查项、备份、事故和归档入口已经接入服务端动作。</p>
      </section>
      <section className="release-readiness-panel">
        <article className={releaseReady ? "ready" : "pending"}>
          <span>Release readiness</span>
          <b>{doneItems.length}/{releaseTotal}</b>
          <p>{releaseReady ? "本地 checkpoint 发布证据已齐，可以进入汇报或下一阶段演练。" : `还剩 ${remainingItems.length} 个检查项需要补证据。`}</p>
        </article>
        <article>
          <span>Evidence</span>
          <b>{race.backups.length + race.incidents.length}</b>
          <p>备份、事故、回滚和归档证据会在这里沉淀。</p>
        </article>
        <article>
          <span>Next action</span>
          <b>{remainingItems[0]?.label ?? "go/no-go"}</b>
          <p>{remainingItems[0] ? "优先补齐这个检查项的证据。" : "可以记录最终 go / no-go 决策。"}</p>
        </article>
      </section>
      <section className="app-grid">
        <div className="app-stack">
          <section className="form-card">
            <h2>P0 Regression</h2>
            <form action={runP0Action}>
              <input type="hidden" name="raceId" value={race.id} />
              <button type="submit">Run P0 Regression</button>
            </form>
          </section>
          <section className="form-card">
            <h2>Release Checklist</h2>
            <div className="table-list">
              {race.releaseItems.map((item) => (
                <form className="table-row" action={markReleaseChecklistItemAction} key={item.id}>
                  <input type="hidden" name="raceId" value={race.id} />
                  <input type="hidden" name="itemKey" value={item.itemKey} />
                  <input type="hidden" name="label" value={item.label} />
                  <span>{item.label}</span>
                  <b className={`status-pill ${item.status === "done" ? "good" : "warn"}`}>{item.status}</b>
                  <input name="evidence" defaultValue={item.evidence || "local rehearsal evidence recorded"} />
                  <button type="submit">Mark done</button>
                </form>
              ))}
            </div>
          </section>
          <section className="form-card">
            <h2>Canary / Production / Go-No-Go</h2>
            <form action={markCanaryReadyAction}>
              <input type="hidden" name="raceId" value={race.id} />
              <input name="evidence" defaultValue="本地灰度发布证据已确认。" />
              <button type="submit">Mark Canary Ready</button>
            </form>
            <form action={markProductionReleasedAction}>
              <input type="hidden" name="raceId" value={race.id} />
              <input name="evidence" defaultValue="本地正式发布证据已确认。" />
              <button type="submit">Mark Production Released</button>
            </form>
            <form action={recordGoNoGoAction}>
              <input type="hidden" name="raceId" value={race.id} />
              <input name="evidence" defaultValue="go：P0、Live Hall、大屏、Report、Results 彩排完成。" />
              <button type="submit">Record Go / No-Go</button>
            </form>
          </section>
        </div>
        <aside className="form-card">
          <h2>Backup / Incidents</h2>
          <form action={createBackupAction}>
            <input type="hidden" name="raceId" value={race.id} />
            <input name="scope" defaultValue="manual_ops_snapshot" />
            <button type="submit">Create Backup</button>
          </form>
          {race.backups.map((backup) => (
            <div className="table-row" key={backup.id}>
              <span>{backup.scope}</span><b>{backup.status}</b><em>{backup.evidence}</em>
            </div>
          ))}
          {race.incidents.map((incident) => (
            <div className="table-row" key={incident.id}>
              <span>{incident.impact}</span><b>{incident.action}</b><em>{incident.followUp}</em>
            </div>
          ))}
        </aside>
      </section>
    </section>
  );
}
