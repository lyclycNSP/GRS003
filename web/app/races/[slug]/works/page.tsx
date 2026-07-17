import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader, StatusBadge } from "@/app/components/ui";
import { getEntrantDisplay, getRaceWorks } from "@/lib/queries";
import { resolveVisualCover } from "@/lib/visual-covers";
import styles from "../../PublicRace.module.css";
import { RacePublicNavigation } from "../RacePublicNavigation";

export default async function RaceWorksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getRaceWorks(slug);
  if (!result) notFound();
  const { race, works } = result;

  return (
    <main className={styles.page}>
      <RacePublicNavigation active="works" slug={race.slug} title={race.title} />
      <PageHeader
        actions={<StatusBadge tone="info">{works.length} 件公开 Works</StatusBadge>}
        breadcrumbs={[{ label: "赛事中心", href: "/" }, { label: race.title, href: `/races/${race.slug}` }, { label: "Works" }]}
        description="浏览本场已经公开的作品、Rider 资产和可公开 Evidence 摘要。"
        eyebrow="Race Works"
        title={`${race.title} · 作品墙`}
      />

      {works.length ? (
        <section className={styles.galleryGrid} aria-label={`${race.title} 公开作品`}>
          {works.map((work) => {
            const entrant = getEntrantDisplay(work.registration);
            return (
              <article className={styles.workCard} key={work.id}>
                <div className={styles.workCover}>
                  <Image alt={`${work.title} 作品封面`} height={360} src={resolveVisualCover("work", work.slug)} width={640} />
                  <span className={styles.coverBadge}><StatusBadge tone="info">{work.status}</StatusBadge></span>
                </div>
                <div className={styles.cardBody}>
                  <span className={styles.workOwner}>{entrant.name} · {entrant.type === "team" ? "Team" : "Rider"}</span>
                  <h2>{work.title}</h2>
                  <p>{work.summary}</p>
                  <div className={styles.linkRow}>
                    <Link className={styles.primaryButton} href={`/works/${work.slug}`}>查看 Work</Link>
                    {entrant.type === "individual" ? <Link className={styles.secondaryButton} href={`/riders/${entrant.slug}`}>Rider 资料</Link> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState
          action={<Link className={styles.secondaryButton} href={`/races/${race.slug}`}>返回 Race 概览</Link>}
          title="暂无公开 Works"
          description="作品公开后会进入本场作品墙；评审中的作品仅对授权角色可见。"
        />
      )}
    </main>
  );
}
