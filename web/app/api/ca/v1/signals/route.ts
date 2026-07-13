import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestRidingSignal } from "@/lib/domain";

const signalSchema = z.object({
  messageId: z.string().min(8).max(160),
  idempotencyKey: z.string().min(8).max(240),
  timestamp: z.string().datetime(),
  raceId: z.string().min(1).max(120),
  registrationId: z.string().min(1).max(120),
  raceProjectId: z.string().min(1).max(120),
  caConnectionId: z.string().min(1).max(120),
  caSessionId: z.string().min(1).max(160),
  progressPercent: z.number().min(0).max(100).optional(),
  tokens: z.number().int().min(0).max(1_000_000_000).optional(),
  attestation: z.object({
    source: z.enum(["ocr_desktop_app", "registered_ca_connector"]),
    signingKeyId: z.string().min(1).max(160),
    signature: z.string().min(40).max(160),
    signedAt: z.string().datetime()
  }).strict()
}).strict();

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 64 * 1024) {
    return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }
  let raw: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 64 * 1024) {
      return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
    }
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = signalSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_signal" }, { status: 400 });
  }
  const result = await ingestRidingSignal(parsed.data);
  return NextResponse.json(result, {
    status: result.ok ? 200 : 401,
    headers: { "Cache-Control": "no-store" }
  });
}
