import assert from "node:assert/strict";
import {
  TrackProfileValidationError,
  assertTrackProfileEditable,
  clonePublishedAsDraft,
  parseTrackBundle,
  parseTrackProfile,
  serializeTrackProfile,
  validateTrackBundle,
  validateTrackProfile
} from "../lib/track-profile";
import {
  TrackRuntimeError,
  compileTrack,
  deriveHorseVisualOrientation,
  sampleBubblePose,
  sampleHorsePose,
  sampleMiniMapPose,
  validateTrackGeometry
} from "../lib/track-runtime";
import metro from "../public/tracks/metro-raceway/1.0.0/track.profile.json";

const profile = parseTrackProfile(metro);
const track = compileTrack(profile);
const pose = sampleHorsePose({
  track,
  entryId: "entry-1",
  progress: 0.5,
  laneId: "lane-1",
  visualState: "running"
});

assert.ok(Number.isFinite(pose.x));
assert.ok(Number.isFinite(pose.y));
assert.equal(pose.entryId, "entry-1");
assert.equal(track.samples.at(-1)?.point.x, track.samples[0]?.point.x);
assert.equal(sampleMiniMapPose(track, 0.5).s, pose.s);

const duplicateLaneProfile = structuredClone(metro);
duplicateLaneProfile.lanes[1]!.offset = duplicateLaneProfile.lanes[0]!.offset;
assert.equal(validateTrackProfile(duplicateLaneProfile).valid, false);

assert.throws(() => assertTrackProfileEditable(profile), TrackProfileValidationError);
const draft = clonePublishedAsDraft(profile, "1.1.0", "2026-07-14T12:00:00.000Z");
assert.equal(draft.status, "draft");
assert.equal(parseTrackProfile(serializeTrackProfile(draft)).version, "1.1.0");

const bundle = {
  format: "dcr-track-bundle",
  version: "1.0.0",
  trackId: profile.trackId,
  trackVersion: profile.version,
  exportedAt: "2026-07-14T12:00:00.000Z",
  files: [
    { path: "track.profile.json", contentType: "application/json", content: serializeTrackProfile(profile), encoding: "utf8" },
    { path: "background.webp", contentType: "image/webp", content: "YmFja2dyb3VuZA==", encoding: "base64" }
  ]
};
assert.equal(validateTrackBundle(bundle).valid, true);
assert.equal(parseTrackBundle(bundle).background.path, "background.webp");

const degenerate = structuredClone(draft);
degenerate.centerline.points = Array.from({ length: 4 }, () => ({ x: 100, y: 100 }));
assert.throws(() => compileTrack(degenerate), TrackRuntimeError);
assert.ok(validateTrackGeometry(degenerate).some((issue) => issue.code === "PATH_TOO_SHORT"));
assert.deepEqual(deriveHorseVisualOrientation(170), { flipX: true, pitch: 10 });
assert.ok(sampleBubblePose({ track, entryId: "entry-1", progress: 0.5 }));

console.log("PASS validates, compiles and samples track runtime contracts");
