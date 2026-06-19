import Link from "next/link";
import { notFound } from "next/navigation";
import { getRaceResults } from "@/lib/queries";

export default async function RaceResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const race = await getRaceResults(slug);
  if (!race) notFound();

  return (
    <section className="route-page">
      <section className="module-title route-hero">
        <p className="section-kicker">{race.title} / Results</p>
        <h1>{race.title} 最终榜单</h1>
        <p className="module-summary">Award 是最终结果；Live Hall 的过程榜单只用于观看赛况。</p>
      </section>

      <section className="award-grid">
        {race.awards.length ? race.awards.map((award) => (
          <article className="glass-card" key={award.id}>
            <span>#{award.rank} / {award.awardName}</span>
            <h2>{award.work?.title ?? award.registration.user.displayName}</h2>
            <p>{award.decisionReason}</p>
            <Link href={award.work ? `/works/${award.work.slug}` : `/riders/${award.registration.user.slug}`}>查看资产</Link>
          </article>
        )) : (
          <article className="glass-card">
            <span>Results</span>
            <h2>榜单尚未发布</h2>
            <p>Organizer 发布 Award 后，本页会展示最终结果。</p>
          </article>
        )}
      </section>

      <section className="review-card-grid route-band">
        {race.resultReports.length ? race.resultReports.map((report) => (
          <article className="glass-card" key={report.id}>
            <span>{report.type}</span>
            <b>{report.status}</b>
            <p>{report.content}</p>
          </article>
        )) : (
          <article className="glass-card">
            <span>Race Report</span>
            <b>等待发布</b>
            <p>公开 race_report 发布后会出现在这里。</p>
          </article>
        )}
      </section>

      <section className="route-band">
        <Link className="inline-action" href={`/races/${race.slug}/review`}>查看 Review</Link>
        <Link className="inline-action" href={`/races/${race.slug}`}>返回 Race Page</Link>
      </section>
    </section>
  );
}
