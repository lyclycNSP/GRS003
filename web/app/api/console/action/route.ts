import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { markReleaseChecklistItem, rebuildProjection, runP0Regression, switchScreenMode, toggleScreenFallback } from "@/lib/domain";

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  const body = await request.json() as { action: string; raceId: string; mode?: string; enabled?: boolean; itemKey?: string; label?: string; status?: string; evidence?: string };
  if (body.action === "rebuildProjection") return NextResponse.json(await rebuildProjection(ctx, body.raceId));
  if (body.action === "runP0") return NextResponse.json(await runP0Regression(ctx, body.raceId));
  if (body.action === "switchScreenMode") return NextResponse.json(await switchScreenMode(ctx, body.raceId, body.mode ?? "live"));
  if (body.action === "toggleScreenFallback") return NextResponse.json(await toggleScreenFallback(ctx, body.raceId, Boolean(body.enabled)));
  if (body.action === "markReleaseChecklistItem") return NextResponse.json(await markReleaseChecklistItem(ctx, { raceId: body.raceId, itemKey: body.itemKey ?? "manual", label: body.label, status: body.status, evidence: body.evidence ?? "api evidence" }));
  return NextResponse.json({ ok: false, message: "unknown action" }, { status: 400 });
}
