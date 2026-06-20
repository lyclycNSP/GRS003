import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  approveRegistration,
  assignJudge,
  createRace,
  disableCAConnection,
  editReport,
  generateReport,
  ingestRidingSignal,
  publishRace,
  publishReport,
  regenerateReport,
  registerCAConnection,
  runP0Regression,
  simulateProjectionFailure,
  simulateReportFailure,
  submitJudgingRecord,
  submitRegistration,
  submitWork,
  switchScreenMode,
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

  await test("organizer creates and publishes Race", async () => {
    const created = await createRace(organizer, { title: "本地补齐验收赛", challenge: "验证 DEV-4", summary: "Race 创建发布验收" });
    assert.equal(created.ok, true);
    const published = await publishRace(organizer, created.id!);
    assert.equal(published.ok, true);
    const race = await prisma.race.findUnique({ where: { id: created.id! } });
    assert.equal(race?.visibility, "public");
    assert.equal(race?.status, "running");
  });
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


  await test("work judge structure reaches submitted judging record", async () => {
    const workResult = await submitWork(rider, "reg_mira", { title: "Judge Flow Work", summary: "Judge flow", demoUrl: "mock://demo/judge", repoUrl: "mock://repo/judge" });
    assert.equal(workResult.ok, true);
    const publishedWork = await prisma.work.findUnique({ where: { id: workResult.id! } });
    const assignment = await assignJudge(organizer, publishedWork!.id, "user_judge_1");
    assert.equal(assignment.ok, true);
    const judgeCtx: AuthContext = { userId: "user_judge_1", roles: ["judge"], profileCompleted: true, managedRaceIds: [], approvedRegistrationIds: [], assignedWorkIds: [publishedWork!.id] };
    const record = await submitJudgingRecord(judgeCtx, assignment.id!, { scoreResult: 90, scoreRiding: 87, comments: "Looks complete." });
    assert.equal(record.ok, true);
    const saved = await prisma.judgingRecord.findUnique({ where: { assignmentId: assignment.id! } });
    assert.equal(saved?.status, "submitted");
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
      attestation: {
        source: "ocr_desktop_app",
        signingKeyId: `ocr_key_${connection!.connectorId}`,
        signature: `dev-signature:${connection!.connectorId}:good-key`,
        signedAt: new Date().toISOString()
      },
      progressPercent: 100,
      tokens: 12000
    });
    assert.equal(result.ok, true);
    const evidence = await prisma.evidence.findMany({ where: { registrationId: "reg_mira" } });
    assert.ok(evidence.length >= 1);
  });

  await test("forged CA signal without attestation is rejected", async () => {
    const registered = await registerCAConnection(rider, "rp_mira");
    assert.equal(registered.ok, true);
    await prisma.cAConnection.update({ where: { id: registered.id! }, data: { handshakeAt: new Date() } });
    const result = await ingestRidingSignal({
      raceId: "race_bay_2026",
      registrationId: "reg_mira",
      raceProjectId: "rp_mira",
      caConnectionId: registered.id!,
      idempotencyKey: "forged-key",
      caSessionId: "forged-session",
      progressPercent: 100,
      tokens: 22000
    });
    assert.equal(result.ok, false);
    const flags = await prisma.reviewFlag.findMany({ where: { registrationId: "reg_mira", type: "ingestion_exception" } });
    assert.ok(flags.some((flag) => flag.judgeVisibleSummary.includes("认证声明")));
  });


  await test("disabled CA signal is rejected", async () => {
    const registered = await registerCAConnection(rider, "rp_mira");
    assert.equal(registered.ok, true);
    await prisma.cAConnection.update({ where: { id: registered.id! }, data: { handshakeAt: new Date() } });
    const disabled = await disableCAConnection(rider, registered.id!);
    assert.equal(disabled.ok, true);
    const result = await ingestRidingSignal({ raceId: "race_bay_2026", registrationId: "reg_mira", raceProjectId: "rp_mira", caConnectionId: registered.id!, idempotencyKey: "disabled-key", caSessionId: "disabled-session" });
    assert.equal(result.ok, false);
  });

  await test("projection failure keeps stable projection", async () => {
    const before = await prisma.projection.findFirst({ where: { raceId: "race_bay_2026", status: "stable" }, orderBy: { lastRebuiltAt: "desc" } });
    const failed = await simulateProjectionFailure(organizer, "race_bay_2026");
    assert.equal(failed.ok, true);
    const after = await prisma.projection.findFirst({ where: { raceId: "race_bay_2026", status: "stable" }, orderBy: { lastRebuiltAt: "desc" } });
    assert.equal(after?.id, before?.id);
  });

  await test("screen mode switches through supported modes", async () => {
    for (const mode of ["live", "leaderboard", "works", "announcement", "fallback"]) {
      const result = await switchScreenMode(organizer, "race_bay_2026", mode);
      assert.equal(result.ok, true);
    }
    const state = await prisma.screenState.findUnique({ where: { raceId: "race_bay_2026" } });
    assert.equal(state?.mode, "fallback");
    assert.equal(state?.fallbackEnabled, true);
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


  await test("failed report can be regenerated, edited, and published", async () => {
    const failed = await simulateReportFailure(organizer, { raceId: "race_bay_2026", type: "race_report" });
    assert.equal(failed.ok, true);
    const regenerated = await regenerateReport(organizer, failed.id!);
    assert.equal(regenerated.ok, true);
    const edited = await editReport(organizer, failed.id!, "人工编辑后的 race_report。");
    assert.equal(edited.ok, true);
    await publishReport(organizer, failed.id!);
    const report = await prisma.report.findUnique({ where: { id: failed.id! } });
    assert.equal(report?.visibility, "public");
    assert.equal(report?.content, "人工编辑后的 race_report。");
  });
  await test("P0 regression reaches release and ops evidence", async () => {
    const result = await runP0Regression(organizer, "race_bay_2026");
    assert.equal(result.ok, true);
    const p0 = await prisma.releaseChecklistItem.findUnique({ where: { raceId_itemKey: { raceId: "race_bay_2026", itemKey: "p0_regression" } } });
    const backups = await prisma.backup.findMany({ where: { raceId: "race_bay_2026" } });
    assert.equal(p0?.status, "done");
    assert.ok(backups.length >= 1);
    const screen = await prisma.releaseChecklistItem.findUnique({ where: { raceId_itemKey: { raceId: "race_bay_2026", itemKey: "screen_rehearsal" } } });
    const goNoGo = await prisma.releaseChecklistItem.findUnique({ where: { raceId_itemKey: { raceId: "race_bay_2026", itemKey: "go_no_go" } } });
    assert.equal(screen?.status, "done");
    assert.equal(goNoGo?.status, "done");
  });

  await prisma.$disconnect();

  if (process.exitCode) process.exit(process.exitCode);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
