import Link from "next/link";
import { redirect } from "next/navigation";
import { switchActiveRoleAction } from "@/app/actions";
import { AppIcon, type AppIconName } from "@/app/components/AppIcon";
import { PendingSubmitButton } from "@/app/components/PendingSubmitButton";
import { getAuthContext } from "@/lib/auth";
import { buildLoginPath } from "@/lib/login-redirect";
import styles from "@/app/onboarding/AuthFlow.module.css";

const rolePresentation = {
  rider: { label: "Rider", icon: "user", description: "报名赛事、维护 RaceProject、连接 CA 并提交作品。" },
  judge: { label: "Judge", icon: "shield", description: "查看分配任务、固定作品版本和骑行证据摘要。" },
  organizer: { label: "Organizer", icon: "building", description: "创建并管理授权赛事、报名、评审、展示与报告。" },
  admin: { label: "Admin", icon: "identity", description: "审核角色申请并维护账号资格，不继承业务权限。" }
} as const;

export default async function RoleSwitchPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(buildLoginPath("/role-switch"));
  if (!ctx.profileCompleted) redirect("/profile");
  if (!ctx.availableRoles.length) redirect("/onboarding/role");
  return (
    <section className={styles.flowPage} data-testid="role-switch-page">
      <div className={styles.flowBackdrop} aria-hidden="true" />
      <header className={styles.flowHeader}>
        <div className={styles.flowHeaderCopy}><p className={styles.eyebrow}>Role workspace</p><h1>选择当前<em>角色</em></h1><p className={styles.flowHeaderDescription}>一次会话只激活一个角色。切换后，左侧导航、查询和服务端权限都会进入该角色的独立状态空间。</p></div>
        <div className={styles.headerVisual} aria-hidden="true"><AppIcon name="role" size={50} /></div>
      </header>
      <section className={styles.roleGrid} aria-label="有效角色">
        {ctx.availableRoles.map((role) => {
          const item = rolePresentation[role];
          const current = ctx.activeRole === role;
          return <form className={styles.flowCard} action={switchActiveRoleAction} key={role}><input type="hidden" name="role" value={role} /><div className={styles.cardTopline}><span className={styles.cardIcon}><AppIcon name={item.icon as AppIconName} size={24} /></span><span className={`${styles.statusBadge} ${current ? styles.statusActive : ""}`}>{current ? "当前激活" : "已开通"}</span></div><h2>{item.label}</h2><p>{item.description}</p><div className={styles.cardMeta}><strong>切换后仅使用 {item.label} 权限</strong></div><div className={styles.cardActions}><PendingSubmitButton label={current ? `返回 ${item.label} 工作台` : `进入 ${item.label} 工作台`} pendingLabel="正在切换…" /></div></form>;
        })}
        <article className={styles.flowCard}><div className={styles.cardTopline}><span className={styles.cardIcon}><AppIcon name="role" size={24} /></span><span className={styles.cardCode}>qualifications</span></div><h2>新增角色</h2><p>Rider 可自助开通；Judge 与 Organizer 提交独立资格资料后由 Admin 审核。</p><div className={styles.cardMeta}><strong>不会改变当前角色</strong></div><div className={styles.cardActions}><Link className={styles.primaryAction} href="/onboarding/role">申请或管理角色<AppIcon name="chevron" size={14} /></Link></div></article>
      </section>
    </section>
  );
}
