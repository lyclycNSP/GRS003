import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { commitSessionCookie, createSessionRecord, withAuthWriteRetry } from "@/lib/auth";
import { GithubOAuthError, fetchGithubIdentityOrThrow } from "@/lib/github-oauth";
import { buildLoginPath, resolveRequestOrigin, sanitizeInternalNext, type LoginErrorCode } from "@/lib/login-redirect";
import { prisma } from "@/lib/prisma";
import { getAppUrl, hasGithubOAuthConfig } from "@/lib/runtime-config";
import { consumePendingOAuthState, encodePendingOAuthStates, parsePendingOAuthStates } from "@/lib/oauth-state";
import { randomBytes } from "node:crypto";

function logAuthFailure(stage: string, requestId: string, error?: unknown) {
  const details = error && typeof error === "object"
    ? { name: "name" in error ? String(error.name) : "Error", code: "code" in error ? String(error.code) : undefined }
    : undefined;
  console.error("[auth] GitHub callback failed", { stage, requestId, ...details });
}

function githubErrorCode(error: GithubOAuthError): LoginErrorCode {
  if (error.stage === "token_exchange") return "github_token_exchange_failed";
  if (error.stage === "email_fetch") return "github_email_fetch_failed";
  return "github_identity_failed";
}

function persistenceErrorCode(error: unknown): LoginErrorCode {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "auth_account_conflict";
  }
  return "auth_persistence_failed";
}

export async function GET(request: NextRequest) {
  const store = await cookies();
  const requestOrigin = resolveRequestOrigin(request);
  const requestId = randomBytes(8).toString("hex");
  const state = request.nextUrl.searchParams.get("state") ?? undefined;
  const consumed = consumePendingOAuthState(parsePendingOAuthStates(store.get("ary_oauth_pending")?.value), state);
  const next = sanitizeInternalNext(consumed.matched?.next);
  const cookieOptions = { httpOnly:true, secure:process.env.NODE_ENV==="production", sameSite:"lax" as const, path:"/api/auth/github", maxAge:10*60 };
  if (consumed.remaining.length) store.set("ary_oauth_pending",encodePendingOAuthStates(consumed.remaining),cookieOptions); else store.set("ary_oauth_pending","",{...cookieOptions,maxAge:0});
  store.delete("ary_oauth_state");store.delete("ary_oauth_next");

  let appUrl: string;
  try {
    appUrl = getAppUrl();
  } catch (error) {
    logAuthFailure("configuration", requestId, error);
    return NextResponse.redirect(new URL(buildLoginPath(next, "oauth_not_configured"), requestOrigin));
  }
  const loginError = (error: LoginErrorCode) => NextResponse.redirect(new URL(buildLoginPath(next, error), appUrl));
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");

  if (providerError) {
    logAuthFailure("provider_denied", requestId);
    return loginError("oauth_denied");
  }
  if (!hasGithubOAuthConfig() || !code || !state || !consumed.matched) {
    logAuthFailure("state_validation", requestId);
    return loginError("invalid_oauth_callback");
  }

  let identity;
  try {
    identity = await fetchGithubIdentityOrThrow(code, {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: `${appUrl}/api/auth/github/callback`
    });
  } catch (error) {
    logAuthFailure(error instanceof GithubOAuthError ? error.stage : "github_unknown", requestId, error);
    return loginError(error instanceof GithubOAuthError ? githubErrorCode(error) : "github_identity_failed");
  }
  if (!identity?.email) return loginError("verified_github_email_required");

  const providerAccountId = String(identity.user.id);
  try {
    const result = await withAuthWriteRetry(() => prisma.$transaction(async (tx) => {
      const account = await tx.authAccount.findUnique({
        where: { provider_providerAccountId: { provider: "github", providerAccountId } }
      });
      let userId = account?.userId;

      if (account) {
        await tx.user.update({
          where: { id: account.userId },
          data: {
            githubLogin: identity.user.login,
            githubUserId: providerAccountId,
            avatarUrl: identity.user.avatar_url ?? null,
            verifiedEmailsJson: JSON.stringify(identity.verifiedEmails),
            emailVerifiedAt: new Date()
          }
        });
        await tx.authAccount.update({ where: { id: account.id }, data: { loginName: identity.user.login } });
      } else {
        const deterministicUserId = `user_${providerAccountId}`;
        const existingUser = await tx.user.findFirst({
          where: { OR: [{ githubUserId: providerAccountId }, { id: deterministicUserId }] }
        });
        if (existingUser?.githubUserId && existingUser.githubUserId !== providerAccountId) {
          throw new Error("AUTH_ACCOUNT_CONFLICT");
        }

        if (existingUser) {
          userId = existingUser.id;
          await tx.user.update({
            where: { id: existingUser.id },
            data: {
              githubLogin: identity.user.login,
              githubUserId: providerAccountId,
              avatarUrl: identity.user.avatar_url ?? null,
              email: existingUser.email ?? identity.email,
              verifiedEmailsJson: JSON.stringify(identity.verifiedEmails),
              emailVerifiedAt: new Date()
            }
          });
        } else {
          userId = deterministicUserId;
          await tx.user.create({
            data: {
              id: userId,
              slug: `${identity.user.login}-${providerAccountId}`.toLowerCase(),
              displayName: identity.user.name?.trim() || identity.user.login,
              githubLogin: identity.user.login,
              githubUserId: providerAccountId,
              avatarUrl: identity.user.avatar_url ?? null,
              email: identity.email,
              verifiedEmailsJson: JSON.stringify(identity.verifiedEmails),
              emailVerifiedAt: new Date(),
              profileCompleted: false
            }
          });
        }
        await tx.authAccount.create({
          data: {
            id: `auth_${providerAccountId}`,
            userId,
            provider: "github",
            providerAccountId,
            loginName: identity.user.login
          }
        });
      }

      const user = await tx.user.findUnique({
        where: { id: userId! },
        select: { profileCompleted: true, preferredRole: true }
      });
      if (!user) throw new Error("AUTH_USER_NOT_FOUND");
      const session = await createSessionRecord(tx, userId!);
      return { user, session };
    }));

    await commitSessionCookie(result.session.token);
    let destination = next;
    if (!result.user.profileCompleted) destination = "/profile";
    else if (result.session.availableRoles.length === 0) destination = "/onboarding/role";
    else if (result.session.availableRoles.length > 1 && !result.user.preferredRole) destination = "/role-switch";
    return NextResponse.redirect(new URL(destination, appUrl));
  } catch (error) {
    logAuthFailure("persistence", requestId, error);
    const conflict = error instanceof Error && error.message === "AUTH_ACCOUNT_CONFLICT";
    return loginError(conflict ? "auth_account_conflict" : persistenceErrorCode(error));
  }
}
