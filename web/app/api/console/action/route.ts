import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { rebuildProjection, runP0Regression } from "@/lib/domain";

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  const body = await request.json() as { action: string; raceId: string };
  if (body.action === "rebuildProjection") return NextResponse.json(await rebuildProjection(ctx, body.raceId));
  if (body.action === "runP0") return NextResponse.json(await runP0Regression(ctx, body.raceId));
  return NextResponse.json({ ok: false, message: "unknown action" }, { status: 400 });
}
