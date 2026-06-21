import { NextRequest, NextResponse } from "next/server";
import { setDebugRoleOverride, setSession, type Role } from "@/lib/auth";

const DEBUG_USERS = {
  organizer: { userId: "user_org_1", roles: ["organizer"] },
  admin: { userId: "user_org_1", roles: ["admin"] },
  rider: { userId: "user_rider_1", roles: ["rider"] },
  judge: { userId: "user_judge_1", roles: ["judge"] }
} as const;

type DebugUserKey = keyof typeof DEBUG_USERS;

function isDebugUserKey(value: string | null): value is DebugUserKey {
  return value !== null && value in DEBUG_USERS;
}

function debugLoginEnabled() {
  return process.env.ENABLE_DEBUG_LOGIN === "true" && process.env.NODE_ENV !== "production";
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  if (!debugLoginEnabled()) {
    return NextResponse.json({ error: "Debug login is disabled" }, { status: 404 });
  }

  const user = request.nextUrl.searchParams.get("user");
  if (!isDebugUserKey(user)) {
    return NextResponse.json({ error: "Unknown debug user" }, { status: 400 });
  }

  const debugUser = DEBUG_USERS[user];
  await setSession(debugUser.userId);
  await setDebugRoleOverride([...debugUser.roles] as Role[]);
  return NextResponse.redirect(`${appUrl}/console`);
}
