import { NextRequest, NextResponse } from "next/server";
import { canManageRace, getAuthContext } from "@/lib/auth";
import { getAttachmentStore, getLegacyLocalAttachmentStore } from "@/lib/attachment-store";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params; const ctx = await getAuthContext();
  const version = await prisma.raceProblemVersion.findUnique({ where: { id: versionId }, include: { race: true } });
  if (!version || version.scanStatus !== "clean" || version.disabledAt) return new NextResponse("Not Found", { status: 404 });
  const publicVersion = version.race.visibility === "public" && version.race.status !== "draft" && !!version.publishedAt;
  const organizerAccess = !!ctx && ctx.activeRole === "organizer" && canManageRace(ctx, version.raceId);
  let riderAccess = false;
  if (ctx?.activeRole === "rider" && version.race.currentProblemVersionId === version.id) {
    const [registration, draftTeam] = await Promise.all([
      prisma.registration.findFirst({
        where: {
          raceId: version.raceId,
          status: { notIn: ["rejected", "withdrawn", "cancelled"] },
          OR: [{ userId: ctx.userId }, { team: { members: { some: { userId: ctx.userId } } } }]
        },
        select: { id: true }
      }),
      prisma.team.findFirst({
        where: { raceId: version.raceId, registration: null, members: { some: { userId: ctx.userId } } },
        select: { id: true }
      })
    ]);
    riderAccess = Boolean(registration || draftTeam);
  }
  if (!publicVersion && !organizerAccess && !riderAccess) return new NextResponse("Not Found", { status: 404 });
  const safeName = version.displayName.replace(/["\\\r\n]/g, "_");
  try {
    const store = version.storageProvider === "platform_legacy"
      ? getLegacyLocalAttachmentStore()
      : getAttachmentStore(version.storageOwnerUserId ?? version.uploadedByUserId);
    const signedUrl = await store.createDownloadUrl(version.storageKey, safeName, 120);
    if (signedUrl) return NextResponse.redirect(signedUrl, { status: 307, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    const body = await store.get(version.storageKey);
    return new NextResponse(new Uint8Array(body), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="race-problem-r${version.revision}.pdf"; filename*=UTF-8''${encodeURIComponent(safeName)}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
  } catch {
    return new NextResponse("Attachment source unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
