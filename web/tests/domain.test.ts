import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  approveRegistration,
  assignJudge,
  configureSubmissionWindow,
  createRace,
  createTeam,
  disableCAConnection,
  editReport,
  generateReport,
  ingestRidingSignal,
  lockSubmissionWindow,
  joinTeam,
  publishAward,
  publishRace,
  publishReport,
  regenerateReport,
  registerCAConnection,
  runP0Regression,
  simulateProjectionFailure,
  simulateReportFailure,
  submitJudgingRecord,
  submitRegistration,
  submitTeamRegistration,
  submitWork,
  switchScreenMode,
  updateProfile,
  updateUserRoles
} from "../lib/domain";
import { isRaceOrganizer, type AuthContext } from "../lib/auth";
import { getConsoleSnapshotForUser, getRaceResults, getWorkBySlug } from "../lib/queries";
import { createRidingSignalAttestation, type RidingSignalPayload } from "../lib/ca-attestation";

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
  managedRaceIds: ["race_bay_2026", "race_finance_2026", "race_genesis_2026", "race_submission_e2e"],
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

function signedSignal(connectorId: string, overrides: Partial<RidingSignalPayload> = {}) {
  const payload: RidingSignalPayload = {
    messageId: `message-${Date.now()}-${Math.random()}`,
    idempotencyKey: `idempotency-${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    raceId: "race_bay_2026",
    registrationId: "reg_mira",
    raceProjectId: "rp_mira",
    caConnectionId: "missing",
    caSessionId: "test-session",
    progressPercent: 100,
    tokens: 12000,
    ...overrides
  };
  return { ...payload, attestation: createRidingSignalAttestation(connectorId, payload, "ocr_desktop_app") };
}

async function main() {

  await test("organizer authorization requires an exact user ID match", async () => {
    assert.equal(isRaceOrganizer('["user_123"]', "user_123"), true);
    assert.equal(isRaceOrganizer('["user_123"]', "user_12"), false);
    assert.equal(isRaceOrganizer('["user_123"]', "user_1234"), false);
  });

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

  await test("Rider team can create, join, submit and share CA access", async () => {
    const captainId = "user_team_captain_test";
    const memberId = "user_team_member_test";
    for (const [id, slug, displayName] of [
      [captainId, "team-captain-test", "Team Captain Test"],
      [memberId, "team-member-test", "Team Member Test"]
    ]) {
      await prisma.user.upsert({
        where: { id },
        update: { rolesJson: JSON.stringify(["rider"]), profileCompleted: true },
        create: { id, slug, displayName, rolesJson: JSON.stringify(["rider"]), profileCompleted: true }
      });
    }
    const captain: AuthContext = { userId: captainId, roles: ["rider"], profileCompleted: true, managedRaceIds: [], approvedRegistrationIds: [], assignedWorkIds: [] };
    const member: AuthContext = { userId: memberId, roles: ["rider"], profileCompleted: true, managedRaceIds: [], approvedRegistrationIds: [], assignedWorkIds: [] };
    const created = await createTeam(captain, "race_finance_2026", `Team Flow ${Date.now()}`);
    assert.equal(created.ok, true);
    const team = await prisma.team.findUnique({ where: { id: created.id! } });
    assert.ok(team);
    const joined = await joinTeam(member, team.inviteCode);
    assert.equal(joined.ok, true);
    const individualBlocked = await submitRegistration(member, "race_finance_2026");
    assert.equal(individualBlocked.ok, false);
    const submitted = await submitTeamRegistration(captain, team.id);
    assert.equal(submitted.ok, true);
    const registration = await prisma.registration.findUnique({ where: { id: submitted.id! } });
    assert.equal(registration?.participantType, "team");
    assert.equal(registration?.teamId, team.id);
    const approved = await approveRegistration(organizer, registration!.id);
    assert.equal(approved.ok, true);
    const project = await prisma.raceProject.findUnique({ where: { registrationId: registration!.id } });
    assert.ok(project);
    const connection = await registerCAConnection(member, project.id);
    assert.equal(connection.ok, true);
    const savedConnection = await prisma.cAConnection.findUnique({ where: { id: connection.id! } });
    assert.equal(savedConnection?.ownerUserId, memberId);
    const memberWork = await submitWork(member, registration!.id, { title: "Member Work", summary: "Must be rejected", repoUrl: "https://github.com/example/member-work", repoCommitSha: "1".repeat(40) });
    assert.equal(memberWork.ok, false);
    const captainWork = await submitWork(captain, registration!.id, { title: "Team Flow Work", summary: "Submitted by captain", repoUrl: "https://github.com/example/team-flow-work", repoCommitSha: "2".repeat(40) });
    assert.equal(captainWork.ok, true);
  });

  await test("approved Registration ensures exactly one RaceProject", async () => {
    const result = await approveRegistration(organizer, "reg_mira");
    assert.equal(result.ok, true, result.message);
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
    const raceResult = await createRace(organizer, {
      title: `Judge Flow ${Date.now()}`,
      challenge: "Validate version-bound judging.",
      summary: "Isolated judge flow fixture."
    });
    assert.equal(raceResult.ok, true);
    const registrationResult = await submitRegistration(rider, raceResult.id!);
    assert.equal(registrationResult.ok, true);
    const approved = await approveRegistration(organizer, registrationResult.id!);
    assert.equal(approved.ok, true);
    const configured = await configureSubmissionWindow(organizer, raceResult.id!, {
      opensAt: new Date(Date.now() - 60_000),
      closesAt: new Date(Date.now() + 3_600_000)
    });
    assert.equal(configured.ok, true);
    const isolatedRider: AuthContext = { ...rider, approvedRegistrationIds: [registrationResult.id!] };
    const workResult = await submitWork(isolatedRider, registrationResult.id!, { title: "Judge Flow Work", summary: "Judge flow", demoUrl: "https://demo.example.com/judge", repoUrl: "https://github.com/example/judge", repoCommitSha: "b".repeat(40) });
    assert.equal(workResult.ok, true);
    const publishedWork = await prisma.work.findUnique({ where: { id: workResult.id! } });
    const locked = await lockSubmissionWindow(organizer, raceResult.id!, "进入领域评审测试");
    assert.equal(locked.ok, true);
    const assignment = await assignJudge(organizer, publishedWork!.id, "user_judge_1");
    assert.equal(assignment.ok, true);
    const judgeCtx: AuthContext = { userId: "user_judge_1", roles: ["judge"], profileCompleted: true, managedRaceIds: [], approvedRegistrationIds: [], assignedWorkIds: [publishedWork!.id] };
    const record = await submitJudgingRecord(judgeCtx, assignment.id!, { scoreResult: 90, scoreRiding: 87, comments: "Looks complete." });
    assert.equal(record.ok, true);
    const saved = await prisma.judgingRecord.findUnique({ where: { assignmentId: assignment.id! } });
    assert.equal(saved?.status, "submitted");
  });

  await test("Award publication rejects registration and work outside the Race", async () => {
    const result = await publishAward(organizer, {
      raceId: "race_genesis_2026",
      registrationId: "reg_mira",
      workId: "work-gba-wander",
      awardName: "Cross Race Award",
      rank: 1,
      reason: "This should not be allowed."
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /Registration/);
  });

  await test("public Work detail only resolves published public Work", async () => {
    const publicWork = await getWorkBySlug("ary-self-dogfood-agent");
    const reviewOnlyWork = await getWorkBySlug("work-localjoy");
    assert.equal(publicWork?.visibility, "public");
    assert.equal(reviewOnlyWork, null);
  });

  await test("Console snapshot scopes registrations and judge assignments to selected Race", async () => {
    const snapshot = await getConsoleSnapshotForUser("user_judge_1", "race_genesis_2026");
    assert.equal(snapshot.race?.id, "race_genesis_2026");
    assert.equal(snapshot.assignments.length, 0);
    assert.equal(snapshot.currentUser?.judgeAssignments.length, 0);
    assert.equal(snapshot.currentUser?.registrations.every((registration) => registration.raceId === "race_genesis_2026"), true);
  });

  await test("Award rejects a legacy unversioned Work", async () => {
    const race = await getRaceResults("bay-area-happy-trip");
    assert.ok(race);
    const result = await publishAward(organizer, {
      raceId: "race_finance_2026",
      registrationId: "reg_finance_ana",
      workId: "work-finance-legacy",
      awardName: "Review Only Award",
      rank: 2,
      reason: "Award can be public while Work remains under review."
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /版本化/);
  });

  await test("unknown CA connection is rejected without writing attacker identifiers", async () => {
    const before = await prisma.reviewFlag.count({ where: { registrationId: "reg_mira", type: "ingestion_exception" } });
    const result = await ingestRidingSignal({
      messageId: "message-invalid",
      timestamp: new Date().toISOString(),
      raceId: "race_bay_2026",
      registrationId: "reg_mira",
      raceProjectId: "rp_mira",
      caConnectionId: "missing",
      idempotencyKey: "bad-key",
      caSessionId: "bad-session"
    });
    assert.equal(result.ok, false);
    assert.equal(await prisma.reviewFlag.count({ where: { registrationId: "reg_mira", type: "ingestion_exception" } }), before);
  });

  await test("valid CA signal creates Session and Evidence", async () => {
    const registered = await registerCAConnection(rider, "rp_mira");
    assert.equal(registered.ok, true);
    const connection = await prisma.cAConnection.findUnique({ where: { id: registered.id! } });
    await prisma.cAConnection.update({ where: { id: connection!.id }, data: { handshakeAt: new Date() } });
    const result = await ingestRidingSignal(signedSignal(connection!.connectorId, {
      messageId: "message-valid-ca",
      idempotencyKey: "good-key-valid",
      caConnectionId: connection!.id,
      caSessionId: "good-session"
    }));
    assert.equal(result.ok, true);
    const evidence = await prisma.evidence.findMany({ where: { registrationId: "reg_mira" } });
    assert.ok(evidence.length >= 1);
  });

  await test("forged CA signal without attestation is rejected", async () => {
    const registered = await registerCAConnection(rider, "rp_mira");
    assert.equal(registered.ok, true);
    await prisma.cAConnection.update({ where: { id: registered.id! }, data: { handshakeAt: new Date() } });
    const result = await ingestRidingSignal({
      messageId: "message-forged",
      timestamp: new Date().toISOString(),
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

  await test("tampered CA payload fails HMAC verification", async () => {
    const registered = await registerCAConnection(rider, "rp_mira");
    assert.equal(registered.ok, true);
    const connection = await prisma.cAConnection.update({ where: { id: registered.id! }, data: { handshakeAt: new Date() } });
    const signed = signedSignal(connection.connectorId, {
      messageId: "message-tamper-protected",
      idempotencyKey: "idempotency-tamper-protected",
      caConnectionId: connection.id,
      caSessionId: "tamper-session",
      tokens: 100
    });
    const result = await ingestRidingSignal({ ...signed, tokens: 999999 });
    assert.equal(result.ok, false);
    assert.equal(await prisma.cAIngestionReceipt.count({ where: { messageId: "message-tamper-protected" } }), 0);
  });


  await test("disabled CA signal is rejected", async () => {
    const registered = await registerCAConnection(rider, "rp_mira");
    assert.equal(registered.ok, true);
    await prisma.cAConnection.update({ where: { id: registered.id! }, data: { handshakeAt: new Date() } });
    const disabled = await disableCAConnection(rider, registered.id!);
    assert.equal(disabled.ok, true);
    const result = await ingestRidingSignal({ messageId: "message-disabled", timestamp: new Date().toISOString(), raceId: "race_bay_2026", registrationId: "reg_mira", raceProjectId: "rp_mira", caConnectionId: registered.id!, idempotencyKey: "disabled-key", caSessionId: "disabled-session" });
    assert.equal(result.ok, false);
  });

  await test("duplicate signed CA signal is ignored without duplicate Evidence", async () => {
    const registered = await registerCAConnection(rider, "rp_mira");
    assert.equal(registered.ok, true);
    const connection = await prisma.cAConnection.update({ where: { id: registered.id! }, data: { handshakeAt: new Date() } });
    const signal = signedSignal(connection.connectorId, {
      messageId: "message-replay-protected",
      idempotencyKey: "idempotency-replay-protected",
      caConnectionId: connection.id,
      caSessionId: "replay-session"
    });
    const before = await prisma.evidence.count();
    assert.equal((await ingestRidingSignal(signal)).ok, true);
    assert.equal((await ingestRidingSignal(signal)).ok, true);
    assert.equal(await prisma.evidence.count(), before + 1);
    assert.equal(await prisma.cAIngestionReceipt.count({ where: { caConnectionId: connection.id } }), 1);
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
    assert.equal(result.ok, true, result.message);
    const p0 = await prisma.releaseChecklistItem.findUnique({ where: { raceId_itemKey: { raceId: "race_bay_2026", itemKey: "p0_regression" } } });
    const backups = await prisma.backup.findMany({ where: { raceId: "race_bay_2026" } });
    assert.equal(p0?.status, "done");
    assert.ok(backups.length >= 1);
    const screen = await prisma.releaseChecklistItem.findUnique({ where: { raceId_itemKey: { raceId: "race_bay_2026", itemKey: "screen_rehearsal" } } });
    const goNoGo = await prisma.releaseChecklistItem.findUnique({ where: { raceId_itemKey: { raceId: "race_bay_2026", itemKey: "go_no_go" } } });
    assert.equal(screen?.status, "done");
    assert.equal(goNoGo?.status, "done");
    const p0Work = await prisma.work.findUnique({
      where: { registrationId: "reg_mira" },
      include: { currentVersion: true, assignments: { include: { judgingRecord: true } }, awards: true }
    });
    assert.ok(p0Work?.currentVersion);
    assert.ok(p0Work?.assignments.some((item) => item.workSubmissionVersionId === p0Work.currentVersionId && item.judgingRecord?.status === "submitted"));
    assert.ok(p0Work?.awards.some((item) => item.workSubmissionVersionId === p0Work.currentVersionId && item.status === "published"));
  });

  await prisma.$disconnect();

  if (process.exitCode) process.exit(process.exitCode);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
