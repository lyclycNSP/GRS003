"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { AuthenticatedAppShell, type AppShellUser } from "@/app/components/AppShell";
import type { Role } from "@/lib/auth";
import styles from "@/app/components/AppShell.module.css";

export type ChromeAuth = Omit<AppShellUser, "activeRole"> & {
  activeRole: Role | null;
};

function PublicChrome({ children, auth, debugLoginEnabled, returnPath }: {
  children: React.ReactNode;
  auth: ChromeAuth | null;
  debugLoginEnabled: boolean;
  returnPath: string;
}) {
  return (
    <div className="deck-shell">
      <header className="deck-header" aria-label="ARY navigation">
        <Link className="brand" href="/" aria-label="ARY 首页">
          <span className="brand-emblem" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-horse-compass-transparent.png" alt="" />
          </span>
          <span><strong>Agent Racing Yard</strong><small>骑行智能体 · 纵横三万里</small></span>
        </Link>
        <nav className="ia-nav" aria-label="公共站点导航">
          <Link className="nav-link" href="/">赛事</Link>
          <Link className="nav-link" href="/works">Works</Link>
          <Link className="nav-link" href="/riders">Riders</Link>
          <Link className="nav-link" href="/cooperation">合作与赞助</Link>
        </nav>
        <div className="workspace-entry" aria-label="工作台入口">
          {!auth ? <Link href={`/login?next=${encodeURIComponent(returnPath)}`}>登录</Link> : null}
          {auth ? <Link href="/console">工作台</Link> : null}
          {!auth && debugLoginEnabled ? <Link href={`/debug-login?next=${encodeURIComponent(returnPath)}`}>Debug Login</Link> : null}
          {auth ? <form action={logoutAction}><button type="submit">退出</button></form> : null}
        </div>
      </header>
      <main className="deck next-page">{children}</main>
    </div>
  );
}

export function SiteChrome({ children, auth, debugLoginEnabled }: {
  children: React.ReactNode;
  auth: ChromeAuth | null;
  debugLoginEnabled: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnPath = query ? `${pathname}?${query}` : pathname;

  if (pathname.startsWith("/screen/display")) {
    return <main className="screen-output-root">{children}</main>;
  }

  const judgeWorkRoute = /^\/works\/[^/]+\/judge(?:\/|$)/.test(pathname);
  const publicRoute = pathname === "/" || pathname === "/works" || (pathname.startsWith("/works/") && !judgeWorkRoute) ||
    pathname === "/riders" || pathname.startsWith("/riders/") || pathname === "/cooperation" ||
    pathname.startsWith("/races/");
  const focusedPublicFlow = pathname === "/login" || pathname === "/debug-login" || pathname === "/role-switch";
  if (auth?.activeRole && !focusedPublicFlow && !publicRoute) {
    const user: AppShellUser = { ...auth, activeRole: auth.activeRole };
    return (
      <Suspense fallback={<div className={styles.shellLoading} aria-label="正在加载工作台" />}>
        <AuthenticatedAppShell user={user}>{children}</AuthenticatedAppShell>
      </Suspense>
    );
  }

  return <PublicChrome auth={auth} debugLoginEnabled={debugLoginEnabled} returnPath={returnPath}>{children}</PublicChrome>;
}
