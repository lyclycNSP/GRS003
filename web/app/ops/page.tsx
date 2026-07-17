import { canManageRace, getAuthContext } from "@/lib/auth";
import { getConsoleSnapshot } from "@/lib/queries";
import { createBackupAction, markCanaryReadyAction, markProductionReleasedAction, markReleaseChecklistItemAction, recordGoNoGoAction, runP0Action } from "@/app/actions";
import { notFound } from "next/navigation";
import { ActionOutcomePanel, PendingActionButton, StatRail, StatusSummary, type ActionOutcome } from "@/app/components/ui";
import styles from "./Ops.module.css";

const outcomeByAction: Record<string, { outcome: ActionOutcome; title: string; description: string; anchor: string; entityLabel?: string }> = {
  "backup-created": { outcome: "success", title: "备份记录已创建", description: "新的备份 Evidence 已进入本场赛事的运维记录。", anchor: "#backup", entityLabel: "Backup ID" },
  "backup-create-failed": { outcome: "error", title: "备份记录创建失败", description: "请检查赛事状态与备份范围后重试。", anchor: "#backup" },
  "p0-completed": { outcome: "success", title: "P0 回归已完成", description: "彩排结果和 Evidence 已写入发布检查上下文。", anchor: "#p0-regression", entityLabel: "Race ID" },
  "p0-failed": { outcome: "error", title: "P0 回归未完成", description: "请先处理阻断项，再重新运行 P0 回归。", anchor: "#p0-regression" },
  "release-checklist-updated": { outcome: "success", title: "发布检查项已更新", description: "该检查项的状态和 Evidence 已同步到发布就绪摘要。", anchor: "#release-checklist", entityLabel: "Checklist item" },
  "release-checklist-update-failed": { outcome: "error", title: "发布检查项没有更新", description: "请确认 Evidence 和当前操作权限后重试。", anchor: "#release-checklist" },
  "go-no-go-recorded": { outcome: "success", title: "Go / No-Go 决策已记录", description: "最终决策 Evidence 已进入本场赛事的发布审计链。", anchor: "#release-decision", entityLabel: "Race ID" },
  "go-no-go-record-failed": { outcome: "error", title: "Go / No-Go 决策未记录", description: "请补充有效 Evidence 后重试。", anchor: "#release-decision" },
  "canary-ready": { outcome: "success", title: "Canary 状态已就绪", description: "灰度发布 Evidence 已保存，页面状态已同步。", anchor: "#release-decision", entityLabel: "Race ID" },
  "canary-ready-failed": { outcome: "error", title: "Canary 状态没有更新", description: "请确认前置检查项和 Evidence 后重试。", anchor: "#release-decision" },
  "production-released": { outcome: "success", title: "Production 发布状态已记录", description: "正式发布 Evidence 已保存到本场赛事。", anchor: "#release-decision", entityLabel: "Race ID" },
  "production-release-failed": { outcome: "error", title: "Production 发布状态没有更新", description: "请确认发布门禁和 Evidence 后重试。", anchor: "#release-decision" },
};

export default async function OpsPage({ searchParams }: { searchParams?: Promise<{ raceId?: string; action?: string; actionError?: string; entityId?: string }> }) {
  const ctx = await getAuthContext();
  const { raceId, action, actionError, entityId } = (await searchParams) ?? {};
  if (!ctx || !raceId || !canManageRace(ctx, raceId)) notFound();
  const { race } = await getConsoleSnapshot(raceId);
  if (!race || race.id !== raceId) notFound();
  const doneItems = race.releaseItems.filter((item) => item.status === "done");
  const releaseTotal = race.releaseItems.length;
  const releaseReady = releaseTotal > 0 && doneItems.length === releaseTotal;
  const remainingItems = race.releaseItems.filter((item) => item.status !== "done");
  const actionOutcome = action ? outcomeByAction[action] : undefined;
  return (
    <section className={`${styles.page} route-page`} data-testid="ops-workspace">
      <section className={`${styles.hero} module-title`}>
        <p className="section-kicker">Release / Ops / {ctx.activeRole}</p>
        <h1>{race.title} 运维与发布检查</h1>
        <p className="module-summary">集中核对 P0 回归、发布检查项、备份与事故证据，为最终 go / no-go 决策提供可追溯依据。</p>
      </section>
      {action && actionOutcome ? (
        <ActionOutcomePanel
          actionCode={action}
          description={actionOutcome.outcome === "error" && actionError ? actionError : actionOutcome.description}
          entity={actionOutcome.outcome === "success" && entityId && actionOutcome.entityLabel ? { label: actionOutcome.entityLabel, value: entityId } : undefined}
          nextAction={<a href={actionOutcome.anchor}>查看更新后的状态</a>}
          outcome={actionOutcome.outcome}
          title={actionOutcome.title}
        />
      ) : null}
      <StatusSummary
        eyebrow="Release readiness"
        title={releaseReady ? "发布证据已齐" : `还有 ${remainingItems.length} 项待完成`}
        description={releaseReady ? "可以进入汇报或下一阶段演练。" : `下一步：${remainingItems[0]?.label ?? "补齐发布证据"}`}
        tone={releaseReady ? "success" : "warning"}
      />
      <StatRail aria-label="发布就绪信息" items={[
        { label: "完成进度", value: `${doneItems.length}/${releaseTotal}`, hint: releaseReady ? "ready" : "pending", tone: releaseReady ? "success" : "warning" },
        { label: "Evidence", value: race.backups.length + race.incidents.length, hint: "备份与事故记录" },
        { label: "Next action", value: remainingItems[0]?.label ?? "go/no-go", hint: remainingItems[0] ? "优先补证据" : "记录最终决策" },
      ]} />
      <section className="app-grid">
        <div className="app-stack">
          <section className="form-card" id="p0-regression">
            <h2>P0 Regression</h2>
            <form action={runP0Action}>
              <input type="hidden" name="raceId" value={race.id} />
              <PendingActionButton label="Run P0 Regression" pendingLabel="正在执行 P0 回归…" testId="ops-run-p0" variant="inherit" />
            </form>
          </section>
          <section className="form-card" id="release-checklist">
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
                  <PendingActionButton disabled={item.status === "done"} label={item.status === "done" ? "已完成" : "Mark done"} pendingLabel="正在保存证据…" variant="inherit" />
                </form>
              ))}
            </div>
          </section>
          <section className="form-card" id="release-decision">
            <h2>Canary / Production / Go-No-Go</h2>
            <form action={markCanaryReadyAction}>
              <input type="hidden" name="raceId" value={race.id} />
              <input name="evidence" defaultValue="本地灰度发布证据已确认。" />
              <PendingActionButton label="Mark Canary Ready" pendingLabel="正在记录 Canary 证据…" variant="inherit" />
            </form>
            <form action={markProductionReleasedAction}>
              <input type="hidden" name="raceId" value={race.id} />
              <input name="evidence" defaultValue="本地正式发布证据已确认。" />
              <PendingActionButton label="Mark Production Released" pendingLabel="正在记录发布证据…" variant="inherit" />
            </form>
            <form action={recordGoNoGoAction}>
              <input type="hidden" name="raceId" value={race.id} />
              <input name="evidence" defaultValue="go：P0、Live Hall、大屏、Report、Results 彩排完成。" />
              <PendingActionButton label="Record Go / No-Go" pendingLabel="正在记录最终决策…" variant="inherit" />
            </form>
          </section>
        </div>
        <aside className="form-card" id="backup">
          <h2>Backup / Incidents</h2>
          <form action={createBackupAction}>
            <input type="hidden" name="raceId" value={race.id} />
            <input name="scope" defaultValue="manual_ops_snapshot" />
            <PendingActionButton label="Create Backup" pendingLabel="正在创建备份记录…" testId="ops-create-backup" variant="inherit" />
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
