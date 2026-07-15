import { interpolate, normalize, pointInPolygon, wrapUnit } from "./math";
import {
  type BubblePose,
  TrackRuntimeError,
  type CompiledTrack,
  type HorsePose,
  type HorseVisualOrientation,
  type HorseVisualState,
  type MiniMapPose,
  type TrackSample,
} from "./types";

interface SampledPathPose {
  point: { x: number; y: number };
  tangent: { x: number; y: number };
  normal: { x: number; y: number };
}

const MAX_MESSAGE_ZONE_DISTANCE = 0.18;
const BUBBLE_MARGIN_X = 160;
const BUBBLE_MARGIN_Y = 80;
const BUBBLE_SLOT_SPREAD = 18;
const FALLBACK_OFFSETS = [-150, 150, -220, 220, -290, 290];

function lowerBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle]! < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function sampleAtPathS(track: CompiledTrack, pathS: number): SampledPathPose {
  const targetLength = wrapUnit(pathS) * track.totalLength;
  const upperIndex = Math.max(
    1,
    lowerBound(track.cumulativeLengths, targetLength),
  );
  const lowerIndex = upperIndex - 1;
  const lowerLength = track.cumulativeLengths[lowerIndex]!;
  const upperLength = track.cumulativeLengths[upperIndex]!;
  const span = upperLength - lowerLength;
  const amount = span > 0 ? (targetLength - lowerLength) / span : 0;
  const lower = track.samples[lowerIndex] as TrackSample;
  const upper = track.samples[upperIndex] as TrackSample;
  const tangent = normalize(interpolate(lower.tangent, upper.tangent, amount));

  return {
    point: interpolate(lower.point, upper.point, amount),
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
  };
}

function displayPathS(track: CompiledTrack, progress: number): number {
  const normalizedProgress = Math.max(0, Math.min(1, progress));
  let displayAdjustment = 0;

  if (normalizedProgress === 0) {
    displayAdjustment = track.profile.startFinish.startDisplayOffset;
  } else if (normalizedProgress === 1) {
    displayAdjustment = track.profile.startFinish.finishDisplayOffset;
  }

  return wrapUnit(
    track.profile.startFinish.s + normalizedProgress + displayAdjustment,
  );
}

function circularDistance(left: number, right: number): number {
  const direct = Math.abs(left - right);
  return Math.min(direct, 1 - direct);
}

function clampBubblePoint(
  track: CompiledTrack,
  point: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: Math.min(
      track.profile.viewBox.width - BUBBLE_MARGIN_X,
      Math.max(BUBBLE_MARGIN_X, point.x),
    ),
    y: Math.min(
      track.profile.viewBox.height - BUBBLE_MARGIN_Y,
      Math.max(BUBBLE_MARGIN_Y, point.y),
    ),
  };
}

function isInsideNoBubbleZone(track: CompiledTrack, point: { x: number; y: number }): boolean {
  return track.noBubbleZones.some((zone) => pointInPolygon(point, zone.polygon));
}

function sampleFallbackBubblePoint(input: {
  track: CompiledTrack;
  progress: number;
  slot: number;
}): { x: number; y: number } | null {
  const sampled = sampleAtPathS(
    input.track,
    displayPathS(input.track, input.progress),
  );

  for (const offset of FALLBACK_OFFSETS) {
    const candidate = clampBubblePoint(input.track, {
      x:
        sampled.point.x +
        sampled.normal.x * offset +
        sampled.tangent.x * input.slot * BUBBLE_SLOT_SPREAD,
      y:
        sampled.point.y +
        sampled.normal.y * offset +
        sampled.tangent.y * input.slot * BUBBLE_SLOT_SPREAD,
    });

    if (!isInsideNoBubbleZone(input.track, candidate)) {
      return candidate;
    }
  }

  return null;
}

export function deriveHorseVisualOrientation(
  tangentRotation: number,
): HorseVisualOrientation {
  const normalized = ((tangentRotation + 180) % 360 + 360) % 360 - 180;
  const flipX = Math.abs(normalized) > 90;
  const visualAngle = flipX
    ? Math.sign(normalized) * (180 - Math.abs(normalized))
    : normalized;

  return {
    flipX,
    pitch: Math.max(-15, Math.min(15, visualAngle)),
  };
}

export function sampleHorsePose(input: {
  track: CompiledTrack;
  entryId: string;
  progress: number;
  laneId: string;
  visualState: HorseVisualState;
}): HorsePose {
  const laneOffset = input.track.laneOffsets.get(input.laneId);
  if (laneOffset === undefined) {
    throw new TrackRuntimeError(`Lane ${input.laneId} does not exist.`);
  }

  if (!Number.isFinite(input.progress)) {
    throw new TrackRuntimeError("Progress must be a finite number.");
  }

  const progress = Math.max(0, Math.min(1, input.progress));
  const sampled = sampleAtPathS(input.track, displayPathS(input.track, progress));
  const x = sampled.point.x + sampled.normal.x * laneOffset;
  const y = sampled.point.y + sampled.normal.y * laneOffset;

  return {
    entryId: input.entryId,
    x,
    y,
    rotation: (Math.atan2(sampled.tangent.y, sampled.tangent.x) * 180) / Math.PI,
    s: progress,
    laneId: input.laneId,
    visualState: input.visualState,
    zIndex: Math.round(y * 100),
  };
}

export function sampleMiniMapPose(
  track: CompiledTrack,
  progress: number,
): MiniMapPose {
  if (!Number.isFinite(progress)) {
    throw new TrackRuntimeError("Progress must be a finite number.");
  }

  const normalizedProgress = Math.max(0, Math.min(1, progress));
  const sampled = sampleAtPathS(
    track,
    displayPathS(track, normalizedProgress),
  );

  return {
    x: sampled.point.x,
    y: sampled.point.y,
    rotation: (Math.atan2(sampled.tangent.y, sampled.tangent.x) * 180) / Math.PI,
    s: normalizedProgress,
  };
}

export function sampleBubblePose(input: {
  track: CompiledTrack;
  entryId: string;
  progress: number;
  slot?: number;
}): BubblePose | null {
  if (!Number.isFinite(input.progress)) {
    throw new TrackRuntimeError("Progress must be a finite number.");
  }

  const progress = Math.max(0, Math.min(1, input.progress));
  const pathS = displayPathS(input.track, progress);
  const slot = Math.max(0, input.slot ?? 0);
  const zoneAnchor = [...input.track.messageZoneAnchors]
    .filter((anchor) => !isInsideNoBubbleZone(input.track, anchor.centroid))
    .sort(
      (left, right) =>
        circularDistance(pathS, left.s) - circularDistance(pathS, right.s) ||
        right.priority - left.priority,
    )[0];

  if (
    zoneAnchor !== undefined &&
    circularDistance(pathS, zoneAnchor.s) <= MAX_MESSAGE_ZONE_DISTANCE
  ) {
    const point = clampBubblePoint(input.track, {
      x: zoneAnchor.centroid.x,
      y: zoneAnchor.centroid.y + slot * BUBBLE_SLOT_SPREAD,
    });

    return {
      entryId: input.entryId,
      source: "message_zone",
      s: progress,
      slot,
      x: point.x,
      y: point.y,
      zoneId: zoneAnchor.zoneId,
    };
  }

  const fallbackPoint = sampleFallbackBubblePoint({
    progress,
    slot,
    track: input.track,
  });

  if (fallbackPoint === null) {
    return null;
  }

  return {
    entryId: input.entryId,
    source: "fallback",
    s: progress,
    slot,
    x: fallbackPoint.x,
    y: fallbackPoint.y,
  };
}
