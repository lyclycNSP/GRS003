import Link from "next/link";
import { getPublicWorks } from "@/lib/queries";

export default async function WorksPage() {
  const works = await getPublicWorks();
  return (
    <section className="route-page">
      <section className="module-title route-hero">
        <p className="section-kicker">Works / Public Gallery</p>
        <h1>公开作品墙</h1>
        <p className="module-summary">已发布作品、Rider、Demo、Repo 和公开 Evidence 摘要进入这里；评审中材料仍留在工作台。</p>
      </section>
      <section className="work-grid">
        {works.map((work) => (
          <article className="work-card" key={work.id}>
            <span>{work.registration.race.title}</span>
            <h2>{work.title}</h2>
            <p>{work.summary}</p>
            <b>{work.registration.user.displayName}</b>
            <div className="work-card-actions">
              <Link href={`/works/${work.slug}`}>Work Page</Link>
              <Link href={`/riders/${work.registration.user.slug}`}>Rider</Link>
              <Link href={`/races/${work.registration.race.slug}`}>Race</Link>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
