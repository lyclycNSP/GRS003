import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionOutcomePanel, ContentCard, DetailPanel, PageHeader, PendingActionButton, StatusBadge } from "@/app/components/ui";
import { submitJudgingRecordAction } from "@/app/actions";
import { getAuthContext } from "@/lib/auth";
import { getRaceReviewAggregatesForUser, getReviewWorkBySlug } from "@/lib/queries";
import { resolveVisualCover } from "@/lib/visual-covers";
import styles from "../../Works.module.css";

function ExternalIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M11 4h5v5M9 11l7-7M15 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" /></svg>;
}

export default async function WorkJudgePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<{ saved?: string; action?: string; entityId?: string; actionError?: string }> }) {
  const { slug } = await params;
  const { saved, action, actionError } = (await searchParams) ?? {};
  const ctx = await getAuthContext();
  const work = await getReviewWorkBySlug(slug);
  if (!work || ctx?.activeRole !== "judge" || !ctx.assignedWorkIds.includes(work.id)) notFound();
  const race = work.registration.race;
  const entrant = work.registration.team ? { name: work.registration.team.name } : { name: work.registration.user.displayName };
  const assignment = work.assignments.find((item) => item.judgeUserId === ctx.userId);
  if (!assignment) notFound();
  const assignedVersion = assignment.workSubmissionVersion;
  const reviewedTitle = assignedVersion?.title ?? work.title;
  const reviewedSummary = assignedVersion?.summary ?? work.summary;
  const reviewedDemoUrl = assignedVersion?.demoUrl ?? work.demoUrl;
  const reviewedRepoUrl = assignedVersion?.repoUrl ?? work.repoUrl;
  const review = assignment.judgingRecord;
  const aggregate = (await getRaceReviewAggregatesForUser(ctx.userId, "judge", race.id)).find((item) => item.workId === work.id);

  return (
    <main className={`${styles.page} ${styles.judgePage}`} data-testid="judge-work-page">
      <PageHeader
        compact
        eyebrow="Judge View / Assigned Work"
        title={reviewedTitle}
        description={`评审席正在审阅 ${entrant.name} 的固定作品版本。评分、评论和风险信息仅在授权的 Judge Workspace 中可见。`}
        breadcrumbs={[
          { label: "Judge Workspace", href: "/console/judge" },
          { label: race.title, href: `/races/${race.slug}` },
          { label: reviewedTitle },
        ]}
        actions={<StatusBadge tone={review ? "success" : "warning"} dot>{review ? "已提交评审" : "待评审"}</StatusBadge>}
      />

      {action === "judging-submitted" || saved === "1" ? <ActionOutcomePanel actionCode="judging-submitted" outcome="success" title="评审记录已提交" description={aggregate?.completedReviews === 3 ? "本作品的三份评分已经齐备，聚合均分现已对已提交 Judge 可见。" : `当前已完成 ${aggregate?.completedReviews ?? 1}/3 份评审；三份齐备后才会计算均分。`} entity={{ label: "Assignment", value: assignment.id }} nextAction={<Link href="/console/judge">返回任务列表</Link>} testId="judge-save-confirmation" /> : null}
      {action === "judging-submit-failed" ? <ActionOutcomePanel actionCode={action} outcome="error" title="评审未能提交" description={actionError || "请确认评分范围、评论长度和当前赛事状态后重试。"} /> : null}

      <section className={styles.judgeHero}>
        <img alt="" src={resolveVisualCover("work", work.slug)} />
        <div className={styles.judgeHeroShade} />
        <div className={styles.judgeHeroCopy}>
          <span>{race.title}</span>
          <h2>{reviewedTitle}</h2>
          <p>{reviewedSummary}</p>
          <div className={styles.detailActions}>
            {reviewedDemoUrl ? <Link className={styles.primaryButton} href={`/works/${work.slug}/demo`}>打开 Demo <ExternalIcon /></Link> : <span className={styles.disabledButton}>Demo 未绑定</span>}
            {reviewedRepoUrl ? <a className={styles.secondaryButton} href={reviewedRepoUrl} target="_blank" rel="noopener noreferrer">查看 Repo <ExternalIcon /></a> : <span className={styles.disabledButton}>Repo 未绑定</span>}
            {work.visibility === "public" && work.status === "published" ? <Link className={styles.secondaryButton} href={`/works/${work.slug}`}>公开视角</Link> : null}
          </div>
        </div>
      </section>

      <section className={styles.judgeLayout}>
        <div className={styles.judgeContext}>
          <ContentCard className={styles.assignedCard} title="Assigned Work" description="本次评审绑定的不可变版本" data-testid="judge-assigned-work">
            <div className={styles.assignmentHeadline}>
              <div><span>Work</span><strong>{reviewedTitle}</strong></div>
              <div><span>Rider / Entrant</span><strong>{entrant.name}</strong></div>
              <div><span>Work ID</span><strong>{work.slug}</strong></div>
              <div><span>Assignment</span><strong>{assignment.status}</strong></div>
              <div><span>Review context</span><strong>{work.reviewFlags.length ? work.reviewFlags.map((flag) => flag.type).join(" / ") : "no_flags"}</strong></div>
              <div><span>Frozen version</span><strong>{assignedVersion ? `v${assignedVersion.versionNumber} · ${assignedVersion.id}` : "legacy"}</strong></div>
            </div>
            <p className={styles.storyLead}>{reviewedSummary}</p>
            <div className={styles.assignedVersion} data-testid="judge-work-version">
              {assignedVersion ? (
                <><StatusBadge tone="violet">v{assignedVersion.versionNumber}</StatusBadge><code>commit {assignedVersion.repoCommitSha}</code><code>SHA-256 {assignedVersion.integrityHash}</code><span>{assignedVersion.repositoryVerificationStatus === "verified" ? "GitHub App 已验证仓库与 Commit" : "历史版本，仓库与 Commit 未验证"}</span><span>外部仓库内容未经代码安全扫描</span></>
              ) : (
                <><StatusBadge tone="neutral">Legacy</StatusBadge><span>无版本哈希</span></>
              )}
            </div>
          </ContentCard>

          {aggregate?.overall !== null && aggregate?.overall !== undefined ? <ContentCard title="三人评审聚合" description="仅在你已提交且三位 Judge 全部完成后展示；不会泄露其他 Judge 的单项评分。" data-testid="judge-work-aggregate">
            <div className={styles.assignmentHeadline}>
              <div><span>成果均分</span><strong>{aggregate.avgResult?.toFixed(2)}</strong></div>
              <div><span>Riding 均分</span><strong>{aggregate.avgRiding?.toFixed(2)}</strong></div>
              <div><span>综合均分</span><strong>{aggregate.overall.toFixed(2)}</strong></div>
              <div><span>完成度</span><strong>{aggregate.completedReviews}/{aggregate.requiredReviews}</strong></div>
            </div>
          </ContentCard> : null}

          <ContentCard title="Review Flags" description="提交前需要纳入评审判断的风险提示">
            <div className={styles.flagList}>
              {work.reviewFlags.length ? work.reviewFlags.map((flag) => (
                <article className={styles.flagItem} key={flag.id}>
                  <StatusBadge tone={flag.severity === "high" ? "danger" : flag.severity === "medium" ? "warning" : "info"}>{flag.type} / {flag.status}</StatusBadge>
                  <p>{flag.resolutionNote ? `${flag.judgeVisibleSummary} 处理记录：${flag.resolutionNote}` : flag.judgeVisibleSummary}</p>
                </article>
              )) : <div className={styles.noFlag}><span>✓</span><p><strong>无 ReviewFlag</strong>当前没有评审前提示。</p></div>}
            </div>
            <Link className={styles.inlineLink} href={`/console/risk-center?raceId=${race.id}`}>打开风险评审中心 →</Link>
          </ContentCard>

          <DetailPanel className={styles.judgeEvidence} title="Riding Evidence" description="评审可引用的作品与骑行证据">
            <div className={styles.evidenceList}>
              {work.evidences.map((evidence) => (
                <article key={evidence.id}><div><StatusBadge tone="info">{evidence.type}</StatusBadge><span>{evidence.visibility}</span></div><strong>{evidence.title}</strong><p>{evidence.summary}</p></article>
              ))}
            </div>
            <p className={styles.privacyNote}>原始 CA Session 默认不公开；Judge View 只展示该 Assignment 获授权引用的信息。</p>
          </DetailPanel>
        </div>

        <form className={styles.scoreForm} action={submitJudgingRecordAction} data-testid="judge-score-form">
          <div className={styles.formHeading}>
            <div><span>Score Form</span><h2>提交评审</h2><p>两个评分项均为 0–100 分，评论将作为本次 JudgingRecord 保存。</p></div>
            <StatusBadge tone={review ? "success" : "warning"}>{review ? `${assignment.status} / submitted` : "Draft"}</StatusBadge>
          </div>
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <input type="hidden" name="redirectTo" value={`/works/${work.slug}/judge`} />
          {review ? <p className={styles.currentRecord}>当前记录：{assignment.status} / submitted</p> : null}
          <div className={styles.scoreFields}>
            <label>score_result<span>成果完成度</span><input type="number" min="0" max="100" step="1" name="scoreResult" defaultValue={review?.scoreResult ?? 86} required /></label>
            <label>score_riding<span>Agent Riding 表现</span><input type="number" min="0" max="100" step="1" name="scoreRiding" defaultValue={review?.scoreRiding ?? 91} required /></label>
          </div>
          <label className={styles.commentField}>comments<span>评审意见 · 最多 2000 字</span><textarea name="comments" maxLength={2000} defaultValue={review?.comments ?? "路线表达清楚，纠偏记录完整。"} /></label>
          <div className={styles.formFooter}><Link href="/console/judge">返回任务列表</Link><PendingActionButton disabled={Boolean(race.reviewResultsPublishedAt)} label={race.reviewResultsPublishedAt ? "结果已发布，评审已锁定" : review ? "更新评审" : "提交评审"} pendingLabel="正在校验并保存评审…" testId="submit-judging-record" /></div>
        </form>
      </section>
    </main>
  );
}
