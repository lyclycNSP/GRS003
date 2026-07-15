import type {
  AryRaceLiveEntrySnapshot,
  AryRaceLiveSnapshot,
  GlobalRankingItem,
  RaceLiveAttentionSnapshot,
  RaceLiveMessageSnapshot,
} from "./contracts";

export type RaceLivePresentation = {
  groupOrder: number;
  groupCount: number;
  entryIds: Set<string>;
  entries: AryRaceLiveEntrySnapshot[];
  top3: GlobalRankingItem[];
  bubbles: RaceLiveMessageSnapshot[];
  attentionItems: RaceLiveAttentionSnapshot[];
  providerShare: { codex: number; claude: number; other: number };
  elapsedSeconds: number;
};

const severityOrder: Record<RaceLiveAttentionSnapshot["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function parseRaceLiveInitialNow(initialNow: string): Date {
  const parsed = new Date(initialNow);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Race Live initialNow is invalid");
  return parsed;
}

function calculateProviderShare(entries: AryRaceLiveEntrySnapshot[]) {
  const counts = { codex: 0, claude: 0, other: 0 };
  for (const entry of entries) {
    for (const provider of entry.agentProviders) counts[provider] += 1;
  }
  const total = counts.codex + counts.claude + counts.other;
  if (total === 0) return counts;
  const codex = Math.round(counts.codex / total * 100);
  const claude = Math.round(counts.claude / total * 100);
  return { codex, claude, other: 100 - codex - claude };
}

export function buildRaceLivePresentation(
  snapshot: AryRaceLiveSnapshot,
  activeGroupOrder: number,
  now: Date,
): RaceLivePresentation {
  const group = snapshot.displayGroups.find((item) => item.order === activeGroupOrder)
    ?? snapshot.displayGroups[0];
  const entryIds = new Set(group?.entryIds ?? []);
  const entries = snapshot.entries.filter((entry) => entryIds.has(entry.entryId)).slice(0, 8);
  const visibleEntryIds = new Set(entries.map((entry) => entry.entryId));
  const generatedAtMs = new Date(snapshot.generatedAt).getTime();
  const nowMs = Math.min(now.getTime(), generatedAtMs + snapshot.runtimeConfig.staleThresholdSeconds * 1000);
  const bubbles = snapshot.ridingMessages
    .filter((message) => message.displayMode === "bubble" && visibleEntryIds.has(message.entryId))
    .filter((message) => message.expiresAt === undefined || new Date(message.expiresAt).getTime() > nowMs)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, snapshot.runtimeConfig.maxVisibleBubbles);
  const attentionItems = snapshot.attentionItems
    .filter((item) => item.status === "open" && visibleEntryIds.has(item.entryId))
    .sort((left, right) => severityOrder[right.severity] - severityOrder[left.severity]
      || right.updatedAt.localeCompare(left.updatedAt));
  const startedAt = snapshot.round.actualStartedAt ?? snapshot.round.scheduledStartAt;
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 1000));

  return {
    groupOrder: group?.order ?? 1,
    groupCount: snapshot.displayGroups.length,
    entryIds: visibleEntryIds,
    entries,
    top3: snapshot.globalRanking.slice(0, 3),
    bubbles,
    attentionItems,
    providerShare: calculateProviderShare(entries),
    elapsedSeconds,
  };
}
