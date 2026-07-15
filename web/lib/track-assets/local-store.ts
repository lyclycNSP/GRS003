import { constants } from "node:fs";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { StagedTrackAsset, TrackAssetStore } from "./store";

function within(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export class LocalTrackAssetStore implements TrackAssetStore {
  readonly root: string;

  constructor(root = process.env.TRACK_ASSET_ROOT ?? path.join(process.cwd(), ".data", "track-assets")) {
    this.root = path.resolve(root);
  }

  async stage(input: { publishRequestId: string; bytes: Uint8Array; extension: "webp" | "png" | "jpg" }): Promise<StagedTrackAsset> {
    const stageRoot = path.join(this.root, ".staging");
    await mkdir(stageRoot, { recursive: true });
    const stagedPath = path.join(stageRoot, `${randomUUID()}.${input.extension}`);
    if (!within(this.root, stagedPath)) throw new Error("Invalid asset staging path");
    await writeFile(stagedPath, input.bytes, { flag: "wx" });
    return { publishRequestId: input.publishRequestId, stagedPath, extension: input.extension };
  }

  async finalize(staged: StagedTrackAsset, key: string): Promise<{ assetRef: string }> {
    if (!/^[a-zA-Z0-9._/-]+$/.test(key) || key.includes("..")) throw new Error("Invalid asset key");
    const finalPath = path.resolve(this.root, key);
    if (!within(this.root, finalPath)) throw new Error("Invalid asset destination");
    await mkdir(path.dirname(finalPath), { recursive: true });
    try {
      await copyFile(staged.stagedPath, finalPath, constants.COPYFILE_EXCL);
      staged.finalizedPath = finalPath;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
    } finally {
      await rm(staged.stagedPath, { force: true });
    }
    return { assetRef: `/track-assets/${key.replaceAll("\\", "/")}` };
  }

  async discard(staged: StagedTrackAsset): Promise<void> {
    // A finalized content-addressed object may already be referenced by a concurrent
    // winner. Never delete it in request-local compensation; orphan GC must prove
    // that no TrackProfileVersion references the asset first.
    if (within(this.root, path.resolve(staged.stagedPath))) await rm(staged.stagedPath, { force: true });
  }
}
