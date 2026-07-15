import type { TrackProfile } from "../track-profile";

export interface Vector2 {
  x: number;
  y: number;
}

export interface TrackSample {
  point: Vector2;
  tangent: Vector2;
  normal: Vector2;
  s: number;
}

export interface MessageZoneAnchor {
  zoneId: string;
  centroid: Vector2;
  priority: number;
  s: number;
}

export interface NoBubbleZoneArea {
  zoneId: string;
  polygon: readonly Vector2[];
  reason?: string | undefined;
}

export interface CompiledTrack {
  profileId: string;
  version: string;
  profile: TrackProfile;
  samples: readonly TrackSample[];
  cumulativeLengths: readonly number[];
  totalLength: number;
  laneOffsets: ReadonlyMap<string, number>;
  messageZoneAnchors: readonly MessageZoneAnchor[];
  noBubbleZones: readonly NoBubbleZoneArea[];
}

export type HorseVisualState =
  | "idle"
  | "running"
  | "sprinting"
  | "blocked"
  | "pit_stop"
  | "finished"
  | "stale";

export interface HorsePose {
  entryId: string;
  x: number;
  y: number;
  rotation: number;
  s: number;
  laneId: string;
  visualState: HorseVisualState;
  zIndex: number;
}

export interface MiniMapPose {
  x: number;
  y: number;
  rotation: number;
  s: number;
}

export interface BubblePose {
  entryId: string;
  source: "fallback" | "message_zone";
  x: number;
  y: number;
  s: number;
  slot: number;
  zoneId?: string | undefined;
}

export interface HorseVisualOrientation {
  flipX: boolean;
  pitch: number;
}

export interface TrackGeometryIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  path?: string | undefined;
}

export class TrackRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackRuntimeError";
  }
}
