import Link from "next/link";
import { fromJson } from "@/lib/json";
import { getScreenSnapshot } from "@/lib/queries";

type ProjectionPayload = {
  headlineMetrics?: Record<string, unknown>;
  processLeaderboard?: Array<{ rank: number; name: string; score: number; label: string }>;
  totals?: Record<string, unknown>;
  entries?: Array<{ riderName: string; ingestion: string; workTitle?: string | null }>;
};

export default async function ScreenDisplayPage() {
  const snapshot = await getScreenSnapshot();
  if (!snapshot) return <section className="screen-display"><h1>No race seeded</h1></section>;
  const { race, works, stableProjection, screenState } = snapshot;
  const payload = fromJson<ProjectionPayload>(stableProjection?.payloadJson, {});
  const announcement = race.announcements[0];
  const mode = screenState.fallbackEnabled ? "fallback" : screenState.mode;

  return (
    <section className="screen-display">
      <header>
        <span>ARY Live Screen</span>
        <Link href="/screen">Console</Link>
      </header>
      <main>
        <p>{race.title} / {mode}</p>
        <h1>{mode === "announcement" ? announcement?.title ?? race.title : race.title}</h1>
        {mode === "live" ? (
          <div className="screen-stat-grid">
            {Object.entries(payload.headlineMetrics ?? payload.totals ?? {}).map(([key, value]) => (
              <article key={key}><span>{key}</span><b>{String(value)}</b></article>
            ))}
          </div>
        ) : null}
        {mode === "leaderboard" ? (
          <div className="screen-board-list">
            {(payload.processLeaderboard ?? []).map((entry) => <article key={entry.rank}><b>#{entry.rank}</b><span>{entry.name}</span><em>{entry.score} / {entry.label}</em></article>)}
            {(payload.entries ?? []).map((entry, index) => <article key={entry.riderName}><b>#{index + 1}</b><span>{entry.riderName}</span><em>{entry.ingestion}</em></article>)}
          </div>
        ) : null}
        {mode === "works" ? (
          <div className="screen-board-list">
            {works.map((work) => <article key={work.id}><b>{work.registration.user.displayName}</b><span>{work.title}</span><em>{work.summary}</em></article>)}
          </div>
        ) : null}
        {mode === "announcement" ? <h2>{announcement?.body ?? "暂无公告"}</h2> : null}
        {mode === "fallback" ? <h2>Fallback: stable Projection / public works / announcement ready.</h2> : null}
      </main>
    </section>
  );
}