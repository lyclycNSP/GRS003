import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { fromJson } from "@/lib/json";

export type Role = "rider" | "judge" | "organizer" | "admin";

export type AuthContext = {
  userId: string;
  availableRoles: Role[];
  activeRole: Role | null;
  profileCompleted: boolean;
  managedRaceIds: string[];
  approvedRegistrationIds: string[];
  assignedWorkIds: string[];
};

const SESSION_COOKIE = "ary_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
export const ROLES: Role[] = ["rider", "judge", "organizer", "admin"];

export function isRole(value: string | null | undefined): value is Role {
  return Boolean(value && ROLES.includes(value as Role));
}

export function isRaceOrganizer(organizerJson: string, userId: string): boolean {
  return fromJson<unknown[]>(organizerJson, []).some((organizerId) => organizerId === userId);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge
  };
}

type SessionWriteOptions = {
  requireRequestedRole?: boolean;
};

export class AuthRoleUnavailableError extends Error {
  constructor() {
    super("ROLE_NOT_AVAILABLE");
    this.name = "AuthRoleUnavailableError";
  }
}

function isRetryableAuthWriteError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return code === "P2002" || code === "P2034" || /SQLITE_BUSY|database is locked|write conflict/i.test(message);
}

export async function withAuthWriteRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableAuthWriteError(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 30 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function createSessionRecord(
  tx: Prisma.TransactionClient,
  userId: string,
  requestedRole?: Role | null,
  options: SessionWriteOptions = {}
) {
  const [user, roleRows] = await Promise.all([
    tx.user.findUnique({ where: { id: userId }, select: { preferredRole: true } }),
    tx.userRole.findMany({
      where: { userId, status: "active", role: { in: ROLES } },
      orderBy: { grantedAt: "asc" },
      select: { role: true }
    })
  ]);
  if (!user) throw new Error("AUTH_USER_NOT_FOUND");
  const availableRoles = roleRows.map((row) => row.role).filter(isRole);
  if (options.requireRequestedRole && (!requestedRole || !availableRoles.includes(requestedRole))) {
    throw new AuthRoleUnavailableError();
  }
  const preferredRole = isRole(user.preferredRole) && availableRoles.includes(user.preferredRole)
    ? user.preferredRole
    : null;
  const activeRole = requestedRole && availableRoles.includes(requestedRole)
    ? requestedRole
    : preferredRole ?? (availableRoles.length === 1 ? availableRoles[0] : null);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await tx.authSession.create({
    data: {
      id: `auth_session_${randomBytes(16).toString("hex")}`,
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      activeRole
    }
  });
  return { token, activeRole, availableRoles };
}

export async function commitSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_SECONDS));
}

async function getSessionFromCookie() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.authSession.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.authSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return { session, token };
}

export async function getCurrentUserId(): Promise<string | null> {
  return (await getSessionFromCookie())?.session.userId ?? null;
}

export async function getActiveRoles(userId: string): Promise<Role[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId, status: "active", role: { in: ROLES } },
    orderBy: { grantedAt: "asc" },
    select: { role: true }
  });
  return rows.map((row) => row.role).filter(isRole);
}

export async function setSession(
  userId: string,
  requestedRole?: Role | null,
  options: SessionWriteOptions = {}
) {
  const session = await withAuthWriteRetry(() => prisma.$transaction(
    (tx) => createSessionRecord(tx, userId, requestedRole, options)
  ));
  await commitSessionCookie(session.token);
  return session;
}

export async function switchActiveRole(role: Role) {
  const current = await getSessionFromCookie();
  if (!current) throw new Error("AUTH_REQUIRED");
  const roleGrant = await prisma.userRole.findUnique({
    where: { userId_role: { userId: current.session.userId, role } }
  });
  if (!roleGrant || roleGrant.status !== "active") throw new Error("ROLE_NOT_AVAILABLE");
  await prisma.$transaction([
    prisma.authSession.update({ where: { id: current.session.id }, data: { activeRole: role, lastSeenAt: new Date() } }),
    prisma.user.update({ where: { id: current.session.userId }, data: { preferredRole: role } })
  ]);
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const current = await getSessionFromCookie();
  if (!current) return null;
  const user = await prisma.user.findUnique({
    where: { id: current.session.userId },
    include: { roles: true, registrations: true, judgeAssignments: true }
  });
  if (!user) return null;

  const availableRoles = user.roles
    .filter((item) => item.status === "active")
    .map((item) => item.role)
    .filter(isRole);
  const activeRole = isRole(current.session.activeRole) && availableRoles.includes(current.session.activeRole)
    ? current.session.activeRole
    : null;
  if (current.session.activeRole && !activeRole) {
    await prisma.authSession.update({ where: { id: current.session.id }, data: { activeRole: null } });
  }

  const managedRaces = activeRole === "organizer"
    ? (await prisma.race.findMany({ select: { id: true, createdByUserId: true, organizerJson: true } }))
      .filter((race) => race.createdByUserId === user.id || isRaceOrganizer(race.organizerJson, user.id))
      .map((race) => race.id)
    : [];

  return {
    userId: user.id,
    availableRoles,
    activeRole,
    profileCompleted: user.profileCompleted,
    managedRaceIds: managedRaces,
    approvedRegistrationIds: activeRole === "rider"
      ? user.registrations.filter((registration) => registration.status === "approved").map((registration) => registration.id)
      : [],
    assignedWorkIds: activeRole === "judge" ? user.judgeAssignments.map((assignment) => assignment.workId) : []
  };
}

export function requireAuth(ctx: AuthContext | null): asserts ctx is AuthContext {
  if (!ctx) throw new Error("AUTH_REQUIRED");
}

export function requireRole(ctx: AuthContext | null, roles: Role[]): asserts ctx is AuthContext {
  requireAuth(ctx);
  if (!ctx.activeRole || !roles.includes(ctx.activeRole)) throw new Error("FORBIDDEN");
}

export function canManageRace(ctx: AuthContext | null, raceId: string): boolean {
  return Boolean(ctx && ctx.activeRole === "organizer" && ctx.managedRaceIds.includes(raceId));
}

export function requireManagedRace(ctx: AuthContext | null, raceId: string) {
  if (!canManageRace(ctx, raceId)) throw new Error("FORBIDDEN");
}
