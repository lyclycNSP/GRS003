import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { fromJson } from "@/lib/json";

export type Role = "rider" | "judge" | "organizer" | "admin";

export type AuthContext = {
  userId: string;
  roles: Role[];
  profileCompleted: boolean;
  managedRaceIds: string[];
  approvedRegistrationIds: string[];
  assignedWorkIds: string[];
};

export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get("ary_session")?.value ?? null;
}

export async function setSession(userId: string) {
  const store = await cookies();
  store.set("ary_session", userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete("ary_session");
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      registrations: true,
      judgeAssignments: true
    }
  });
  if (!user) return null;
  const roles = fromJson<Role[]>(user.rolesJson, []);
  const managedRaces = roles.includes("admin")
    ? await prisma.race.findMany({ select: { id: true } })
    : await prisma.race.findMany({
        where: { organizerJson: { contains: user.id } },
        select: { id: true }
      });
  return {
    userId: user.id,
    roles,
    profileCompleted: user.profileCompleted,
    managedRaceIds: managedRaces.map((race) => race.id),
    approvedRegistrationIds: user.registrations
      .filter((registration) => registration.status === "approved")
      .map((registration) => registration.id),
    assignedWorkIds: user.judgeAssignments.map((assignment) => assignment.workId)
  };
}

export function requireAuth(ctx: AuthContext | null): asserts ctx is AuthContext {
  if (!ctx) throw new Error("AUTH_REQUIRED");
}

export function requireRole(ctx: AuthContext | null, roles: Role[]): asserts ctx is AuthContext {
  requireAuth(ctx);
  if (!roles.some((role) => ctx.roles.includes(role))) throw new Error("FORBIDDEN");
}

export function canManageRace(ctx: AuthContext | null, raceId: string): boolean {
  if (!ctx) return false;
  return ctx.roles.includes("admin") || ctx.managedRaceIds.includes(raceId);
}

export function requireManagedRace(ctx: AuthContext | null, raceId: string) {
  if (!canManageRace(ctx, raceId)) throw new Error("FORBIDDEN");
}
