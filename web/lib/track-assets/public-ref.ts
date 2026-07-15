export function isPublishedTrackAssetRef(input: {
  trackId: string;
  version: string;
  fileName: string;
  checksum: string;
  backgroundHash?: string | null;
  backgroundAssetRef: string;
}): boolean {
  const legacyRef = `/tracks/${input.trackId}/${input.version}/${input.fileName}`;
  if (input.backgroundAssetRef === legacyRef) return true;
  const hash = (input.backgroundHash ?? input.checksum).replace(/^sha256:/, "");
  return new RegExp(`^/track-assets/${input.trackId}/${input.version}/${hash}\\.(?:webp|png|jpg)$`).test(input.backgroundAssetRef);
}
