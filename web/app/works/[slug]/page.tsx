import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentCard, DetailPanel, KeyValueList, PageHeader, StatRail, StatusBadge } from "@/app/components/ui";
import { getEntrantDisplay, getWorkBySlug } from "@/lib/queries";
import { resolveVisualCover } from "@/lib/visual-covers";
import styles from "../Works.module.css";

function ExternalIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M11 4h5v5M9 11l7-7M15 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" /></svg>;
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = await getWorkBySlug(slug);
  if (!work) notFound();
  const race = work.registration.race;
  const entrant = getEntrantDisplay(work.registration);
  const publishedDate = work.publishedAt ?? work.submittedAt;

  return (
    <main className={styles.page} data-testid="public-work-page">
      <PageHeader
        compact
        title={work.title}
        eyebrow="Work Page"
        description={work.summary}
        breadcrumbs={[
          { label: "Works", href: "/works" },
          { label: race.title, href: `/races/${race.slug}` },
          { label: work.title },
        ]}
        actions={<StatusBadge tone="success" dot>公开作品</StatusBadge>}
      />

      <section className={styles.detailHero}>
        <div className={styles.detailCover}>
          <img alt="" src={resolveVisualCover("work", work.slug)} />
          <div className={styles.detailCoverCopy}>
            <span>{race.title}</span>
            <strong>{entrant.name}</strong>
          </div>
        </div>
        <div className={styles.detailIntro}>
          <div>
            <span className={styles.detailKicker}>作品概览</span>
            <h2>{work.title}</h2>
            <p>{work.summary}</p>
          </div>
          <div className={styles.detailActions}>
            {work.demoUrl ? <Link className={styles.primaryButton} href={`/works/${work.slug}/demo`}>打开 Demo <ExternalIcon /></Link> : <span className={styles.disabledButton}>Demo 未绑定</span>}
            {work.repoUrl ? <a className={styles.secondaryButton} href={work.repoUrl} target="_blank" rel="noopener noreferrer">查看 Repo <ExternalIcon /></a> : <span className={styles.disabledButton}>Repo 未绑定</span>}
            {entrant.type === "individual" ? <Link className={styles.secondaryButton} href={`/riders/${entrant.slug}`}>Rider Profile</Link> : null}
          </div>
          <dl className={styles.metaList}>
            <div><dt>参与方式</dt><dd>{entrant.type === "team" ? "Team" : "Individual Rider"}</dd></div>
            <div><dt>公开时间</dt><dd>{publishedDate ? publishedDate.toLocaleDateString("zh-CN") : "—"}</dd></div>
            <div><dt>作品状态</dt><dd>{work.status}</dd></div>
          </dl>
        </div>
      </section>

      {entrant.type === "team" ? (
        <ContentCard className={styles.teamBand} title="Team members" description="本作品以团队身份参加赛事。">
          <div className={styles.memberList}>{entrant.members.map((member) => <span key={member.slug}>{member.displayName}</span>)}</div>
        </ContentCard>
      ) : null}

      <StatRail aria-label="作品公开指标" items={[
        { label: "公开 Evidence", value: work.evidences.length, hint: work.evidences.length ? "可引用摘要" : "暂无公开证据" },
        { label: "已发布奖项", value: work.awards.length, hint: work.awards.length ? "公开 Results" : "暂无奖项", tone: "success" },
        { label: "提交版本", value: work.submissionVersion ? `v${work.submissionVersion.versionNumber}` : "legacy", hint: "不可变版本" },
      ]} />

      <section className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <ContentCard className={styles.storyCard} title="作品说明" description="公开作品资产与可引用材料">
            <p className={styles.storyLead}>{work.summary}</p>
            <KeyValueList items={[
              { label: "Demo", value: work.demoUrl ? "已绑定" : "未绑定", hint: work.demoUrl ?? "等待 Rider 补充" },
              { label: "Repo", value: work.repoUrl ? "已绑定" : "未绑定", hint: work.repoUrl ?? "等待 Rider 补充" },
            ]} />
          </ContentCard>

          <ContentCard className={styles.versionCard} title="Submission Integrity" description="公开作品当前指向的不可变提交版本" data-testid="public-work-version">
            {work.submissionVersion ? (
              <div className={styles.versionGrid}>
                <div><span>Version</span><strong>v{work.submissionVersion.versionNumber}</strong></div>
                <div><span>Commit</span><code>{work.submissionVersion.repoCommitSha}</code></div>
                <div className={styles.hashCell}><span>SHA-256</span><code>{work.submissionVersion.integrityHash}</code></div>
                <div><span>Repository</span><strong>{work.submissionVersion.repositoryVerificationStatus === "verified" ? "GitHub App 已验证" : "历史版本 · 未验证"}</strong></div>
                <p>外部仓库内容未执行 Secret、依赖或恶意代码扫描，请勿直接运行不受信任代码。</p>
              </div>
            ) : (
              <div className={styles.legacyNotice}><strong>legacy</strong><p>迁移前作品，无版本哈希。</p></div>
            )}
          </ContentCard>

          {work.awards.length ? (
            <ContentCard title="Awards" description="本作品已公开发布的奖项记录">
              <div className={styles.awardList}>{work.awards.map((award) => (
                <article key={award.id}><span>#{award.rank}</span><div><strong>{award.awardName}</strong><p>{award.decisionReason}</p></div></article>
              ))}</div>
            </ContentCard>
          ) : null}
        </div>

        <DetailPanel className={styles.evidencePanel} title="Riding Evidence" description="仅展示公开摘要与可公开引用信息">
          {work.evidences.length ? (
            <div className={styles.evidenceList}>{work.evidences.map((evidence) => (
              <article key={evidence.id}>
                <div><StatusBadge tone="info">{evidence.type}</StatusBadge><time>{evidence.createdAt.toLocaleDateString("zh-CN")}</time></div>
                <strong>{evidence.title}</strong>
                <p>{evidence.summary}</p>
              </article>
            ))}</div>
          ) : <p className={styles.mutedCopy}>暂无公开 Evidence 摘要。</p>}
          <p className={styles.privacyNote}>原始 CA Session 默认不公开；本页不会展示评审专用材料或私有证据。</p>
          <div className={styles.asideLinks}>
            <Link href={`/races/${race.slug}`}>返回 Race Page</Link>
            <Link href="/works">浏览更多 Works</Link>
          </div>
        </DetailPanel>
      </section>
    </main>
  );
}
