import { getAuthContext } from "@/lib/auth";
import { getConsoleSnapshot } from "@/lib/queries";
import { createBackupAction, runP0Action } from "@/app/actions";

export default async function OpsPage() {
  const ctx = await getAuthContext();
  const { race } = await getConsoleSnapshot();
  if (!race) return <section className="route-page"><h1>No race seeded</h1></section>;
  return (
    <section className="route-page">
      <section className="module-title">
        <p className="section-kicker">Release / Ops / {ctx?.roles.join(", ") || "未登录"}</p>
        <h1>{race.title} 运维与发布检查</h1>
        <p className="module-summary">P0回归、发布检查项、备份、事故和归档入口已经接入服务端动作。</p>
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
                <div className="table-row" key={item.id}>
                  <span>{item.label}</span>
                  <b>{item.status}</b>
                  <em>{item.evidence || "No evidence yet"}</em>
                </div>
              ))}
            </div>
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
