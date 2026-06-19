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
                {allConnections.map(({ connection, registration }) => (
                  <div className="table-row" key={connection.id}>
                    <span>{registration.user.displayName}</span>
                    <b>{connection.ingestionStatus}{connection.disabledAt ? "/disabled" : ""}</b>
                    <em>{connection.connectorId} / {connection.externalProjectRef}</em>
                    <form action={disableCAConnectionAction}>
                      <input type="hidden" name="caConnectionId" value={connection.id} />
                      <button type="submit">Disable</button>
                    </form>
                  </div>
                ))}
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
              <article className="rider-status-card"><span>Registration</span><b>{ownRegistration?.status ?? "none"}</b><p>{ownRegistration?.race.title ?? "选择 Race 后报名"}</p></article>
              <article className="rider-status-card"><span>RaceProject</span><b>{ownProject?.aggregateIngestionStatus ?? "not_configured"}</b><p>{ownProject?.connectionHealth ?? "等待审核生成"}</p></article>
              <article className="rider-status-card"><span>Work</span><b>{ownRegistration?.work?.status ?? "none"}</b><p>{ownRegistration?.work?.title ?? "尚未提交作品"}</p></article>
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
              {(currentUser?.judgeAssignments ?? assignments).map((assignment) => (
                <div className="table-row" key={assignment.id}>
                  <span>{assignment.work.title}</span>
                  <b>{assignment.status}</b>
                  <Link href={`/works/${assignment.work.slug}/judge`}>Open Judge View</Link>
                </div>
              ))}
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
