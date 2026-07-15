import assert from "node:assert/strict";
import metroProfile from "../public/tracks/metro-raceway/1.0.0/track.profile.json" with { type: "json" };
import { parseTrackProfile } from "../lib/track-profile";
import {
  createEditorHistory,
  pushEditorChange,
  redoEditorChange,
  reverseTrackDirection,
  undoEditorChange,
} from "../lib/track-calibrator/editor-history";
import { buildPreviewModel } from "../lib/track-calibrator/preview";

const published = parseTrackProfile(metroProfile);
const profile = parseTrackProfile({ ...published, status: "draft", publishedAt: undefined });
const history = createEditorHistory(profile);
const changed = pushEditorChange(history, { ...profile, direction: "counterclockwise" });
const undone = undoEditorChange(changed);
assert.equal(undone.present.direction, profile.direction);
assert.equal(redoEditorChange(undone).present.direction, "counterclockwise");

const reversed = reverseTrackDirection(profile);
assert.deepEqual(reversed.centerline.points[0], profile.centerline.points.at(-1));
assert.equal(reversed.direction, "counterclockwise");
assert.equal(reversed.startFinish.s, 1 - profile.startFinish.s);

const preview = buildPreviewModel({
  horseCount: 8,
  profile,
  progress: 0.5,
  scenario: "clustered",
  visualState: "running",
});
assert.equal(preview.error, null);
assert.equal(preview.entries.length, 8);
assert.equal(preview.entries.filter((entry) => entry.miniMapPose).length, 8);

console.log("PASS supports deterministic Calibrator editing and preview");
