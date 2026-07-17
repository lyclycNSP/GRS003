import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader, StatRail, StatusBadge, StatusSummary } from "@/app/components/ui";
import { getRaceReview } from "@/lib/queries";
import styles from "../../PublicRace.module.css";
import { RacePublicNavigation } from "../RacePublicNavigation";

export default async function RaceReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const race = await getRaceReview(slug);
  if (!race) notFound();
  const summary = race.reports[0];

  return (
    <main className={styles.page}>
      <RacePublicNavigation active="review" slug={race.slug} title={race.title} />
      <PageHeader
        actions={<StatusBadge tone={summary ? "success" : "warning"}>{summary ? "Review 已发布" : "等待发布"}</StatusBadge>}
        breadcrumbs={[{ label: "赛事中心", href: "/" }, { label: race.title, href: `/races/${race.slug}` }, { label: "Review" }]}
        description="公开复盘解释评审判断、获奖理由与典型 Evidence；原始 CA Session 默认不公开。"
        eyebrow="Race Review"
        title={`${race.title} · 评审复盘`}
      />

      <StatusSummary
        description={summary?.content ?? "公开 review_summary 发布后会进入本页。"}
        eyebrow="Review Summary"
        title={summary?.status ?? "等待发布"}
        tone={summary ? "success" : "warning"}
      />
      <StatRail aria-label="复盘公开信息" items={[{
        label: "Public Evidence",
        value: race.publicEvidence.length,
        hint: race.publicEvidence.length ? "已授权公开" : "暂无公开证据",
      }]} />

      <section className={styles.section} aria-labelledby="evidence-title">
        <header className={styles.sectionHeading}>
          <div><span className={styles.sectionLabel}>Evidence Highlights</span><h2 id="evidence-title">公开证据摘要</h2></div>
          <p>用于解释评审判断与能力亮点，不暴露原始私有骑行数据。</p>
        </header>
        {race.publicEvidence.length ? (
          <div className={styles.evidenceList}>
            {race.publicEvidence.map((evidence) => (
              <article className={styles.evidenceItem} key={evidence.id}>
                <div>
                  <span className={styles.miniLabel}>{evidence.type}</span>
                  <strong>{evidence.title}</strong>
                  <p>{evidence.summary}</p>
                </div>
                <em>{evidence.riderName} / {evidence.workTitle}</em>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="暂无公开 Evidence" description="被允许公开引用的 Evidence 发布后，会进入 Review。" />
        )}
      </section>

      <div className={styles.linkRow}>
        <Link className={styles.primaryButton} href={`/races/${race.slug}/results`}>查看 Results</Link>
        <Link className={styles.secondaryButton} href={`/races/${race.slug}/works`}>浏览 Works</Link>
      </div>
    </main>
  );
}
