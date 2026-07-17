import { createHash, randomBytes, randomUUID } from "node:crypto";
import net from "node:net";
import { PDFDocument, PDFName } from "pdf-lib";
import { prisma } from "@/lib/prisma";

export const MAX_RACE_PROBLEM_BYTES = 10 * 1024 * 1024;
export const MAX_RACE_PROBLEM_PAGES = 200;

const ACTIVE_PDF_MARKERS = [
  /\/JavaScript\b/i, /\/JS\b/i, /\/Launch\b/i, /\/EmbeddedFile\b/i,
  /\/Filespec\b/i, /\/OpenAction\b/i, /\/AA\b/i, /\/XFA\b/i
];

export function sanitizePdfDisplayName(raw: string): string | null {
  const base = raw.replace(/\\/g, "/").split("/").pop()?.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120) ?? "";
  if (!base || !/\.pdf$/i.test(base) || /\.pdf\./i.test(base)) return null;
  return base;
}

export async function inspectPdf(buffer: Buffer): Promise<{ ok: true; pages: number; sha256: string } | { ok: false; reason: string }> {
  if (!buffer.length || buffer.length > MAX_RACE_PROBLEM_BYTES) return { ok: false, reason: "PDF 文件大小必须在 1 字节至 10 MiB 之间" };
  const head = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("latin1");
  const tail = buffer.subarray(Math.max(0, buffer.length - 2048)).toString("latin1");
  if (!/^%PDF-1\.[0-7]/.test(head)) return { ok: false, reason: "文件内容不是受支持的 PDF" };
  if (!/%%EOF[\s\0]*$/.test(tail)) return { ok: false, reason: "PDF 结构不完整" };
  const source = buffer.toString("latin1");
  if (/\/Encrypt\b/i.test(source)) return { ok: false, reason: "不接受加密或密码保护的 PDF" };
  if (ACTIVE_PDF_MARKERS.some((pattern) => pattern.test(source))) return { ok: false, reason: "PDF 包含脚本、附件或主动内容" };
  let document: PDFDocument;
  try { document = await PDFDocument.load(buffer, { ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false }); }
  catch { return { ok: false, reason: "PDF 对象结构无效或已加密" }; }
  if (document.isEncrypted) return { ok: false, reason: "不接受加密或密码保护的 PDF" };
  const forbiddenCatalogKeys = ["OpenAction", "AA", "AcroForm", "XFA"];
  if (forbiddenCatalogKeys.some((key) => document.catalog.has(PDFName.of(key)))) return { ok: false, reason: "PDF 包含表单、自动动作或主动内容" };
  const objectSummary = document.context.enumerateIndirectObjects().map(([, object]) => object.toString()).join("\n");
  if (ACTIVE_PDF_MARKERS.some((pattern) => pattern.test(objectSummary))) return { ok: false, reason: "PDF 包含脚本、附件或主动内容" };
  const pages = document.getPageCount();
  if (pages < 1 || pages > MAX_RACE_PROBLEM_PAGES) return { ok: false, reason: `PDF 页数必须为 1-${MAX_RACE_PROBLEM_PAGES} 页` };
  return { ok: true, pages, sha256: createHash("sha256").update(buffer).digest("hex") };
}

export type MalwareScanResult = { status: "clean" | "rejected" | "scan_failed"; engine: string; detail: string };

export async function scanPdf(buffer: Buffer): Promise<MalwareScanResult> {
  const mode = process.env.ATTACHMENT_SCANNER ?? (process.env.NODE_ENV === "production" ? "clamav" : "mock-clean");
  if (mode === "mock-clean") {
    if (process.env.NODE_ENV === "production") return { status: "scan_failed", engine: "disabled", detail: "生产环境禁止测试扫描器" };
    return { status: "clean", engine: "development-mock", detail: "仅限本地开发；未执行真实恶意软件扫描" };
  }
  if (mode !== "clamav") return { status: "scan_failed", engine: mode, detail: "未配置受支持的扫描器" };
  return scanWithClamav(buffer);
}

async function scanWithClamav(buffer: Buffer): Promise<MalwareScanResult> {
  const host = process.env.CLAMAV_HOST;
  const port = Number(process.env.CLAMAV_PORT ?? "3310");
  if (!host || !Number.isInteger(port)) return { status: "scan_failed", engine: "clamav", detail: "ClamAV 配置不完整" };
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (result: MalwareScanResult) => { if (!settled) { settled = true; socket.destroy(); resolve(result); } };
    socket.setTimeout(Number(process.env.CLAMAV_TIMEOUT_MS ?? "10000"));
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
        const chunk = buffer.subarray(offset, Math.min(buffer.length, offset + 64 * 1024));
        const length = Buffer.alloc(4); length.writeUInt32BE(chunk.length); socket.write(length); socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => {
      const response = Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim();
      if (/\bOK$/.test(response)) finish({ status: "clean", engine: "clamav", detail: "扫描通过" });
      else if (/\bFOUND$/.test(response)) finish({ status: "rejected", engine: "clamav", detail: "检测到恶意内容" });
      else finish({ status: "scan_failed", engine: "clamav", detail: "扫描器返回异常" });
    });
    socket.on("timeout", () => finish({ status: "scan_failed", engine: "clamav", detail: "扫描超时" }));
    socket.on("error", () => finish({ status: "scan_failed", engine: "clamav", detail: "扫描服务不可用" }));
  });
}

const globalIntents = globalThis as unknown as { raceProblemRate?: Map<string, number[]> };
const rates = globalIntents.raceProblemRate ?? new Map<string, number[]>();
globalIntents.raceProblemRate = rates;

export async function createUploadIntent(userId: string, raceId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.raceProblemUploadIntent.create({ data: { id: `problem_intent_${randomUUID()}`, tokenHash: createHash("sha256").update(token).digest("hex"), userId, raceId, expiresAt: new Date(Date.now() + 10 * 60_000) } });
  return token;
}

export async function consumeUploadIntent(token: string, userId: string, raceId: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const result = await prisma.raceProblemUploadIntent.updateMany({ where: { tokenHash: createHash("sha256").update(token).digest("hex"), userId, raceId, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  return result.count === 1;
}

export function allowProblemUpload(userId: string): boolean {
  const now = Date.now(); const windowStart = now - 60 * 60_000;
  const recent = (rates.get(userId) ?? []).filter((value) => value > windowStart);
  if (recent.length >= 10) return false;
  recent.push(now); rates.set(userId, recent); return true;
}
