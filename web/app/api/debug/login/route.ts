import { NextRequest, NextResponse } from "next/server";
import { AuthRoleUnavailableError, setSession, type Role } from "@/lib/auth";
import { buildLoginPath, resolveRequestOrigin, sanitizeInternalNext } from "@/lib/login-redirect";

const DEBUG_USERS = {
  organizer: { userId: "user_org_1", role: "organizer" },
  organizer_alt: { userId: "user_org_2", role: "organizer" },
  admin: { userId: "user_admin_1", role: "admin" },
  rider: { userId: "user_rider_1", role: "rider" },
  rider_e2e: { userId: "user_rider_e2e", role: "rider" },
  judge: { userId: "user_judge_1", role: "judge" },
  multi: { userId: "user_multi_1", role: "organizer" }
} as const;

type DebugUserKey = keyof typeof DEBUG_USERS;

function isDebugUserKey(value: string | null): value is DebugUserKey {
  return value !== null && value in DEBUG_USERS;
}

function debugLoginEnabled() {
  return process.env.ENABLE_DEBUG_LOGIN === "true" && process.env.NODE_ENV !== "production";
}

const DEBUG_LOGIN_DISABLED_REASON = "Debug login is disabled";

export async function GET(request: NextRequest) {
  const origin = resolveRequestOrigin(request);
  const requestedNext = request.nextUrl.searchParams.get("next");
  const genericNext = sanitizeInternalNext(requestedNext);
  if (!debugLoginEnabled()) {
    const response = NextResponse.redirect(new URL(buildLoginPath(genericNext, "debug_login_disabled"), origin));
    response.headers.set("x-ary-auth-reason", DEBUG_LOGIN_DISABLED_REASON);
    return response;
  }

  const user = request.nextUrl.searchParams.get("user");
  if (!isDebugUserKey(user)) {
    return NextResponse.redirect(new URL(buildLoginPath(genericNext, "debug_user_invalid"), origin));
  }

  const debugUser = DEBUG_USERS[user];
  const fallback = user === "rider_e2e" ? "/console?raceId=race_submission_e2e" : "/console";
  const next = sanitizeInternalNext(requestedNext, fallback);
  try {
    await setSession(debugUser.userId, debugUser.role as Role, { requireRequestedRole: true });
    return NextResponse.redirect(new URL(next, origin));
  } catch (error) {
    const code = error instanceof AuthRoleUnavailableError ? "debug_role_unavailable" : "auth_persistence_failed";
    console.error("[auth] Debug login failed", {
      stage: error instanceof AuthRoleUnavailableError ? "role_validation" : "persistence",
      name: error instanceof Error ? error.name : "Error",
      code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined
    });
    return NextResponse.redirect(new URL(buildLoginPath(next, code), origin));
  }
}
