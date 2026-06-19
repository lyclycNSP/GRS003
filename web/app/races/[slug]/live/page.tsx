import { notFound } from "next/navigation";
import { getRaceBySlug } from "@/lib/queries";
import { fromJson } from "@/lib/json";

type ProjectionPayload = {
  headlineMetrics?: Record<string, string | number>;
  processLeaderboard?: Array<{ rank: number; name: string; score: number; label: string }>;
  eventStream?: Array<{ time: string; text: string }>;
};

export default async function LivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const race = await getRaceBySlug(slug);
  if (!race) notFound();
  const projection = race.projections.find((item) => item.status === "stable");
  const payload = fromJson<ProjectionPayload>(projection?.payloadJson, {});
  const metrics = payload.headlineMetrics ?? race.metrics;
  return (
    <section className="route-page">
      <section className="live-header" style={{ position: "relative", inset: "auto", marginBottom: 24 }}>
        <div>
          <p className="section-kicker">Live Hall / {race.title}</p>
          <h1>{race.title} 正在骑行</h1>
        </div>
        <div className="live-score"><span>Riding Signal</span><b>{String(metrics.ridingSignal ?? 76)}%</b></div>
      </section>
      <section className="app-grid">
        <div className="app-stack">
          <section className="live-metrics" style={{ position: "relative", inset: "auto", width: "auto", gridTemplateColumns: "repeat(4,1fr)" }}>
            {Object.entries(metrics).slice(0, 4).map(([key, metric]) => (
              <article key={key}><span>{key}</span><b>{String(metric)}</b><p>Projection stable read model.</p></article>
            ))}
          </section>
          <section className="event-stream" style={{ position: "relative", inset: "auto", width: "auto" }}>
            {(payload.eventStream ?? []).map((event) => <article key={`${event.time}-${event.text}`}><b>{event.time}</b><span>{event.text}</span></article>)}
          </section>
        </div>
        <section className="leaderboard-panel" style={{ position: "relative", inset: "auto", width: "auto" }}>
          <h2>Current Process Leaderboard</h2>
          <ol>
            {(payload.processLeaderboard ?? []).map((item) => (
              <li key={item.rank}><span>{String(item.rank).padStart(2, "0")}</span><b>{item.name}</b><em>{item.score}</em></li>
            ))}
          </ol>
          <p>过程榜单用于观看，不作为最终 Results。</p>
        </section>
      </section>
    </section>
  );
}
