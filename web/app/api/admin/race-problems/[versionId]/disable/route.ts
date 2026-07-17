import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  if (request.headers.get("origin") !== new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const ctx = await getAuthContext(); if (!ctx || ctx.activeRole !== "admin") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const { versionId } = await params; const body = await request.json().catch(() => ({})) as { reason?: string }; const reason = body.reason?.trim().slice(0, 500);
  if (!reason) return NextResponse.json({ error: "必须填写安全停用原因" }, { status: 400 });
  const version = await prisma.raceProblemVersion.findUnique({ where: { id: versionId } }); if (!version) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.raceProblemVersion.update({ where: { id: versionId }, data: { scanStatus: "disabled", disabledAt: new Date(), disabledReason: reason } });
    await tx.race.updateMany({ where: { id: version.raceId, currentProblemVersionId: versionId }, data: { currentProblemVersionId: null } });
    await tx.raceProblemAuditEvent.create({ data: { id: `problem_audit_${randomUUID()}`, raceId: version.raceId, problemVersionId: versionId, actorUserId: ctx.userId, action: "security_disabled", detailJson: JSON.stringify({ reason }) } });
  });
  return NextResponse.json({ ok: true });
}
