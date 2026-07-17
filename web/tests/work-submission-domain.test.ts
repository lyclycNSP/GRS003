import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  allocateRaceJudges,
  configureSubmissionWindow,
  lockSubmissionWindow,
  publishAward,
  publishWork,
  reopenSubmissionWindow,
  saveRaceJudgePool,
  submitWork
} from "../lib/domain";
import type { AuthContext } from "../lib/auth";
import { getWorkBySlug } from "../lib/queries";

const prisma = new PrismaClient();
const suffix = Date.now().toString(36);
const testRaceId = `race_submission_${suffix}`;
const testRegistrationId = `reg_submission_${suffix}`;
const otherRegistrationId = `reg_submission_other_${suffix}`;

const rider: AuthContext = {
  userId: "user_rider_1",
  availableRoles: ["rider"],
  activeRole: "rider",
  profileCompleted: true,
  managedRaceIds: [],
  approvedRegistrationIds: [testRegistrationId],
  assignedWorkIds: []
};

const organizer: AuthContext = {
  userId: "user_org_1",
  availableRoles: ["organizer"],
  activeRole: "organizer",
  profileCompleted: true,
  managedRaceIds: [testRaceId, "race_finance_2026"],
  approvedRegistrationIds: [],
  assignedWorkIds: []
};

const admin: AuthContext = { ...organizer, availableRoles: ["admin"], activeRole: "admin" };
const otherRider: AuthContext = { ...rider, userId: "user_rider_2", approvedRegistrationIds: [otherRegistrationId] };

async function main() {
  await prisma.race.create({
    data: {
      id: testRaceId,
      slug: `submission-integrity-${suffix}`,
      title: "Submission Integrity Test",
      status: "running",
      visibility: "review",
      challenge: "Test immutable Work versions.",
      summary: "Isolated domain test race.",
      organizerJson: JSON.stringify(["user_org_1"]),
      scheduleJson: "{}",
      rulesJson: "{}",
      metricsJson: "{}",
      createdByUserId: "user_org_1",
      submissionOpensAt: new Date(Date.now() - 60_000),
      submissionClosesAt: new Date(Date.now() + 3_600_000)
    }
  });
  await prisma.registration.create({
    data: { id: testRegistrationId, raceId: testRaceId, userId: rider.userId, status: "approved", submittedAt: new Date(), approvedAt: new Date() }
  });
  await prisma.registration.create({
    data: { id: otherRegistrationId, raceId: testRaceId, userId: otherRider.userId, status: "approved", submittedAt: new Date(), approvedAt: new Date() }
  });

  const first = await submitWork(rider, testRegistrationId, {
    title: "Immutable Work v1",
    summary: "First immutable version.",
    demoUrl: "https://demo.example.com/v1",
    repoUrl: "https://github.com/example/immutable-work",
    repoCommitSha: "1".repeat(40)
  });
  assert.equal(first.ok, true, first.message);
  const otherRiderOverride = await submitWork(otherRider, testRegistrationId, {
    title: "Immutable Work v1",
    summary: "Must not submit for another Rider.",
    repoUrl: "https://github.com/example/immutable-work",
    repoCommitSha: "8".repeat(40)
  });
  assert.equal(otherRiderOverride.ok, false);
  assert.match(otherRiderOverride.message, /本人/);
  const sameTitle = await submitWork(otherRider, otherRegistrationId, {
    title: "Immutable Work v1",
    summary: "A different Rider may use the same title.",
    repoUrl: "https://github.com/example/other-immutable-work",
    repoCommitSha: "8".repeat(40)
  });
  assert.equal(sameTitle.ok, true, sameTitle.message);
  const sameTitleWorks = await prisma.work.findMany({ where: { id: { in: [first.id!, sameTitle.id!] } } });
  assert.equal(new Set(sameTitleWorks.map((item) => item.slug)).size, 2);

  const scheduled = await configureSubmissionWindow(organizer, testRaceId, {
    opensAt: new Date(Date.now() + 3_600_000),
    closesAt: new Date(Date.now() + 7_200_000)
  });
  assert.equal(scheduled.ok, true, scheduled.message);
  const submissionBeforeStart = await submitWork(rider, testRegistrationId, {
    title: "Too early",
    summary: "Must remain v1.",
    repoUrl: "https://github.com/example/immutable-work",
    repoCommitSha: "9".repeat(40)
  });
  assert.equal(submissionBeforeStart.ok, false);
  assert.match(submissionBeforeStart.message, /not_started/);
  const assignmentBeforeStart = await allocateRaceJudges(organizer, testRaceId, "before-start");
  assert.equal(assignmentBeforeStart.ok, false);
  assert.match(assignmentBeforeStart.message, /关闭/);
  const publicationBeforeStart = await publishWork(organizer, first.id!);
  assert.equal(publicationBeforeStart.ok, false);
  assert.match(publicationBeforeStart.message, /关闭/);
  const awardBeforeStart = await publishAward(organizer, {
    raceId: testRaceId,
    registrationId: testRegistrationId,
    workId: first.id!,
    awardName: "Too Early Award",
    rank: 8,
    reason: "Must not publish before the version is frozen."
  });
  assert.equal(awardBeforeStart.ok, false);
  assert.match(awardBeforeStart.message, /冻结/);
  const opened = await configureSubmissionWindow(organizer, testRaceId, {
    opensAt: new Date(Date.now() - 60_000),
    closesAt: new Date(Date.now() + 3_600_000)
  });
  assert.equal(opened.ok, true, opened.message);

  const second = await submitWork(rider, testRegistrationId, {
    title: "Immutable Work v2",
    summary: "Second immutable version.",
    demoUrl: "https://demo.example.com/v2",
    repoUrl: "https://github.com/example/immutable-work",
    repoCommitSha: "2".repeat(40)
  });
  assert.equal(second.ok, true, second.message);
  assert.equal(second.id, first.id);

  const work = await prisma.work.findUnique({
    where: { id: first.id! },
    include: { currentVersion: true, submissionVersions: { orderBy: { versionNumber: "asc" } } }
  });
  assert.equal(work?.versionCounter, 2);
  assert.equal(work?.currentVersion?.versionNumber, 2);
  assert.equal(work?.currentVersion?.repoCommitSha, "2".repeat(40));
  assert.equal(work?.currentVersion?.repositoryVerificationStatus, "verified");
  assert.equal(work?.currentVersion?.hashSchemaVersion, "ary.work-submission.v2");
  assert.equal(work?.submissionVersions.length, 2);
  assert.equal(work?.submissionVersions[0].title, "Immutable Work v1");
  assert.equal(work?.submissionVersions[0].repoCommitSha, "1".repeat(40));
  assert.match(work?.submissionVersions[0].integrityHash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(await prisma.submissionAuditEvent.count({ where: { workId: work!.id, action: "version_submitted" } }), 2);

  const organizerSubmission = await submitWork(organizer, testRegistrationId, {
    title: "Organizer override",
    summary: "Must not be accepted.",
    repoUrl: "https://github.com/example/immutable-work",
    repoCommitSha: "3".repeat(40)
  });
  assert.equal(organizerSubmission.ok, false);
  assert.match(organizerSubmission.message, /本人/);

  await prisma.registration.update({ where: { id: testRegistrationId }, data: { status: "pending" } });
  const pendingSubmission = await submitWork(rider, testRegistrationId, {
    title: "Pending registration",
    summary: "Must not be accepted.",
    repoUrl: "https://github.com/example/immutable-work",
    repoCommitSha: "4".repeat(40)
  });
  assert.equal(pendingSubmission.ok, false);
  assert.match(pendingSubmission.message, /审核通过/);
  await prisma.registration.update({ where: { id: testRegistrationId }, data: { status: "approved" } });

  const configured = await configureSubmissionWindow(organizer, testRaceId, {
    opensAt: new Date(Date.now() - 60_000),
    closesAt: new Date(Date.now() + 7_200_000)
  });
  assert.equal(configured.ok, true, configured.message);

  const assignmentWhileOpen = await allocateRaceJudges(organizer, testRaceId, "while-open");
  assert.equal(assignmentWhileOpen.ok, false);
  assert.match(assignmentWhileOpen.message, /关闭/);

  await prisma.race.update({ where: { id: testRaceId }, data: { submissionClosesAt: new Date(Date.now() - 1_000) } });
  const submissionAfterDeadline = await submitWork(rider, testRegistrationId, {
    title: "After deadline",
    summary: "Must not create v3.",
    repoUrl: "https://github.com/example/immutable-work",
    repoCommitSha: "5".repeat(40)
  });
  assert.equal(submissionAfterDeadline.ok, false);
  assert.match(submissionAfterDeadline.message, /closed_by_deadline/);
  const deadlineReopened = await reopenSubmissionWindow(admin, testRaceId, {
    closesAt: new Date(Date.now() + 7_200_000),
    reason: "截止后紧急延期"
  });
  assert.equal(deadlineReopened.ok, true, deadlineReopened.message);

  const locked = await lockSubmissionWindow(organizer, testRaceId, "材料已齐，提前进入评审");
  assert.equal(locked.ok, true, locked.message);
  const raceAfterLock = await prisma.race.findUnique({ where: { id: testRaceId } });
  assert.ok(raceAfterLock?.submissionLockedAt);
  assert.equal(raceAfterLock?.submissionLockReason, "材料已齐，提前进入评审");
  const submissionWhileLocked = await submitWork(rider, testRegistrationId, {
    title: "While locked",
    summary: "Must not create v3.",
    repoUrl: "https://github.com/example/immutable-work",
    repoCommitSha: "6".repeat(40)
  });
  assert.equal(submissionWhileLocked.ok, false);
  assert.match(submissionWhileLocked.message, /closed_manually/);
  await assert.rejects(
    () => reopenSubmissionWindow(organizer, testRaceId, { closesAt: new Date(Date.now() + 10_800_000), reason: "Organizer不得解锁" }),
    /FORBIDDEN/
  );

  const reopened = await reopenSubmissionWindow(admin, testRaceId, {
    closesAt: new Date(Date.now() + 10_800_000),
    reason: "评审尚未分配，批准延长"
  });
  assert.equal(reopened.ok, true, reopened.message);

  await lockSubmissionWindow(organizer, testRaceId, "正式冻结");
  await prisma.userRole.create({
    data: { id: `role_conflicted_judge_${suffix}`, userId: otherRider.userId, role: "judge", status: "active", source: "test" }
  });
  const conflictedPool = await saveRaceJudgePool(organizer, testRaceId, [otherRider.userId, "user_judge_1", "user_multi_1"]);
  assert.equal(conflictedPool.ok, false);
  assert.match(conflictedPool.message, /参.*赛|冲突|资格/);
  assert.equal((await saveRaceJudgePool(organizer, testRaceId, ["user_org_1", "user_judge_1", "user_multi_1"])).ok, true);
  const allocation = await allocateRaceJudges(organizer, testRaceId, "work-submission-test-seed");
  assert.equal(allocation.ok, true, allocation.message);
  const storedAssignment = await prisma.judgeAssignment.findUnique({ where: { workId_judgeUserId: { workId: work!.id, judgeUserId: "user_judge_1" } } });
  assert.equal(storedAssignment?.workSubmissionVersionId, work?.currentVersionId);
  const submissionAfterAssignment = await submitWork(rider, testRegistrationId, {
    title: "After assignment",
    summary: "Must not create v3.",
    repoUrl: "https://github.com/example/immutable-work",
    repoCommitSha: "7".repeat(40)
  });
  assert.equal(submissionAfterAssignment.ok, false);
  assert.match(submissionAfterAssignment.message, /sealed_for_judging/);

  const award = await publishAward(organizer, {
    raceId: testRaceId,
    registrationId: testRegistrationId,
    workId: work!.id,
    awardName: "Immutable Work Award",
    rank: 9,
    reason: "The reviewed version is pinned."
  });
  assert.equal(award.ok, true, award.message);
  const storedAward = await prisma.award.findUnique({ where: { id: award.id! } });
  assert.equal(storedAward?.workSubmissionVersionId, work?.currentVersionId);

  const published = await publishWork(organizer, work!.id);
  assert.equal(published.ok, true, published.message);
  const publicWork = await getWorkBySlug(work!.slug);
  assert.equal(publicWork?.submissionVersion?.versionNumber, 2);
  assert.equal(publicWork?.submissionVersion?.repoCommitSha, "2".repeat(40));
  assert.match(publicWork?.submissionVersion?.integrityHash ?? "", /^[a-f0-9]{64}$/);
  const publicJson = JSON.stringify(publicWork);
  assert.equal(publicJson.includes("submittedByUserId"), false);
  assert.equal(publicJson.includes("submissionAuditEvents"), false);
  assert.equal(publicJson.includes("submissionLockReason"), false);

  const reopenAfterAssignment = await reopenSubmissionWindow(admin, testRaceId, {
    closesAt: new Date(Date.now() + 14_400_000),
    reason: "不应允许"
  });
  assert.equal(reopenAfterAssignment.ok, false);
  assert.match(reopenAfterAssignment.message, /评审分配/);

  const publishLegacy = await publishWork(organizer, "work-finance-legacy");
  assert.equal(publishLegacy.ok, false);
  assert.match(publishLegacy.message, /版本化/);
  const publicLegacy = await getWorkBySlug("finance-legacy-work");
  assert.equal(publicLegacy?.title, "Legacy Finance Notes");
  assert.equal(publicLegacy?.submissionVersion, null);
}

main()
  .then(() => console.log("PASS creates immutable Work submission versions"))
  .catch((error) => {
    console.error("FAIL creates immutable Work submission versions");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
