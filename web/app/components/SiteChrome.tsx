"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/screen/display")) {
    return <main className="screen-output-root">{children}</main>;
  }

  return (
    <div className="deck-shell">
      <header className="deck-header" aria-label="ARY navigation">
        <Link className="brand" href="/" aria-label="ARY home">
          <span className="brand-emblem" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-horse-compass-transparent.png" alt="" />
          </span>
          <span>
            <strong>Agent Racing Yard</strong>
            <small>骑行智能体 纵横三万里</small>
          </span>
        </Link>
        <nav className="ia-nav" aria-label="Public site navigation">
          <Link className="nav-link" href="/">Races</Link>
          <Link className="nav-link" href="/works">Works</Link>
          <Link className="nav-link" href="/riders/mira-chen">Riders</Link>
          <Link className="nav-link" href="/cooperation">Cooperation</Link>
        </nav>
        <div className="workspace-entry" aria-label="Workspace entry">
          <Link href="/api/auth/github">Login</Link>
          <Link href="/console">Workspace</Link>
          <form action={logoutAction}><button type="submit">Logout</button></form>
        </div>
      </header>
      <main className="deck next-page">{children}</main>
    </div>
  );
}
