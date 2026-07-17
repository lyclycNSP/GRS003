import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { canManageRace, getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ raceId: string; versionId: string }> }) {
  const { raceId, versionId } = await params; const ctx = await getAuthContext();
  if (request.headers.get("origin") !== new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  if (!ctx || ctx.activeRole !== "organizer" || !canManageRace(ctx, raceId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const version = await prisma.raceProblemVersion.findFirst({ where: { id: versionId, raceId } });
  if (!version || version.scanStatus !== "clean" || version.disabledAt) return NextResponse.json({ error: "该修订尚未通过安全检查" }, { status: 409 });
  await prisma.$transaction([
    prisma.race.update({ where: { id: raceId }, data: { currentProblemVersionId: versionId } }),
    prisma.raceProblemVersion.update({ where: { id: versionId }, data: { publishedAt: version.publishedAt ?? new Date() } }),
    prisma.raceProblemAuditEvent.create({ data: { id: `problem_audit_${randomUUID()}`, raceId, problemVersionId: versionId, actorUserId: ctx.userId, action: "revision_published" } })
  ]);
  return NextResponse.json({ ok: true });
}
