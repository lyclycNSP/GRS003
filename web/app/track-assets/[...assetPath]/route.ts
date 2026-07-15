import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const CONTENT_TYPES: Record<string, string> = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" };

export async function GET(_request: Request, { params }: { params: Promise<{ assetPath: string[] }> }) {
  const root = path.resolve(process.env.TRACK_ASSET_ROOT ?? path.join(process.cwd(), ".data", "track-assets"));
  const segments = (await params).assetPath;
  if (!segments.length || segments.some((segment) => !/^[a-zA-Z0-9._-]+$/.test(segment) || segment === ".." || segment.startsWith("."))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const filePath = path.resolve(root, ...segments);
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];
  if (!contentType) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const [resolvedRoot, resolvedFile] = await Promise.all([realpath(root), realpath(filePath)]);
    const realRelative = path.relative(resolvedRoot, resolvedFile);
    if (!realRelative || realRelative.startsWith("..") || path.isAbsolute(realRelative)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const bytes = await readFile(resolvedFile);
    return new NextResponse(bytes, { headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" } });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
