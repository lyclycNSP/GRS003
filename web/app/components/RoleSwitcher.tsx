"use client";

import Link from "next/link";
import { switchActiveRoleAction } from "@/app/actions";
import { AppIcon } from "@/app/components/AppIcon";
import styles from "@/app/components/AuthenticatedUI.module.css";

const roleLabels: Record<string, string> = {
  rider: "Rider",
  judge: "Judge",
  organizer: "Organizer",
  admin: "Admin"
};

export type RoleSwitcherProps = {
  activeRole: string | null;
  availableRoles: string[];
  pendingRoles?: string[];
  compact?: boolean;
};

export function RoleSwitcher({ activeRole, availableRoles, pendingRoles = [], compact = false }: RoleSwitcherProps) {
  const currentLabel = activeRole ? roleLabels[activeRole] ?? activeRole : "选择角色";
  return (
    <details className={`${styles.roleSwitcher} ${compact ? styles.roleSwitcherCompact : ""}`} data-testid="role-switcher">
      <summary aria-label={`切换角色，当前角色：${currentLabel}`}>
        <span className={styles.roleSwitcherIcon}><AppIcon name="role" size={18} /></span>
        <span className={styles.roleSwitcherText}><small>当前角色</small><strong>{activeRole ?? currentLabel}</strong></span>
        <span className={styles.roleSwitcherChevron}><AppIcon name="chevron" size={16} /></span>
      </summary>
      <div className={styles.roleSwitcherPopover}>
        <div className={styles.roleSwitcherHeading}><span>切换工作身份</span><small>本会话只激活一个角色</small></div>
        <div className={styles.roleSwitcherList}>
          {availableRoles.map((role) => (
            <form action={switchActiveRoleAction} key={role}>
              <input type="hidden" name="role" value={role} />
              <button type="submit" disabled={role === activeRole} aria-label={role}>
                <span>{roleLabels[role] ?? role}</span>
                <small>{role === activeRole ? "当前" : "进入工作台"}</small>
              </button>
            </form>
          ))}
          {pendingRoles.map((role) => <Link href={`/onboarding/status?role=${role}`} key={`pending-${role}`}><span>{roleLabels[role] ?? role}</span><small>等待审核</small></Link>)}
        </div>
        <Link className={styles.roleManageLink} href="/onboarding/role">管理或申请角色 <AppIcon name="chevron" size={15} /></Link>
      </div>
    </details>
  );
}
