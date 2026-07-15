import Link from "next/link";
import { notFound } from "next/navigation";
import { getReviewWorkBySlug } from "@/lib/queries";
import { submitJudgingRecordAction } from "@/app/actions";
import { getAuthContext } from "@/lib/auth";

export default async function WorkJudgePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<{ saved?: string }> }) {
  const { slug } = await params;
  const { saved } = (await searchParams) ?? {};
  const ctx = await getAuthContext();
  const work = await getReviewWorkBySlug(slug);
  if (!work || !ctx?.roles.includes("judge") || !ctx.assignedWorkIds.includes(work.id)) notFound();
  const race = work.registration.race;
  const entrant = work.registration.team
    ? { name: work.registration.team.name }
    : { name: work.registration.user.displayName };
  const assignment = work.assignments.find((item) => item.judgeUserId === ctx.userId);
  if (!assignment) notFound();
  const assignedVersion = assignment.workSubmissionVersion;
  const reviewedTitle = assignedVersion?.title ?? work.title;
  const reviewedSummary = assignedVersion?.summary ?? work.summary;
  const reviewedDemoUrl = assignedVersion?.demoUrl ?? work.demoUrl;
  const reviewedRepoUrl = assignedVersion?.repoUrl ?? work.repoUrl;
  const review = assignment.judgingRecord;
  return (
    <section className="route-page">
      <section className="work-detail-hero work-judge-hero" style={{ position: "relative", inset: "auto", marginBottom: 24 }}>
        <p className="section-kicker">{race.title} / {reviewedTitle} / Judge View</p>
        <h1>{reviewedTitle}</h1>
        <p className="module-summary">评审席视角：{entrant.name} 的作品已提交，Demo、Repo 与 Riding Evidence 摘要可被评审席查看。</p>
        {saved === "1" ? <p className="status-pill good" data-testid="judge-save-confirmation">JudgingRecord 已保存，Assignment 状态已更新。</p> : null}
        <div className="work-detail-actions work-judge-actions">
          <a href={reviewedDemoUrl ?? "#"} target="_blank" rel="noopener noreferrer">打开 Demo</a>
          <a href={reviewedRepoUrl ?? "#"} target="_blank" rel="noopener noreferrer">查看 Repo</a>
          <Link href={`/works/${work.slug}`}>公开视角</Link>
          <Link href={`/races/${race.slug}`}>返回 Race</Link>
        </div>
      </section>
      <section className="judge-review-layout work-judge-layout" style={{ position: "relative", inset: "auto" }}>
        <article className="assigned-work-card work-judge-summary" data-testid="judge-assigned-work">
          <span>Assigned Work</span>
          <h2>{reviewedTitle}</h2>
          <p>{reviewedSummary}</p>
          <div data-testid="judge-work-version">
            {assignedVersion ? <p>固定版本 v{assignedVersion.versionNumber} / commit {assignedVersion.repoCommitSha} / SHA-256 {assignedVersion.integrityHash}</p> : <p>Legacy assignment / 无版本哈希</p>}
          </div>
          <div className="work-judge-flags">
            {work.reviewFlags.length ? work.reviewFlags.map((flag) => (
              <span className={`review-flag review-flag--${flag.severity}`} key={flag.id}><b>{flag.type} / {flag.status}</b><em>{flag.resolutionNote ? `${flag.judgeVisibleSummary} 处理记录：${flag.resolutionNote}` : flag.judgeVisibleSummary}</em></span>
            )) : <span className="review-flag"><b>无 ReviewFlag</b><em>当前没有评审前提示。</em></span>}
          </div>
          <Link className="inline-action" href={`/console/risk-center?raceId=${race.id}`}>打开风险评审中心</Link>
        </article>
        <form className="score-form-card work-judge-form" action={submitJudgingRecordAction} data-testid="judge-score-form">
          <span>Score Form</span>
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <input type="hidden" name="redirectTo" value={`/works/${work.slug}/judge`} />
          {review ? <p className="status-pill good">当前记录：{assignment.status} / submitted</p> : null}
          <label>score_result<input type="number" min="0" max="100" name="scoreResult" defaultValue={review?.scoreResult ?? 86} /></label>
          <label>score_riding<input type="number" min="0" max="100" name="scoreRiding" defaultValue={review?.scoreRiding ?? 91} /></label>
          <label>comments<textarea name="comments" defaultValue={review?.comments ?? "路线表达清楚，纠偏记录完整。"} /></label>
          <button type="submit">提交评审</button>
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
