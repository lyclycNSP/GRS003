import Link from "next/link";
import { redirect } from "next/navigation";
import {
  approveRegistrationAction,
  assignJudgeAction,
  createRaceAction,
  disableCAConnectionAction,
  editReportAction,
  generateReportAction,
  handshakeCAAction,
  ingestSignalAction,
  publishAwardAction,
  publishRaceAction,
  publishReportAction,
  publishWorkAction,
  rebuildProjectionAction,
  regenerateReportAction,
  registerCAAction,
  simulateProjectionFailureAction,
  simulateReportFailureAction,
  submitRegistrationAction,
  submitWorkAction,
  updateRolesAction
} from "@/app/actions";
import { getAuthContext } from "@/lib/auth";
import { fromJson } from "@/lib/json";
import { getConsoleSnapshotForUser } from "@/lib/queries";

function hasRole(roles: string[], role: string) {
  return roles.includes("admin") || roles.includes(role);
}

function toneFor(value?: string | null) {
  if (!value) return "muted";
  if (["active", "approved", "published", "submitted", "done", "complete", "connected"].includes(value)) return "good";
  if (["failed", "disabled", "rejected", "needs profile"].some((item) => value.includes(item))) return "risk";
  if (["open", "draft", "not_configured", "pending"].includes(value)) return "warn";
  return "muted";
}

function stepState(done: boolean, active: boolean) {
  if (done) return "done";
  if (active) return "active";
  return "todo";
}

export default async function ConsolePage() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return (
      <section className="route-page">
        <section className="console-main route-hero">
          <p className="section-kicker">Workspace</p>
          <h1>请先登录</h1>
          <p>登录后进入 Organizer、Rider、Judge 或 Admin 工作台。</p>
          <Link className="inline-action" href="/api/auth/github">GitHub 登录</Link>
        </section>
      </section>
    );
  }
  if (!ctx.profileCompleted) redirect("/profile");

  const { race, users, assignments, currentUser } = await getConsoleSnapshotForUser(ctx.userId);
  if (!race) return <section className="route-page"><h1>No race seeded</h1></section>;

  const roles = ctx.roles;
  const registrations = race.registrations;
  const firstApproved = registrations.find((registration) => registration.status === "approved");
  const firstProject = firstApproved?.raceProject;
  const firstConnection = firstProject?.caConnections[0];
  const allConnections = registrations.flatMap((registration) => registration.raceProject?.caConnections.map((connection) => ({ connection, registration })) ?? []);
  const firstWork = registrations.find((registration) => registration.work)?.work;
  const judge = users.find((user) => fromJson<string[]>(user.rolesJson, []).includes("judge"));
  const ownRegistrations = currentUser?.registrations ?? [];
  const ownRegistration = ownRegistrations[0];
  const ownProject = ownRegistration?.raceProject;
  const ownConnection = ownProject?.caConnections[0];
  const approvedCount = registrations.filter((registration) => registration.status === "approved").length;
  const projectCount = registrations.filter((registration) => registration.raceProject).length;
  const connectionCount = allConnections.length;
  const verifiedConnectionCount = allConnections.filter(({ connection }) => connection.handshakeAt && !connection.disabledAt).length;
  const activeConnectionCount = allConnections.filter(({ connection }) => connection.ingestionStatus === "active" && !connection.disabledAt).length;
  const workCount = registrations.filter((registration) => registration.work).length;
  const publicReportCount = race.reports.filter((report) => report.status === "published" && report.visibility === "public").length;
  const riskFlags = registrations.flatMap((registration) => registration.reviewFlags);
  const workflowSteps = [
    { label: "Registration", detail: `${approvedCount}/${registrations.length} approved`, done: approvedCount > 0, active: registrations.length > 0 },
    { label: "RaceProject", detail: `${projectCount} generated`, done: projectCount > 0, active: approvedCount > 0 },
    { label: "CA verified", detail: `${verifiedConnectionCount}/${connectionCount} attested`, done: verifiedConnectionCount > 0, active: connectionCount > 0 },
    { label: "Projection", detail: `${activeConnectionCount} active`, done: activeConnectionCount > 0, active: verifiedConnectionCount > 0 },
    { label: "Work", detail: `${workCount} submitted`, done: workCount > 0, active: activeConnectionCount > 0 },
    { label: "Report", detail: `${publicReportCount} public`, done: publicReportCount > 0, active: workCount > 0 }
  ];

  return (
    <section className="route-page console-layout">
      <aside className="console-sidebar">
        <h2>Workspace</h2>
        {hasRole(roles, "organizer") ? <a href="#organizer">Organizer View</a> : null}
        {hasRole(roles, "rider") ? <a href="#rider">Rider View</a> : null}
        {hasRole(roles, "judge") ? <a href="#judge">Judge View</a> : null}
        {hasRole(roles, "admin") ? <a href="#admin">Admin Console</a> : null}
        <Link href="/profile">Profile</Link>
        <Link href="/ops">Ops</Link>
      </aside>

      <section className="console-main">
        <p className="section-kicker">Console / {race.title} / {roles.join(", ")}</p>
        <h1>{race.title} 指挥席</h1>
        <section className="console-flow-strip" aria-label="MVP workflow">
          {workflowSteps.map((step) => (
            <article className={stepState(step.done, step.active)} key={step.label}>
              <span>{step.label}</span>
              <b>{step.done ? "ready" : step.active ? "in progress" : "waiting"}</b>
              <p>{step.detail}</p>
            </article>
          ))}
        </section>
        <section className="console-signal-bar">
          <article>
            <span>CA Trust</span>
            <b>{verifiedConnectionCount > 0 ? "attestation visible" : "waiting for OCR / connector"}</b>
            <p>CA 信号必须带 OCR Desktop App / registered connector 签名，伪造或篡改会进入隔离。</p>
          </article>
          <article>
            <span>Review Risk</span>
            <b>{riskFlags.length} flags</b>
            <p>{riskFlags[0]?.judgeVisibleSummary ?? "当前没有评审前风险提示。"}</p>
          </article>
        </section>
        <section className="role-entry-grid">
          {["organizer", "rider", "judge", "admin"].map((role) => (
            <a href={hasRole(roles, role) ? `#${role}` : "#"} className={hasRole(roles, role) ? "active" : ""} key={role}>
              <span>{role}</span>
              <b>{hasRole(roles, role) ? "enabled" : "hidden"}</b>
              <p>{role === "organizer" ? "报名、CA、作品、评审和发布。" : role === "rider" ? "自己的报名、RaceProject 和 Work。" : role === "judge" ? "已分配作品和评分表。" : "User.roles 维护。"}</p>
            </a>
          ))}
        </section>

        {hasRole(roles, "organizer") ? (
          <section id="organizer" className="console-view-panel active">
            <section className="form-card">
              <h2>Race 管理</h2>
              <form action={createRaceAction}>
                <input name="title" defaultValue="本地演示 Race" />
                <input name="challenge" defaultValue="用 Agent 完成一次可演示的赛事闭环。" />
                <textarea name="summary" defaultValue="DEV-4 到 REL-1 本地演示 Race。" />
                <button type="submit">创建 Race</button>
              </form>
              <form action={publishRaceAction}>
                <input type="hidden" name="raceId" value={race.id} />
                <button type="submit">发布当前 Race</button>
              </form>
            </section>
            <div className="ops-grid">
              <article><span>赛道</span><b>{race.status}</b><p>作品提交开放</p></article>
              <article><span>报名</span><b>{registrations.length}</b><p>Rider 已入场</p></article>
              <article><span>连接</span><b>{registrations.flatMap((r) => r.raceProject?.caConnections ?? []).length}</b><p>CAConnection</p></article>
              <article><span>作品</span><b>{registrations.filter((r) => r.work).length}</b><p>已提交</p></article>
              <article><span>报告</span><b>{race.reports.length}</b><p>草稿/公开</p></article>
              <article><span>奖项</span><b>{race.awards.length}</b><p>Leaderboard</p></article>
            </div>
            <section className="form-card">
              <h2>报名审核</h2>
              <div className="table-list">
                {registrations.map((registration) => (
                  <div className="table-row" key={registration.id}>
                    <span>{registration.user.displayName}</span>
                    <b>{registration.status}</b>
                    <form action={approveRegistrationAction}>
                      <input type="hidden" name="registrationId" value={registration.id} />
                      <button type="submit">Approve + RaceProject</button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
            <section className="form-card">
              <h2>CAConnection 状态</h2>
              <div className="table-list">
                {allConnections.length > 0 ? allConnections.map(({ connection, registration }) => (
                  <div className="table-row ca-row" key={connection.id}>
                    <span>{registration.user.displayName}</span>
                    <b className={`status-pill ${toneFor(connection.disabledAt ? "disabled" : connection.ingestionStatus)}`}>{connection.ingestionStatus}{connection.disabledAt ? "/disabled" : ""}</b>
                    <em>
                      <strong>{connection.handshakeAt && !connection.disabledAt ? "Verified by OCR / connector" : "Attestation pending"}</strong>
                      {connection.connectorId} / {connection.externalProjectRef}
                    </em>
                    <form action={disableCAConnectionAction}>
                      <input type="hidden" name="caConnectionId" value={connection.id} />
                      <button type="submit">Disable</button>
                    </form>
                  </div>
                )) : <div className="empty-state">暂无 CAConnection。Rider 审核通过后先登记并握手，再接入带 attestation 的 CA Signal。</div>}
              </div>
            </section>
            <section className="form-card">
              <h2>发布与报告</h2>
              {firstWork ? (
                <>
                  <form action={publishWorkAction}>
                    <input type="hidden" name="workId" value={firstWork.id} />
                    <button type="submit">公开 Work</button>
                  </form>
                  {judge ? (
                    <form action={assignJudgeAction}>
                      <input type="hidden" name="workId" value={firstWork.id} />
                      <input type="hidden" name="judgeUserId" value={judge.id} />
                      <button type="submit">分配 Judge</button>
                    </form>
                  ) : null}
                  <form action={publishAwardAction}>
                    <input type="hidden" name="raceId" value={race.id} />
                    <input type="hidden" name="registrationId" value={firstApproved?.id ?? ""} />
                    <input type="hidden" name="workId" value={firstWork.id} />
                    <input name="awardName" defaultValue="Grand Prize" />
                    <input name="rank" defaultValue="1" />
                    <textarea name="reason" defaultValue="Best combined result and riding evidence package." />
                    <button type="submit">发布 Award</button>
                  </form>
                </>
              ) : <p>需要先提交 Work。</p>}
              <form action={rebuildProjectionAction}>
                <input type="hidden" name="raceId" value={race.id} />
                <button type="submit">重建 Projection</button>
              </form>
              <form action={generateReportAction}>
                <input type="hidden" name="raceId" value={race.id} />
                <select name="type" defaultValue="race_report">
                  <option value="race_report">race_report</option>
                  <option value="review_summary">review_summary</option>
                  <option value="rider_report">rider_report</option>
                </select>
                <input name="subjectRegistrationId" placeholder="rider_report registrationId" />
                <button type="submit">生成 Report</button>
              </form>
              <div className="table-list">
                {race.reports.map((report) => (
                  <div className="table-row" key={report.id}>
                    <span>{report.type}</span>
                    <b>{report.status}/{report.visibility}</b>
                    <form action={publishReportAction}>
                      <input type="hidden" name="reportId" value={report.id} />
                      <button type="submit">Publish</button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          </section>
        ) : null}

        {hasRole(roles, "rider") ? (
          <section id="rider" className="form-card">
            <h2>Rider View</h2>
            <div className="rider-cockpit-grid">
              <article className="rider-status-card"><span>Registration</span><b className={`status-pill ${toneFor(ownRegistration?.status)}`}>{ownRegistration?.status ?? "none"}</b><p>{ownRegistration?.race.title ?? "选择 Race 后报名"}</p></article>
              <article className="rider-status-card"><span>RaceProject</span><b className={`status-pill ${toneFor(ownProject?.aggregateIngestionStatus)}`}>{ownProject?.aggregateIngestionStatus ?? "not_configured"}</b><p>{ownProject?.connectionHealth ?? "等待审核生成"}</p></article>
              <article className="rider-status-card"><span>Work</span><b className={`status-pill ${toneFor(ownRegistration?.work?.status)}`}>{ownRegistration?.work?.status ?? "none"}</b><p>{ownRegistration?.work?.title ?? "尚未提交作品"}</p></article>
            </div>
            <div className="ca-attestation-panel">
              <span>CA anti-forgery</span>
              <b>{ownConnection?.handshakeAt ? "OCR / connector signature required" : "waiting for CA handshake"}</b>
              <p>{ownConnection ? `connectorId: ${ownConnection.connectorId}. 合法信号会携带 dev-signature:${ownConnection.connectorId}:<idempotencyKey>。` : "登记 CAConnection 后，系统会展示签名来源和接入状态。"}</p>
            </div>
            {!ownRegistration ? (
              <div className="console-empty-actions">
                <p>你还没有报名当前赛事。先提交报名，审核通过后会生成 RaceProject。</p>
                <form action={submitRegistrationAction}>
                  <input type="hidden" name="raceId" value={race.id} />
                  <button type="submit">报名参赛</button>
                </form>
                <Link className="inline-action" href={`/races/${race.slug}`}>查看 Race Page</Link>
              </div>
            ) : ownProject ? (
              <>
                <form action={registerCAAction}>
                  <input type="hidden" name="raceProjectId" value={ownProject.id} />
                  <button type="submit">新增 CAConnection</button>
                </form>
                {ownConnection ? (
                  <>
                    <form action={handshakeCAAction}>
                      <input type="hidden" name="caConnectionId" value={ownConnection.id} />
                      <button type="submit">握手 CAConnection</button>
                    </form>
                    <form action={ingestSignalAction}>
                      <input type="hidden" name="raceId" value={ownRegistration!.raceId} />
                      <input type="hidden" name="registrationId" value={ownRegistration!.id} />
                      <input type="hidden" name="raceProjectId" value={ownProject.id} />
                      <input type="hidden" name="caConnectionId" value={ownConnection.id} />
                      <input type="hidden" name="connectorId" value={ownConnection.connectorId} />
                      <input name="caSessionId" defaultValue="session-ui" />
                      <input name="progressPercent" defaultValue="100" />
                      <input name="tokens" defaultValue="12000" />
                      <button type="submit">接入合法 CA Signal</button>
                    </form>
                  </>
                ) : null}
                <form action={submitWorkAction}>
                  <input type="hidden" name="registrationId" value={ownRegistration!.id} />
                  <input name="title" defaultValue={ownRegistration?.work?.title ?? "Adaptive Bay Route Agent"} />
                  <textarea name="summary" defaultValue={ownRegistration?.work?.summary ?? "A route planner that replans around live constraints and explains tradeoffs."} />
                  <input name="demoUrl" defaultValue={ownRegistration?.work?.demoUrl ?? "https://demo.example.com/adaptive-bay-route-agent"} />
                  <input name="repoUrl" defaultValue={ownRegistration?.work?.repoUrl ?? "https://github.com/example/adaptive-bay-route-agent"} />
                  <button type="submit">提交 Work</button>
                </form>
              </>
            ) : <p>需要 Organizer 审核报名后生成 RaceProject。</p>}
          </section>
        ) : null}

        {hasRole(roles, "judge") ? (
          <section id="judge" className="form-card">
            <h2>Judge View</h2>
            <div className="table-list">
              {(currentUser?.judgeAssignments ?? assignments).length > 0 ? (currentUser?.judgeAssignments ?? assignments).map((assignment) => (
                <div className="table-row" key={assignment.id}>
                  <span>{assignment.work.title}</span>
                  <b className={`status-pill ${toneFor(assignment.status)}`}>{assignment.status}</b>
                  <Link href={`/works/${assignment.work.slug}/judge`}>Open Judge View</Link>
                </div>
              )) : <div className="empty-state">暂无分配作品。Organizer 发布 Work 后可分配 Judge。</div>}
            </div>
          </section>
        ) : null}

        {hasRole(roles, "admin") ? (
          <section id="admin" className="form-card">
            <h2>Admin / User.roles</h2>
            {users.map((user) => {
              const userRoles = fromJson<string[]>(user.rolesJson, []);
              return (
                <form className="table-row role-row" action={updateRolesAction} key={user.id}>
                  <input type="hidden" name="userId" value={user.id} />
                  <span>{user.displayName}</span>
                  <b>{user.profileCompleted ? "complete" : "needs profile"}</b>
                  <em>
                    {["rider", "judge", "organizer", "admin"].map((role) => (
                      <label key={role}><input type="checkbox" name={role} defaultChecked={userRoles.includes(role)} />{role}</label>
                    ))}
                    <button type="submit">Save</button>
                  </em>
                </form>
              );
            })}
          </section>
        ) : null}
      </section>
    </section>
  );
}
