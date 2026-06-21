import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkBySlug } from "@/lib/queries";

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = await getWorkBySlug(slug);
  if (!work) notFound();
  const race = work.registration.race;
  const rider = work.registration.user;

  return (
    <section className="route-page page-work-detail">
      <section className="work-detail-hero route-hero">
        <p className="section-kicker">{race.title} / {rider.displayName}</p>
        <h1>{work.title}</h1>
        <p className="module-summary">{work.summary}</p>
        <div className="work-detail-actions">
          <a href={work.demoUrl ?? "#"} className={!work.demoUrl ? "is-disabled" : undefined}>打开 Demo</a>
          <a href={work.repoUrl ?? "#"} className={!work.repoUrl ? "is-disabled" : undefined}>查看 Repo</a>
          <Link href={`/riders/${rider.slug}`}>Rider Profile</Link>
          <Link href={`/races/${race.slug}`}>Race Page</Link>
          <Link href="/works">返回 Works</Link>
        </div>
      </section>

      <section className="app-grid">
        <section className="work-story-grid route-grid">
          <article className="work-story-card primary">
            <span>作品亮点</span>
            <h2>作品资产与骑行证据已汇合</h2>
            <p>{work.summary}</p>
          </article>
          <article className="work-story-card"><span>Demo</span><h2>{work.demoUrl ? "已绑定" : "未绑定"}</h2><p>{work.demoUrl ?? "等待 Rider 补充"}</p></article>
          <article className="work-story-card"><span>Repo</span><h2>{work.repoUrl ? "已绑定" : "未绑定"}</h2><p>{work.repoUrl ?? "等待 Rider 补充"}</p></article>
          <article className="work-story-card"><span>状态</span><h2>{work.status}</h2><p>{work.visibility}</p></article>
        </section>
        <aside className="work-evidence-panel route-aside">
          <h2>Riding Evidence</h2>
          {work.evidences.length ? work.evidences.map((evidence) => (
            <div key={evidence.id}><span>{evidence.type}</span><b>{evidence.title}</b><em>{evidence.visibility}</em></div>
          )) : <p>暂无公开 Evidence 摘要。</p>}
          {work.reviewFlags.map((flag) => (
            <div key={flag.id}><span>{flag.type}</span><b>{flag.severity}</b><em>{flag.judgeVisibleSummary}</em></div>
          ))}
          <p>原始 CA Session 默认不公开；本页只展示公开摘要、作品材料和评审可引用信息。</p>
        </aside>
      </section>
    </section>
  );
}
