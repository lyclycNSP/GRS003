import { notFound } from "next/navigation";
import { EmptyState, PageHeader, StatRail, StatusBadge } from "@/app/components/ui";
import { fromJson } from "@/lib/json";
import { getRaceBySlug } from "@/lib/queries";
import styles from "../../PublicRace.module.css";
import { RacePublicNavigation } from "../RacePublicNavigation";

type ProjectionPayload = {
  headlineMetrics?: Record<string, string | number>;
  processLeaderboard?: Array<{ rank: number; name: string; score: number; label: string }>;
  eventStream?: Array<{ time: string; text: string }>;
};

const metricLabels: Record<string, string> = {
  riders: "Riders",
  activeRiders: "活跃 Rider",
  submittedWorks: "提交 Works",
  ridingSignal: "Riding Signal",
  risks: "风险信号",
  cost: "成本"
};

export default async function LivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const race = await getRaceBySlug(slug);
  if (!race) notFound();
  const projection = race.projections.find((item) => item.status === "stable");
  const payload = fromJson<ProjectionPayload>(projection?.payloadJson, {});
  const metrics = payload.headlineMetrics ?? race.metrics;
  const metricEntries = Object.entries(metrics).slice(0, 4);
  const events = payload.eventStream ?? [];
  const leaderboard = payload.processLeaderboard ?? [];

  return (
    <main className={styles.page}>
      <RacePublicNavigation active="live" slug={race.slug} title={race.title} />
      <PageHeader
        actions={<StatusBadge dot tone={projection ? "success" : "warning"}>{projection ? "Projection stable" : "暂无稳定 Projection"}</StatusBadge>}
        breadcrumbs={[{ label: "赛事中心", href: "/" }, { label: race.title, href: `/races/${race.slug}` }, { label: "Live Hall" }]}
        description="观看当前赛况、过程指标和事件流。过程榜单用于现场观察，不作为最终 Results。"
        eyebrow="Live Hall"
        title={`${race.title} · 实况`}
      />

      {metricEntries.length ? <StatRail aria-label="实时指标" items={metricEntries.map(([key, metric]) => ({
        label: metricLabels[key] ?? key,
        value: String(metric),
        hint: "当前 Projection",
      }))} /> : null}

      <section className={styles.liveLayout}>
        <div className={styles.liveStack}>
          <section className={styles.livePanel} aria-labelledby="event-stream-title">
            <span className={styles.miniLabel}>Event Stream</span>
            <h2 id="event-stream-title">赛事动态</h2>
            <p>按公开 Projection 展示当前 Race 的过程事件。</p>
            {events.length ? (
              <div className={styles.streamList}>
                {events.map((event) => (
                  <article className={styles.streamItem} key={`${event.time}-${event.text}`}>
                    <strong>{event.time}</strong><span>{event.text}</span>
                  </article>
                ))}
              </div>
            ) : <div className={styles.empty}>当前没有公开的过程事件。</div>}
          </section>
        </div>
        <section className={styles.leaderboard} aria-labelledby="process-board-title">
          <span className={styles.miniLabel}>Process Leaderboard</span>
          <h2 id="process-board-title">过程榜单</h2>
          <p>仅用于观看实时赛况，最终名次以发布后的 Award 和 Results 为准。</p>
          {leaderboard.length ? (
            <ol>
              {leaderboard.map((item) => (
                <li key={`${item.rank}-${item.name}`}><span>{String(item.rank).padStart(2, "0")}</span><b>{item.name}</b><em>{item.score}</em></li>
              ))}
            </ol>
          ) : <EmptyState title="暂无过程榜单" description="稳定 Projection 发布过程排名后会在这里显示。" />}
        </section>
      </section>
    </main>
  );
}
