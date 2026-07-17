import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { canManageRace, getAuthContext } from "@/lib/auth";
import { getAttachmentStore } from "@/lib/attachment-store";
import { prisma } from "@/lib/prisma";
import { allowProblemUpload, consumeUploadIntent, inspectPdf, MAX_RACE_PROBLEM_BYTES, sanitizePdfDisplayName, scanPdf } from "@/lib/race-problem-security";

async function readLimited(request: NextRequest): Promise<Buffer | null> {
  if (!request.body) return null;
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > MAX_RACE_PROBLEM_BYTES) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ raceId: string }> }) {
  const { raceId } = await params; const ctx = await getAuthContext(); const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin) return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  if (!ctx || ctx.activeRole !== "organizer" || !canManageRace(ctx, raceId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const token = request.headers.get("x-upload-token") ?? "";
  if (!await consumeUploadIntent(token, ctx.userId, raceId)) return NextResponse.json({ error: "上传令牌无效或已过期" }, { status: 403 });
  if (!allowProblemUpload(ctx.userId)) return NextResponse.json({ error: "上传过于频繁，请稍后重试" }, { status: 429 });
  if (request.headers.get("content-type")?.split(";", 1)[0].toLowerCase() !== "application/pdf") return NextResponse.json({ error: "仅接受 application/pdf" }, { status: 415 });
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_RACE_PROBLEM_BYTES) return NextResponse.json({ error: "PDF 不能超过 10 MiB" }, { status: 413 });
  let rawName = request.headers.get("x-file-name") ?? ""; try { rawName = decodeURIComponent(rawName); } catch { return NextResponse.json({ error: "PDF 文件名编码无效" }, { status: 400 }); }
  const displayName = sanitizePdfDisplayName(rawName);
  if (!displayName) return NextResponse.json({ error: "PDF 文件名无效" }, { status: 400 });
  const buffer = await readLimited(request); if (!buffer) return NextResponse.json({ error: "PDF 为空或超过 10 MiB" }, { status: 413 });
  const inspection = await inspectPdf(buffer); if (!inspection.ok) return NextResponse.json({ error: inspection.reason }, { status: 400 });
  const race = await prisma.race.findUnique({ where: { id: raceId }, select: { id: true, status: true, currentProblemVersionId: true } });
  if (!race) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  let rawChangeNote = request.headers.get("x-change-note") ?? "";
  try { rawChangeNote = decodeURIComponent(rawChangeNote); } catch { return NextResponse.json({ error: "修改说明编码无效" }, { status: 400 }); }
  const changeNote = rawChangeNote.trim().slice(0, 500);
  if (race.status !== "draft" && !changeNote) return NextResponse.json({ error: "已发布 Race 的新修订必须填写修改说明" }, { status: 400 });
  const scan = await scanPdf(buffer);
  const versionId = `problem_${randomUUID()}`;
  const storageKey = scan.status === "clean" ? `race-problems/${raceId}/${versionId}.pdf` : `discarded/${raceId}/${versionId}.pdf`;
  let storageProvider = "discarded";
  let storageFailure: string | null = null;
  if (scan.status === "clean") {
    try {
      const store = getAttachmentStore(ctx.userId);
      await store.put(storageKey, buffer);
      storageProvider = store.provider;
    } catch {
      storageFailure = "Organizer 自有对象存储写入失败";
    }
  }
  const finalStatus = storageFailure ? "scan_failed" : scan.status;
  const result = await prisma.$transaction(async (tx) => {
    const revision = ((await tx.raceProblemVersion.aggregate({ where: { raceId }, _max: { revision: true } }))._max.revision ?? 0) + 1;
    const version = await tx.raceProblemVersion.create({ data: {
      id: versionId, raceId, revision, displayName, storageKey, storageProvider,
      storageOwnerUserId: finalStatus === "clean" ? ctx.userId : null,
      sizeBytes: buffer.length, mimeType: "application/pdf", sha256: inspection.sha256,
      scanStatus: finalStatus, scanEngine: scan.engine, scanDetail: storageFailure ?? scan.detail,
      uploadedByUserId: ctx.userId, changeNote: changeNote || null
    } });
    if (finalStatus === "clean" && race.status === "draft") await tx.race.update({ where: { id: raceId }, data: { currentProblemVersionId: version.id } });
    await tx.raceProblemAuditEvent.create({ data: {
      id: `problem_audit_${randomUUID()}`, raceId, problemVersionId: version.id, actorUserId: ctx.userId,
      action: storageFailure ? "external_store_failed" : finalStatus === "clean" ? "scanned_and_relayed_to_organizer_store" : finalStatus,
      detailJson: JSON.stringify({ engine: scan.engine, pages: inspection.pages, sha256: inspection.sha256, storageProvider })
    } });
    return version;
  });
  const successMessage = storageProvider === "ephemeral_memory"
    ? "开发环境：赛题仅保存在当前服务进程的临时内存，重启后失效"
    : "赛题 PDF 已检查并转存至 Organizer 自有存储";
  return NextResponse.json({ id: result.id, revision: result.revision, scanStatus: result.scanStatus, message: finalStatus === "clean" ? successMessage : storageFailure ?? "文件未通过安全扫描，未保存或公开" }, { status: finalStatus === "clean" ? 201 : storageFailure ? 503 : 422 });
}
