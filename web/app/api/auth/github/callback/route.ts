import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { setSession } from "@/lib/auth";
import { toJson } from "@/lib/json";
import { getAppUrl, hasGithubOAuthConfig } from "@/lib/runtime-config";

type GithubUser = { id: number; login: string; name?: string };

async function fetchGithubUser(code: string): Promise<GithubUser | null> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appUrl = getAppUrl();
  if (!clientId || !clientSecret) return null;
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${appUrl}/api/auth/github/callback`
    })
  });
  const tokenPayload = await tokenResponse.json() as { access_token?: string };
  if (!tokenPayload.access_token) return null;
  const userResponse = await fetch("https://api.github.com/user", {
    headers: { authorization: `Bearer ${tokenPayload.access_token}`, accept: "application/vnd.github+json" }
  });
  if (!userResponse.ok) return null;
  return userResponse.json() as Promise<GithubUser>;
}

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get("ary_oauth_state")?.value;
  store.delete("ary_oauth_state");
  if (!hasGithubOAuthConfig() || !code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "invalid_oauth_callback" }, { status: 400 });
  }
  const githubUser = await fetchGithubUser(code);
  if (!githubUser) return NextResponse.json({ error: "github_identity_failed" }, { status: 401 });
  const providerAccountId = String(githubUser.id);
  const login = githubUser.login;
  const displayName = githubUser?.name || login;
  const account = await prisma.authAccount.findUnique({
    where: { provider_providerAccountId: { provider: "github", providerAccountId } }
  });
  let userId = account?.userId;
  let profileCompleted = true;
  if (!userId) {
    const existingSeedUser = process.env.NODE_ENV === "production"
      ? null
      : await prisma.user.findFirst({ where: { githubLogin: login } });
    const user = existingSeedUser ?? await prisma.user.create({
      data: {
        id: `user_${providerAccountId}`,
        slug: login,
        displayName,
        githubLogin: login,
        profileCompleted: false,
        rolesJson: toJson(["rider"])
      }
    });
    userId = user.id;
    profileCompleted = user.profileCompleted;
    await prisma.authAccount.upsert({
      where: { provider_providerAccountId: { provider: "github", providerAccountId } },
      update: { userId: user.id, loginName: login },
      create: { id: `auth_${providerAccountId}`, userId: user.id, provider: "github", providerAccountId, loginName: login }
    });
  } else {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    profileCompleted = Boolean(user?.profileCompleted);
  }
  await setSession(userId);
  return NextResponse.redirect(`${appUrl}${profileCompleted ? "/console" : "/profile"}`);
}
