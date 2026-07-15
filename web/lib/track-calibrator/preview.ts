import { compileTrack, sampleBubblePose, sampleHorsePose, sampleMiniMapPose, type BubblePose, type HorsePose, type HorseVisualState, type MiniMapPose } from "../track-runtime";
import type { TrackProfile } from "../track-profile";

export type PreviewScenario = "uniform" | "clustered" | "start_cluster" | "finish_sprint";

export interface PreviewEntry {
  entryId: string;
  laneId: string;
  pose: HorsePose;
  miniMapPose: MiniMapPose;
}

export interface PreviewModel {
  entries: PreviewEntry[];
  bubbles: BubblePose[];
  error: string | null;
}

function laneProgresses(progress: number, horseCount: number, scenario: PreviewScenario) {
  if (horseCount <= 1) return [progress];
  switch (scenario) {
    case "uniform": return Array.from({ length: horseCount }, (_, index) => Math.max(0, Math.min(1, progress - index / horseCount * 0.7)));
    case "clustered": return Array.from({ length: horseCount }, (_, index) => Math.max(0, Math.min(1, progress - index * 0.015)));
    case "start_cluster": return Array.from({ length: horseCount }, (_, index) => 0.02 + index * 0.007);
    case "finish_sprint": return Array.from({ length: horseCount }, (_, index) => Math.max(0, Math.min(1, 0.96 - index * 0.02)));
  }
}

export function buildPreviewModel(input: { profile: TrackProfile; horseCount: number; progress: number; scenario?: PreviewScenario; visualState: HorseVisualState }): PreviewModel {
  try {
    const track = compileTrack(input.profile);
    const lanes = input.profile.lanes.slice(0, Math.max(1, input.horseCount));
    const progresses = laneProgresses(input.progress, lanes.length, input.scenario ?? "clustered");
    const entries = lanes.map((lane, index) => {
      const entryId = `preview-entry-${index + 1}`;
      const progress = progresses[index] ?? input.progress;
      return {
        entryId,
        laneId: lane.laneId,
        pose: sampleHorsePose({ track, entryId, progress, laneId: lane.laneId, visualState: input.visualState }),
        miniMapPose: sampleMiniMapPose(track, progress),
      };
    });
    return {
      entries,
      bubbles: entries.flatMap((entry, index) => {
        const bubble = sampleBubblePose({ track, entryId: entry.entryId, progress: entry.pose.s, slot: index });
        return bubble ? [bubble] : [];
      }),
      error: null,
    };
  } catch (error) {
    return { entries: [], bubbles: [], error: error instanceof Error ? error.message : "Preview is unavailable." };
  }
}
