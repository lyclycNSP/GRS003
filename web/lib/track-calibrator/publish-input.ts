import { createHash } from "node:crypto";
import { compileTrack } from "../track-runtime";
import { parseTrackProfile, validateTrackProfile, type TrackProfile } from "../track-profile";

const MAX_PROFILE_BYTES = 1024 * 1024;
const MAX_BACKGROUND_BYTES = 20 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const MIME_EXTENSIONS = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" } as const;

export class TrackPublishInputError extends Error {
  constructor(readonly field: "profile" | "background" | "geometry" | "version", message: string) {
    super(message);
    this.name = "TrackPublishInputError";
  }
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function imageDimensions(bytes: Uint8Array, mimeType: keyof typeof MIME_EXTENSIONS): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mimeType === "image/png" && bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mimeType === "image/webp" && bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X") return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
    if (chunk === "VP8 " && bytes.length >= 30) return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) { const bits = view.getUint32(21, true); return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) }; }
  }
  if (mimeType === "image/jpeg" && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      const length = view.getUint16(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      offset += 2 + length;
    }
  }
  return null;
}

export async function validateTrackPublishInput(input: { profileJson: string; background: File }) {
  const profileBytes = Buffer.byteLength(input.profileJson, "utf8");
  if (profileBytes > MAX_PROFILE_BYTES) throw new TrackPublishInputError("profile", "Profile JSON超过1 MiB");
  let profile: TrackProfile;
  try { profile = parseTrackProfile(input.profileJson); } catch { throw new TrackPublishInputError("profile", "Track Profile格式无效"); }
  if (!/^1(?:\.|$)/.test(profile.schemaVersion)) throw new TrackPublishInputError("version", "不支持的Track Profile Schema主版本");
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(profile.trackId) || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(profile.version)) throw new TrackPublishInputError("version", "trackId或version格式不安全");
  if (profile.status !== "draft" && profile.status !== "validated") throw new TrackPublishInputError("profile", "只允许发布draft或validated Profile");
  const polygonPointCount = [...profile.messageZones, ...profile.noBubbleZones].reduce((sum, zone) => sum + zone.polygon.length, 0);
  if (profile.centerline.points.length > 500 || profile.lanes.length > 32 || profile.checkpoints.length > 200 || profile.messageZones.length > 100 || profile.noBubbleZones.length > 100 || polygonPointCount > 2000) {
    throw new TrackPublishInputError("geometry", "Track几何元素数量超过安全上限");
  }
  if (input.background.size > MAX_BACKGROUND_BYTES) throw new TrackPublishInputError("background", "背景文件超过20 MiB");
  if (input.background.name.includes("..") || input.background.name.includes("/") || input.background.name.includes("\\")) throw new TrackPublishInputError("background", "背景文件名不安全");
  if (!(input.background.type in MIME_EXTENSIONS)) throw new TrackPublishInputError("background", "背景只允许WebP、PNG或JPEG");
  const mimeType = input.background.type as keyof typeof MIME_EXTENSIONS;
  const bytes = new Uint8Array(await input.background.arrayBuffer());
  const dimensions = imageDimensions(bytes, mimeType);
  if (!dimensions) throw new TrackPublishInputError("background", "背景文件内容与MIME不匹配");
  if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) throw new TrackPublishInputError("background", "背景尺寸超过4096");
  if (dimensions.width !== profile.background.width || dimensions.height !== profile.background.height) throw new TrackPublishInputError("background", "背景尺寸与Profile不一致");
  const backgroundHash = sha256(bytes);
  if (profile.background.checksum !== backgroundHash) throw new TrackPublishInputError("background", "背景checksum校验失败");
  const report = validateTrackProfile(profile);
  if (!report.valid) throw new TrackPublishInputError("geometry", "Track几何校验失败");
  try { compileTrack(profile); } catch { throw new TrackPublishInputError("geometry", "Track运行时几何编译失败"); }
  return { profile, bytes, backgroundHash, extension: MIME_EXTENSIONS[mimeType], validationReport: report };
}
