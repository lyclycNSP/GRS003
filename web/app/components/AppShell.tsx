"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { AppIcon } from "@/app/components/AppIcon";
import { RoleSwitcher } from "@/app/components/RoleSwitcher";
import {
  getRoleNavigation,
  isNavigationItemActive,
  type RaceNavigationContext
} from "@/app/components/roleNavigation";
import type { Role } from "@/lib/auth";
import styles from "@/app/components/AppShell.module.css";

export type AppShellUser = {
  userId: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  activeRole: Role;
  availableRoles: Role[];
  pendingRoles: string[];
};

const roleLabels: Record<Role, string> = {
  rider: "Rider",
  judge: "Judge",
  organizer: "Organizer",
  admin: "Admin"
};

const routeLabels: Array<[RegExp, string]> = [
  [/^\/console\/organizer\/races\//, "Race Workspace"],
  [/^\/console\/rider\/races\//, "Rider Race Space"],
  [/^\/console\/organizer$/, "我的赛事"],
  [/^\/console\/rider$/, "Rider 工作台"],
  [/^\/console\/judge$/, "评审工作台"],
  [/^\/console\/admin$/, "管理工作台"],
  [/^\/console\/risk-center/, "Risk Center"],
  [/^\/console\/tracks\/calibrator/, "Track Calibrator"],
  [/^\/console\/tracks/, "Track Management"],
  [/^\/screen$/, "Screen Console"],
  [/^\/ops/, "Ops"],
  [/^\/works\//, "Work 详情"],
  [/^\/works$/, "Works"],
  [/^\/riders\//, "Rider 主页"],
  [/^\/riders$/, "Riders"],
  [/^\/races\//, "Race 详情"],
  [/^\/cooperation/, "合作与赞助"],
  [/^\/onboarding\//, "角色资料"],
  [/^\/profile/, "账号设置"],
  [/^\/$/, "赛事中心"]
];

function getRaceContext(pathname: string, queryRaceId: string | null): RaceNavigationContext | null {
  const routeRaceId = pathname.match(/^\/console\/(?:organizer|rider)\/races\/([^/]+)/)?.[1];
  const value = routeRaceId ?? queryRaceId;
  if (!value) return null;
  try {
    return { raceId: decodeURIComponent(value) };
  } catch {
    return { raceId: value };
  }
}

function getCurrentPageLabel(pathname: string) {
  return routeLabels.find(([pattern]) => pattern.test(pathname))?.[1] ?? "ARY";
}

export function AuthenticatedAppShell({ user, children }: { user: AppShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raceContext = getRaceContext(pathname, searchParams.get("raceId"));
  const groups = getRoleNavigation(user.activeRole, pathname, raceContext);
  const pageLabel = getCurrentPageLabel(pathname);
  const roleLabel = roleLabels[user.activeRole];

  return (
    <div className={styles.shell} data-testid="authenticated-app-shell">
      <aside className={styles.sidebar} aria-label={`${roleLabel} 主导航`}>
        {pathname === `/console/${user.activeRole}` ? <h2 className={styles.visuallyHidden}>{roleLabel} Workspace</h2> : null}
        <Link className={styles.brand} href="/" aria-label="ARY 首页">
          <span className={styles.brandMark}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-horse-compass-transparent.png" alt="" />
          </span>
          <span><strong>ARY</strong><small>Agent Racing Yard</small></span>
        </Link>

        <div className={styles.identity}>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : <span><AppIcon name="user" size={20} /></span>}
          <div><strong>{user.displayName}</strong><small>{roleLabel}</small></div>
        </div>

        <nav className={styles.navigation}>
          {groups.map((group, groupIndex) => (
            <section className={styles.navigationGroup} key={`${group.label ?? "main"}-${groupIndex}`}>
              {group.label ? <p>{group.label}</p> : null}
              {group.items.map((navItem) => {
                const active = isNavigationItemActive(navItem, pathname, raceContext?.raceId ?? null);
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={active ? styles.navigationActive : undefined}
                    href={navItem.href}
                    key={`${navItem.label}-${navItem.href}`}
                  >
                    <AppIcon name={navItem.icon} size={18} />
                    <span>{navItem.label}</span>
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/" data-testid="workspace-public-home-link">
            <AppIcon name="globe" size={17} />
            <span><strong>返回公共主页</strong><small>浏览赛事与公开内容</small></span>
            <AppIcon name="chevron" size={14} />
          </Link>
          <Link href={`/riders/${encodeURIComponent(user.slug)}`}>
            <AppIcon name="user" size={17} />
            <span><strong>查看个人主页</strong><small>公开身份与作品</small></span>
            <AppIcon name="chevron" size={14} />
          </Link>
          <form action={logoutAction}>
            <button type="submit"><AppIcon name="logout" size={16} />退出登录</button>
          </form>
        </div>
      </aside>

      <section className={styles.viewport} data-testid="workspace-shell">
        <header className={styles.topbar}>
          <div className={styles.breadcrumb} aria-label="面包屑">
            <Link href={`/console/${user.activeRole}`}>{roleLabel} Workspace</Link>
            <AppIcon name="chevron" size={13} />
            <span>{pageLabel}</span>
            {raceContext ? <small title={raceContext.raceId}>#{raceContext.raceId.slice(-8)}</small> : null}
          </div>
          <div className={styles.topbarActions}>
            <button className={styles.notificationButton} type="button" aria-label="通知">
              <AppIcon name="bell" size={18} />
            </button>
            <RoleSwitcher
              activeRole={user.activeRole}
              availableRoles={user.availableRoles}
              pendingRoles={user.pendingRoles}
              compact
            />
          </div>
        </header>
        <main className={`${styles.content} next-page`} data-testid="app-shell-content">{children}</main>
      </section>
    </div>
  );
}
