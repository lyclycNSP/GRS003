import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentCard, DetailPanel, PageHeader, StatRail, StatusBadge } from "@/app/components/ui";
import { getRiderProfile } from "@/lib/queries";
import { resolveVisualCover } from "@/lib/visual-covers";
import styles from "../Riders.module.css";

function ExternalIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M11 4h5v5M9 11l7-7M15 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1 1-1v-4" /></svg>;
}

export default async function RiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rider = await getRiderProfile(id);
  if (!rider) notFound();

  return (
    <main className={styles.page} data-testid="public-rider-profile">
      <PageHeader
        compact
        eyebrow="Rider Profile"
        title={rider.displayName}
        description={rider.headline ?? `@${rider.githubLogin ?? rider.slug}`}
        breadcrumbs={[{ label: "Riders", href: "/riders" }, { label: rider.displayName }]}
        actions={<StatusBadge tone="info">Rider</StatusBadge>}
      />

      <section className={styles.profileHero}>
        <img alt="" className={styles.profileBackdrop} src={resolveVisualCover("rider", rider.slug)} />
        <div className={styles.profileShade} />
        <div className={styles.profileIdentity}>
          <div className={styles.profileAvatar}><img alt={`${rider.displayName} 的头像`} src={rider.avatarUrl ?? resolveVisualCover("rider", rider.slug)} /></div>
          <div className={styles.profileCopy}>
            <div><h1>{rider.displayName}</h1><StatusBadge tone="info">Rider</StatusBadge></div>
            <p className={styles.profileHeadline}>{rider.headline ?? `@${rider.githubLogin ?? rider.slug}`}</p>
            <p>{[rider.countryCode, rider.city, rider.organization].filter(Boolean).join(" · ") || "ARY Community"}</p>
            <div className={styles.skillList}>{rider.skills.map((skill) => <Link href={`/riders?skill=${encodeURIComponent(skill)}`} key={skill}>{skill}</Link>)}</div>
          </div>
          <div className={styles.profileActions}>
            {rider.websiteUrl ? <a href={rider.websiteUrl} target="_blank" rel="noreferrer">Portfolio <ExternalIcon /></a> : null}
            {Object.entries(rider.socialLinks).map(([name, url]) => <a href={url} target="_blank" rel="noreferrer" key={name}>{name} <ExternalIcon /></a>)}
          </div>
        </div>
      </section>

      <StatRail aria-label="公开能力统计" items={[
        { label: "公开 Works", value: rider.publicWorks.length, hint: "作品资产" },
        { label: "Awards", value: rider.awards.length, hint: rider.awards.length ? "已发布" : "暂无奖项", tone: "success" },
        { label: "Races", value: rider.races.length, hint: "公开参赛记录" },
      ]} />

      <section className={styles.profileLayout}>
        <div className={styles.profileMain}>
          <ContentCard title="关于 Rider" description="公开身份与 Agent Riding 方向">
            <p className={styles.bioCopy}>{rider.bio ?? "这位 Rider 尚未补充公开个人简介。"}</p>
            <dl className={styles.publicFacts}>
              <div><dt>GitHub</dt><dd>@{rider.githubLogin ?? rider.slug}</dd></div>
              <div><dt>所在城市</dt><dd>{rider.city ?? "未公开"}</dd></div>
              <div><dt>组织 / 学校</dt><dd>{rider.organization ?? "未公开"}</dd></div>
            </dl>
          </ContentCard>

          <section className={styles.profileSection}>
            <div className={styles.sectionHeading}><div><span>Selected Works</span><h2>公开作品</h2><p>由公开参赛记录沉淀的作品资产。</p></div><Link href="/works">查看 Works Gallery →</Link></div>
            {rider.publicWorks.length ? (
              <div className={styles.workGrid}>{rider.publicWorks.map((work) => (
                <article className={styles.workCard} key={work.id}>
                  <Link className={styles.workCover} href={`/works/${work.slug}`}><img alt="" src={resolveVisualCover("work", work.slug)} /><StatusBadge tone="success" dot>Published</StatusBadge></Link>
                  <div><span><Link href={`/races/${work.race.slug}`}>{work.race.title}</Link></span><h3><Link href={`/works/${work.slug}`}>{work.title}</Link></h3><p>{work.summary}</p><div className={styles.workActions}><Link href={`/works/${work.slug}`}>Work Page</Link><Link href={`/races/${work.race.slug}`}>Race</Link></div></div>
                </article>
              ))}</div>
            ) : <div className={styles.inlineEmpty}>暂无公开作品。</div>}
          </section>
        </div>

        <aside className={styles.profileAside}>
          <DetailPanel title="参赛记录" description="只展示公开 Race">
            {rider.races.length ? <div className={styles.raceList}>{rider.races.map((race, index) => (
              <Link href={`/races/${race.slug}`} key={`${race.id}-${index}`}><span>{race.status}</span><strong>{race.title}</strong><small>查看 Race Page →</small></Link>
            ))}</div> : <p className={styles.mutedCopy}>暂无公开参赛记录。</p>}
          </DetailPanel>
          <DetailPanel title="Awards" description="已发布的奖项记录">
            {rider.awards.length ? <div className={styles.awardList}>{rider.awards.map((award) => (
              <article key={award.id}><span>#{award.rank}</span><div><strong>{award.awardName}</strong><p>{award.decisionReason}</p></div></article>
            ))}</div> : <p className={styles.mutedCopy}>暂无已发布奖项。</p>}
          </DetailPanel>
        </aside>
      </section>
    </main>
  );
}
