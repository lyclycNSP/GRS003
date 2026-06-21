import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkBySlug } from "@/lib/queries";
import { submitJudgingRecordAction } from "@/app/actions";

export default async function WorkJudgePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<{ saved?: string }> }) {
  const { slug } = await params;
  const { saved } = (await searchParams) ?? {};
  const work = await getWorkBySlug(slug, { includeReviewOnly: true });
  if (!work) notFound();
  const race = work.registration.race;
  const rider = work.registration.user;
  const assignment = work.assignments[0];
  const review = assignment?.judgingRecord;
  return (
    <section className="route-page">
      <section className="work-detail-hero work-judge-hero" style={{ position: "relative", inset: "auto", marginBottom: 24 }}>
        <p className="section-kicker">{race.title} / {work.title} / Judge View</p>
        <h1>{work.title}</h1>
        <p className="module-summary">评审席视角：{rider.displayName} 的作品已提交，Demo、Repo 与 Riding Evidence 摘要可被评审席查看。</p>
        {saved === "1" ? <p className="status-pill good">JudgingRecord 已保存，Assignment 状态已更新。</p> : null}
        <div className="work-detail-actions work-judge-actions">
          <a href={work.demoUrl ?? "#"}>打开 Demo</a>
          <a href={work.repoUrl ?? "#"}>查看 Repo</a>
          <Link href={`/works/${work.slug}`}>公开视角</Link>
          <Link href={`/races/${race.slug}`}>返回 Race</Link>
        </div>
      </section>
      <section className="judge-review-layout work-judge-layout" style={{ position: "relative", inset: "auto" }}>
        <article className="assigned-work-card work-judge-summary">
          <span>Assigned Work</span>
          <h2>{work.title}</h2>
          <p>{work.summary}</p>
          <div className="work-judge-flags">
            {work.reviewFlags.length ? work.reviewFlags.map((flag) => (
              <span className={`review-flag review-flag--${flag.severity}`} key={flag.id}><b>{flag.type}</b><em>{flag.judgeVisibleSummary}</em></span>
            )) : <span className="review-flag"><b>无 ReviewFlag</b><em>当前没有评审前提示。</em></span>}
          </div>
        </article>
        <form className="score-form-card work-judge-form" action={submitJudgingRecordAction}>
          <span>Score Form</span>
          <input type="hidden" name="assignmentId" value={assignment?.id ?? ""} />
          <input type="hidden" name="redirectTo" value={`/works/${work.slug}/judge`} />
          {review ? <p className="status-pill good">当前记录：{assignment?.status} / submitted</p> : null}
          <label>score_result<input type="number" min="0" max="100" name="scoreResult" defaultValue={review?.scoreResult ?? 86} /></label>
          <label>score_riding<input type="number" min="0" max="100" name="scoreRiding" defaultValue={review?.scoreRiding ?? 91} /></label>
          <label>comments<textarea name="comments" defaultValue={review?.comments ?? "路线表达清楚，纠偏记录完整。"} /></label>
          <button type="submit" disabled={!assignment}>提交评审</button>
        </form>
        <article className="work-evidence-panel work-judge-evidence">
          <h2>Riding Evidence</h2>
          {work.evidences.map((evidence) => (
            <div key={evidence.id}><span>{evidence.type}</span><b>{evidence.title}</b><em>{evidence.visibility}</em></div>
          ))}
          <p>原始 CA Session 默认不公开；本页只展示公开摘要、作品材料和评审可引用信息。</p>
        </article>
      </section>
    </section>
  );
}
