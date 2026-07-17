import { NextRequest, NextResponse } from "next/server";
import { canManageRace, getAuthContext } from "@/lib/auth";
import { assertAttachmentStoreConfigured } from "@/lib/attachment-store";
import { createUploadIntent } from "@/lib/race-problem-security";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ raceId: string }> }) {
  const { raceId } = await params; const ctx = await getAuthContext();
  if (!sameOrigin(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  if (!ctx || ctx.activeRole !== "organizer" || !canManageRace(ctx, raceId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  try { assertAttachmentStoreConfigured(ctx.userId); }
  catch { return NextResponse.json({ error: "Organizer 尚未配置自有对象存储，平台不会代为长期保存赛题" }, { status: 503 }); }
  return NextResponse.json({ token: await createUploadIntent(ctx.userId, raceId), expiresInSeconds: 600 });
}
