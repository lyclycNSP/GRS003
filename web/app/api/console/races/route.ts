import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createRace } from "@/lib/domain";

const WORKSPACE_BY_ROLE = {
  admin: "/console/admin",
  judge: "/console/judge",
  organizer: "/console/organizer",
  rider: "/console/rider"
} as const;

function workspaceForRole(role: string | null | undefined) {
  if (role && role in WORKSPACE_BY_ROLE) {
    return WORKSPACE_BY_ROLE[role as keyof typeof WORKSPACE_BY_ROLE];
  }
  return "/console";
}

export async function POST(request: NextRequest) {
  const expectedOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin) {
    return NextResponse.json({
      code: "INVALID_ORIGIN",
      error: "请求来源不受信任，请从 ARY 工作台重新发起操作。",
      next: "/console/organizer"
    }, { status: 403 });
  }
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({
      code: "AUTH_REQUIRED",
      error: "请先登录后再创建 Race。",
      next: "/login?next=%2Fconsole%2Forganizer"
    }, { status: 401 });
  }
  if (ctx.activeRole !== "organizer") {
    return NextResponse.json({
      code: "ACTIVE_ROLE_MISMATCH",
      error: "当前会话不是 Organizer 角色，请切换角色后重试。",
      currentRole: ctx.activeRole,
      next: workspaceForRole(ctx.activeRole)
    }, { status: 403 });
  }
  let input: unknown; try { input = await request.json(); } catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const body = input as Record<string, unknown>;
  const result = await createRace(ctx, { title: String(body.title ?? ""), challenge: String(body.challenge ?? ""), summary: String(body.summary ?? "") });
  if (!result.ok || !result.id) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ raceId: result.id, message: result.message }, { status: 201 });
}
