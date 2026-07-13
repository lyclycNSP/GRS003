import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAppUrl, hasGithubOAuthConfig } from "@/lib/runtime-config";

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const appUrl = getAppUrl();
  if (!clientId || !hasGithubOAuthConfig()) {
    return NextResponse.json(
      { error: "oauth_not_configured", message: "GitHub OAuth 未配置；本地调试请显式启用 /debug-login。" },
      { status: 503 }
    );
  }
  const state = randomBytes(32).toString("base64url");
  const store = await cookies();
  store.set("ary_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/github/callback",
    maxAge: 10 * 60
  });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${appUrl}/api/auth/github/callback`);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
