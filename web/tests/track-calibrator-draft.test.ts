import assert from "node:assert/strict";
import metroProfile from "../public/tracks/metro-raceway/1.0.0/track.profile.json" with { type: "json" };
import { parseCalibratorDraft, serializeCalibratorDraft } from "../lib/track-calibrator/draft-types";

const draft = parseCalibratorDraft({
  draftId: "draft_test",
  raceId: "race_bay_2026",
  profile: { ...metroProfile, version: "1.1.0", status: "draft", publishedAt: undefined },
  backgroundAssetId: metroProfile.background.assetId,
  validationReport: null,
  savedAt: "2026-07-14T12:00:00.000Z"
});
assert.equal(parseCalibratorDraft(serializeCalibratorDraft(draft)).profile.trackId, "metro-raceway");
assert.throws(() => parseCalibratorDraft({ ...draft, extra: true }));
console.log("PASS serializes strict local Track Calibrator drafts");
