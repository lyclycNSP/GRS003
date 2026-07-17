export type VisualCoverType = "race" | "work" | "rider";

const fallbackCovers: Record<VisualCoverType, string> = {
  race: "/visuals/race/race-fallback.svg",
  work: "/visuals/work/work-fallback.svg",
  rider: "/visuals/rider/rider-fallback.svg"
};

const visualCovers: Record<VisualCoverType, Readonly<Record<string, string>>> = {
  race: {
    "race_bay_2026": "/visuals/race/neon-city-circuit.svg",
    "bay-area-happy-trip": "/visuals/race/neon-city-circuit.svg",
    "race_finance_2026": "/visuals/race/data-horizon-race.svg",
    "smart-investment-analyst": "/visuals/race/data-horizon-race.svg",
    "race_submission_e2e": "/visuals/race/orbit-sprint.svg",
    "submission-integrity-e2e": "/visuals/race/orbit-sprint.svg",
    "race_genesis_2026": "/visuals/race/neon-city-circuit.svg",
    "genesis-dogfood-race": "/visuals/race/neon-city-circuit.svg"
  },
  work: {
    "work-gba-wander": "/visuals/work/agent-city-console.svg",
    "work-localjoy": "/visuals/work/coastal-intelligence.svg",
    "work-genesis-mira": "/visuals/work/robotic-collaboration.svg",
    "ary-self-dogfood-agent": "/visuals/work/robotic-collaboration.svg",
    "work-finance-legacy": "/visuals/work/data-command-center.svg",
    "finance-legacy-work": "/visuals/work/data-command-center.svg"
  },
  rider: {
    "user_rider_1": "/visuals/rider/rider-orbit.svg",
    "mira-chen": "/visuals/rider/rider-orbit.svg",
    "user_rider_2": "/visuals/rider/rider-blueprint.svg",
    "ana-ruiz": "/visuals/rider/rider-blueprint.svg",
    "user_rider_e2e": "/visuals/rider/rider-blueprint.svg",
    "e2e-rider": "/visuals/rider/rider-blueprint.svg",
    "user_multi_1": "/visuals/rider/rider-orbit.svg",
    "multi-role-user": "/visuals/rider/rider-orbit.svg"
  }
};

function normalizeVisualKey(idOrSlug: string | null | undefined) {
  return idOrSlug?.trim().toLocaleLowerCase() ?? "";
}

/** Resolves a stable local cover. Unknown or empty keys always use the type fallback. */
export function resolveVisualCover(type: VisualCoverType, idOrSlug?: string | null): string {
  return visualCovers[type][normalizeVisualKey(idOrSlug)] ?? fallbackCovers[type];
}

export function getVisualCoverFallback(type: VisualCoverType): string {
  return fallbackCovers[type];
}
