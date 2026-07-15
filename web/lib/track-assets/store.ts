export type TrackAssetExtension = "webp" | "png" | "jpg";

export type StagedTrackAsset = {
  publishRequestId: string;
  stagedPath: string;
  extension: TrackAssetExtension;
  finalizedPath?: string;
};

export interface TrackAssetStore {
  stage(input: { publishRequestId: string; bytes: Uint8Array; extension: TrackAssetExtension }): Promise<StagedTrackAsset>;
  finalize(staged: StagedTrackAsset, key: string): Promise<{ assetRef: string }>;
  discard(staged: StagedTrackAsset): Promise<void>;
}
