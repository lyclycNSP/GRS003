import type { TrackProfile } from "../track-profile";

export interface EditorHistory<T> {
  past: T[];
  present: T;
  future: T[];
}

function invertNormalizedPosition(value: number) {
  if (value === 0) return 0;
  const inverted = (1 - value) % 1;
  return inverted < 0 ? inverted + 1 : inverted;
}

export function createEditorHistory<T>(present: T): EditorHistory<T> {
  return { past: [], present, future: [] };
}

export function pushEditorChange<T>(history: EditorHistory<T>, present: T, limit = 50): EditorHistory<T> {
  const past = [...history.past, history.present];
  return { past: past.slice(Math.max(0, past.length - limit)), present, future: [] };
}

export function undoEditorChange<T>(history: EditorHistory<T>): EditorHistory<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redoEditorChange<T>(history: EditorHistory<T>): EditorHistory<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
}

export function reverseTrackDirection(profile: TrackProfile): TrackProfile {
  return {
    ...profile,
    direction: profile.direction === "clockwise" ? "counterclockwise" : "clockwise",
    centerline: { ...profile.centerline, points: [...profile.centerline.points].reverse() },
    startFinish: { ...profile.startFinish, s: invertNormalizedPosition(profile.startFinish.s) },
    checkpoints: profile.checkpoints.map((checkpoint) => ({ ...checkpoint, s: invertNormalizedPosition(checkpoint.s) })),
  };
}
