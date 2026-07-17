import Link from "next/link";
import { redirect } from "next/navigation";
import { curateHomepageRaceAction, reviewRoleApplicationAction, setUserRoleStatusAction } from "@/app/actions";
import { ActionOutcomePanel, PendingActionButton, StatRail } from "@/app/components/ui";
import { getAuthContext } from "@/lib/auth";
import { fromJson } from "@/lib/json";
import { getAdminConsoleSnapshot, getHomepageCurationAdmin } from "@/lib/queries";
import styles from "./AdminConsole.module.css";

const roleLabel: Record<string, string> = {
  rider: "Rider",
  judge: "Judge",
  organizer: "Organizer",
  admin: "Admin"
};

type AdminSearchParams = {
  action?: string;
  actionError?: string;
  curationError?: string;
  entityId?: string;
  error?: string;
  role?: string;
};

const adminActionCopy: Record<string, { title: string; description: string; entityLabel: string; href: string; nextLabel: string }> = {
  "curation-pinned": { title: "赛事已加入首页精选", description: "精选顺序和首页轮播已刷新。", entityLabel: "Race", href: "#homepage-curation", nextLabel: "查看精选列表" },
  "curation-unpinned": { title: "赛事已取消置顶", description: "该位置会按实时热度自动补齐。", entityLabel: "Race", href: "#homepage-curation", nextLabel: "查看精选列表" },
  "curation-hidden": { title: "赛事已从首页轮播隐藏", description: "公开赛事列表和直接访问仍保持不变。", entityLabel: "Race", href: "#homepage-curation", nextLabel: "查看精选列表" },
  "curation-restored": { title: "赛事已恢复首页候选", description: "系统会根据置顶和热度规则重新排序。", entityLabel: "Race", href: "#homepage-curation", nextLabel: "查看精选列表" },
  "curation-moved-up": { title: "精选赛事已上移", description: "新的首页展示顺序已生效。", entityLabel: "Race", href: "#homepage-curation", nextLabel: "查看精选列表" },
  "curation-moved-down": { title: "精选赛事已下移", description: "新的首页展示顺序已生效。", entityLabel: "Race", href: "#homepage-curation", nextLabel: "查看精选列表" },
  "role-application-approved": { title: "角色申请已通过", description: "申请已从待审队列移除，对应资格已立即生效。", entityLabel: "申请", href: "#applications", nextLabel: "继续审核" },
  "role-application-rejected": { title: "角色申请已驳回", description: "申请已从待审队列移除，审核说明已进入记录。", entityLabel: "申请", href: "#applications", nextLabel: "继续审核" },
  "user-role-granted": { title: "Admin 资格已授予", description: "用户资格徽标和可用角色已刷新。", entityLabel: "用户", href: "#users", nextLabel: "查看用户资格" },
  "user-role-suspended": { title: "角色资格已停用", description: "该角色的现有活跃会话已解除，资格状态已刷新。", entityLabel: "用户", href: "#users", nextLabel: "查看用户资格" },
  "user-role-restored": { title: "角色资格已恢复", description: "用户现在可以重新切换到该角色。", entityLabel: "用户", href: "#users", nextLabel: "查看用户资格" },
  "user-role-revoked": { title: "角色资格已撤销", description: "资格记录和相关会话状态已刷新。", entityLabel: "用户", href: "#users", nextLabel: "查看用户资格" },
};

function outcomeFailureCopy(action?: string) {
  if (action === "curation-failed") return { title: "首页精选未更新", href: "#homepage-curation", nextLabel: "返回精选管理" };
  if (action === "role-application-review-failed") return { title: "申请审核未完成", href: "#applications", nextLabel: "返回待审队列" };
  if (action === "user-role-update-failed") return { title: "角色资格未更新", href: "#users", nextLabel: "返回资格管理" };
  return { title: "管理操作未完成", href: "#applications", nextLabel: "返回操作区" };
}

export default async function AdminConsolePage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent("/console/admin")}`);
  if (ctx.activeRole !== "admin") redirect("/console");
  const [{ users, applications }, homepageRaces] = await Promise.all([getAdminConsoleSnapshot(), getHomepageCurationAdmin()]);
  const params = await searchParams;
  const { action, actionError, curationError, entityId, error, role } = params;
  const successOutcome = action ? adminActionCopy[action] : null;
  const failureMessage = actionError ?? curationError ?? error;
  const failureOutcome = failureMessage ? outcomeFailureCopy(action) : null;
  const roleGrants = users.flatMap((user) => user.roles);
  const activeRoleCount = roleGrants.filter((role) => role.status === "active").length;
  const inactiveRoleCount = roleGrants.length - activeRoleCount;
  const completedProfiles = users.filter((user) => user.profileCompleted).length;

  return (
    <section className={styles.page} data-testid="admin-workspace">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Identity Governance · Admin Console</p>
          <h1>账号与角色资格管理</h1>
          <p>集中处理角色申请、账号资料完整度和资格状态，所有高权限动作继续由服务端校验并保留既有审计边界。</p>
        </div>
        <div className={styles.heroBadge} aria-hidden="true">
          <span>ARY</span>
          <strong>身份治理</strong>
        </div>
      </header>

      {successOutcome ? <ActionOutcomePanel
        actionCode={action ?? "admin-action-completed"}
        description={successOutcome.description}
        entity={entityId ? { label: successOutcome.entityLabel, value: role ? `${entityId} · ${roleLabel[role] ?? role}` : entityId } : undefined}
        nextAction={<Link className={styles.outcomeAction} href={successOutcome.href}>{successOutcome.nextLabel}</Link>}
        outcome="success"
        testId="admin-action-outcome"
        title={successOutcome.title}
      /> : null}
      {failureOutcome ? <ActionOutcomePanel
        actionCode={action ?? "admin-action-failed"}
        description={failureMessage}
        nextAction={<Link className={styles.outcomeAction} href={failureOutcome.href}>{failureOutcome.nextLabel}</Link>}
        outcome="error"
        testId="console-action-error"
        title={failureOutcome.title}
      /> : null}

      <section id="homepage-curation" className={styles.panel} data-testid="homepage-curation-admin">
        <div className={styles.panelHeading}><div><p>PUBLIC HOMEPAGE</p><h2>首页赛事精选</h2></div><span className={styles.neutralPill}>最多置顶 6 场</span></div>
        <p className={styles.panelHint}>置顶赛事优先展示，空位按已批准 Rider 数和公开 Works 数自动补齐；隐藏只影响首页首屏。</p>
        <div className={styles.curationList}>{homepageRaces.map((race) => <article className={styles.curationRow} data-testid={`homepage-curation-${race.id}`} key={race.id}>
          <div><strong>{race.title}</strong><small>{race.status} · {String(race.metrics.riders ?? 0)} Riders · {String(race.metrics.submittedWorks ?? 0)} Works</small></div>
          <span className={race.curation?.hidden ? styles.warningPill : race.curation?.pinned ? styles.goodPill : styles.neutralPill}>{race.curation?.hidden ? "已隐藏" : race.curation?.pinned ? `置顶 ${race.curation.position ?? ""}` : "自动"}</span>
          <div className={styles.curationActions}>{race.curation?.pinned ? <>
            <form action={curateHomepageRaceAction}><input type="hidden" name="raceId" value={race.id}/><PendingActionButton label="上移" name="curationAction" pendingLabel="上移中…" size="compact" value="up" variant="inherit" /></form>
            <form action={curateHomepageRaceAction}><input type="hidden" name="raceId" value={race.id}/><PendingActionButton label="下移" name="curationAction" pendingLabel="下移中…" size="compact" value="down" variant="inherit" /></form>
            <form action={curateHomepageRaceAction}><input type="hidden" name="raceId" value={race.id}/><PendingActionButton label="取消置顶" name="curationAction" pendingLabel="取消中…" size="compact" value="unpin" variant="inherit" /></form>
          </> : null}{!race.curation?.pinned && !race.curation?.hidden ? <>
            <form action={curateHomepageRaceAction}><input type="hidden" name="raceId" value={race.id}/><PendingActionButton label="置顶" name="curationAction" pendingLabel="置顶中…" size="compact" value="pin" variant="inherit" /></form>
            <form action={curateHomepageRaceAction}><input type="hidden" name="raceId" value={race.id}/><PendingActionButton label="隐藏" name="curationAction" pendingLabel="隐藏中…" size="compact" value="hide" variant="inherit" /></form>
          </> : null}{race.curation?.hidden ? <form action={curateHomepageRaceAction}><input type="hidden" name="raceId" value={race.id}/><PendingActionButton label="恢复" name="curationAction" pendingLabel="恢复中…" size="compact" value="show" variant="inherit" /></form> : null}</div>
        </article>)}</div>
      </section>

      <StatRail aria-label="Admin overview" items={[
        { label: "待审核申请", value: applications.length, hint: applications.length ? "需要处理" : "队列已清空", tone: applications.length ? "warning" : "success" },
        { label: "平台用户", value: users.length, hint: `${completedProfiles} 份资料完整` },
        { label: "有效资格", value: activeRoleCount, hint: "当前可切换", tone: "success" },
        { label: "受限资格", value: inactiveRoleCount, hint: inactiveRoleCount ? "停用或撤销" : "暂无受限资格" },
      ]} />

      <section id="applications" className={styles.panel}>
        <div className={styles.panelHeading}>
          <div><p>APPLICATION REVIEW</p><h2>待审核申请</h2></div>
          <span className={applications.length ? styles.warningPill : styles.goodPill}>{applications.length ? `${applications.length} 项待处理` : "队列已清空"}</span>
        </div>
        <p className={styles.panelHint}>Judge 与 Organizer 资料必须由有效 Admin 审核；Admin 不在自助申请入口展示。</p>
        <div className={styles.applicationGrid}>
          {applications.length ? applications.map((application) => {
            const expertise = application.requestedRole === "judge"
              ? fromJson<string[]>(application.user.judgeProfile?.expertiseJson, [])
              : fromJson<string[]>(application.user.organizerProfile?.eventCategoriesJson, []);
            const organization = application.requestedRole === "judge"
              ? application.user.judgeProfile?.organization
              : application.user.organizerProfile?.organizationName;
            const title = application.requestedRole === "judge"
              ? application.user.judgeProfile?.title
              : application.user.organizerProfile?.position;
            const bio = application.requestedRole === "judge"
              ? application.user.judgeProfile?.reviewBio
              : application.user.organizerProfile?.organizerBio;
            return (
              <article className={styles.applicationCard} data-testid={`admin-application-${application.id}`} key={application.id}>
                <div className={styles.cardHeader}>
                  <div className={styles.avatar}>{application.user.displayName.slice(0, 1).toUpperCase()}</div>
                  <div><h3>{application.user.displayName}</h3><p>@{application.user.githubLogin}</p></div>
                  <span className={styles.rolePill}>{roleLabel[application.requestedRole] ?? application.requestedRole}</span>
                </div>
                <dl className={styles.applicationMeta}>
                  <div><dt>组织 / 职位</dt><dd>{[organization, title].filter(Boolean).join(" · ") || "未填写"}</dd></div>
                  <div><dt>能力标签</dt><dd>{expertise.join("、") || "未填写"}</dd></div>
                </dl>
                <p className={styles.bio}>{bio || "申请人尚未填写补充说明。"}</p>
                <form className={styles.reviewForm} action={reviewRoleApplicationAction}>
                  <input type="hidden" name="applicationId" value={application.id} />
                  <label><span>审核说明</span><textarea name="note" placeholder="记录审核结论；驳回时必填" /></label>
                  <div><PendingActionButton label="通过申请" name="decision" pendingLabel="审核处理中…" value="approve" variant="inherit" /><PendingActionButton className={styles.secondaryButton} label="驳回" name="decision" pendingLabel="审核处理中…" value="reject" variant="inherit" /></div>
                </form>
              </article>
            );
          }) : <div className={styles.emptyState}><strong>暂无待审核申请</strong><p>新的 Judge 或 Organizer 申请会出现在这里。</p></div>}
        </div>
      </section>

      <section id="users" className={styles.panel}>
        <div className={styles.panelHeading}>
          <div><p>USER & ROLE STATUS</p><h2>用户与角色资格</h2></div>
          <span className={styles.neutralPill}>{users.length} 个账号</span>
        </div>
        <div className={styles.userList}>
          {users.map((user) => {
            const activeAdmin = user.roles.some((role) => role.role === "admin" && role.status === "active");
            return (
              <article className={styles.userCard} data-testid={`admin-user-${user.id}`} key={user.id}>
                <div className={styles.userIdentity}>
                  <div className={styles.avatar}>{user.displayName.slice(0, 1).toUpperCase()}</div>
                  <div><strong>{user.displayName}</strong><small>@{user.githubLogin ?? user.slug}</small></div>
                  <span className={user.profileCompleted ? styles.goodPill : styles.warningPill}>{user.profileCompleted ? "资料完整" : "待补资料"}</span>
                </div>
                <div className={styles.roleList}>
                  {user.roles.map((grant) => (
                    <form className={styles.roleRow} action={setUserRoleStatusAction} key={grant.id}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="role" value={grant.role} />
                      <div><strong>{roleLabel[grant.role] ?? grant.role}</strong><span className={grant.status === "active" ? styles.goodPill : styles.warningPill}>{grant.status}</span></div>
                      <input name="reason" aria-label={`${grant.role} 操作原因`} placeholder="操作原因" />
                      <div className={styles.rowActions}>
                        {grant.status === "active" ? <>
                          <PendingActionButton className={styles.secondaryButton} disabled={user.id === ctx.userId && grant.role === "admin"} label="停用" name="roleAction" pendingLabel="停用中…" size="compact" value="suspend" variant="inherit" />
                          <PendingActionButton className={styles.dangerButton} disabled={user.id === ctx.userId && grant.role === "admin"} label="撤销" name="roleAction" pendingLabel="撤销中…" size="compact" value="revoke" variant="inherit" />
                        </> : <PendingActionButton label="恢复资格" name="roleAction" pendingLabel="恢复中…" size="compact" value="restore" variant="inherit" />}
                      </div>
                    </form>
                  ))}
                  {!activeAdmin && user.profileCompleted ? (
                    <form className={styles.grantRow} action={setUserRoleStatusAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="role" value="admin" />
                      <input type="hidden" name="roleAction" value="grant" />
                      <span>该账号尚无 Admin 资格</span><PendingActionButton label="授予 Admin" pendingLabel="授予中…" size="compact" variant="inherit" />
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
