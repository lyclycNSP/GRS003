import Link from "next/link";
import { notFound } from "next/navigation";
import { getRaceReview } from "@/lib/queries";

export default async function RaceReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const race = await getRaceReview(slug);
  if (!race) notFound();

  return (
    <section className="route-page">
      <section className="module-title route-hero">
        <p className="section-kicker">{race.title} / Review</p>
        <h1>{race.title} 评审复盘</h1>
        <p className="module-summary">公开复盘只展示 review_summary、公开 Evidence 和可引用作品信息。</p>
      </section>

      <section className="review-layout route-grid">
        <article className="glass-card">
          <span>Review Summary</span>
          <h2>{race.reports[0]?.status ?? "等待发布"}</h2>
          <p>{race.reports[0]?.content ?? "公开 review_summary 发布后会进入本页。"}</p>
        </article>
        <article className="glass-card">
          <span>Evidence</span>
          <h2>{race.publicEvidence.length}</h2>
          <p>公开 Evidence 摘要可被复盘引用，原始 CA Session 默认不公开。</p>
        </article>
      </section>

      <section className="review-card-grid route-band">
        {race.publicEvidence.map((evidence) => (
          <article className="glass-card" key={evidence.id}>
            <span>{evidence.type}</span>
            <b>{evidence.title}</b>
            <p>{evidence.summary}</p>
            <em>{evidence.riderName} / {evidence.workTitle}</em>
          </article>
        ))}
      </section>

      <section className="route-band">
        <Link className="inline-action" href={`/races/${race.slug}/results`}>查看 Results</Link>
        <Link className="inline-action" href={`/races/${race.slug}/works`}>查看 Works</Link>
      </section>
    </section>
  );
}
