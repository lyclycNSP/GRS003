import type { Metadata } from "next";
import Link from "next/link";
import { HashRedirect } from "@/app/components/HashRedirect";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARY Integrated MVP",
  description: "ARY high-fidelity frontend integrated with server-side race domain actions."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <HashRedirect />
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
            </div>
          </header>
          <main className="deck next-page">{children}</main>
        </div>
      </body>
    </html>
  );
}
