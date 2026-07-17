import Link from "next/link";
import styles from "../PublicRace.module.css";

type RacePublicNavigationProps = {
  slug: string;
  title: string;
  active: "overview" | "live" | "works" | "results" | "review";
};

const items = [
  ["overview", "Race 概览", ""],
  ["live", "Live Hall", "/live"],
  ["works", "Works", "/works"],
  ["results", "Results", "/results"],
  ["review", "Review", "/review"]
] as const;

export function RacePublicNavigation({ slug, title, active }: RacePublicNavigationProps) {
  return (
    <nav className={styles.pageNav} aria-label={`${title} 页面导航`}>
      <div className={styles.tabRow}>
        {items.map(([key, label, suffix]) => (
          <Link className={`${styles.tabLink} ${active === key ? styles.tabActive : ""}`} href={`/races/${slug}${suffix}`} key={key}>
            {label}
          </Link>
        ))}
      </div>
      <Link className={styles.quietButton} href="/">返回赛事中心</Link>
    </nav>
  );
}
