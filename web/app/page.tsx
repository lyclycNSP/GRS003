import Image from "next/image";
import Link from "next/link";
import { DirectoryPagination } from "@/app/components/DirectoryPagination";
import { EmptyState, StatusBadge } from "@/app/components/ui";
import {
  getEntrantDisplay,
  getHomepageFeaturedRaces,
  getHomepageFeaturedWorks,
  getLatestPublicRaceResult,
  getPaginatedPublicRaces,
  getPublicRaces
} from "@/lib/queries";
import { resolveVisualCover } from "@/lib/visual-covers";
import styles from "./HomePage.module.css";
import { HomeHeroCarousel } from "./HomeHeroCarousel";

export const dynamic = "force-dynamic";

type HomeSearchParams = {
  q?: string;
  status?: string;
  page?: string;
};

function statusTone(status: string): "success" | "info" | "neutral" {
  if (status === "running") return "success";
  if (status === "published") return "info";
  return "neutral";
}

function statusLabel(status: string) {
  if (status === "running") return "进行中";
  if (status === "completed") return "已结束";
  if (status === "published") return "已发布";
  return status;
}

export default async function HomePage({ searchParams }: { searchParams?: Promise<HomeSearchParams> }) {
  const query = await searchParams;
  const [allRaces, raceDirectory, featuredWorks, latestResult] = await Promise.all([
    getPublicRaces(),
    getPaginatedPublicRaces({ q: query?.q, status: query?.status, page: query?.page }),
    getHomepageFeaturedWorks(3),
    getLatestPublicRaceResult()
  ]);
  const featuredRaces = await getHomepageFeaturedRaces(allRaces);

  return (
    <main className={styles.page}>
      {featuredRaces.length ? (
        <HomeHeroCarousel
          races={featuredRaces.map((race) => ({
            id: race.id,
            slug: race.slug,
            title: race.title,
            challenge: race.challenge,
            status: race.status,
            cover: resolveVisualCover("race", race.slug),
            riders: Number(race.metrics.riders ?? 0),
            works: Number(race.metrics.submittedWorks ?? 0)
          }))}
        />
      ) : (
        <EmptyState title="暂无公开 Race" description="Organizer 发布公开赛事后，会在 Race Gallery 中展示。" />
      )}

      <section className={styles.section} id="race-gallery" aria-labelledby="race-gallery-title" data-testid="public-race-directory">
        <header className={styles.sectionHeader}>
          <div>
            <p>Race Center</p>
            <h2 id="race-gallery-title">探索公开赛事</h2>
          </div>
          <span>搜索赛题和挑战，进入对应 Race 查看当前赛况、公开作品与最终 Results。</span>
        </header>

        <form className={styles.directoryToolbar} action="/" method="get">
          <label className={styles.searchField}>
            <span className={styles.visuallyHidden}>搜索赛事</span>
            <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
            <input defaultValue={query?.q ?? ""} name="q" placeholder="搜索赛事名称、摘要或挑战说明…" />
          </label>
          <label className={styles.selectField}>
            <span className={styles.visuallyHidden}>按赛事状态筛选</span>
            <select defaultValue={query?.status ?? ""} name="status">
              <option value="">全部状态</option>
              <option value="running">进行中</option>
              <option value="published">已发布</option>
              <option value="completed">已结束</option>
            </select>
          </label>
          <button type="submit">搜索赛事</button>
          {(query?.q || query?.status) ? <Link className={styles.clearFilter} href="/#race-gallery">清除筛选</Link> : null}
          <span className={styles.directoryCount}>共 {raceDirectory.total} 场</span>
        </form>

        {raceDirectory.items.length ? (
          <>
            <div className={styles.raceGrid}>
              {raceDirectory.items.map((race) => (
                <article className={styles.raceCard} key={race.id}>
                  <div className={styles.cover}>
                    <Image alt={`${race.title} 赛事封面`} height={360} src={resolveVisualCover("race", race.slug)} width={640} />
                    <span className={styles.coverStatus}><StatusBadge dot tone={statusTone(race.status)}>{statusLabel(race.status)}</StatusBadge></span>
                  </div>
                  <div className={styles.cardBody}>
                    <h3>{race.title}</h3>
                    <p>{race.summary}</p>
                    <div className={styles.cardStats}>
                      <span><strong>{String(race.metrics.riders ?? 0)}</strong>Riders</span>
                      <span><strong>{String(race.metrics.submittedWorks ?? 0)}</strong>Works</span>
                    </div>
                    <div className={styles.cardActions}>
                      <Link className={styles.primary} href={`/races/${race.slug}`}>进入 Race</Link>
                      <Link className={styles.cardLink} href={`/races/${race.slug}/works`}>Works</Link>
                      <Link className={styles.cardLink} href={`/races/${race.slug}/results`}>Results</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <DirectoryPagination
              anchor="race-gallery"
              ariaLabel="公开赛事分页"
              page={raceDirectory.page}
              pathname="/"
              query={{ q: query?.q, status: query?.status }}
              totalPages={raceDirectory.totalPages}
            />
          </>
        ) : (
          <EmptyState
            title="没有匹配的公开赛事"
            description="尝试调整搜索词或赛事状态。草稿和私有赛事不会出现在公共目录中。"
            action={<Link className={styles.secondary} href="/#race-gallery">清除筛选</Link>}
          />
        )}
      </section>

      {featuredWorks.length ? (
        <section className={`${styles.section} ${styles.compactSection}`} aria-labelledby="featured-works-title" data-testid="homepage-featured-works">
          <header className={styles.sectionHeader}>
            <div>
              <p>Featured Works</p>
              <h2 id="featured-works-title">精选作品</h2>
            </div>
            <Link className={styles.sectionLink} href="/works">查看全部 Works <span aria-hidden="true">→</span></Link>
          </header>
          <div className={styles.workGrid}>
            {featuredWorks.map((work) => {
              const entrant = getEntrantDisplay(work.registration);
              return (
                <article className={styles.workCard} key={work.id}>
                  <Link className={styles.workCoverLink} href={`/works/${work.slug}`} aria-label={`查看 ${work.title}`}>
                    <div className={styles.cover}>
                      <Image alt="" height={360} src={resolveVisualCover("work", work.slug)} width={640} />
                      {work.awards.length ? <span className={styles.awardFlag}>Award × {work.awards.length}</span> : null}
                    </div>
                  </Link>
                  <div className={styles.cardBody}>
                    <span className={styles.workMeta}>{work.registration.race.title} · {entrant.name}</span>
                    <h3><Link href={`/works/${work.slug}`}>{work.title}</Link></h3>
                    <p>{work.summary}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className={styles.resultSummary} aria-labelledby="latest-result-title" data-testid="homepage-latest-result">
        <div>
          <p className={styles.eyebrow}>Latest Results</p>
          <h2 id="latest-result-title">{latestResult?.title ?? "赛果等待发布"}</h2>
          <p>{latestResult ? "最近完成并发布 Award 的赛事结果，过程榜单仍保留在对应 Live Hall。" : "赛事完成并发布 Award 后，最新赛果会在这里形成可信的公开摘要。"}</p>
        </div>
        {latestResult ? (
          <div className={styles.awardSummary} aria-label="最新奖项摘要">
            {latestResult.awards.slice(0, 3).map((award) => (
              <span key={award.id}><strong>{award.rank ? `#${award.rank}` : "Award"}</strong>{award.awardName} · {getEntrantDisplay(award.registration).name}</span>
            ))}
          </div>
        ) : null}
        {latestResult ? (
          <div className={styles.resultActions}>
            <Link className={styles.primary} href={`/races/${latestResult.slug}/results`}>查看 Results</Link>
            <Link className={styles.secondary} href={`/races/${latestResult.slug}/review`}>查看 Review</Link>
          </div>
        ) : null}
      </section>

      <section className={styles.cooperationCta} aria-label="合作与赞助">
        <div>
          <p className={styles.eyebrow}>Cooperation</p>
          <h2>把下一场赛事、作品或社区合作带到 ARY</h2>
          <p>面向 Rider、学校、企业与社区，提供报名、办赛、赞助和联合传播入口。</p>
        </div>
        <Link className={styles.primary} href="/cooperation">了解合作方式 <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}
