import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  approveRegistration,
  generateReport,
  ingestRidingSignal,
  publishReport,
  registerCAConnection,
  runP0Regression,
  submitRegistration,
  updateProfile,
  updateUserRoles
} from "../lib/domain";
import type { AuthContext } from "../lib/auth";

const prisma = new PrismaClient();

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

const organizer: AuthContext = {
  userId: "user_org_1",
  roles: ["organizer", "admin", "judge", "rider"],
  profileCompleted: true,
  managedRaceIds: ["race_bay_2026", "race_finance_2026", "race_genesis_2026"],
  approvedRegistrationIds: [],
  assignedWorkIds: []
};

const rider: AuthContext = {
  userId: "user_rider_1",
  roles: ["rider"],
  profileCompleted: true,
  managedRaceIds: [],
  approvedRegistrationIds: ["reg_mira"],
  assignedWorkIds: []
};

async function main() {
  await test("duplicate registration is idempotent per user and race", async () => {
    const first = await submitRegistration(rider, "race_bay_2026");
    const second = await submitRegistration(rider, "race_bay_2026");
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    const registrations = await prisma.registration.findMany({ where: { raceId: "race_bay_2026", userId: "user_rider_1" } });
    assert.equal(registrations.length, 1);
  });

  await test("approved Registration ensures exactly one RaceProject", async () => {
    const result = await approveRegistration(organizer, "reg_mira");
    assert.equal(result.ok, true);
    const projects = await prisma.raceProject.findMany({ where: { registrationId: "reg_mira" } });
    assert.equal(projects.length, 1);
  });

  await test("permission denies rider approving Registration", async () => {
    await assert.rejects(() => approveRegistration(rider, "reg_mira"), /FORBIDDEN/);
  });

  await test("profile completion saves user fields", async () => {
    await prisma.user.update({ where: { id: "user_rider_1" }, data: { profileCompleted: false } });
    const result = await updateProfile(rider, { displayName: "Mira Chen", city: "Oakland", githubLogin: "mira-ca" });
    assert.equal(result.ok, true);
    const user = await prisma.user.findUnique({ where: { id: "user_rider_1" } });
    assert.equal(user?.profileCompleted, true);
    assert.equal(user?.city, "Oakland");
  });

  await test("only admin can maintain User.roles", async () => {
    await assert.rejects(() => updateUserRoles(rider, "user_judge_1", ["judge", "rider"]), /FORBIDDEN/);
    const result = await updateUserRoles(organizer, "user_judge_1", ["judge", "rider"]);
    assert.equal(result.ok, true);
    const user = await prisma.user.findUnique({ where: { id: "user_judge_1" } });
    assert.deepEqual(JSON.parse(user!.rolesJson), ["judge", "rider"]);
  });

  await test("invalid CA signal is rejected and creates ReviewFlag", async () => {
    const result = await ingestRidingSignal({
      raceId: "race_bay_2026",
      registrationId: "reg_mira",
      raceProjectId: "rp_mira",
      caConnectionId: "missing",
      idempotencyKey: "bad-key",
      caSessionId: "bad-session"
    });
    assert.equal(result.ok, false);
    const flags = await prisma.reviewFlag.findMany({ where: { registrationId: "reg_mira", type: "ingestion_exception" } });
    assert.ok(flags.length >= 1);
  });

  await test("valid CA signal creates Session and Evidence", async () => {
    const registered = await registerCAConnection(rider, "rp_mira");
    assert.equal(registered.ok, true);
    const connection = await prisma.cAConnection.findUnique({ where: { id: registered.id! } });
    await prisma.cAConnection.update({ where: { id: connection!.id }, data: { handshakeAt: new Date() } });
    const result = await ingestRidingSignal({
      raceId: "race_bay_2026",
      registrationId: "reg_mira",
      raceProjectId: "rp_mira",
      caConnectionId: connection!.id,
      idempotencyKey: "good-key",
      caSessionId: "good-session",
      progressPercent: 100,
      tokens: 12000
    });
    assert.equal(result.ok, true);
    const evidence = await prisma.evidence.findMany({ where: { registrationId: "reg_mira" } });
    assert.ok(evidence.length >= 1);
  });

  await test("report visibility keeps rider_report private and review_summary public", async () => {
    const riderReport = await generateReport(organizer, { raceId: "race_bay_2026", type: "rider_report", subjectRegistrationId: "reg_mira" });
    const review = await generateReport(organizer, { raceId: "race_bay_2026", type: "review_summary" });
    assert.equal(riderReport.ok, true);
    assert.equal(review.ok, true);
    await publishReport(organizer, riderReport.id!);
    await publishReport(organizer, review.id!);
    const publishedRider = await prisma.report.findUnique({ where: { id: riderReport.id! } });
    const publishedReview = await prisma.report.findUnique({ where: { id: review.id! } });
    assert.equal(publishedRider?.visibility, "private");
    assert.equal(publishedReview?.visibility, "public");
  });

  await test("P0 regression reaches release and ops evidence", async () => {
    const result = await runP0Regression(organizer, "race_bay_2026");
    assert.equal(result.ok, true);
    const p0 = await prisma.releaseChecklistItem.findUnique({ where: { raceId_itemKey: { raceId: "race_bay_2026", itemKey: "p0_regression" } } });
    const backups = await prisma.backup.findMany({ where: { raceId: "race_bay_2026" } });
    assert.equal(p0?.status, "done");
    assert.ok(backups.length >= 1);
  });

  await prisma.$disconnect();

  if (process.exitCode) process.exit(process.exitCode);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
