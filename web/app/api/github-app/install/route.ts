import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(); const slug = process.env.GITHUB_APP_SLUG;
  if (!ctx) return NextResponse.redirect(new URL("/login?next=/api/github-app/install", request.url));
  if (!slug) return NextResponse.json({ error: "GitHub App 尚未配置" }, { status: 503 });
  const state = randomBytes(32).toString("base64url"); const response = NextResponse.redirect(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${state}`);
  response.cookies.set("ary_github_install_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/github-app", maxAge: 600 }); return response;
}
