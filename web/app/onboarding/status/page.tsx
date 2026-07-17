import Link from "next/link";
import { redirect } from "next/navigation";
import { withdrawRoleApplicationAction } from "@/app/actions";
import { AppIcon } from "@/app/components/AppIcon";
import { PendingSubmitButton } from "@/app/components/PendingSubmitButton";
import { getAuthContext } from "@/lib/auth";
import { getOnboardingState } from "@/lib/queries";
import styles from "../AuthFlow.module.css";

export default async function OnboardingStatusPage({ searchParams }: { searchParams: Promise<{ role?: string; error?: string }> }) {
  const query = await searchParams;
  const ctx = await getAuthContext();
  if (!ctx) {
    const next = `/onboarding/status${query.role ? `?role=${encodeURIComponent(query.role)}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const state = await getOnboardingState(ctx.userId, query.role);
  const application = state?.currentApplication;
  if (!application) redirect("/onboarding/role");
  const statusLabel = application.status === "pending" ? "审核中" : application.status === "rejected" ? "需要修改" : "草稿";
  const statusClass = application.status === "pending" ? styles.statusPending : application.status === "rejected" ? styles.statusRejected : "";
  const summary = application.status === "pending" ? "资料已提交，等待 Admin 审核；审核通过前不能切换到该角色。" : application.status === "rejected" ? `申请已驳回：${application.reviewNote ?? "未提供原因"}` : "角色资料仍是草稿，提交后才会进入审核队列。";
  return (
    <section className={styles.flowPage} data-testid="role-application-status">
      <div className={styles.flowBackdrop} aria-hidden="true" />
      <header className={styles.flowHeader}>
        <div className={styles.flowHeaderCopy}><p className={styles.eyebrow}>Application / {application.status}</p><h1>{application.requestedRole} <em>角色申请</em></h1><p className={styles.flowHeaderDescription}>{summary}</p></div>
        <div className={styles.headerVisual} aria-hidden="true"><AppIcon name="shield" size={50} /></div>
      </header>
      {query.error ? <p className={`${styles.notice} ${styles.noticeError}`}>{query.error}</p> : null}
      <div className={styles.statusLayout}>
        <section className={styles.statusCard}>
          <header className={styles.statusHeading}><span><AppIcon name="identity" size={25} /></span><div><h2>资格申请进度</h2><p>{application.requestedRole} · 申请编号 #{application.id.slice(-8)}</p></div><span className={`${styles.statusBadge} ${statusClass}`}>{statusLabel}</span></header>
          <div className={styles.timeline}>
            <article className={styles.timelineItem}><span className={styles.timelineDot}>1</span><div><h3>角色资料已建立</h3><p>分类资料已保存到你的账号，可继续维护。</p></div></article>
            <article className={styles.timelineItem}><span className={styles.timelineDot}>2</span><div><h3>{application.status === "draft" ? "等待提交" : "资料已提交"}</h3><p>{application.status === "draft" ? "完成必填信息并提交后进入审核。" : "Admin 将依据资格资料进行审核。"}</p></div></article>
            <article className={styles.timelineItem}><span className={styles.timelineDot}>3</span><div><h3>{application.status === "rejected" ? "按反馈修改" : "等待资格生效"}</h3><p>{application.status === "rejected" ? "修改资料并重新提交，不会创建重复申请。" : "审核通过后即可在 RoleSwitcher 中激活该角色。"}</p></div></article>
          </div>
          <div className={styles.statusActions}><Link className={styles.secondaryAction} href={`/onboarding/${application.requestedRole}`}>{application.status === "rejected" ? "修改并重新提交" : "查看或编辑资料"}</Link>{application.source === "self" ? <form action={withdrawRoleApplicationAction}><input type="hidden" name="applicationId" value={application.id} /><PendingSubmitButton label="撤回申请" pendingLabel="正在撤回…" /></form> : null}</div>
        </section>
        <aside className={styles.guidanceCard}><h2>审核说明</h2><p>资格审核只影响该角色，不会关闭账号已有的其他有效资格。</p><ul className={styles.guidanceList}><li><span>1</span><div>当前会话只激活一个角色，权限不会叠加。</div></li><li><span>2</span><div>Judge 与 Organizer 必须经 Admin 审核。</div></li><li><span>3</span><div>审核结果生效后，从右上角角色控件切换。</div></li></ul></aside>
      </div>
    </section>
  );
}
