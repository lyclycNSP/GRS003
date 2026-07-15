import type { ScreenDisplayGroup } from "./contracts";

export interface GroupableRaceEntry {
  entryId: string;
  displayOrder: number;
}

export interface GroupLaneAssignment {
  entryId: string;
  laneId: `lane-${number}`;
}

export function createScreenDisplayGroups(
  roundId: string,
  entries: readonly GroupableRaceEntry[]
): ScreenDisplayGroup[] {
  const ordered = [...entries].sort(
    (left, right) => left.displayOrder - right.displayOrder || left.entryId.localeCompare(right.entryId)
  );
  const groups: ScreenDisplayGroup[] = [];

  for (let index = 0; index < ordered.length; index += 8) {
    const order = groups.length + 1;
    groups.push({
      groupId: `${roundId}:group:${order}`,
      order,
      entryIds: ordered.slice(index, index + 8).map((entry) => entry.entryId)
    });
  }

  return groups;
}

export function assignGroupLanes(group: ScreenDisplayGroup): GroupLaneAssignment[] {
  return group.entryIds.map((entryId, index) => ({
    entryId,
    laneId: `lane-${index + 1}`
  }));
}
