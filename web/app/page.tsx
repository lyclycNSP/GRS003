import Link from "next/link";
import { getPublicRaces, getPublicWorks } from "@/lib/queries";

export default async function HomePage() {
  const races = await getPublicRaces();
  const works = await getPublicWorks();
  const liveRaces = races.filter((race) => race.status === "running");
  const featured = liveRaces.find((race) => race.slug === "bay-area-happy-trip") ?? liveRaces[0] ?? races[0];
  const latestResult = races.find((race) => race.status === "completed");

  return (
    <section className="route-page">
      <section className="hero-copy page-home-hero">
        <p className="section-kicker">Race Gallery / Live Now</p>
        <h1>{featured?.title ?? "ARY Race Gallery"}</h1>
        <div className="hero-live-switcher" aria-label="Live race switcher">
          {liveRaces.map((race) => (
            <Link className={race.id === featured?.id ? "active" : ""} href={`/races/${race.slug}`} key={race.id}>
              {race.title}
            </Link>
          ))}
        </div>
        <p className="hero-subtitle">{featured?.challenge}</p>
        <div className="hero-meta">
          <span><b>{String(featured?.metrics.riders ?? 0)}</b> riders</span>
          <span><b>{String(featured?.metrics.activeRiders ?? 0)}</b> active</span>
          <span><b>{String(featured?.metrics.submittedWorks ?? 0)}</b> works</span>
          <span><b>{featured?.status}</b> status</span>
        </div>
        <div className="hero-actions">
          <Link className="inline-action" href={`/races/${featured?.slug}/live`}>进入 Live Hall</Link>
          <Link className="inline-action" href={`/races/${featured?.slug}`}>查看赛题</Link>
        </div>
      </section>

      <section className="benefit-row route-band">
        {works.slice(0, 2).map((work) => (
          <article key={work.id}>
            <span className="icon-card">Work</span>
            <div>
              <h2>{work.title}</h2>
              <p>{work.registration.race.title} / {work.registration.user.displayName}</p>
              <Link href={`/works/${work.slug}`}>查看作品</Link>
            </div>
          </article>
        ))}
      </section>

      <section className="work-grid">
        {races.map((race) => (
          <article className="work-card" key={race.id}>
            <span>{race.status}</span>
            <h2>{race.title}</h2>
            <p>{race.summary}</p>
            <b>{String(race.metrics.riders ?? 0)} riders / {String(race.metrics.submittedWorks ?? 0)} works</b>
            <div className="work-card-actions">
              <Link href={`/races/${race.slug}`}>Race Page</Link>
              <Link href={`/races/${race.slug}/works`}>Works</Link>
              <Link href={`/races/${race.slug}/results`}>Results</Link>
            </div>
          </article>
        ))}
      </section>

      <section className="route-band app-grid">
        <article className="form-card">
          <span className="section-kicker">Latest Results</span>
          <h2>{latestResult?.title ?? "结果等待发布"}</h2>
          <p>{latestResult ? latestResult.summary : "完成赛事实时进入 Results，过程榜单留在 Live Hall。"}</p>
          {latestResult ? <Link className="inline-action" href={`/races/${latestResult.slug}/results`}>查看最终榜单</Link> : null}
        </article>
        <article className="form-card">
          <span className="section-kicker">Cooperation</span>
          <h2>报名、办赛、赞助入口</h2>
          <p>面向 Rider、Organizer 和合作伙伴的转化入口已迁入正式应用。</p>
          <Link className="inline-action" href="/cooperation">进入合作页</Link>
        </article>
      </section>
    </section>
  );
}
