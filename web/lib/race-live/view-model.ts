import type { AryRaceLiveSnapshot } from "./contracts";

export function RaceLiveViewModelMapper(snapshot: AryRaceLiveSnapshot, activeGroupOrder: number) {
  const group = snapshot.displayGroups.find((item) => item.order === activeGroupOrder) ?? snapshot.displayGroups[0];
  const entryIds = new Set(group?.entryIds ?? []);
  return {
    group,
    entries: snapshot.entries.filter((entry) => entryIds.has(entry.entryId)),
    top3: snapshot.globalRanking.slice(0, 3)
  };
}
