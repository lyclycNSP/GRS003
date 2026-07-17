import Link from "next/link";
import { redirect } from "next/navigation";
import { selectRoleAction } from "@/app/actions";
import { AppIcon, type AppIconName } from "@/app/components/AppIcon";
import { PendingSubmitButton } from "@/app/components/PendingSubmitButton";
import { getAuthContext } from "@/lib/auth";
import { getOnboardingState } from "@/lib/queries";
import styles from "../AuthFlow.module.css";

const roleCards = [
  { role: "rider", title: "Rider", icon: "user", summary: "报名参赛、接入 CA、提交作品和查看结果。资料完成后立即开通。" },
  { role: "judge", title: "Judge", icon: "shield", summary: "评审分配给自己的作品。分类资料提交后由 Admin 审核。" },
  { role: "organizer", title: "Organizer", icon: "building", summary: "创建和管理赛事、审核报名、分配评委、控制 Screen 与 Ops。需要 Admin 审核。" }
] as const;

export default async function RoleSelectionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent("/onboarding/role")}`);
  if (!ctx.profileCompleted) redirect("/profile");
  const state = await getOnboardingState(ctx.userId);
  if (!state) redirect("/profile");
  const { error } = await searchParams;
  return (
    <section className={styles.flowPage} data-testid="role-selection-page">
      <div className={styles.flowBackdrop} aria-hidden="true" />
      <header className={styles.flowHeader}>
        <div className={styles.flowHeaderCopy}><p className={styles.eyebrow}>Role qualifications</p><h1>开通或管理<em>角色</em></h1><p className={styles.flowHeaderDescription}>一个账号可以拥有多个有效资格，但当前会话只激活一个角色。Admin 资格只能由有效 Admin 授予，不在申请入口展示。</p></div>
        <div className={styles.headerVisual} aria-hidden="true"><AppIcon name="role" size={50} /></div>
      </header>
      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}
      <section className={styles.roleGrid} aria-label="可申请角色">
        {roleCards.map((item) => {
          const grant = state.roles.find((role) => role.role === item.role);
          const application = state.roleApplications.find((app) => app.requestedRole === item.role && ["draft", "pending", "rejected"].includes(app.status));
          const stateLabel = grant?.status === "active" ? "已开通" : application ? application.status === "pending" ? "审核中" : application.status === "rejected" ? "需修改" : "草稿" : "未申请";
          const stateClass = grant?.status === "active" ? styles.statusActive : application?.status === "pending" ? styles.statusPending : application?.status === "rejected" ? styles.statusRejected : "";
          return (
            <article className={styles.flowCard} key={item.role}>
              <div className={styles.cardTopline}><span className={styles.cardIcon}><AppIcon name={item.icon as AppIconName} size={24} /></span><span className={`${styles.statusBadge} ${stateClass}`}>{stateLabel}</span></div>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
              <div className={styles.cardMeta}><strong>{item.role === "rider" ? "资料提交后即时生效" : "资料提交后由 Admin 审核"}</strong></div>
              <div className={styles.cardActions}>
                {grant?.status === "active" ? <Link className={styles.primaryAction} href={`/onboarding/${item.role}`}>编辑角色资料<AppIcon name="chevron" size={14} /></Link> : application?.status === "pending" ? <Link className={styles.primaryAction} href={`/onboarding/status?role=${item.role}`}>查看审核状态<AppIcon name="chevron" size={14} /></Link> : <form action={selectRoleAction}><input type="hidden" name="role" value={item.role} /><PendingSubmitButton label={application ? "继续填写" : `申请 ${item.title}`} pendingLabel="正在进入…" /></form>}
              </div>
            </article>
          );
        })}
      </section>
    </section>
  );
}
