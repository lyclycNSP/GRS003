import Link from "next/link";
import { notFound } from "next/navigation";
import { getRiderProfile } from "@/lib/queries";

export default async function RiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rider = await getRiderProfile(id);
  if (!rider) notFound();

  return (
    <section className="route-page">
      <section className="module-title route-hero">
        <p className="section-kicker">Rider Profile / {rider.city ?? "ARY"}</p>
        <h1>{rider.displayName}</h1>
        <p className="module-summary">@{rider.githubLogin ?? rider.slug} / {rider.roles.join(", ")}</p>
      </section>

      <section className="profile-layout route-grid">
        <article className="profile-card">
          <span>Works</span>
          <h2>{rider.publicWorks.length}</h2>
          <p>公开作品资产进入 Works 与 Race 页面。</p>
        </article>
        <article className="profile-card">
          <span>Awards</span>
          <h2>{rider.awards.length}</h2>
          <p>已发布奖项会进入 Results。</p>
        </article>
        <article className="profile-card">
          <span>Races</span>
          <h2>{rider.races.length}</h2>
          <p>参赛记录和作品共同构成 Rider 资产。</p>
        </article>
      </section>

      <section className="work-grid route-band">
        {rider.publicWorks.map((work) => (
          <article className="work-card" key={work.id}>
            <span>{work.race.title}</span>
            <h2>{work.title}</h2>
            <p>{work.summary}</p>
            <div className="work-card-actions">
              <Link href={`/works/${work.slug}`}>Work Page</Link>
              <Link href={`/races/${work.race.slug}`}>Race</Link>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
