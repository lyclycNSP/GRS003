import Link from "next/link";
import { redirect } from "next/navigation";
import { AppIcon } from "@/app/components/AppIcon";
import { CopyInviteCode } from "@/app/console/CopyInviteCode";
import { ActionOutcomePanel, LifecycleStepper, PageHeader, PendingActionButton, StatRail, StatusBadge, StatusSummary } from "@/app/components/ui";
import visualStyles from "@/app/console/RoleWorkspaceVisual.module.css";
import {
  approveRegistrationAction,
  allocateRaceJudgesAction,
  configureSubmissionWindowAction,
  disableCAConnectionAction,
  editReportAction,
  generateReportAction,
  handshakeCAAction,
  ingestSignalAction,
  lockSubmissionWindowAction,
  leaveTeamAction,
  publishAwardAction,
  publishRaceAction,
  publishRaceReviewResultsAction,
  publishReportAction,
  publishWorkAction,
  rebuildProjectionAction,
  rejectRegistrationAction,
  regenerateReportAction,
  registerCAAction,
  removeTeamMemberAction,
  simulateProjectionFailureAction,
  simulateReportFailureAction,
  saveRaceJudgePoolAction,
  submitTeamRegistrationAction,
  submitWorkAction,
  updateTeamAction,
} from "@/app/actions";
import { getAuthContext, type Role } from "@/lib/auth";
import { getJudgeAllocationPreview } from "@/lib/domain";
import { fromJson } from "@/lib/json";
import { getConsoleSnapshotForUser, getEntrantDisplay, getJudgeManagementSnapshot, getRaceReviewAggregatesForUser } from "@/lib/queries";
import { getSubmissionWindowState } from "@/lib/work-submission";
import { resolveVisualCover } from "@/lib/visual-covers";

function toneFor(value?: string | null) {
  if (!value) return "muted";
  if (["active", "approved", "published", "submitted", "done", "complete", "connected"].includes(value)) return "good";
  if (["failed", "disabled", "rejected", "needs profile"].some((item) => value.includes(item))) return "risk";
  if (["open", "draft", "not_configured", "pending"].includes(value)) return "warn";
  return "muted";
}

function utcInputValue(value?: Date | null) {
  return value?.toISOString().slice(0, 16) ?? "";
}

type WorkspaceSearchParams = {
  raceId?: string;
  action?: string;
  entityId?: string;
  actionMessage?: string;
  actionError?: string;
};

function OrganizerActionOutcome({ action, entityId, actionMessage, actionError, raceId, raceSlug }: { action?: string; entityId?: string; actionMessage?: string; actionError?: string; raceId: string; raceSlug: string }) {
  if (!action) {
    if (actionMessage) return <ActionOutcomePanel actionCode="legacy-workspace-success" outcome="success" title="工作台状态已更新" description="页面数据已经重新读取，请在对应实体区域确认最新状态。" />;
    if (actionError) return <ActionOutcomePanel actionCode="legacy-workspace-failed" outcome="error" title="操作未完成" description="请检查当前权限与资源状态后重试。" />;
    return null;
  }
  const success = {
    "registration-approved": { title: "报名已通过并移入参赛选手库", description: "待审核队列已更新，RaceProject 与初始完整性检查已按幂等规则建立。", href: `/console/organizer/races/${raceId}/participants`, next: "查看参赛选手库" },
    "registration-rejected": { title: "报名已拒绝并移入历史记录", description: "拒绝原因已经进入审核记录，当前报名不会生成 RaceProject。", href: `/console/organizer/races/${raceId}/participants?status=history`, next: "查看审核历史" },
    "judge-pool-saved": { title: "赛事 Judge 池已更新", description: "候选资格与参赛冲突已重新校验，可继续预检并自动分配。", href: `#judge-allocation`, next: "查看分配预检" },
    "judges-allocated": { title: "三 Judge 自动分配已原子完成", description: "每件符合条件的作品已固定到三个不同 Judge，任务负载和覆盖矩阵已刷新。", href: `#judge-allocation`, next: "查看覆盖矩阵" },
    "review-results-published": { title: "聚合评审结果已发布", description: "Rider 现在可以查看自己的维度均分；公共页面仍只展示正式 Award。", href: `#judge-allocation`, next: "查看评审结果" },
    "race-created": { title: "Race 私有草稿已创建", description: "赛事资产已经建立，可以继续上传赛题、设置提交窗口并准备公开发布。", href: "#organizer", next: "继续配置当前 Race" },
    "race-published": { title: "Race 已发布到公共赛事中心", description: "赛事状态与公开可见性已经更新，访客现在可以进入 Race Page。", href: `/races/${raceSlug}`, next: "查看公开 Race Page" },
    "ca-registered": { title: "CAConnection 已登记", description: "新的连接已经进入当前 RaceProject，下一步可以完成来源握手。", href: "#ca-workspace", next: "继续 CA 配置" },
    "ca-handshake-completed": { title: "CA 来源握手已完成", description: "连接来源已验证，后续合法信号可进入作品证据链。", href: "#ca-workspace", next: "查看 CA 状态" },
    "ca-signal-ingested": { title: "CA Signal 已接入", description: "接入状态、风险和 Race Live Projection 已按当前数据刷新。", href: "#ca-workspace", next: "查看接入状态" },
    "ca-disabled": { title: "CAConnection 已停用", description: "该连接不再接收新信号，历史审计记录仍保留。", href: "#ca-workspace", next: "查看连接" },
    "work-published": { title: "作品已公开", description: "该作品已进入公开 Works 视图，固定提交版本保持不变。", href: "#publishing", next: "查看发布区" },
    "award-published": { title: "Award 已发布", description: "奖项已写入当前 Race 的正式结果记录。", href: "#publishing", next: "查看奖项" },
    "report-generated": { title: "Report 已生成", description: "新报告已进入当前 Race 的报告列表，可继续编辑或发布。", href: "#publishing", next: "查看报告" },
    "report-edited": { title: "Report 内容已保存", description: "报告草稿内容和更新时间已刷新。", href: "#publishing", next: "查看报告" },
    "report-regenerated": { title: "Report 已重新生成", description: "报告内容已根据当前赛事事实重新构建。", href: "#publishing", next: "查看报告" },
    "report-published": { title: "Report 已发布", description: "报告可见性已按其类型规则更新。", href: "#publishing", next: "查看报告" },
    "report-failure-recorded": { title: "Report 失败演练已记录", description: "失败证据已写入审计上下文，未覆盖已有可用报告。", href: "#publishing", next: "查看报告状态" },
    "projection-rebuilt": { title: "Projection 已重建", description: "Live Hall 与稳定输出现在读取最新成功版本。", href: "#publishing", next: "查看输出状态" },
    "projection-failure-recorded": { title: "Projection 失败演练已记录", description: "稳定版本仍被保留，可从输出区域继续检查 fallback。", href: "#publishing", next: "查看输出状态" },
  }[action];
  if (success) return <ActionOutcomePanel actionCode={action} outcome="success" title={success.title} description={success.description} entity={action === "race-created" || action === "race-published" ? { label: "Race ID", value: entityId || raceId } : undefined} nextAction={<Link href={success.href}>{success.next}</Link>} />;

  const failureTitle = {
    "registration-approve-failed": "报名未能通过审核",
    "registration-reject-failed": "报名未能拒绝",
    "judge-pool-save-failed": "Judge 池未能保存",
    "judge-allocation-failed": "自动分配未执行",
    "review-results-publish-failed": "评审结果尚未发布",
    "race-create-failed": "Race 未能创建",
    "race-publish-failed": "Race 未能发布",
    "ca-register-failed": "CAConnection 未能登记",
    "ca-handshake-failed": "CA 来源握手未完成",
    "ca-signal-ingest-failed": "CA Signal 未能接入",
    "ca-signal-mock-disabled": "当前环境禁用 CA Mock",
    "ca-disable-failed": "CAConnection 未能停用",
    "work-publish-failed": "作品未能公开",
    "award-publish-failed": "Award 未能发布",
    "report-generate-failed": "Report 未能生成",
    "report-edit-failed": "Report 未能保存",
    "report-regenerate-failed": "Report 未能重新生成",
    "report-publish-failed": "Report 未能发布",
    "report-failure-record-failed": "Report 失败演练未能记录",
    "projection-rebuild-failed": "Projection 未能重建",
    "projection-failure-record-failed": "Projection 失败演练未能记录",
  }[action] ?? "操作未完成";
  const anchor = action.startsWith("registration") ? "registration-review" : action.startsWith("judge") || action.startsWith("review-results") ? "judge-allocation" : action.startsWith("ca-") ? "ca-workspace" : action.startsWith("race-") ? "organizer" : "publishing";
  return <ActionOutcomePanel actionCode={action} outcome="error" title={failureTitle} description="服务端已拒绝本次操作；请检查页面展示的资源状态、权限和前置条件后重试。" nextAction={<Link href={`#${anchor}`}>返回操作区</Link>} />;
}

function RoleActionOutcome({ action, actionMessage, actionError }: { action?: string; actionMessage?: string; actionError?: string }) {
  if (!action) {
    if (actionMessage) return <ActionOutcomePanel actionCode="legacy-workspace-success" outcome="success" title="工作台状态已更新" description="页面数据已经刷新，请在对应步骤确认最新实体状态。" />;
    if (actionError) return <ActionOutcomePanel actionCode="legacy-workspace-failed" outcome="error" title="操作未完成" description="请检查当前权限和步骤状态后重试。" testId="console-action-error" />;
    return null;
  }
  const successTitles: Record<string, string> = {
    "ca-registered": "CAConnection 已登记", "ca-handshake-completed": "CA 来源握手已完成", "ca-signal-ingested": "CA Signal 已接入", "ca-disabled": "CAConnection 已停用", "work-published": "作品已公开",
  };
  const failureTitles: Record<string, string> = {
    "ca-register-failed": "CAConnection 未能登记", "ca-handshake-failed": "CA 来源握手未完成", "ca-signal-ingest-failed": "CA Signal 未能接入", "ca-signal-mock-disabled": "当前环境禁用 CA Mock", "ca-disable-failed": "CAConnection 未能停用", "work-publish-failed": "作品未能公开",
  };
  if (successTitles[action]) return <ActionOutcomePanel actionCode={action} outcome="success" title={successTitles[action]} description="页面中的状态、计数和下一步操作已经同步刷新。" />;
  return <ActionOutcomePanel actionCode={action} outcome="error" title={failureTitles[action] ?? "操作未完成"} description="服务端已拒绝本次操作；请根据当前步骤状态检查前置条件后重试。" testId="console-action-error" />;
}

export default async function ConsolePage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent("/console")}`);
  if (!ctx.profileCompleted) redirect("/profile");
  if (!ctx.availableRoles.length) redirect("/onboarding/role");
  if (!ctx.activeRole) redirect("/role-switch");
  redirect(`/console/${ctx.activeRole}`);
}

export async function RoleWorkspacePage({ role, searchParams }: { role: Role; searchParams?: Promise<WorkspaceSearchParams> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(`/console/${role}`)}`);
  if (!ctx.profileCompleted) redirect("/profile");
  if (ctx.activeRole !== role) redirect("/console");

  const { raceId, action, entityId, actionMessage, actionError } = (await searchParams) ?? {};
  const { race, assignments, currentUser } = await getConsoleSnapshotForUser(ctx.userId, raceId, role);
  if (!race) return role === "rider" ? (
    <section className="route-page" data-testid="rider-private-empty">
      <h1>还没有参赛空间</h1>
      <p>这里仅展示你已经个人报名或作为团队成员参加的赛事。公开赛事浏览不会混入私人工作台。</p>
      <Link className="inline-action" href="/">前往赛事中心</Link>
    </section>
  ) : <section className="route-page"><h1>暂无授权 Race</h1></section>;

  const registrations = race.registrations;
  const pendingRegistrations = registrations.filter((registration) => registration.status === "pending");
  const firstApproved = registrations.find((registration) => registration.status === "approved");
  const firstProject = firstApproved?.raceProject;
  const firstConnection = firstProject?.caConnections[0];
  const allConnections = registrations.flatMap((registration) => registration.raceProject?.caConnections.map((connection) => ({ connection, registration })) ?? []);
  const firstWork = registrations.find((registration) => registration.work)?.work;
  const ownRegistrations = currentUser?.registrations ?? [];
  const ownRegistration = ownRegistrations.find((registration) => registration.raceId === race.id);
  const currentMembership = currentUser?.teamMemberships.find((membership) => membership.team.raceId === race.id);
  const draftTeam = currentMembership?.team.registration ? null : currentMembership?.team;
  const ownTeam = ownRegistration?.team ?? draftTeam ?? null;
  const isTeamCaptain = ownTeam?.createdByUserId === ctx.userId;
  const ownProject = ownRegistration?.raceProject;
  const ownConnection = ownProject?.caConnections.find((connection) => connection.ownerUserId === ctx.userId)
    ?? ownProject?.caConnections.find((connection) => !connection.ownerUserId)
    ?? ownProject?.caConnections[0];
  const approvedCount = registrations.filter((registration) => registration.status === "approved").length;
  const projectCount = registrations.filter((registration) => registration.raceProject).length;
  const connectionCount = allConnections.length;
  const verifiedConnectionCount = allConnections.filter(({ connection }) => connection.handshakeAt && !connection.disabledAt).length;
  const activeConnectionCount = allConnections.filter(({ connection }) => connection.ingestionStatus === "active" && !connection.disabledAt).length;
  const workCount = registrations.filter((registration) => registration.work).length;
  const versionedWorkCount = registrations.filter((registration) => registration.work?.currentVersion).length;
  const legacyWorkCount = workCount - versionedWorkCount;
  const publicReportCount = race.reports.filter((report) => report.status === "published" && report.visibility === "public").length;
  const canManageCurrentRace = ctx.activeRole === "organizer" && ctx.managedRaceIds.includes(race.id);
  const canSubmitOwnWork = Boolean(ownRegistration && (ownRegistration.userId === ctx.userId || canManageCurrentRace));
  const riskFlags = registrations.flatMap((registration) => registration.reviewFlags);
  const submissionWindowState = getSubmissionWindowState(race, assignments.length > 0);
  const submissionFreezeReason = race.submissionLockReason ??
    (submissionWindowState === "sealed_for_judging" ? "已进入评审" : submissionWindowState === "closed_by_deadline" ? "已到提交截止时间" : "未冻结");
  const workflowSteps = [
    { label: "Registration", detail: `${approvedCount}/${registrations.length} approved`, done: approvedCount > 0, active: registrations.length > 0 },
    { label: "RaceProject", detail: `${projectCount} generated`, done: projectCount > 0, active: approvedCount > 0 },
    { label: "CA verified", detail: `${verifiedConnectionCount}/${connectionCount} attested`, done: verifiedConnectionCount > 0, active: connectionCount > 0 },
    { label: "Projection", detail: `${activeConnectionCount} active`, done: activeConnectionCount > 0, active: verifiedConnectionCount > 0 },
    { label: "Work", detail: `${workCount} submitted`, done: workCount > 0, active: activeConnectionCount > 0 },
    { label: "Report", detail: `${publicReportCount} public`, done: publicReportCount > 0, active: workCount > 0 }
  ];
  const judgeAssignments = currentUser?.judgeAssignments ?? assignments;
  const judgeManagement = role === "organizer" ? await getJudgeManagementSnapshot(race.id, ctx.userId) : null;
  const allocationPreview = role === "organizer" ? await getJudgeAllocationPreview(ctx, race.id) : null;
  const reviewAggregates = role === "organizer" || role === "judge"
    ? await getRaceReviewAggregatesForUser(ctx.userId, role, race.id)
    : [];
  const workspaceTitles: Record<Role, string> = {
    organizer: `${race.title} 指挥席`,
    rider: `${race.title} Rider 工作台`,
    judge: `${race.title} 评审工作台`,
    admin: "账号与角色资格管理"
  };
  const workspaceDescriptions: Record<Role, string> = {
    organizer: "围绕单场 Race 管理报名、CA 信任、作品版本、评审与发布，所有操作均受 managed Race 权限约束。",
    rider: "从报名到不可变作品版本，在同一视图掌握 RaceProject、CA 连接、风险整改与下一步动作。",
    judge: "只读取分配给你的固定作品版本，并结合可见风险摘要完成可追溯评审。",
    admin: "维护账号与角色资格。"
  };
  const raceCover = resolveVisualCover("race", race.slug || race.id);

  return (
    <div className={`${visualStyles.workspace} ${visualStyles[role]}`} data-role-workspace={role}>
      <PageHeader
        breadcrumbs={role === "organizer"
          ? [{ label: "我的赛事", href: "/console/organizer" }, { label: race.title }]
          : [{ label: "Console", href: `/console/${role}` }, { label: role === "rider" ? "Rider 工作台" : "评审工作台" }]}
        eyebrow={`${role.toUpperCase()} · RACE WORKSPACE`}
        title={workspaceTitles[role]}
        description={workspaceDescriptions[role]}
        actions={role === "organizer" ? <Link className={visualStyles.secondaryAction} href="/console/organizer">返回我的赛事</Link> : <Link className={visualStyles.secondaryAction} href={`/races/${race.slug}`}>查看 Race Page</Link>}
      />

      <section className={visualStyles.raceHero} data-testid="console-current-race">
        <div className={visualStyles.raceHeroCopy}>
          <div className={visualStyles.heroBadges}>
            <StatusBadge tone={race.status === "running" ? "success" : race.status === "draft" ? "warning" : "neutral"} dot>
              <span data-testid="console-current-race-status">{race.status}</span>
            </StatusBadge>
            <StatusBadge tone="info">{race.visibility}</StatusBadge>
          </div>
          <p>当前 Race</p>
          <h2>{race.title}</h2>
          <span data-testid="console-current-race-identity">{race.visibility} / {race.slug}</span>
          <div className={visualStyles.heroLinks}>
            <Link href={`/races/${race.slug}`}>Race Page</Link>
            <Link href={`/races/${race.slug}/works`}>Works</Link>
            <Link href={`/console/risk-center?raceId=${race.id}`}>Risk Center</Link>
            {canManageCurrentRace ? <Link href={`/screen?raceId=${race.id}`}>Screen Console</Link> : null}
            {canManageCurrentRace ? <Link href={`/screen/display/${encodeURIComponent(race.id)}`}>Screen Display</Link> : null}
            {canManageCurrentRace ? <Link href={`/console/tracks?raceId=${race.id}`}>Track Management</Link> : null}
            {canManageCurrentRace ? <Link href={`/ops?raceId=${race.id}`}>Ops</Link> : null}
          </div>
        </div>
        <div className={visualStyles.raceHeroVisual} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={raceCover} alt="" />
        </div>
      </section>

      <section className={`console-main ${visualStyles.content}`} data-testid={role === "organizer" ? "race-workspace" : undefined}>
        {role === "organizer" ? <OrganizerActionOutcome action={action} entityId={entityId} actionMessage={actionMessage} actionError={actionError} raceId={race.id} raceSlug={race.slug} /> : <RoleActionOutcome action={action} actionMessage={actionMessage} actionError={actionError} />}
        {role === "organizer" ? <>
        <LifecycleStepper aria-label="MVP workflow" steps={workflowSteps.map((step) => ({
          label: step.label,
          detail: step.detail,
          state: step.done ? "complete" : step.active ? "current" : "upcoming",
        }))} />
        <StatusSummary
          eyebrow="CA Trust & Review Risk"
          title={riskFlags.length ? `${riskFlags.length} 项风险需要关注` : verifiedConnectionCount > 0 ? "CA 来源已验证，当前无待处理风险" : "等待 CA 握手与来源验证"}
          description={riskFlags[0]?.judgeVisibleSummary ?? (verifiedConnectionCount > 0 ? "已验证连接会为评审提供可追溯过程信号。" : "CA 信号需携带已注册 connector 签名，异常来源将进入隔离。")}
          tone={riskFlags.length ? "warning" : verifiedConnectionCount > 0 ? "success" : "neutral"}
          action={<Link className="inline-action" href={`/console/risk-center?raceId=${race.id}`}>进入风险评审中心</Link>}
        />
        </> : null}
        {role === "organizer" ? (
          <section id="organizer" className="console-view-panel active">
            <section className="form-card">
              <h2>Race 状态</h2>
              <p className="form-hint">当前操作只作用于这场 Race。创建其他赛事请返回“我的赛事”。</p>
              <form className="console-action-row" action={publishRaceAction}>
                <input type="hidden" name="raceId" value={race.id} />
                <button type="submit">发布当前 Race</button>
              </form>
            </section>
            <section className="form-card">
              <h2>作品提交窗口</h2>
              <p data-testid="submission-window-state"><b>{submissionWindowState}</b> / {race.submissionLockReason ?? "无手动关闭原因"}</p>
              <p data-testid="submission-work-counts">{workCount} submitted / {versionedWorkCount} versioned / {legacyWorkCount} legacy</p>
              <form className="console-field-form" action={configureSubmissionWindowAction}>
                <input type="hidden" name="raceId" value={race.id} />
                <label><span>开始时间（UTC）</span><input type="datetime-local" name="submissionOpensAt" defaultValue={utcInputValue(race.submissionOpensAt)} required /></label>
                <label><span>截止时间（UTC）</span><input type="datetime-local" name="submissionClosesAt" defaultValue={utcInputValue(race.submissionClosesAt)} required /></label>
                <button type="submit" disabled={assignments.length > 0 || Boolean(race.submissionLockedAt)}>保存提交窗口</button>
              </form>
              <form className="console-field-form" action={lockSubmissionWindowAction} data-testid="submission-lock-form">
                <input type="hidden" name="raceId" value={race.id} />
                <label><span>关闭原因</span><input name="reason" required /></label>
                <button type="submit" disabled={submissionWindowState !== "open"}>提前关闭全场提交</button>
              </form>
            </section>
            <StatRail aria-label="赛事运营指标" items={[
              { label: "赛道", value: race.status, hint: submissionWindowState },
              { label: "报名", value: registrations.length, hint: "Rider 入场" },
              { label: "连接", value: connectionCount, hint: "CAConnection" },
              { label: "作品", value: workCount, hint: "已提交" },
              { label: "报告", value: race.reports.length, hint: "草稿 / 公开" },
              { label: "奖项", value: race.awards.length, hint: "Leaderboard" },
            ]} />
            <section className="form-card" id="registration-review" data-testid="registration-review-queue">
              <div className={visualStyles.sectionHeading}>
                <div><span>REGISTRATION REVIEW</span><h2>待审核报名</h2><p>这里只保留尚未处理的报名。通过或拒绝后，记录会立即移入参赛选手库或审核历史。</p></div>
                <div className={visualStyles.headingActions}>
                  <StatusBadge tone={pendingRegistrations.length ? "warning" : "success"}>{pendingRegistrations.length} 待处理</StatusBadge>
                  <Link className={visualStyles.secondaryAction} data-testid="participant-library-link" href={`/console/organizer/races/${race.id}/participants`}>参赛选手库 · {approvedCount}</Link>
                </div>
              </div>
              <div className="table-list">
                {pendingRegistrations.length ? pendingRegistrations.map((registration) => (
                  <article className={visualStyles.reviewQueueItem} data-testid="pending-registration-row" key={registration.id}>
                    <div className={visualStyles.queueIdentity}>
                      <span>{registration.participantType === "team" ? "TEAM" : "INDIVIDUAL"}</span>
                      <strong>{getEntrantDisplay(registration).name}</strong>
                      <small>提交于 {registration.submittedAt.toLocaleString("zh-CN")}</small>
                    </div>
                    <form action={approveRegistrationAction} className={visualStyles.queueApproveForm}>
                      <input type="hidden" name="raceId" value={race.id} />
                      <input type="hidden" name="registrationId" value={registration.id} />
                      <PendingActionButton aria-label="Approve + RaceProject" label="审核通过" pendingLabel="正在建立参赛空间…" testId="approve-registration" variant="inherit" />
                    </form>
                    <form action={rejectRegistrationAction} className={visualStyles.queueRejectForm}>
                      <input type="hidden" name="raceId" value={race.id} />
                      <input type="hidden" name="registrationId" value={registration.id} />
                      <label><span>拒绝原因</span><input name="reason" minLength={2} maxLength={500} placeholder="填写可追溯的审核原因" required /></label>
                      <PendingActionButton className={visualStyles.dangerButton} label="拒绝报名" pendingLabel="正在记录拒绝原因…" testId="reject-registration" variant="inherit" />
                    </form>
                  </article>
                )) : <div className="empty-state" data-testid="registration-review-empty"><strong>待审核队列已清空</strong><p>新提交的个人或团队报名会出现在这里。</p><Link className="inline-action" href={`/console/organizer/races/${race.id}/participants`}>查看已审核选手 →</Link></div>}
              </div>
            </section>
            <section className="form-card" id="ca-workspace">
              <h2>CAConnection 状态</h2>
              <div className="table-list">
                {allConnections.length > 0 ? allConnections.map(({ connection, registration }) => (
                  <div className="table-row ca-row" key={connection.id}>
                    <span>{getEntrantDisplay(registration).name}</span>
                    <b className={`status-pill ${toneFor(connection.disabledAt ? "disabled" : connection.ingestionStatus)}`}>{connection.ingestionStatus}{connection.disabledAt ? "/disabled" : ""}</b>
                    <em>
                      <strong>{connection.handshakeAt && !connection.disabledAt ? "Verified by OCR / connector" : "Attestation pending"}</strong>
                      {connection.connectorId} / {connection.externalProjectRef}
                    </em>
                    <form action={disableCAConnectionAction}>
                      <input type="hidden" name="raceId" value={race.id} />
                      <input type="hidden" name="caConnectionId" value={connection.id} />
                      <button type="submit">Disable</button>
                    </form>
                  </div>
                )) : <div className="empty-state">暂无 CAConnection。Rider 审核通过后先登记并握手，再接入带 attestation 的 CA Signal。</div>}
              </div>
            </section>
            <section className="form-card">
              <h2>风险评审中心入口</h2>
              <p className="form-hint">ReviewFlag 已升级为可处置对象。Organizer 可以在风险评审中心中按状态、严重度、类型和 Rider 筛选，并保留处置记录回流给 Judge。</p>
              <Link className="inline-action" href={`/console/risk-center?raceId=${race.id}`}>打开风险评审中心</Link>
            </section>
            <section className="form-card" id="publishing">
              <h2>发布与报告</h2>
              <p className="form-hint">先处理作品和评审分配，再发布 Award 或生成 Report。Report 类型决定公开边界：race_report / review_summary 可公开，rider_report 默认私有且需要 registrationId。</p>
              {firstWork ? (
                <div className="organizer-publish-stack">
                  <section className="rider-step-card organizer-step-card">
                    <span>Work</span>
                    <h3>公开作品</h3>
                    <p>公开 Work 后会进入公开作品墙。评审分配由下方平台自动分配区统一处理，不再逐件手工派单。</p>
                    <div className="console-action-row">
                      <form action={publishWorkAction}>
                        <input type="hidden" name="raceId" value={race.id} />
                        <input type="hidden" name="workId" value={firstWork.id} />
                        <button type="submit">公开 Work</button>
                      </form>
                    </div>
                  </section>
                  <section className="rider-step-card organizer-step-card">
                    <span>Award</span>
                    <h3>发布 Award</h3>
                    <p>为当前 Race 下的已审核报名和作品发布奖项。Rank 用数字表示榜单名次，Reason 会显示为获奖理由。</p>
                    <form className="console-field-form award-form" action={publishAwardAction}>
                      <input type="hidden" name="raceId" value={race.id} />
                      <input type="hidden" name="registrationId" value={firstApproved?.id ?? ""} />
                      <input type="hidden" name="workId" value={firstWork.id} />
                      <label>
                        <span>奖项名 <strong>*</strong></span>
                        <input name="awardName" defaultValue="Grand Prize" required />
                      </label>
                      <label>
                        <span>Rank <strong>*</strong></span>
                        <input name="rank" defaultValue="1" required />
                      </label>
                      <label>
                        <span>获奖理由</span>
                        <textarea name="reason" defaultValue="Best combined result and riding evidence package." />
                      </label>
                      <button type="submit">发布 Award</button>
                    </form>
                  </section>
                </div>
              ) : <p>需要先提交 Work。</p>}
              {judgeManagement && allocationPreview ? <section className={visualStyles.judgeAllocation} id="judge-allocation" data-testid="judge-allocation-panel">
                <div className={visualStyles.sectionHeading}>
                  <div><span>AUTOMATED REVIEW ALLOCATION</span><h2>三 Judge 自动评审</h2><p>Organizer 只维护赛事 Judge 池；平台在一次原子事务中为每件版本化作品补足三个不同 Judge。</p></div>
                  <StatusBadge tone={judgeManagement.race.reviewResultsPublishedAt ? "success" : reviewAggregates.every((item) => item.completedReviews === 3) && reviewAggregates.length ? "info" : "warning"}>
                    {judgeManagement.race.reviewResultsPublishedAt ? "结果已发布" : `${assignments.length}/${reviewAggregates.length * 3} 分配席位`}
                  </StatusBadge>
                </div>

                <div className={visualStyles.judgeManagementGrid}>
                  <form action={saveRaceJudgePoolAction} className={visualStyles.judgePool} data-testid="judge-assignment-form">
                    <input type="hidden" name="raceId" value={race.id} />
                    <div className={visualStyles.panelHeading}><div><strong>赛事 Judge 池</strong><p>至少选择三名无本场参赛冲突的有效 Judge。</p></div><span>{judgeManagement.candidates.filter((candidate) => candidate.selected).length} selected</span></div>
                    <div className={visualStyles.judgeCandidateList}>
                      {judgeManagement.candidates.map((candidate) => (
                        <label className={`${visualStyles.judgeCandidate} ${!candidate.eligible ? visualStyles.ineligible : ""}`} key={candidate.userId}>
                          <input name="judgeUserIds" type="checkbox" value={candidate.userId} defaultChecked={candidate.selected} disabled={!candidate.eligible || Boolean(judgeManagement.race.reviewResultsPublishedAt) || (candidate.selected && candidate.assignmentCount > 0)} />
                          <span><strong>{candidate.displayName}</strong><small>{candidate.githubLogin ? `@${candidate.githubLogin}` : "GitHub 未公开"}</small></span>
                          <span><b>{candidate.assignmentCount}</b><small>任务</small></span>
                          {!candidate.eligible ? <em>{candidate.conflictReason}</em> : candidate.selected && candidate.assignmentCount > 0 ? <em>已有任务，不可移除</em> : null}
                          {candidate.selected && candidate.assignmentCount > 0 ? <input name="judgeUserIds" type="hidden" value={candidate.userId} /> : null}
                        </label>
                      ))}
                    </div>
                    <PendingActionButton disabled={Boolean(judgeManagement.race.reviewResultsPublishedAt)} label="保存 Judge 池" pendingLabel="正在校验资格与冲突…" testId="save-judge-pool" variant="inherit" />
                  </form>

                  <div className={visualStyles.allocationReadiness}>
                    <div className={visualStyles.panelHeading}><div><strong>分配预检</strong><p>提交窗口关闭后才允许生成固定评审任务。</p></div></div>
                    <dl className={visualStyles.readinessList} data-testid="judge-allocation-preview">
                      <div><dt>可分配 Works</dt><dd>{allocationPreview.workCount}</dd></div>
                      <div><dt>Judge 池</dt><dd>{allocationPreview.poolSize}</dd></div>
                      <div><dt>保留席位</dt><dd>{allocationPreview.retainedCount}</dd></div>
                      <div><dt>待新增席位</dt><dd>{allocationPreview.neededCount}</dd></div>
                    </dl>
                    <div className={visualStyles.previewCoverage}>
                      <span><b style={{ width: `${allocationPreview.workCount ? Math.min(100, allocationPreview.retainedCount / (allocationPreview.workCount * 3) * 100) : 0}%` }} /></span>
                      <p>当前覆盖率 {allocationPreview.workCount ? Math.round(allocationPreview.retainedCount / (allocationPreview.workCount * 3) * 100) : 0}% · 分配后目标 100%</p>
                    </div>
                    {allocationPreview.blockers.length ? <div className={visualStyles.previewBlockers} data-testid="judge-allocation-blockers"><strong>当前不可执行</strong><ul>{allocationPreview.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : <div className={visualStyles.previewReady} data-testid="judge-allocation-ready"><strong>预检通过</strong><span>原子事务将保留 {allocationPreview.retainedCount} 个合法席位，并新增 {allocationPreview.neededCount} 个席位。</span></div>}
                    <form action={allocateRaceJudgesAction}>
                      <input type="hidden" name="raceId" value={race.id} />
                      <PendingActionButton
                        disabled={allocationPreview.blockers.length > 0}
                        fullWidth label="原子分配三 Judge" pendingLabel="正在原子计算与写入…" testId="allocate-race-judges" variant="inherit"
                      />
                    </form>
                    {judgeManagement.batches[0] ? <p className={visualStyles.batchNote}>最近批次：{judgeManagement.batches[0].algorithmVersion} · 新增 {judgeManagement.batches[0].createdCount} 席 · 保留 {judgeManagement.batches[0].retainedCount} 席</p> : null}
                  </div>
                </div>

                <div className={visualStyles.assignmentMatrix} data-testid="judge-assignment-list">
                  <div className={visualStyles.matrixHeader}><strong>Work × Judge 覆盖矩阵</strong><span>三个席位全部提交后才计算均分</span></div>
                  {allocationPreview.works.length ? allocationPreview.works.map((previewWork) => {
                    const aggregate = reviewAggregates.find((item) => item.workId === previewWork.workId);
                    const workAssignments = assignments.filter((assignment) => assignment.workId === previewWork.workId);
                    return <article data-testid="judge-assignment-matrix-row" key={previewWork.workId}>
                      <div><strong>{previewWork.title}</strong><span>{previewWork.assignmentCount}/3 assigned · {aggregate?.completedReviews ?? 0}/3 reviewed · {previewWork.neededCount} needed</span></div>
                      <div className={visualStyles.matrixSlots}>{[1, 2, 3].map((slot) => {
                        const assignment = workAssignments.find((item) => item.slot === slot);
                        return <span className={assignment ? visualStyles.slotFilled : visualStyles.slotEmpty} key={slot}><b>#{slot}</b>{assignment ? assignment.judge.displayName : "待分配"}<small>{assignment?.status ?? "empty"}</small></span>;
                      })}</div>
                      <div className={visualStyles.aggregateScore}>{aggregate?.overall === null || aggregate?.overall === undefined ? <span>等待三份评分</span> : <><strong>{aggregate.overall.toFixed(2)}</strong><small>综合均分 · #{aggregate.rank}</small></>}</div>
                    </article>;
                  }) : <div className="empty-state">暂无符合自动分配条件的版本化 Work。</div>}
                </div>

                <div className={visualStyles.publishReviewBar}>
                  <div><strong>{judgeManagement.race.reviewResultsPublishedAt ? "评审结果已锁定并发布" : "发布 Rider 可见评审结果"}</strong><p>发布后 Rider 可查看自己的两个维度均分；Award 仍需 Organizer 独立确认。</p></div>
                  <form action={publishRaceReviewResultsAction}>
                    <input type="hidden" name="raceId" value={race.id} />
                    <PendingActionButton disabled={Boolean(judgeManagement.race.reviewResultsPublishedAt) || !reviewAggregates.length || reviewAggregates.some((item) => item.completedReviews !== 3)} label={judgeManagement.race.reviewResultsPublishedAt ? "已发布" : "发布聚合结果"} pendingLabel="正在锁定并发布…" testId="publish-review-results" variant="inherit" />
                  </form>
                </div>
              </section> : null}
              <section className="rider-step-card organizer-step-card">
                <span>Projection & Report</span>
                <h3>重建 Projection / 生成 Report</h3>
                <p>Projection 用于 Live Hall 和大屏稳定展示；Report 用于赛后公开总结或私有 Rider 报告。</p>
                <div className="console-action-row">
                  <form action={rebuildProjectionAction}>
                    <input type="hidden" name="raceId" value={race.id} />
                    <button type="submit">重建 Projection</button>
                  </form>
                </div>
                <form className="console-field-form report-form" action={generateReportAction}>
                  <input type="hidden" name="raceId" value={race.id} />
                  <label>
                    <span>Report 类型 <strong>*</strong></span>
                    <select name="type" defaultValue="race_report" required>
                      <option value="race_report">race_report：赛事公开总结</option>
                      <option value="review_summary">review_summary：评审公开摘要</option>
                      <option value="rider_report">rider_report：单个 Rider 私有报告</option>
                    </select>
                  </label>
                  <label>
                    <span>Rider registrationId</span>
                    <input name="subjectRegistrationId" placeholder="仅 rider_report 需要填写" />
                  </label>
                  <button type="submit">生成 Report</button>
                </form>
              </section>
              <div className="table-list">
                {race.reports.map((report) => (
                  <div className="table-row" key={report.id}>
                    <span>{report.type}</span>
                    <b>{report.status}/{report.visibility}</b>
                    <form action={publishReportAction}>
                      <input type="hidden" name="raceId" value={race.id} />
                      <input type="hidden" name="reportId" value={report.id} />
                      <button type="submit">Publish</button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          </section>
        ) : null}

        {role === "rider" ? (
          <section id="rider" className="form-card">
            <h2>Rider View</h2>
            <LifecycleStepper aria-label="Rider 参赛进度" steps={[
              { label: `Registration · ${ownRegistration?.status ?? "none"}`, detail: ownRegistration?.race.title ?? "选择 Race 后报名", state: ownRegistration?.status === "approved" ? "complete" : ownRegistration ? "current" : "upcoming", testId: "rider-registration-status" },
              { label: `RaceProject · ${ownProject?.aggregateIngestionStatus ?? "not_configured"}`, detail: ownProject ? `${ownProject.connectionHealth}${ownConnection ? " · connected" : ""}` : "等待审核生成", state: ownProject ? "complete" : ownRegistration?.status === "approved" ? "current" : "upcoming", testId: "rider-project-status" },
              { label: `Work · ${ownRegistration?.work?.status ?? "none"}`, detail: ownRegistration?.work?.title ?? "尚未提交作品", state: ownRegistration?.work ? "complete" : ownProject ? "current" : "upcoming", testId: "rider-work-status" },
              { label: `Submission Version · ${ownRegistration?.work?.currentVersion ? `v${ownRegistration.work.currentVersion.versionNumber}` : "legacy / none"}`, detail: `${submissionWindowState} / ${submissionFreezeReason}`, state: ownRegistration?.work?.currentVersion ? "complete" : ownRegistration?.work ? "current" : "upcoming", testId: "rider-work-version" },
            ]} />
            {ownRegistration?.work?.currentVersion ? (
              <StatusSummary data-testid="rider-work-integrity" eyebrow="Work integrity" title={ownRegistration.work.currentVersion.repoCommitSha} description={`SHA-256: ${ownRegistration.work.currentVersion.integrityHash}`} tone="success" />
            ) : null}
            {race.currentProblemVersion?.scanStatus === "clean" ? (
              <StatusSummary
                data-testid="rider-race-problem-download"
                eyebrow="Race problem"
                title={`赛题 PDF · 修订 ${race.currentProblemVersion.revision}`}
                description={race.currentProblemVersion.displayName}
                tone="primary"
                action={<a className="inline-action" href={`/api/race-problems/${encodeURIComponent(race.currentProblemVersion.id)}/download`}>下载赛题 PDF</a>}
              />
            ) : null}
            <StatusSummary eyebrow="CA anti-forgery" title={ownConnection?.handshakeAt ? "连接来源已握手" : "等待 CA 握手"} description={ownConnection ? `connectorId: ${ownConnection.connectorId} / signingKeyId: ${ownConnection.signingKeyId}` : "登记 CAConnection 后，系统会展示签名来源和接入状态。"} tone={ownConnection?.handshakeAt ? "success" : "warning"} />
            <StatusSummary eyebrow="Risk readiness" title={ownRegistration?.reviewFlags.length ? `${ownRegistration.reviewFlags.length} 项待整改风险` : "当前无待处理风险"} description={ownRegistration?.reviewFlags[0]?.judgeVisibleSummary ?? "当前没有与你相关的评审前风险提示。"} tone={ownRegistration?.reviewFlags.length ? "warning" : "success"} action={<Link className="inline-action" href={`/console/risk-center?raceId=${race.id}`}>查看风险中心</Link>} />
            {ownTeam ? (
              <section className="rider-step-card" data-testid="rider-team-panel">
                <span>Team · {ownTeam.status}</span>
                <h3>{ownTeam.name}</h3>
                <p>{ownTeam.description || "暂无团队简介"}</p>
                <p>我的身份：<strong>{isTeamCaptain ? "队长" : "队员"}</strong> · {ownTeam.members.length}/{ownTeam.maxMembers} members</p>
                {ownTeam.status === "draft" ? <p>邀请码：<strong data-testid="team-invite-code">{ownTeam.inviteCode}</strong> {isTeamCaptain ? <CopyInviteCode code={ownTeam.inviteCode} /> : null}</p> : null}
                <div className="table-list">
                  {ownTeam.members.map((member) => (
                    <div className="table-row" key={member.id}>
                      <span>{member.user.displayName}</span>
                      <b>{member.role}</b>
                      {isTeamCaptain && member.userId !== ctx.userId ? (
                        <form action={removeTeamMemberAction}>
                          <input type="hidden" name="teamId" value={ownTeam.id} />
                          <input type="hidden" name="userId" value={member.userId} />
                          <input type="hidden" name="raceId" value={race.id} />
                          <button type="submit">移除</button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>
                {isTeamCaptain && ownTeam.status === "draft" ? <form className="console-field-form" action={updateTeamAction}>
                  <input type="hidden" name="teamId" value={ownTeam.id} />
                  <input type="hidden" name="raceId" value={race.id} />
                  <label><span>团队名</span><input name="name" defaultValue={ownTeam.name} required maxLength={80} /></label>
                  <label><span>团队简介</span><textarea name="description" defaultValue={ownTeam.description ?? ""} maxLength={500} /></label>
                  <label><span>人数上限</span><input name="maxMembers" type="number" min={2} max={10} defaultValue={ownTeam.maxMembers} required /></label>
                  <button type="submit">保存团队资料</button>
                </form> : null}
                {isTeamCaptain && ownTeam.status === "draft" ? (
                  <form action={submitTeamRegistrationAction}>
                    <input type="hidden" name="teamId" value={ownTeam.id} />
                    <input type="hidden" name="raceId" value={race.id} />
                    <button type="submit" disabled={ownTeam.members.length < 2}>提交团队报名</button>
                    {ownTeam.members.length < 2 ? <p className="form-hint">至少邀请 1 名队员后才能提交。</p> : null}
                  </form>
                ) : !isTeamCaptain && ownTeam.status === "draft" ? (
                  <form action={leaveTeamAction}>
                    <input type="hidden" name="teamId" value={ownTeam.id} />
                    <input type="hidden" name="raceId" value={race.id} />
                    <button type="submit">退出团队</button>
                  </form>
                ) : <p className="form-hint">团队报名已提交，成员与资料已锁定。</p>}
              </section>
            ) : null}
            {!ownRegistration ? (
              <div className="console-empty-actions"><p>团队正在筹备中。由队长邀请成员并提交团队报名后，Organizer 才能审核并生成 RaceProject。</p></div>
            ) : ownProject ? (
              <div className="rider-action-stack">
                <section className="rider-step-card">
                  <span>Step 1</span>
                  <h3>登记 CAConnection</h3>
                  <p>为当前 RaceProject 建立一个可接入的 CA 连接。登记后再完成握手，系统才会接受实时信号。</p>
                  <form action={registerCAAction}>
                    <input type="hidden" name="raceId" value={race.id} />
                    <input type="hidden" name="raceProjectId" value={ownProject.id} />
                    <button type="submit">新增 CAConnection</button>
                  </form>
                </section>
                {ownConnection ? (
                  <>
                    <section className="rider-step-card">
                      <span>Step 2</span>
                      <h3>握手并验证来源</h3>
                      <p>模拟 OCR Desktop App / connector 完成握手。握手后，后续信号会带 connector 签名并进入 Evidence。</p>
                      <form action={handshakeCAAction}>
                        <input type="hidden" name="raceId" value={race.id} />
                        <input type="hidden" name="caConnectionId" value={ownConnection.id} />
                        <button type="submit">握手 CAConnection</button>
                      </form>
                    </section>
                    <section className="rider-step-card">
                      <span>Step 3</span>
                      <h3>接入合法 CA Signal</h3>
                      <p>填写一次骑行会话快照。Session ID 用于幂等，Progress 是完成进度，Tokens 是本次 Agent 输出量。</p>
                      <form className="ca-signal-form" action={ingestSignalAction} data-testid="rider-signal-form">
                        <input type="hidden" name="raceId" value={race.id} />
                        <input type="hidden" name="registrationId" value={ownRegistration!.id} />
                        <input type="hidden" name="raceProjectId" value={ownProject.id} />
                        <input type="hidden" name="caConnectionId" value={ownConnection.id} />
                        <input type="hidden" name="connectorId" value={ownConnection.connectorId} />
                        <label>
                          <span>Session ID</span>
                          <input name="caSessionId" defaultValue="session-ui" />
                        </label>
                        <label>
                          <span>Progress %</span>
                          <input name="progressPercent" defaultValue="100" />
                        </label>
                        <label>
                          <span>Tokens</span>
                          <input name="tokens" defaultValue="12000" />
                        </label>
                        <button type="submit">接入合法 CA Signal</button>
                      </form>
                    </section>
                  </>
                ) : null}
                <section className="rider-step-card">
                  <span>Step 4</span>
                  <h3>提交 Work</h3>
                  <p>提交作品标题、摘要、Demo 和 Repo。CA 信号会作为过程证据，作品本身仍由 Organizer/Judge 后续处理。</p>
                  <p><a href="/api/github-app/install">安装 / 管理 ARY GitHub App</a> · 提交前必须授权目标仓库；ARY 不保存长期仓库 Token，也不会运行仓库代码。</p>
                  <p>{ownRegistration.team ? `团队作品由队长 ${ownRegistration.user.displayName} 在提交窗口内统一提交不可变版本。` : "提交作品标题、摘要、Demo 和 Repo。CA 信号会作为过程证据。"}</p>
                  {canSubmitOwnWork ? <form className="work-submit-form" action={submitWorkAction} data-testid="rider-work-form">
                    <input type="hidden" name="registrationId" value={ownRegistration!.id} />
                    <input type="hidden" name="raceId" value={race.id} />
                    <label>
                      <span>Title</span>
                      <input name="title" defaultValue={ownRegistration?.work?.title ?? "Adaptive Bay Route Agent"} />
                    </label>
                    <label>
                      <span>Summary</span>
                      <textarea name="summary" defaultValue={ownRegistration?.work?.summary ?? "A route planner that replans around live constraints and explains tradeoffs."} />
                    </label>
                    <label>
                      <span>Demo URL</span>
                      <input name="demoUrl" defaultValue={ownRegistration?.work?.demoUrl ?? "https://demo.example.com/adaptive-bay-route-agent"} />
                    </label>
                    <label>
                      <span>Repo URL</span>
                      <input name="repoUrl" defaultValue={ownRegistration?.work?.repoUrl ?? "https://github.com/example/adaptive-bay-route-agent"} />
                    </label>
                    <label>
                      <span>Commit SHA</span>
                      <input name="repoCommitSha" defaultValue={ownRegistration?.work?.currentVersion?.repoCommitSha ?? ""} required pattern="[a-fA-F0-9]{40}" />
                    </label>
                    <button type="submit" disabled={submissionWindowState !== "open"}>提交 Work</button>
                  </form> : <p className="form-hint">你可以维护自己的 CA 连接；团队 Work 需要由队长提交。</p>}
                </section>
              </div>
            ) : <p>需要 Organizer 审核报名后生成 RaceProject。</p>}
          </section>
        ) : null}

        {role === "judge" ? <>
          <StatRail aria-label="Judge assignment overview" items={[
            { label: "Assignments", value: judgeAssignments.length, hint: "当前分配", icon: <AppIcon name="works" size={18} /> },
            { label: "Pending", value: judgeAssignments.filter((item) => item.status !== "reviewed").length, hint: "等待评审", tone: "warning", icon: <AppIcon name="calendar" size={18} /> },
            { label: "Completed", value: judgeAssignments.filter((item) => item.status === "reviewed").length, hint: "已提交", tone: "success", icon: <AppIcon name="shield" size={18} /> },
            { label: "Race", value: race.status, hint: race.title, tone: "violet", icon: <AppIcon name="race" size={18} /> },
          ]} />
          <section id="judge" className="form-card">
            <h2>Judge View</h2>
            <p className="form-hint">每项任务均绑定分配时的 WorkSubmissionVersion。后续新版本不会静默替换当前评审材料。</p>
            <div className="table-list">
              {judgeAssignments.length > 0 ? judgeAssignments.map((assignment) => (
                <div className={`table-row ${visualStyles.assignmentRow}`} key={assignment.id}>
                  <span>{assignment.work.title}</span>
                  <b className={`status-pill ${toneFor(assignment.status)}`}>{assignment.status}</b>
                  <em>{assignment.work.registration.race.title} / {assignment.workSubmissionVersion ? `v${assignment.workSubmissionVersion.versionNumber} ${assignment.workSubmissionVersion.repoCommitSha}` : "legacy"}</em>
                  <Link href={`/works/${assignment.work.slug}/judge`}>Open Judge View</Link>
                </div>
              )) : <div className="empty-state">暂无分配作品。Organizer 发布 Work 后可分配 Judge。</div>}
            </div>
            {reviewAggregates.some((aggregate) => aggregate.overall !== null) ? <div className={visualStyles.judgeAggregateList} data-testid="judge-review-aggregates">
              {reviewAggregates.filter((aggregate) => aggregate.overall !== null).map((aggregate) => <article key={aggregate.workId}>
                <div><span>三人聚合已完成</span><strong>{aggregate.title}</strong></div>
                <dl><div><dt>成果均分</dt><dd>{aggregate.avgResult?.toFixed(2)}</dd></div><div><dt>Riding 均分</dt><dd>{aggregate.avgRiding?.toFixed(2)}</dd></div><div><dt>综合</dt><dd>{aggregate.overall?.toFixed(2)}</dd></div></dl>
              </article>)}
            </div> : null}
          </section>
        </> : null}

      </section>
    </div>
  );
}
