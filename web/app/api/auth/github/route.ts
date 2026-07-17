import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { buildLoginPath, resolveRequestOrigin, sanitizeInternalNext } from "@/lib/login-redirect";
import { getAppUrl, hasGithubOAuthConfig } from "@/lib/runtime-config";
import { appendPendingOAuthState, encodePendingOAuthStates, parsePendingOAuthStates } from "@/lib/oauth-state";

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const next = sanitizeInternalNext(request.nextUrl.searchParams.get("next"));
  const requestOrigin = resolveRequestOrigin(request);
  if (!clientId || !hasGithubOAuthConfig()) {
    return NextResponse.redirect(new URL(buildLoginPath(next, "oauth_not_configured"), requestOrigin));
  }
  let appUrl: string;
  try {
    appUrl = getAppUrl();
  } catch (error) {
    console.error("[auth] GitHub login configuration failed", {
      stage: "configuration",
      name: error instanceof Error ? error.name : "Error"
    });
    return NextResponse.redirect(new URL(buildLoginPath(next, "oauth_not_configured"), requestOrigin));
  }
  if (requestOrigin !== appUrl) {
    return NextResponse.redirect(new URL(`/api/auth/github?next=${encodeURIComponent(next)}`, appUrl));
  }
  const state = randomBytes(32).toString("base64url");
  const store = await cookies();
  const oauthCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/github",
    maxAge: 10 * 60
  };
  const pending = appendPendingOAuthState(parsePendingOAuthStates(store.get("ary_oauth_pending")?.value), state, next);
  store.set("ary_oauth_pending", encodePendingOAuthStates(pending), oauthCookieOptions);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${appUrl}/api/auth/github/callback`);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
