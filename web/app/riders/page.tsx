import Link from "next/link";
import { DirectoryPagination } from "@/app/components/DirectoryPagination";
import { EmptyState, PageHeader, SearchToolbar, StatRail, StatusBadge } from "@/app/components/ui";
import { getPaginatedPublicRiders, listPublicRiders } from "@/lib/queries";
import { resolveVisualCover } from "@/lib/visual-covers";
import styles from "./Riders.module.css";

export const dynamic = "force-dynamic";

type RiderSearchParams = {
  q?: string;
  skill?: string;
  page?: string;
};

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M4 10h11M11 6l4 4-4 4" /></svg>;
}

export default async function RidersPage({ searchParams }: { searchParams?: Promise<RiderSearchParams> }) {
  const query = await searchParams;
  const [directory, allRiders] = await Promise.all([
    getPaginatedPublicRiders({ q: query?.q, skill: query?.skill, page: query?.page }),
    listPublicRiders(),
  ]);
  const riders = directory.items;
  const skills = Array.from(new Set(allRiders.flatMap((rider) => rider.skills)))
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
  const worksCount = allRiders.reduce((total, rider) => total + rider.stats.publicWorks, 0);
  const awardsCount = allRiders.reduce((total, rider) => total + rider.stats.publishedAwards, 0);

  return (
    <main className={styles.page} data-testid="public-rider-directory">
      <PageHeader
        eyebrow="Riders / Public Directory"
        title="Rider 能力档案"
        description="从公开参赛记录、作品、奖项和技能标签中发现 Agent Riding 实践者。这里是能力档案目录，不展示私有资料或社交关系。"
        breadcrumbs={[{ label: "首页", href: "/" }, { label: "Riders" }]}
        actions={<Link className={styles.headerAction} href="/works">浏览公开 Works <ArrowIcon /></Link>}
      />

      <StatRail aria-label="Rider 目录统计" items={[
        { label: "公开 Rider", value: allRiders.length, hint: "有效资格" },
        { label: "公开 Works", value: worksCount, hint: "公开参赛记录" },
        { label: "已发布奖项", value: awardsCount, hint: awardsCount ? "公开 Results" : "暂无奖项", tone: "success" },
      ]} />

      <SearchToolbar
        className={styles.toolbar}
        id="rider-directory-results"
        start={(
          <form className={styles.searchForm} method="get">
            <label className={styles.searchField}>
              <span className={styles.visuallyHidden}>搜索 Rider</span>
              <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
              <input defaultValue={query?.q ?? ""} name="q" placeholder="搜索姓名、城市、组织或技能…" />
            </label>
            <label className={styles.selectField}>
              <span className={styles.visuallyHidden}>按技能筛选</span>
              <select defaultValue={query?.skill ?? ""} name="skill">
                <option value="">全部技能</option>
                {skills.map((skill) => <option key={skill} value={skill}>{skill}</option>)}
              </select>
            </label>
            <button type="submit">筛选</button>
          </form>
        )}
        end={<span className={styles.resultCount}>共 {directory.total} 位 Rider{directory.totalPages > 1 ? ` · 第 ${directory.page} 页` : ""}</span>}
      />

      {skills.length ? (
        <nav className={styles.skillFilters} aria-label="热门技能筛选">
          <Link className={!query?.skill ? styles.activeSkill : undefined} href={query?.q ? `/riders?q=${encodeURIComponent(query.q)}` : "/riders"}>全部</Link>
          {skills.slice(0, 8).map((skill) => {
            const params = new URLSearchParams();
            if (query?.q) params.set("q", query.q);
            params.set("skill", skill);
            return <Link className={query?.skill === skill ? styles.activeSkill : undefined} href={`/riders?${params.toString()}`} key={skill}>{skill}</Link>;
          })}
        </nav>
      ) : null}

      {riders.length ? (
        <section className={styles.riderGrid} aria-label="Rider 列表">
          {riders.map((rider) => (
            <article className={styles.riderCard} key={rider.slug}>
              <div className={styles.cardBackdrop}><img alt="" src={resolveVisualCover("rider", rider.slug)} /></div>
              <div className={styles.cardIdentity}>
                <div className={styles.avatarShell}>
                  <img alt={`${rider.displayName} 的头像`} src={rider.avatarUrl ?? resolveVisualCover("rider", rider.slug)} />
                </div>
                <div><h2><Link href={`/riders/${rider.slug}`}>{rider.displayName}</Link></h2><p>{rider.headline ?? `@${rider.githubLogin ?? rider.slug}`}</p></div>
                <StatusBadge tone="info">Rider</StatusBadge>
              </div>
              <p className={styles.locationLine}>{[rider.city, rider.organization].filter(Boolean).join(" · ") || "ARY Community"}</p>
              <p className={styles.cardBio}>{rider.bio ?? "公开参赛、作品与能力记录正在持续沉淀。"}</p>
              <div className={styles.skillList}>
                {rider.skills.slice(0, 4).map((skill) => {
                  const params = new URLSearchParams();
                  if (query?.q) params.set("q", query.q);
                  params.set("skill", skill);
                  return <Link href={`/riders?${params.toString()}#rider-directory-results`} key={skill}>{skill}</Link>;
                })}
                {rider.skills.length > 4 ? <span>+{rider.skills.length - 4}</span> : null}
              </div>
              <dl className={styles.cardStats}>
                <div><dt>Works</dt><dd>{rider.stats.publicWorks}</dd></div>
                <div><dt>Awards</dt><dd>{rider.stats.publishedAwards}</dd></div>
                <div><dt>Races</dt><dd>{rider.stats.publicRaces}</dd></div>
              </dl>
              <Link className={styles.profileLink} href={`/riders/${rider.slug}`}>查看 Rider Profile <ArrowIcon /></Link>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          title="没有匹配的 Rider"
          description="尝试调整搜索词或技能筛选。目录只收录拥有有效 Rider 资格的公开能力档案。"
          action={<Link className={styles.secondaryButton} href="/riders">清除筛选</Link>}
        />
      )}

      <DirectoryPagination
        anchor="rider-directory-results"
        ariaLabel="Rider 目录分页"
        page={directory.page}
        pathname="/riders"
        query={{ q: query?.q, skill: query?.skill }}
        totalPages={directory.totalPages}
      />
    </main>
  );
}
