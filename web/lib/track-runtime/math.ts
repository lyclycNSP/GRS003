import type { Point } from "../track-profile";
import type { Vector2 } from "./types";

export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function normalize(vector: Vector2): Vector2 {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= Number.EPSILON) {
    return { x: 1, y: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

export function interpolate(
  start: Vector2,
  end: Vector2,
  amount: number,
): Vector2 {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
  };
}

export function wrapUnit(value: number): number {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

export function polygonCentroid(points: readonly Point[]): Vector2 {
  const totals = points.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x,
      y: accumulator.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: totals.x / Math.max(points.length, 1),
    y: totals.y / Math.max(points.length, 1),
  };
}

export function pointInPolygon(
  point: Vector2,
  polygon: readonly Vector2[],
): boolean {
  let inside = false;

  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          ((previous.y - current.y) || Number.EPSILON) +
          current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function catmullRomCoordinate(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export function sampleSmoothedSegment(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
  smoothing: number,
): Vector2 {
  const curve = {
    x: catmullRomCoordinate(p0.x, p1.x, p2.x, p3.x, t),
    y: catmullRomCoordinate(p0.y, p1.y, p2.y, p3.y, t),
  };
  const linear = interpolate(p1, p2, t);

  return interpolate(linear, curve, smoothing);
}
