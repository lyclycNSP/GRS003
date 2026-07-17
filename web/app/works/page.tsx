import Link from "next/link";
import { DirectoryPagination } from "@/app/components/DirectoryPagination";
import { ContentCard, EmptyState, PageHeader, SearchToolbar, StatRail, StatusBadge } from "@/app/components/ui";
import { getEntrantDisplay, getPaginatedPublicWorks, getPublicWorks } from "@/lib/queries";
import { resolveVisualCover } from "@/lib/visual-covers";
import styles from "./Works.module.css";

export const dynamic = "force-dynamic";

type WorksSearchParams = {
  q?: string;
  race?: string;
  page?: string;
};

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M4 10h11M11 6l4 4-4 4" /></svg>;
}

export default async function WorksPage({ searchParams }: { searchParams?: Promise<WorksSearchParams> }) {
  const query = await searchParams;
  const [directory, publicWorks] = await Promise.all([
    getPaginatedPublicWorks({ q: query?.q, race: query?.race, page: query?.page }),
    getPublicWorks()
  ]);
  const eligibleWorks = publicWorks.filter((work) =>
    work.registration.race.visibility === "public" && work.registration.race.status !== "draft"
  );
  const races = Array.from(new Map(eligibleWorks.map((work) => [work.registration.race.slug, work.registration.race])).values());
  const awardCount = eligibleWorks.reduce((total, work) => total + work.awards.length, 0);

  return (
    <main className={styles.page} data-testid="public-works-gallery">
      <PageHeader
        eyebrow="Works / Public Gallery"
        title="公开作品墙"
        description="浏览已发布的 Rider 作品、Demo、Repo 与公开成果。评审中材料和非公开 Evidence 始终留在授权工作台。"
        breadcrumbs={[{ label: "首页", href: "/" }, { label: "Works" }]}
        actions={<Link className={styles.headerAction} href="/cooperation">了解如何参赛 <ArrowIcon /></Link>}
      />

      <StatRail aria-label="公开作品统计" items={[
        { label: "公开作品", value: eligibleWorks.length, hint: "已发布" },
        { label: "关联赛事", value: races.length, hint: "公开 Race" },
        { label: "已发布奖项", value: awardCount, hint: awardCount ? "公开 Results" : "暂无奖项", tone: "success" },
      ]} />

      <SearchToolbar
        className={styles.toolbar}
        start={(
          <form className={styles.searchForm} method="get">
            <label className={styles.searchField}>
              <span className={styles.visuallyHidden}>搜索作品</span>
              <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
              <input defaultValue={query?.q ?? ""} name="q" placeholder="搜索作品、Rider 或赛事…" />
            </label>
            <label className={styles.selectField}>
              <span className={styles.visuallyHidden}>按赛事筛选</span>
              <select defaultValue={query?.race ?? ""} name="race">
                <option value="">全部赛事</option>
                {races.map((race) => <option key={race.id} value={race.slug}>{race.title}</option>)}
              </select>
            </label>
            <button type="submit">筛选</button>
          </form>
        )}
        end={<span className={styles.resultCount}>{directory.total} 个公开作品</span>}
      />

      {directory.items.length ? (
        <section className={styles.workGrid} aria-label="作品列表" id="works-directory" data-testid="public-works-list">
          {directory.items.map((work) => {
            const entrant = getEntrantDisplay(work.registration);
            return (
              <ContentCard className={styles.workCard} interactive key={work.id}>
                <Link className={styles.coverLink} href={`/works/${work.slug}`} aria-label={`查看 ${work.title}`}>
                  <img alt="" className={styles.cover} src={resolveVisualCover("work", work.slug)} />
                  <span className={styles.coverShade} />
                  <StatusBadge className={styles.coverStatus} tone="success" dot>Published</StatusBadge>
                  {work.awards.length ? <span className={styles.awardFlag}>Award × {work.awards.length}</span> : null}
                </Link>
                <div className={styles.workBody}>
                  <div className={styles.cardEyebrow}>
                    <Link href={`/races/${work.registration.race.slug}`}>{work.registration.race.title}</Link>
                    <span>{work.submissionVersion ? `v${work.submissionVersion.versionNumber}` : "legacy"}</span>
                  </div>
                  <h2><Link href={`/works/${work.slug}`}>{work.title}</Link></h2>
                  <p>{work.summary}</p>
                  <div className={styles.authorRow}>
                    <span className={styles.authorMark}>{entrant.name.slice(0, 1).toLocaleUpperCase()}</span>
                    <span><b>{entrant.name}</b><small>{entrant.type === "team" ? "Team" : "Rider"}</small></span>
                  </div>
                  <div className={styles.cardActions}>
                    <Link className={styles.primaryLink} href={`/works/${work.slug}`}>查看作品 <ArrowIcon /></Link>
                    {entrant.type === "individual" ? <Link href={`/riders/${entrant.slug}`}>Rider Profile</Link> : null}
                    <Link href={`/races/${work.registration.race.slug}`}>Race</Link>
                  </div>
                </div>
              </ContentCard>
            );
          })}
        </section>
      ) : (
        <EmptyState
          title="没有匹配的公开作品"
          description="尝试调整搜索词或赛事筛选。这里不会显示评审中、私有或尚未发布的作品。"
          action={<Link className={styles.secondaryButton} href="/works">清除筛选</Link>}
        />
      )}

      <DirectoryPagination
        anchor="works-directory"
        ariaLabel="公开作品分页"
        page={directory.page}
        pathname="/works"
        query={{ q: query?.q, race: query?.race }}
        totalPages={directory.totalPages}
      />
    </main>
  );
}
