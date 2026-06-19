import Link from "next/link";
import { notFound } from "next/navigation";
import { getRaceWorks } from "@/lib/queries";

export default async function RaceWorksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getRaceWorks(slug);
  if (!result) notFound();
  const { race, works } = result;
  return (
    <section className="route-page">
      <section className="module-title route-hero">
        <p className="section-kicker">{race.title} / Works</p>
        <h1>{race.title} 作品墙</h1>
        <p className="module-summary">本场公开作品、Rider 资产和可公开 Evidence 摘要。</p>
      </section>
      <section className="work-grid">
        {works.map((work) => (
          <article className="work-card" key={work.id}>
            <span>{work.status}</span>
            <h2>{work.title}</h2>
            <p>{work.summary}</p>
            <b>{work.registration.user.displayName}</b>
            <div className="work-card-actions">
              <Link href={`/works/${work.slug}`}>Work Page</Link>
              <Link href={`/riders/${work.registration.user.slug}`}>Rider</Link>
            </div>
          </article>
        ))}
      </section>
      <section className="route-band">
        <Link className="inline-action" href={`/races/${race.slug}`}>返回 Race Page</Link>
        <Link className="inline-action" href={`/races/${race.slug}/results`}>查看 Results</Link>
      </section>
    </section>
  );
}
