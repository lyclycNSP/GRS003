import type { GlobalRankingItem } from "@/lib/race-live/contracts";

export function RaceLiveTopThree({ items }: { items: GlobalRankingItem[] }) {
  return <section className="race-live-top3" data-testid="race-live-top3">
    <div className="race-live-section-label"><small>当前 Round</small><b>实时 TOP 3</b></div>
    {items.map((entry) => <article key={entry.entryId}>
      <strong>#{entry.rank}</strong><span>{entry.entrantDisplayName}</span><em>{Math.round(entry.roundProgress * 100)}%</em>
    </article>)}
  </section>;
}
