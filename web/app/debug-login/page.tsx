import { AppIcon, type AppIconName } from "@/app/components/AppIcon";
import styles from "@/app/onboarding/AuthFlow.module.css";
import { sanitizeInternalNext } from "@/lib/login-redirect";

const debugUsers = [
  { key: "organizer", title: "Organizer", icon: "building", href: "/api/debug/login?user=organizer", description: "赛事、报名、评审分配、Track、Screen 与 Ops。" },
  { key: "organizer_alt", title: "Organizer B", icon: "building", href: "/api/debug/login?user=organizer_alt", description: "独立赛事资产账号，用于验证 Organizer 之间的数据隔离。" },
  { key: "admin", title: "Admin", icon: "shield", href: "/api/debug/login?user=admin", description: "账号、角色申请与角色资格管理，不混入业务工作台。" },
  { key: "rider", title: "Rider", icon: "user", href: "/api/debug/login?user=rider", description: "报名、团队、RaceProject、CA 接入和作品提交。" },
  { key: "judge", title: "Judge", icon: "identity", href: "/api/debug/login?user=judge", description: "查看分配作品并提交评分和评语。" },
  { key: "multi", title: "Multi-role", icon: "role", href: "/api/debug/login?user=multi", description: "同一账号拥有 Rider、Judge、Organizer，用于验证会话级角色切换。" }
] as const;

export default async function DebugLoginPage({ searchParams }: { searchParams?: Promise<{ next?: string }> }) {
  const next = sanitizeInternalNext((await searchParams)?.next);
  return (
    <section className={styles.flowPage} data-testid="debug-login-page">
      <div className={styles.flowBackdrop} aria-hidden="true" />
      <header className={styles.flowHeader}>
        <div className={styles.flowHeaderCopy}>
          <p className={styles.eyebrow}>Local development · Debug Login</p>
          <h1>选择调试<em>身份</em></h1>
          <p className={styles.flowHeaderDescription}>使用预置账号验证四类独立工作台、角色切换与权限隔离。普通用户登录仍严格使用 GitHub OAuth。</p>
        </div>
        <div className={styles.headerVisual} aria-hidden="true"><AppIcon name="identity" size={50} /></div>
      </header>
      <div className={styles.debugWarning}><AppIcon name="alert" size={20} /><span>此入口仅在非生产环境且 <strong>ENABLE_DEBUG_LOGIN=true</strong> 时可用，不代表生产身份认证路径。</span></div>
      <section className={styles.debugGrid} aria-label="调试账号">
        {debugUsers.map((user) => (
          <article className={styles.flowCard} key={user.key}>
            <div className={styles.cardTopline}><span className={styles.cardIcon}><AppIcon name={user.icon as AppIconName} size={24} /></span><span className={styles.cardCode}>debug user · {user.key}</span></div>
            <h2>{user.title}</h2>
            <p>{user.description}</p>
            <div className={styles.cardActions}><a className={styles.primaryAction} href={`${user.href}&next=${encodeURIComponent(next)}`}>以 {user.title} 登录<AppIcon name="chevron" size={14} /></a></div>
          </article>
        ))}
      </section>
    </section>
  );
}
