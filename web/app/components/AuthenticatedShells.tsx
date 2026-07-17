import Link from "next/link";
import { AppIcon, type AppIconName } from "@/app/components/AppIcon";
import styles from "@/app/components/AuthenticatedUI.module.css";
import shellStyles from "@/app/components/AppShell.module.css";

export function ProfilePageShell({ role, title, description, children }: {
  role: "account" | "rider" | "judge" | "organizer";
  title: React.ReactNode;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${styles.profilePage} ${styles[`profileTone${role[0].toUpperCase()}${role.slice(1)}`]}`}>
      <div className={styles.profileBackdrop} aria-hidden="true"><span /><span /><span /></div>
      <nav className={styles.profileBreadcrumb} aria-label="面包屑"><Link href="/">首页</Link><AppIcon name="chevron" size={14} /><span>{role === "account" ? "账号资料" : `${role} profile`}</span></nav>
      <header className={styles.profileHero}>
        <div><p>ARY Identity Studio</p><h1>{title}</h1><div className={styles.profileLead}>{description}</div></div>
        <div className={styles.profileHeroArt} aria-hidden="true"><AppIcon name={role === "account" ? "identity" : role === "rider" ? "user" : role === "judge" ? "shield" : "building"} size={52} /></div>
      </header>
      {children}
    </section>
  );
}

export function ProfileField({ icon, label, required, hint, wide = false, children }: {
  icon: AppIconName;
  label: string;
  required?: boolean;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`${styles.profileField} ${wide ? styles.profileFieldWide : ""}`}>
      <span className={styles.profileFieldLabel}><AppIcon name={icon} size={18} />{label}{required ? <b>*</b> : null}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

type WorkspaceNavItem = { label: string; href: string; icon: AppIconName; active?: boolean };

const roleDescriptions: Record<string, string> = {
  organizer: "赛事组织者控制中心，掌握赛事运行、证据完整度与风险态势。",
  rider: "参赛骑手工作区，串联报名、CA 骑行证据、作品提交与整改进度。",
  judge: "评审任务工作区，围绕固定作品版本完成可信、可追溯的评审。",
  admin: "账号与角色资格中心，审核申请并维护最小化的系统身份边界。"
};

export async function WorkspaceShell({ role, eyebrow, title, children }: {
  userId: string;
  role: string;
  activeRole: string | null;
  availableRoles: string[];
  eyebrow: string;
  title: string;
  navItems: WorkspaceNavItem[];
  children: React.ReactNode;
}) {
  return (
    <section className={shellStyles.legacyWorkspaceContent} data-role-workspace={role}>
      <header className={styles.workspaceHero}>
        <div className={styles.workspaceHeroCopy}><p>{eyebrow}</p><h1>{title}</h1><span>{roleDescriptions[role]}</span></div>
        <div className={styles.workspaceHeroArt} aria-hidden="true"><span /><span /><span /></div>
      </header>
      <div className={styles.workspaceContent}>{children}</div>
    </section>
  );
}
