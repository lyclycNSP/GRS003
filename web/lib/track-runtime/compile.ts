import type { Point, TrackProfile } from "../track-profile";
import {
  distance,
  polygonCentroid,
  normalize,
  sampleSmoothedSegment,
} from "./math";
import {
  TrackRuntimeError,
  type CompiledTrack,
  type MessageZoneAnchor,
  type TrackGeometryIssue,
  type TrackSample,
  type Vector2,
} from "./types";

const SAMPLES_PER_SEGMENT = 32;
const MINIMUM_PATH_LENGTH = 1;

function orderedPoints(profile: TrackProfile): Point[] {
  const points = profile.centerline.points.map((point) => ({ ...point }));
  if (profile.direction === "clockwise") {
    return points;
  }

  const [first, ...rest] = points;
  return first === undefined ? [] : [first, ...rest.reverse()];
}

function buildRawPoints(profile: TrackProfile): Vector2[] {
  const points = orderedPoints(profile);
  const rawPoints: Vector2[] = [];

  for (let segment = 0; segment < points.length; segment += 1) {
    const p0 = points[(segment - 1 + points.length) % points.length]!;
    const p1 = points[segment]!;
    const p2 = points[(segment + 1) % points.length]!;
    const p3 = points[(segment + 2) % points.length]!;

    for (let step = 0; step < SAMPLES_PER_SEGMENT; step += 1) {
      rawPoints.push(
        sampleSmoothedSegment(
          p0,
          p1,
          p2,
          p3,
          step / SAMPLES_PER_SEGMENT,
          profile.centerline.smoothing,
        ),
      );
    }
  }

  if (rawPoints[0] !== undefined) {
    rawPoints.push({ ...rawPoints[0] });
  }

  return rawPoints;
}

function buildSamples(rawPoints: readonly Vector2[]): {
  samples: TrackSample[];
  cumulativeLengths: number[];
  totalLength: number;
} {
  const uniqueCount = Math.max(rawPoints.length - 1, 0);
  const cumulativeLengths = [0];

  for (let index = 1; index < rawPoints.length; index += 1) {
    cumulativeLengths.push(
      cumulativeLengths[index - 1]! +
        distance(rawPoints[index - 1]!, rawPoints[index]!),
    );
  }

  const totalLength = cumulativeLengths.at(-1) ?? 0;
  const samples = rawPoints.map((point, index): TrackSample => {
    const uniqueIndex = index === uniqueCount ? 0 : index;
    const previous =
      rawPoints[(uniqueIndex - 1 + uniqueCount) % uniqueCount] ?? point;
    const next = rawPoints[(uniqueIndex + 1) % uniqueCount] ?? point;
    const tangent = normalize({
      x: next.x - previous.x,
      y: next.y - previous.y,
    });

    return {
      point: { ...point },
      tangent,
      normal: { x: -tangent.y, y: tangent.x },
      s: totalLength > 0 ? cumulativeLengths[index]! / totalLength : 0,
    };
  });

  return { samples, cumulativeLengths, totalLength };
}

function nearestSampleS(
  samples: readonly TrackSample[],
  point: Vector2,
): number {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestS = 0;

  for (const sample of samples) {
    const candidateDistance = distance(sample.point, point);
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      bestS = sample.s;
    }
  }

  return bestS;
}

function buildMessageZoneAnchors(
  profile: TrackProfile,
  samples: readonly TrackSample[],
): MessageZoneAnchor[] {
  return profile.messageZones.map((zone) => {
    const centroid = polygonCentroid(zone.polygon);

    return {
      zoneId: zone.zoneId,
      centroid,
      priority: zone.priority,
      s: nearestSampleS(samples, centroid),
    };
  });
}

export function validateTrackGeometry(
  profile: TrackProfile,
): TrackGeometryIssue[] {
  const issues: TrackGeometryIssue[] = [];

  profile.centerline.points.forEach((point, index) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      issues.push({
        code: "NON_FINITE_POINT",
        severity: "error",
        message: "Centerline coordinates must be finite.",
        path: `centerline.points.${index}`,
      });
    }
  });

  if (issues.some((issue) => issue.severity === "error")) {
    return issues;
  }

  const rawPoints = buildRawPoints(profile);
  const { samples, cumulativeLengths, totalLength } = buildSamples(rawPoints);

  if (totalLength < MINIMUM_PATH_LENGTH) {
    issues.push({
      code: "PATH_TOO_SHORT",
      severity: "error",
      message: "Track path length is below the minimum runtime threshold.",
      path: "centerline.points",
    });
    return issues;
  }

  const averageStep = totalLength / Math.max(samples.length - 1, 1);
  for (let index = 1; index < cumulativeLengths.length; index += 1) {
    const step =
      cumulativeLengths[index]! - cumulativeLengths[index - 1]!;
    if (step > averageStep * 5) {
      issues.push({
        code: "SAMPLE_JUMP",
        severity: "warning",
        message: "Adjacent path samples contain an unusually large jump.",
        path: `centerline.samples.${index}`,
      });
    }
  }

  for (let index = 1; index < samples.length - 1; index += 1) {
    const previous = samples[index - 1]!.tangent;
    const current = samples[index]!.tangent;
    const dot = Math.max(
      -1,
      Math.min(1, previous.x * current.x + previous.y * current.y),
    );
    const turnDegrees = (Math.acos(dot) * 180) / Math.PI;
    if (turnDegrees > 45) {
      issues.push({
        code: "HIGH_CURVATURE",
        severity: "warning",
        message: "Track curvature changes sharply at a sampled point.",
        path: `centerline.samples.${index}`,
      });
    }
  }

  for (const lane of profile.lanes) {
    const outside = samples.find((sample) => {
      const x = sample.point.x + sample.normal.x * lane.offset;
      const y = sample.point.y + sample.normal.y * lane.offset;
      return (
        x < 0 ||
        x > profile.viewBox.width ||
        y < 0 ||
        y > profile.viewBox.height
      );
    });

    if (outside !== undefined) {
      issues.push({
        code: "LANE_OUT_OF_BOUNDS",
        severity: "error",
        message: `Lane ${lane.laneId} leaves the configured viewBox.`,
        path: `lanes.${profile.lanes.indexOf(lane)}.offset`,
      });
    }
  }

  return issues;
}

export function compileTrack(profile: TrackProfile): CompiledTrack {
  const issues = validateTrackGeometry(profile);
  const errors = issues.filter((issue) => issue.severity === "error");

  if (errors.length > 0) {
    throw new TrackRuntimeError(
      `Track ${profile.trackId}@${profile.version} cannot be compiled: ${errors
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }

  const { samples, cumulativeLengths, totalLength } = buildSamples(
    buildRawPoints(profile),
  );

  return {
    profileId: profile.trackId,
    version: profile.version,
    profile,
    samples,
    cumulativeLengths,
    totalLength,
    laneOffsets: new Map(
      profile.lanes.map((lane) => [lane.laneId, lane.offset]),
    ),
    messageZoneAnchors: buildMessageZoneAnchors(profile, samples),
    noBubbleZones: profile.noBubbleZones.map((zone) => ({
      zoneId: zone.zoneId,
      polygon: zone.polygon.map((point) => ({ ...point })),
      reason: zone.reason,
    })),
  };
}
