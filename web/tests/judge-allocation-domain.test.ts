import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../lib/auth";
import {
  allocateRaceJudges,
  approveRegistration,
  getJudgeAllocationPreview,
  publishRaceReviewResults,
  rejectRegistration,
  saveRaceJudgePool,
  submitJudgingRecord
} from "../lib/domain";
import { prisma } from "../lib/prisma";
import { getRaceReviewAggregatesForUser } from "../lib/queries";

const suffix = randomUUID().slice(0, 8);
const raceId = `race_judge_${suffix}`;
const approvedRegistrationId = `reg_judge_${suffix}`;
const rejectedRegistrationId = `reg_reject_${suffix}`;
const tiedRegistrationId = `reg_tied_${suffix}`;
const workId = `work_judge_${suffix}`;
const versionId = `work_version_judge_${suffix}`;
const tiedWorkId = `work_tied_${suffix}`;
const tiedVersionId = `work_version_tied_${suffix}`;
const blockedRaceId = `race_judge_blocked_${suffix}`;
const organizer: AuthContext = {
  userId: "user_org_1",
  availableRoles: ["organizer", "judge"],
  activeRole: "organizer",
  profileCompleted: true,
  managedRaceIds: [raceId],
  approvedRegistrationIds: [],
  assignedWorkIds: []
};

async function main() {
  await prisma.race.create({
    data: {
      id: raceId, slug: raceId, title: "Atomic Judge Allocation", status: "running", visibility: "private",
      challenge: "test", summary: "test", organizerJson: JSON.stringify(["user_org_1"]),
      scheduleJson: JSON.stringify({ registration: "closed", submission: "locked" }), rulesJson: "{}", metricsJson: "{}",
      createdByUserId: "user_org_1", submissionLockedAt: new Date(), submissionLockedByUserId: "user_org_1"
    }
  });
  await prisma.registration.createMany({
    data: [
      { id: approvedRegistrationId, raceId, userId: "user_rider_1", status: "pending", submittedAt: new Date() },
      { id: rejectedRegistrationId, raceId, userId: "user_rider_2", status: "pending", submittedAt: new Date() },
      { id: tiedRegistrationId, raceId, userId: "user_org_2", status: "pending", submittedAt: new Date() }
    ]
  });

  const approved = await approveRegistration(organizer, approvedRegistrationId);
  assert.equal(approved.ok, true);
  assert.equal((await prisma.raceProject.count({ where: { registrationId: approvedRegistrationId } })), 1);
  assert.equal((await prisma.reviewFlag.count({ where: { registrationId: approvedRegistrationId, type: "no_ca_data" } })), 1);
  assert.equal((await approveRegistration(organizer, tiedRegistrationId)).ok, true);
  assert.equal((await approveRegistration(organizer, approvedRegistrationId)).ok, true);
  assert.equal((await prisma.raceProject.count({ where: { registrationId: approvedRegistrationId } })), 1);
  assert.equal((await prisma.reviewFlag.count({ where: { registrationId: approvedRegistrationId, type: "no_ca_data" } })), 1);

  assert.equal((await rejectRegistration(organizer, rejectedRegistrationId, "")).ok, false);
  assert.equal((await rejectRegistration(organizer, rejectedRegistrationId, "资料不完整")).ok, true);
  const rejected = await prisma.registration.findUniqueOrThrow({ where: { id: rejectedRegistrationId } });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.reviewNote, "资料不完整");

  await prisma.work.create({
    data: {
      id: workId, registrationId: approvedRegistrationId, slug: workId, title: "Atomic Work", summary: "test",
      status: "submitted", visibility: "review", repoUrl: "https://github.com/example/test", currentVersionId: null
    }
  });
  await prisma.workSubmissionVersion.create({
    data: {
      id: versionId, workId, versionNumber: 1, title: "Atomic Work", summary: "test",
      repoUrl: "https://github.com/example/test", repoCommitSha: "a".repeat(40), hashSchemaVersion: "test",
      integrityHash: "b".repeat(64), submittedByUserId: "user_rider_1", submittedAt: new Date()
    }
  });
  await prisma.work.update({ where: { id: workId }, data: { currentVersionId: versionId, versionCounter: 1 } });
  await prisma.work.create({
    data: {
      id: tiedWorkId, registrationId: tiedRegistrationId, slug: tiedWorkId, title: "Tied Atomic Work", summary: "test",
      status: "submitted", visibility: "review", repoUrl: "https://github.com/example/tied", currentVersionId: null
    }
  });
  await prisma.workSubmissionVersion.create({
    data: {
      id: tiedVersionId, workId: tiedWorkId, versionNumber: 1, title: "Tied Atomic Work", summary: "test",
      repoUrl: "https://github.com/example/tied", repoCommitSha: "c".repeat(40), hashSchemaVersion: "test",
      integrityHash: "d".repeat(64), submittedByUserId: "user_org_2", submittedAt: new Date()
    }
  });
  await prisma.work.update({ where: { id: tiedWorkId }, data: { currentVersionId: tiedVersionId, versionCounter: 1 } });

  const judges = ["user_org_1", "user_judge_1", "user_multi_1"];
  assert.equal((await saveRaceJudgePool(organizer, raceId, judges)).ok, true);
  const readyPreview = await getJudgeAllocationPreview(organizer, raceId);
  assert.deepEqual(readyPreview.blockers, []);
  assert.equal(readyPreview.workCount, 2);
  const allocated = await allocateRaceJudges(organizer, raceId, "deterministic-test-seed");
  assert.equal(allocated.ok, true);
  const assignments = await prisma.judgeAssignment.findMany({ where: { raceId }, orderBy: [{ workId: "asc" }, { slot: "asc" }] });
  const primaryAssignments = assignments.filter((assignment) => assignment.workId === workId);
  const tiedAssignments = assignments.filter((assignment) => assignment.workId === tiedWorkId);
  assert.equal(assignments.length, 6);
  assert.deepEqual(primaryAssignments.map((assignment) => assignment.slot), [1, 2, 3]);
  assert.equal(new Set(primaryAssignments.map((assignment) => assignment.judgeUserId)).size, 3);
  await assert.rejects(() => prisma.judgeAssignment.create({
    data: {
      id: `assign_slot4_${suffix}`, raceId, workId, judgeUserId: "user_rider_2", assignedByUserId: "user_org_1",
      status: "assigned", assignedAt: new Date(), slot: 4, workSubmissionVersionId: versionId
    }
  }));
  await assert.rejects(() => prisma.judgeAssignment.create({
    data: {
      id: `assign_duplicate_slot_${suffix}`, raceId, workId, judgeUserId: "user_org_2", assignedByUserId: "user_org_1",
      status: "assigned", assignedAt: new Date(), slot: 1, workSubmissionVersionId: versionId
    }
  }));
  assert.equal((await allocateRaceJudges(organizer, raceId, "second-seed")).ok, true);
  assert.equal(await prisma.judgeAssignment.count({ where: { workId } }), 3);

  const invalidJudge: AuthContext = { ...organizer, userId: primaryAssignments[0].judgeUserId, activeRole: "judge", availableRoles: ["judge"] };
  assert.equal((await submitJudgingRecord(invalidJudge, primaryAssignments[0].id, { scoreResult: 100.5, scoreRiding: 90, comments: "invalid" })).ok, false);
  assert.equal((await getRaceReviewAggregatesForUser(primaryAssignments[0].judgeUserId, "judge", raceId))[0].overall, null);
  assert.equal((await getRaceReviewAggregatesForUser("user_rider_1", "rider", raceId))[0].overall, null);

  for (const assignment of [...primaryAssignments.slice(0, 2), ...tiedAssignments.slice(0, 2)]) {
    const judge: AuthContext = { ...organizer, userId: assignment.judgeUserId, activeRole: "judge", availableRoles: ["judge"] };
    const submitted = await submitJudgingRecord(judge, assignment.id, {
      scoreResult: 80, scoreRiding: 70, comments: `review ${assignment.id}`
    });
    assert.equal(submitted.ok, true);
  }
  const lastPrimaryJudge: AuthContext = { ...organizer, userId: primaryAssignments[2].judgeUserId, activeRole: "judge", availableRoles: ["judge"] };
  const [lastPrimarySubmission, prematurePublish] = await Promise.all([
    submitJudgingRecord(lastPrimaryJudge, primaryAssignments[2].id, { scoreResult: 80, scoreRiding: 70, comments: "concurrent final review" }),
    publishRaceReviewResults(organizer, raceId)
  ]);
  assert.equal(lastPrimarySubmission.ok, true);
  assert.equal(prematurePublish.ok, false);
  assert.equal((await prisma.judgingRecord.findUnique({ where: { assignmentId: primaryAssignments[2].id } }))?.status, "submitted");
  const lastTiedJudge: AuthContext = { ...organizer, userId: tiedAssignments[2].judgeUserId, activeRole: "judge", availableRoles: ["judge"] };
  assert.equal((await submitJudgingRecord(lastTiedJudge, tiedAssignments[2].id, { scoreResult: 80, scoreRiding: 70, comments: "tie" })).ok, true);

  const aggregates = await getRaceReviewAggregatesForUser("user_org_1", "organizer", raceId);
  assert.equal(aggregates.length, 2);
  assert.equal(aggregates[0].avgResult, 80);
  assert.equal(aggregates[0].avgRiding, 70);
  assert.equal(aggregates[0].overall, 75);
  assert.equal(aggregates[0].rank, 1);
  assert.equal(aggregates[1].rank, 1);
  assert.equal((await getRaceReviewAggregatesForUser(primaryAssignments[0].judgeUserId, "judge", raceId)).find((item) => item.workId === workId)?.overall, 75);
  assert.equal((await getRaceReviewAggregatesForUser("user_rider_1", "rider", raceId))[0].overall, null);
  assert.equal((await publishRaceReviewResults(organizer, raceId)).ok, true);
  assert.equal((await getRaceReviewAggregatesForUser("user_rider_1", "rider", raceId))[0].overall, 75);
  assert.deepEqual(await getRaceReviewAggregatesForUser("user_admin_1", "admin", raceId), []);
  const lockedJudge: AuthContext = { ...organizer, userId: primaryAssignments[0].judgeUserId, activeRole: "judge", availableRoles: ["judge"] };
  assert.equal((await submitJudgingRecord(lockedJudge, primaryAssignments[0].id, { scoreResult: 90, scoreRiding: 90, comments: "late" })).ok, false);

  await prisma.race.create({
    data: {
      id: blockedRaceId, slug: blockedRaceId, title: "Blocked Judge Allocation", status: "running", visibility: "private",
      challenge: "test", summary: "test", organizerJson: JSON.stringify(["user_org_1"]),
      scheduleJson: JSON.stringify({ registration: "closed", submission: "locked" }), rulesJson: "{}", metricsJson: "{}",
      createdByUserId: "user_org_1", submissionLockedAt: new Date(), submissionLockedByUserId: "user_org_1"
    }
  });
  const blockedRegistrationId = `reg_blocked_${suffix}`;
  const blockedWorkId = `work_blocked_${suffix}`;
  const blockedVersionId = `version_blocked_${suffix}`;
  await prisma.registration.create({ data: { id: blockedRegistrationId, raceId: blockedRaceId, userId: "user_judge_1", status: "approved", submittedAt: new Date(), approvedAt: new Date() } });
  await prisma.work.create({ data: { id: blockedWorkId, registrationId: blockedRegistrationId, slug: blockedWorkId, title: "Blocked Work", summary: "test", status: "submitted", visibility: "review", currentVersionId: null } });
  await prisma.workSubmissionVersion.create({ data: { id: blockedVersionId, workId: blockedWorkId, versionNumber: 1, title: "Blocked Work", summary: "test", repoUrl: "https://github.com/example/blocked", repoCommitSha: "e".repeat(40), hashSchemaVersion: "test", integrityHash: "f".repeat(64), submittedByUserId: "user_judge_1", submittedAt: new Date() } });
  await prisma.work.update({ where: { id: blockedWorkId }, data: { currentVersionId: blockedVersionId, versionCounter: 1 } });
  await prisma.raceJudgeMembership.createMany({ data: judges.map((judgeUserId) => ({ id: `blocked_${judgeUserId}_${suffix}`, raceId: blockedRaceId, judgeUserId, selectedByUserId: "user_org_1", status: "active", selectedAt: new Date() })) });
  const blockedOrganizer = { ...organizer, managedRaceIds: [blockedRaceId] };
  const blockedPreview = await getJudgeAllocationPreview(blockedOrganizer, blockedRaceId);
  assert.ok(blockedPreview.blockers.some((blocker) => blocker.includes("正在参与本场赛事")));
  assert.ok(blockedPreview.blockers.some((blocker) => blocker.includes("不足三人")));
  assert.equal((await allocateRaceJudges(blockedOrganizer, blockedRaceId, "blocked-seed")).ok, false);
  assert.equal(await prisma.judgeAssignment.count({ where: { raceId: blockedRaceId } }), 0);
  console.log("judge allocation domain tests passed");
}

main()
  .finally(async () => {
    const raceIds = [raceId, blockedRaceId];
    const workIds = (await prisma.work.findMany({ where: { registration: { raceId: { in: raceIds } } }, select: { id: true } })).map((work) => work.id);
    const assignmentIds = (await prisma.judgeAssignment.findMany({ where: { raceId: { in: raceIds } }, select: { id: true } })).map((assignment) => assignment.id);
    await prisma.judgingRecord.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
    await prisma.judgeAssignment.deleteMany({ where: { raceId: { in: raceIds } } });
    await prisma.judgeAllocationBatch.deleteMany({ where: { raceId: { in: raceIds } } });
    await prisma.raceJudgeMembership.deleteMany({ where: { raceId: { in: raceIds } } });
    await prisma.reviewFlag.deleteMany({ where: { raceId: { in: raceIds } } });
    await prisma.workSubmissionVersion.deleteMany({ where: { workId: { in: workIds } } });
    await prisma.work.deleteMany({ where: { id: { in: workIds } } });
    await prisma.raceProject.deleteMany({ where: { registration: { raceId: { in: raceIds } } } });
    await prisma.registration.deleteMany({ where: { raceId: { in: raceIds } } });
    await prisma.race.deleteMany({ where: { id: { in: raceIds } } });
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
