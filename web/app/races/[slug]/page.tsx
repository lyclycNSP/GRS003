import Link from "next/link";
import { notFound } from "next/navigation";
import { submitRegistrationAction } from "@/app/actions";
import { getRaceBySlug } from "@/lib/queries";

export default async function RacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const race = await getRaceBySlug(slug);
  if (!race) notFound();
  const submittedWorks = race.registrations.filter((registration) => registration.work);
  const states = [
    ["报名席", race.schedule.registration ?? "开放", `${race.registrations.length} 位 Rider`],
    ["赛道", race.schedule.race ?? race.status, `${String(race.metrics.activeRiders ?? 0)} 位在线`],
    ["提交", race.schedule.submission ?? "开放", `${submittedWorks.length} 件作品`],
    ["评审席", race.schedule.judging ?? "待开席", `${submittedWorks.length} 份材料`],
    ["颁奖", race.schedule.results ?? "未发布", `${race.awards.length} 个奖项`]
  ];

  return (
    <section className="route-page">
      <section className="race-hero-panel">
        <p className="section-kicker">{race.title} / {race.status}</p>
        <h1>{race.title}</h1>
        <p className="race-summary">{race.challenge}</p>
        <div className="race-cta-row">
          <Link className="inline-action" href={`/races/${race.slug}/live`}>进入 Live Hall</Link>
          <Link className="inline-action" href={`/races/${race.slug}/works`}>作品墙</Link>
          <Link className="inline-action" href={`/races/${race.slug}/results`}>最终榜单</Link>
          <form action={submitRegistrationAction}>
            <input type="hidden" name="raceId" value={race.id} />
            <button className="inline-action" type="submit">报名参赛</button>
          </form>
        </div>
      </section>

      <section className="race-state-grid">
        {states.map(([label, value, text]) => (
          <article className="state-card active" key={label}>
            <span>{label}</span><b>{value}</b><p>{text}</p>
          </article>
        ))}
      </section>

      <section className="app-grid">
        <div className="race-content-grid">
          <article className="glass-card"><span>赛题</span><h2>{race.title}</h2><p>{race.summary}</p></article>
          <article className="glass-card"><span>Riding Signal</span><h2>{String(race.metrics.activeRiders ?? 0)}</h2><p>Live Hall 读取 Projection，最终事实以 Results 和 Report 为准。</p></article>
          <article className="glass-card"><span>作品</span><h2>{submittedWorks.length}</h2><p>公开作品进入 Works，评审中作品只在 Console 和 Judge View 可见。</p></article>
          <article className="glass-card"><span>报告</span><h2>{race.reports.filter((report) => report.visibility === "public").length}</h2><p>公开 Report 将进入 Results 或 Review。</p></article>
        </div>
        <aside className="right-dashboard">
          <h2>本场入口</h2>
          <Link href={`/races/${race.slug}/live`}>Live Hall</Link>
          <Link href={`/races/${race.slug}/works`}>Works</Link>
          <Link href={`/races/${race.slug}/results`}>Results</Link>
          <Link href={`/races/${race.slug}/review`}>Review</Link>
        </aside>
      </section>
    </section>
  );
}
