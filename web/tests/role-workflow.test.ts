import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { reviewRoleApplication, selectRole, setUserRoleStatus, submitRegistration, submitRoleProfile } from "../lib/domain";
import type { AuthContext } from "../lib/auth";

const prisma = new PrismaClient();
const suffix = Date.now().toString(36);
const userId = `user_role_flow_${suffix}`;
const base = { profileCompleted: true, managedRaceIds: [], approvedRegistrationIds: [], assignedWorkIds: [] };
const noRole: AuthContext = { userId, availableRoles: [], activeRole: null, ...base };
const admin: AuthContext = { userId: "user_admin_1", availableRoles: ["admin"], activeRole: "admin", ...base };

async function main() {
try {
  await prisma.user.create({ data: {
    id: userId, slug: `role-flow-${suffix}`, displayName: "Role Flow User", profileCompleted: true,
    email: `role-flow-${suffix}@example.com`, verifiedEmailsJson: JSON.stringify([`role-flow-${suffix}@example.com`])
  } });

  assert.equal((await selectRole(noRole, "rider")).ok, true);
  assert.equal((await submitRoleProfile(noRole, "rider", { headline: "Agent rider", skills: "TypeScript, AI" })).ok, true);
  assert.equal((await prisma.userRole.findUnique({ where: { userId_role: { userId, role: "rider" } } }))?.status, "active");

  const rider: AuthContext = { ...noRole, availableRoles: ["rider"], activeRole: "rider" };
  assert.equal((await selectRole(rider, "judge")).ok, true);
  assert.equal((await submitRoleProfile(rider, "judge", {
    organization: "Agent Guild", title: "Reviewer", expertise: "Evaluation", reviewBio: "More than twenty characters of review experience.", conflictConfirmed: true
  })).ok, true);
  const pending = await prisma.roleApplication.findFirstOrThrow({ where: { userId, requestedRole: "judge", status: "pending" } });
  assert.equal((await reviewRoleApplication(admin, pending.id, "approve", "Qualified")).ok, true);
  assert.equal((await prisma.userRole.findUnique({ where: { userId_role: { userId, role: "judge" } } }))?.status, "active");

  const organizerAsRider: AuthContext = { userId: "user_org_1", availableRoles: ["organizer", "rider"], activeRole: "rider", ...base };
  const conflict = await submitRegistration(organizerAsRider, "race_bay_2026");
  assert.equal(conflict.ok, false);
  assert.match(conflict.message, /Organizer|Judge/);

  const selfProtection = await setUserRoleStatus(admin, "user_admin_1", "admin", "suspend", "test");
  assert.equal(selfProtection.ok, false);
  console.log("PASS independent multi-role applications, approval, race conflict and Admin protection");
} finally {
  await prisma.roleApplication.deleteMany({ where: { userId } });
  await prisma.riderProfile.deleteMany({ where: { userId } });
  await prisma.judgeProfile.deleteMany({ where: { userId } });
  await prisma.organizerProfile.deleteMany({ where: { userId } });
  await prisma.userRole.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
}
}

main().catch((error) => { console.error(error); process.exit(1); });
