import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader, StatusBadge } from "@/app/components/ui";
import { getEntrantDisplay, getRaceResults } from "@/lib/queries";
import styles from "../../PublicRace.module.css";
import { RacePublicNavigation } from "../RacePublicNavigation";

export default async function RaceResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const race = await getRaceResults(slug);
  if (!race) notFound();

  return (
    <main className={styles.page}>
      <RacePublicNavigation active="results" slug={race.slug} title={race.title} />
      <PageHeader
        actions={<StatusBadge tone={race.awards.length ? "success" : "warning"}>{race.awards.length ? `${race.awards.length} 个 Award` : "等待发布"}</StatusBadge>}
        breadcrumbs={[{ label: "赛事中心", href: "/" }, { label: race.title, href: `/races/${race.slug}` }, { label: "Results" }]}
        description="Award 与赛后 Read Model 构成最终结果；Live Hall 的过程榜单不在这里替代最终事实。"
        eyebrow="Official Results"
        title={`${race.title} · 最终榜单`}
      />

      <section className={styles.section} aria-labelledby="award-list-title">
        <header className={styles.sectionHeading}>
          <div><span className={styles.sectionLabel}>Award Leaderboard</span><h2 id="award-list-title">获奖名单</h2></div>
          <p>每个 Award 按发布名次展示，并链接到对应公开 Work 或 Rider 资产。</p>
        </header>
        {race.awards.length ? (
          <div className={styles.awardGrid}>
            {race.awards.map((award) => {
              const entrant = getEntrantDisplay(award.registration);
              const assetHref = award.work
                ? `/works/${award.work.slug}`
                : entrant.type === "individual"
                  ? `/riders/${entrant.slug}`
                  : `/races/${race.slug}/works`;
              return (
                <article className={styles.awardCard} key={award.id}>
                  <span className={styles.awardRank}>{award.rank}</span>
                  <span className={styles.miniLabel}> {award.awardName}</span>
                  <h2>{award.work?.title ?? entrant.name}</h2>
                  <p>{award.decisionReason}</p>
                  <Link href={assetHref}>查看公开资产 →</Link>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="榜单尚未发布" description="Organizer 发布 Award 后，本页会展示最终 Results。" />
        )}
      </section>

      <section className={styles.section} aria-labelledby="race-report-title">
        <header className={styles.sectionHeading}>
          <div><span className={styles.sectionLabel}>Race Report</span><h2 id="race-report-title">赛事结果摘要</h2></div>
          <p>这里只呈现已经公开发布的赛后报告。</p>
        </header>
        {race.resultReports.length ? (
          <div className={styles.reportGrid}>
            {race.resultReports.map((report) => (
              <article className={styles.reportCard} key={report.id}>
                <StatusBadge tone="info">{report.type}</StatusBadge>
                <h2>{report.status}</h2>
                <p>{report.content}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="赛后报告等待发布" description="公开 race_report 发布后会出现在这里。" />
        )}
      </section>

      <div className={styles.linkRow}>
        <Link className={styles.primaryButton} href={`/races/${race.slug}/review`}>查看 Review</Link>
        <Link className={styles.secondaryButton} href={`/races/${race.slug}`}>返回 Race 概览</Link>
      </div>
    </main>
  );
}
