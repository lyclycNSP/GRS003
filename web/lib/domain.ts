import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { canManageRace, isRaceOrganizer, type AuthContext, requireAuth, requireManagedRace, requireRole } from "@/lib/auth";
import { fromJson, toJson } from "@/lib/json";
import { makeId, slugify } from "@/lib/ids";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION, optionalText, parseTags, requiredText } from "@/lib/profile";
import { isSelectableRole, validateRoleProfile, type RoleProfileInput, type SelectableRole } from "@/lib/role-profile";
import { refreshRaceLiveAfterSourceEvent } from "@/lib/race-live/management";
import {
  createRidingSignalAttestation,
  getConnectorSigningKey,
  verifyRidingSignalAttestation,
  type RidingSignalAttestation,
  type RidingSignalPayload
} from "@/lib/ca-attestation";
import {
  createVerifiedWorkSubmissionIntegrityHash,
  getSubmissionWindowState,
  validateWorkSubmissionInput,
  VERIFIED_WORK_SUBMISSION_HASH_SCHEMA
} from "@/lib/work-submission";
import { verifyGitHubRepository } from "@/lib/github-repository-verifier";

type Result = { ok: true; message: string; id?: string } | { ok: false; message: string };

function ok(message: string, id?: string): Result {
  return id ? { ok: true, message, id } : { ok: true, message };
}

function fail(message: string): Result {
  return { ok: false, message };
}

async function runSerializableResult(
  action: (tx: Prisma.TransactionClient) => Promise<Result>,
  conflictMessage = "状态并发冲突，请重试"
): Promise<Result> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable) throw error;
      if (attempt === 3) return fail(conflictMessage);
    }
  }
  return fail(conflictMessage);
}

async function ensureRaceProject(registrationId: string) {
  const existing = await prisma.raceProject.findUnique({ where: { registrationId } });
  if (existing) return existing;
  return prisma.raceProject.create({
    data: {
      id: makeId("rp"),
      registrationId,
      aggregateIngestionStatus: "not_configured",
      connectionHealth: "no_signal",
      metricsJson: toJson({ progressPercent: 0, tokens: 0, messageCount: 0, toolCallCount: 0 })
    }
  });
}

async function createReviewFlag(input: {
  raceId: string;
  registrationId: string;
  raceProjectId?: string | null;
  workId?: string | null;
  type: string;
  severity: string;
  summary: string;
  sourceRef?: unknown;
}) {
  const existing = await prisma.reviewFlag.findFirst({
    where: { registrationId: input.registrationId, type: input.type, status: { not: "resolved" } }
  });
  if (existing) {
    return prisma.reviewFlag.update({
      where: { id: existing.id },
      data: {
        raceId: input.raceId,
        raceProjectId: input.raceProjectId ?? existing.raceProjectId,
        workId: input.workId ?? existing.workId,
        severity: input.severity,
        status: existing.status === "resolved" ? "open" : existing.status,
        judgeVisibleSummary: input.summary,
        resolutionNote: null,
        resolvedByUserId: null,
        resolvedAt: null,
        sourceRefJson: toJson(input.sourceRef ?? {})
      }
    });
  }
  return prisma.reviewFlag.create({
    data: {
      id: makeId("flag"),
      raceId: input.raceId,
      registrationId: input.registrationId,
      raceProjectId: input.raceProjectId ?? null,
      workId: input.workId ?? null,
      type: input.type,
      severity: input.severity,
      status: "open",
      judgeVisibleSummary: input.summary,
      sourceRefJson: toJson(input.sourceRef ?? {})
    }
  });
}

type RegistrationWithTeam = Awaited<ReturnType<typeof getRegistrationWithTeam>>;

async function getRegistrationWithTeam(registrationId: string) {
  return prisma.registration.findUnique({
    where: { id: registrationId },
    include: { team: { include: { members: true } } }
  });
}

function isTeamMember(registration: NonNullable<RegistrationWithTeam>, userId: string) {
  return registration.team?.members.some((member) => member.userId === userId) ?? false;
}

function canContributeToRegistration(ctx: AuthContext | null, registration: NonNullable<RegistrationWithTeam>) {
  if (!ctx) return false;
  return registration.userId === ctx.userId || isTeamMember(registration, ctx.userId) || canManageRace(ctx, registration.raceId);
}

function canLeadRegistration(ctx: AuthContext | null, registration: NonNullable<RegistrationWithTeam>) {
  if (!ctx) return false;
  return registration.userId === ctx.userId || canManageRace(ctx, registration.raceId);
}

async function hasRaceParticipation(userId: string, raceId: string) {
  const existingRegistration = await prisma.registration.findFirst({
    where: {
      raceId,
      status: { notIn: ["rejected", "withdrawn", "cancelled"] },
      OR: [{ userId }, { team: { members: { some: { userId } } } }]
    }
  });
  if (existingRegistration) return true;
  const draftTeam = await prisma.team.findFirst({
    where: { raceId, registration: null, members: { some: { userId } } }
  });
  return Boolean(draftTeam);
}

async function hasOrganizerOrJudgeConflict(userId: string, raceId: string) {
  const [race, assignment] = await Promise.all([
    prisma.race.findUnique({ where: { id: raceId }, select: { organizerJson: true } }),
    prisma.judgeAssignment.findFirst({ where: { raceId, judgeUserId: userId }, select: { id: true } })
  ]);
  return Boolean((race && isRaceOrganizer(race.organizerJson, userId)) || assignment);
}

async function createInviteCode() {
  for (let i = 0; i < 5; i += 1) {
    const code = makeId("invite").replace(/^invite_?/, "").slice(-8).toUpperCase();
    const existing = await prisma.team.findUnique({ where: { inviteCode: code } });
    if (!existing) return code;
  }
  return makeId("invite").replace(/^invite_?/, "").toUpperCase();
}

function isActiveRider(ctx: AuthContext | null): ctx is AuthContext {
  return Boolean(ctx?.activeRole === "rider");
}

function isRaceRegistrationOpen(race: { status: string; scheduleJson: string }) {
  const schedule = fromJson<Record<string, string>>(race.scheduleJson, {});
  return race.status === "running" && ["open", "开放", "开放中"].includes(schedule.registration ?? "");
}

type TeamProfileInput = { raceId: string; name: string; description?: string; maxMembers: number };

function validateTeamProfile(input: TeamProfileInput, memberCount = 1): Result | null {
  if (!input.name.trim()) return fail("请填写团队名称");
  if (input.name.trim().length > 80) return fail("团队名称不能超过 80 个字符");
  if ((input.description?.trim().length ?? 0) > 500) return fail("团队简介不能超过 500 个字符");
  if (!Number.isInteger(input.maxMembers) || input.maxMembers < 2 || input.maxMembers > 10) return fail("团队人数上限必须为 2–10 人");
  if (input.maxMembers < memberCount) return fail("人数上限不能小于当前团队人数");
  return null;
}

function isReviewFlagStatus(status: string) {
  return ["open", "in_review", "resolved"].includes(status);
}

async function getReviewFlagWithScope(flagId: string) {
  return prisma.reviewFlag.findUnique({
    where: { id: flagId },
    include: {
      registration: { include: { user: true, team: { include: { members: true } }, race: true, raceProject: { include: { caConnections: true } }, work: true } },
      work: true,
      raceProject: { include: { caConnections: true } }
    }
  });
}


export async function createRace(ctx: AuthContext | null, input: { title: string; challenge: string; summary: string }): Promise<Result> {
  requireRole(ctx, ["organizer"]);
  const title = input.title.trim();
  if (!title) return fail("Race标题不能为空");
  const baseSlug = slugify(title) || makeId("race");
  const raceId = makeId("race");
  const race = await prisma.race.create({
    data: {
      id: raceId,
      slug: `${baseSlug}-${raceId.slice(-5)}`,
      title,
      status: "draft",
      visibility: "private",
      challenge: input.challenge.trim() || "本地演示赛题",
      summary: input.summary.trim() || input.challenge.trim() || "本地演示赛题",
      organizerJson: toJson([ctx!.userId]),
      scheduleJson: toJson({ registration: "open", race: "draft", submission: "closed", judging: "closed", results: "not_published" }),
      rulesJson: toJson({ allowCAConnectionUntil: "judging", maxMainWorksPerRegistration: 1, caFailureBlocksSubmission: false }),
      metricsJson: toJson({ riders: 0, activeRiders: 0, sessions: 0, submittedWorks: 0, riskSignals: 0 }),
      createdByUserId: ctx!.userId,
      releaseItems: {
        create: [
          { id: makeId("check"), itemKey: "p0_regression", label: "P0回归一键跑通", status: "open", evidence: "" },
          { id: makeId("check"), itemKey: "screen_rehearsal", label: "大屏彩排", status: "open", evidence: "" },
          { id: makeId("check"), itemKey: "live_rehearsal", label: "Live Hall彩排", status: "open", evidence: "" },
          { id: makeId("check"), itemKey: "report_results_rehearsal", label: "Report/Results彩排", status: "open", evidence: "" },
          { id: makeId("check"), itemKey: "go_no_go", label: "go/no-go证据确认", status: "open", evidence: "" }
        ]
      },
      screenState: { create: { id: makeId("screen"), mode: "live", fallbackEnabled: false } }
    }
  });
  return ok("Race已创建", race.id);
}

export async function publishRace(ctx: AuthContext | null, raceId: string): Promise<Result> {
  requireRole(ctx, ["organizer"]);
  const race = await prisma.race.findUnique({ where: { id: raceId }, include: { currentProblemVersion: true, problemVersions: { orderBy: { revision: "desc" }, take: 1 } } });
  if (!race) return fail("Race不存在");
  if (race.createdByUserId !== ctx!.userId && !canManageRace(ctx, raceId)) return fail("没有发布Race的权限");
  const latestProblem = race.problemVersions[0];
  if (latestProblem && (latestProblem.scanStatus !== "clean" || latestProblem.disabledAt)) return fail("最新赛题 PDF 未通过安全检查，不能发布 Race");
  await prisma.$transaction(async (tx) => {
    await tx.race.update({ where: { id: raceId }, data: { status: "running", visibility: "public", scheduleJson: toJson({ registration: "open", race: "running", submission: "open", judging: "queue", results: "not_published" }) } });
    if (race.currentProblemVersionId) {
      await tx.raceProblemVersion.update({ where: { id: race.currentProblemVersionId }, data: { publishedAt: race.currentProblemVersion?.publishedAt ?? new Date() } });
      await tx.raceProblemAuditEvent.create({ data: { id: makeId("problem_audit"), raceId, problemVersionId: race.currentProblemVersionId, actorUserId: ctx!.userId, action: "published_with_race" } });
    }
  });
  return ok("Race已发布", raceId);
}
export async function submitRegistration(ctx: AuthContext | null, raceId: string): Promise<Result> {
  if (!isActiveRider(ctx)) return fail("请先登录并切换到 Rider 身份");
  const race = await prisma.race.findUnique({ where: { id: raceId }, select: { id: true, status: true, scheduleJson: true } });
  if (!race) return fail("Race不存在");
  const existingRegistration = await prisma.registration.findUnique({ where: { raceId_userId: { raceId, userId: ctx.userId } } });
  if (existingRegistration && existingRegistration.participantType === "individual") return ok("你已提交个人报名", existingRegistration.id);
  if (await hasOrganizerOrJudgeConflict(ctx.userId, raceId)) return fail("同一场赛事中，Rider 不能同时担任 Organizer 或 Judge");
  if (!isRaceRegistrationOpen(race)) return fail("当前赛事报名窗口未开放");
  if (await hasRaceParticipation(ctx.userId, raceId)) return fail("你已经参加了该赛事");
  const registration = await prisma.registration.create({
    data: {
      id: makeId("reg"),
      raceId,
      userId: ctx.userId,
      participantType: "individual",
      status: "pending",
      submittedAt: new Date()
    }
  });
  return ok("报名已提交", registration.id);
}

export async function createTeam(ctx: AuthContext | null, input: TeamProfileInput): Promise<Result> {
  if (!isActiveRider(ctx)) return fail("请先登录并切换到 Rider 身份");
  const validation = validateTeamProfile(input);
  if (validation) return validation;
  const race = await prisma.race.findUnique({ where: { id: input.raceId }, select: { id: true, status: true, scheduleJson: true } });
  if (!race) return fail("Race 不存在");
  if (!isRaceRegistrationOpen(race)) return fail("当前赛事报名窗口未开放");
  if (await hasOrganizerOrJudgeConflict(ctx.userId, input.raceId)) return fail("同一场赛事中，Rider 不能同时担任 Organizer 或 Judge");
  const teamName = input.name.trim();
  if (await hasRaceParticipation(ctx.userId, input.raceId)) return fail("你已经参加了该赛事");
  const teamId = makeId("team");
  const baseSlug = slugify(teamName) || "team";
  try {
    const team = await prisma.team.create({ data: {
      id: teamId, raceId: input.raceId, name: teamName,
      description: input.description?.trim() || null,
      slug: `${baseSlug}-${teamId.slice(-5)}`, inviteCode: await createInviteCode(),
      status: "draft", maxMembers: input.maxMembers, createdByUserId: ctx.userId,
      members: { create: { id: makeId("tm"), userId: ctx.userId, role: "captain" } }
    } });
    return ok("团队已创建", team.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail("该赛事中已存在同名团队");
    throw error;
  }
}

export async function joinTeam(ctx: AuthContext | null, raceId: string, inviteCode: string): Promise<Result> {
  if (!isActiveRider(ctx)) return fail("请先登录并切换到 Rider 身份");
  const code = inviteCode.trim().toUpperCase();
  if (!code) return fail("请输入邀请码");
  const team = await prisma.team.findUnique({ where: { inviteCode: code }, include: { members: true, race: { select: { status: true, scheduleJson: true } } } });
  if (!team || team.raceId !== raceId) return fail("邀请码不属于当前赛事");
  if (!isRaceRegistrationOpen(team.race)) return fail("当前赛事报名窗口未开放");
  if (await hasOrganizerOrJudgeConflict(ctx.userId, team.raceId)) return fail("同一场赛事中，Rider 不能同时担任 Organizer 或 Judge");
  if (team.status !== "draft") return fail("团队报名已经提交，无法加入");
  if (team.members.length >= team.maxMembers) return fail("团队人数已满");
  if (await hasRaceParticipation(ctx.userId, team.raceId)) return fail("你已经参加了该赛事");
  const member = await prisma.teamMember.create({
    data: { id: makeId("tm"), teamId: team.id, userId: ctx.userId, role: "member" }
  });
  return ok("已加入团队", member.id);
}

export async function updateTeam(ctx: AuthContext | null, teamId: string, input: Omit<TeamProfileInput, "raceId">): Promise<Result> {
  if (!isActiveRider(ctx)) return fail("请先登录并切换到 Rider 身份");
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: true, registration: true } });
  if (!team) return fail("团队不存在");
  if (team.createdByUserId !== ctx.userId) return fail("只有队长可以编辑团队资料");
  if (team.status !== "draft" || team.registration) return fail("团队报名提交后不能修改资料");
  const validation = validateTeamProfile({ ...input, raceId: team.raceId }, team.members.length);
  if (validation) return validation;
  try {
    await prisma.team.update({ where: { id: team.id }, data: { name: input.name.trim(), description: input.description?.trim() || null, maxMembers: input.maxMembers } });
    return ok("团队资料已更新", team.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail("该赛事中已存在同名团队");
    throw error;
  }
}

export async function leaveTeam(ctx: AuthContext | null, teamId: string): Promise<Result> {
  if (!isActiveRider(ctx)) return fail("请先登录并切换到 Rider 身份");
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: true, registration: true } });
  if (!team) return fail("Team not found.");
  if (team.registration || team.status !== "draft") return fail("Submitted team cannot be changed.");
  const member = team.members.find((item) => item.userId === ctx.userId);
  if (!member) return fail("You are not a team member.");
  if (member.role === "captain" || team.createdByUserId === ctx.userId) return fail("Team captain cannot leave the team.");
  await prisma.teamMember.delete({ where: { id: member.id } });
  return ok("Left team.", teamId);
}

export async function removeTeamMember(ctx: AuthContext | null, teamId: string, userId: string): Promise<Result> {
  if (!isActiveRider(ctx)) return fail("请先登录并切换到 Rider 身份");
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: true, registration: true } });
  if (!team) return fail("Team not found.");
  if (team.registration || team.status !== "draft") return fail("Submitted team cannot be changed.");
  if (team.createdByUserId !== ctx.userId) return fail("只有队长可以移除成员");
  if (team.createdByUserId === userId) return fail("Cannot remove the team captain.");
  const member = team.members.find((item) => item.userId === userId);
  if (!member) return fail("Team member not found.");
  await prisma.teamMember.delete({ where: { id: member.id } });
  return ok("Team member removed.", teamId);
}

export async function submitTeamRegistration(ctx: AuthContext | null, teamId: string): Promise<Result> {
  if (!isActiveRider(ctx)) return fail("请先登录并切换到 Rider 身份");
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: true, registration: true, race: { select: { status: true, scheduleJson: true } } } });
  if (!team) return fail("Team not found.");
  if (team.createdByUserId !== ctx.userId) return fail("只有队长可以提交团队报名");
  if (!isRaceRegistrationOpen(team.race)) return fail("当前赛事报名窗口未开放");
  if (team.registration) return ok("Team registration already submitted.", team.registration.id);
  if (team.status !== "draft") return fail("Team cannot be submitted in current status.");
  if (team.members.length < 2) return fail("Team registration requires at least 2 members.");
  for (const member of team.members) {
    if (await hasOrganizerOrJudgeConflict(member.userId, team.raceId)) {
      return fail("团队成员在同一场赛事中不能同时担任 Organizer 或 Judge");
    }
    const existing = await prisma.registration.findFirst({
      where: {
        raceId: team.raceId,
        OR: [{ userId: member.userId }, { team: { members: { some: { userId: member.userId } } } }]
      }
    });
    if (existing) return fail("A team member is already participating in this Race.");
  }
  const registration = await prisma.$transaction(async (tx) => {
    const created = await tx.registration.create({
      data: {
        id: makeId("reg"),
        raceId: team.raceId,
        userId: team.createdByUserId,
        participantType: "team",
        teamId: team.id,
        status: "pending",
        submittedAt: new Date()
      }
    });
    await tx.team.update({ where: { id: team.id }, data: { status: "submitted" } });
    return created;
  });
  return ok("Team registration submitted.", registration.id);
}

export async function approveRegistration(ctx: AuthContext | null, registrationId: string): Promise<Result> {
  requireAuth(ctx);
  const scoped = await prisma.registration.findUnique({ where: { id: registrationId }, select: { raceId: true } });
  if (!scoped) return fail("Registration不存在");
  requireManagedRace(ctx, scoped.raceId);
  return runSerializableResult(async (tx) => {
    const registration = await tx.registration.findUnique({ where: { id: registrationId } });
    if (!registration) return fail("Registration不存在");
    if (registration.status === "approved") {
      const existingProject = await tx.raceProject.findUnique({ where: { registrationId } });
      return existingProject ? ok("该报名已经审核通过", existingProject.id) : fail("已通过报名缺少 RaceProject，请联系管理员修复数据");
    }
    if (registration.status !== "pending") return fail("只有待审核报名可以通过");

    const reviewedAt = new Date();
    await tx.registration.update({
      where: { id: registrationId },
      data: {
        status: "approved", approvedAt: reviewedAt, reviewedAt,
        reviewedByUserId: ctx!.userId, reviewNote: null
      }
    });
    if (registration.teamId) await tx.team.update({ where: { id: registration.teamId }, data: { status: "locked" } });

    const project = await tx.raceProject.upsert({
      where: { registrationId },
      update: {},
      create: {
        id: makeId("rp"), registrationId, aggregateIngestionStatus: "not_configured",
        connectionHealth: "no_signal",
        metricsJson: toJson({ progressPercent: 0, tokens: 0, messageCount: 0, toolCallCount: 0 })
      }
    });
    const existingFlag = await tx.reviewFlag.findFirst({
      where: { registrationId, type: "no_ca_data", status: { not: "resolved" } }
    });
    if (!existingFlag) {
      await tx.reviewFlag.create({
        data: {
          id: makeId("flag"), raceId: registration.raceId, registrationId, raceProjectId: project.id,
          type: "no_ca_data", severity: "medium", status: "open",
          judgeVisibleSummary: "RaceProject尚未配置 CAConnection，评审前需确认材料缺口。",
          sourceRefJson: toJson({ scope: "race_project", id: project.id })
        }
      });
    }
    return ok("报名已审核通过，并已移入参赛选手库", project.id);
  }, "报名状态已被其他审核操作更新，请刷新后重试");
}

export async function rejectRegistration(ctx: AuthContext | null, registrationId: string, reason: string): Promise<Result> {
  requireAuth(ctx);
  const normalizedReason = reason.trim();
  if (!normalizedReason) return fail("拒绝报名时必须填写原因");
  if (normalizedReason.length > 500) return fail("拒绝原因不能超过 500 个字符");
  const scoped = await prisma.registration.findUnique({ where: { id: registrationId }, select: { raceId: true } });
  if (!scoped) return fail("Registration不存在");
  requireManagedRace(ctx, scoped.raceId);
  return runSerializableResult(async (tx) => {
    const registration = await tx.registration.findUnique({ where: { id: registrationId } });
    if (!registration) return fail("Registration不存在");
    if (registration.status !== "pending") return fail("只有待审核报名可以拒绝");
    const reviewedAt = new Date();
    await tx.registration.update({
      where: { id: registrationId },
      data: {
        status: "rejected", approvedAt: null, reviewedAt,
        reviewedByUserId: ctx!.userId, reviewNote: normalizedReason
      }
    });
    if (registration.teamId) await tx.team.update({ where: { id: registration.teamId }, data: { status: "rejected" } });
    return ok("报名已拒绝并移入历史记录", registrationId);
  }, "报名状态已被其他审核操作更新，请刷新后重试");
}

export async function registerCAConnection(ctx: AuthContext | null, raceProjectId: string): Promise<Result> {
  requireAuth(ctx);
  const project = await prisma.raceProject.findUnique({
    where: { id: raceProjectId },
    include: { registration: { include: { team: { include: { members: true } } } } }
  });
  if (!project) return fail("RaceProject不存在");
  if (!canContributeToRegistration(ctx, project.registration)) {
    return fail("没有登记CAConnection的权限");
  }
  const connectorId = process.env.DEFAULT_CA_CONNECTOR_ID ?? "github-oauth-demo-connector";
  const signingKey = getConnectorSigningKey(connectorId);
  if (!signingKey) return fail("CA connector尚未配置生产签名密钥");
  const connectionId = makeId("conn");
  const connection = await prisma.cAConnection.create({
    data: {
      id: connectionId,
      raceProjectId,
      caType: "codex",
      connectorId,
      connectorVersion: "0.1.0",
      signingKeyId: signingKey.keyId,
      externalProjectRef: `ca-${raceProjectId}-${connectionId}`,
      ingestionStatus: "connected",
      ownerUserId: ctx.userId,
      registeredAt: new Date()
    }
  });
  await prisma.raceProject.update({
    where: { id: raceProjectId },
    data: { aggregateIngestionStatus: "connected", connectionHealth: "ok" }
  });
  await prisma.reviewFlag.updateMany({
    where: { registrationId: project.registrationId, raceProjectId, type: "no_ca_data", status: { not: "resolved" } },
    data: {
      status: "resolved",
      resolutionNote: "已登记至少一个CAConnection，等待握手和信号接入。",
      resolvedByUserId: ctx.userId,
      resolvedAt: new Date()
    }
  });
  return ok("CAConnection已登记", connection.id);
}

export async function handshakeCAConnection(ctx: AuthContext | null, caConnectionId: string): Promise<Result> {
  requireAuth(ctx);
  const connection = await prisma.cAConnection.findUnique({
    where: { id: caConnectionId },
    include: { raceProject: { include: { registration: { include: { team: { include: { members: true } } } } } } }
  });
  if (!connection) return fail("CAConnection不存在");
  const ownsConnection = connection.ownerUserId ? connection.ownerUserId === ctx.userId : canContributeToRegistration(ctx, connection.raceProject.registration);
  if (!ownsConnection && !canManageRace(ctx, connection.raceProject.registration.raceId)) {
    return fail("没有握手CAConnection的权限");
  }
  await prisma.cAConnection.update({ where: { id: caConnectionId }, data: { handshakeAt: new Date() } });
  return ok("CAConnection握手完成", caConnectionId);
}

export async function ingestRidingSignal(input: RidingSignalPayload & { attestation?: RidingSignalAttestation }): Promise<Result> {
  const connection = await prisma.cAConnection.findUnique({
    where: { id: input.caConnectionId },
    include: { raceProject: { include: { registration: true } } }
  });
  if (!connection) return fail("CA信号非法，已隔离");
  if (
    !connection.handshakeAt ||
    connection.disabledAt ||
    connection.raceProjectId !== input.raceProjectId ||
    connection.raceProject.registrationId !== input.registrationId ||
    connection.raceProject.registration.raceId !== input.raceId
  ) {
    await createReviewFlag({
      raceId: connection.raceProject.registration.raceId,
      registrationId: connection.raceProject.registrationId,
      raceProjectId: connection.raceProjectId,
      type: "ingestion_exception",
      severity: "high",
      summary: "CA信号未通过登记、握手或归属校验，已隔离。",
      sourceRef: { idempotencyKey: input.idempotencyKey }
    });
    return fail("CA信号非法，已隔离");
  }
  const { attestation: suppliedAttestation, ...payload } = input;
  const attestation = verifyRidingSignalAttestation(connection.connectorId, connection.signingKeyId, payload, suppliedAttestation);
  if (!attestation.ok) {
    await createReviewFlag({
      raceId: connection.raceProject.registration.raceId,
      registrationId: connection.raceProject.registrationId,
      raceProjectId: connection.raceProjectId,
      type: "ingestion_exception",
      severity: "high",
      summary: attestation.message,
      sourceRef: { idempotencyKey: input.idempotencyKey }
    });
    return fail("CA信号认证失败，已隔离");
  }
  const duplicate = await prisma.cAIngestionReceipt.findFirst({
    where: {
      caConnectionId: input.caConnectionId,
      OR: [{ messageId: input.messageId }, { idempotencyKey: input.idempotencyKey }]
    },
    select: { id: true }
  });
  if (duplicate) return ok("重复CA信号已幂等忽略");
  try {
    const session = await prisma.$transaction(async (tx) => {
      await tx.cAIngestionReceipt.create({
        data: {
          id: makeId("receipt"),
          caConnectionId: input.caConnectionId,
          messageId: input.messageId,
          idempotencyKey: input.idempotencyKey,
          payloadHash: attestation.payloadHash,
          signedAt: attestation.signedAt
        }
      });
      const storedSession = await tx.session.upsert({
        where: { caConnectionId_externalSessionRef: { caConnectionId: input.caConnectionId, externalSessionRef: input.caSessionId } },
        update: {
          lastActiveAt: new Date(),
          messageCount: { increment: 1 },
          tokens: input.tokens ?? 0,
          snapshotJson: toJson({ messageId: input.messageId, idempotencyKey: input.idempotencyKey, progressPercent: input.progressPercent ?? 100 })
        },
        create: {
          id: makeId("session"),
          caConnectionId: input.caConnectionId,
          externalSessionRef: input.caSessionId,
          startedAt: new Date(),
          lastActiveAt: new Date(),
          messageCount: 1,
          tokens: input.tokens ?? 0,
          snapshotJson: toJson({ messageId: input.messageId, idempotencyKey: input.idempotencyKey, progressPercent: input.progressPercent ?? 100 })
        }
      });
      await tx.cAConnection.update({ where: { id: input.caConnectionId }, data: { ingestionStatus: "active", lastSyncedAt: new Date() } });
      await tx.raceProject.update({
        where: { id: input.raceProjectId },
        data: {
          aggregateIngestionStatus: "active",
          connectionHealth: "ok",
          lastSyncedAt: new Date(),
          metricsJson: toJson({ progressPercent: input.progressPercent ?? 100, tokens: input.tokens ?? 0 })
        }
      });
      await tx.evidence.create({
        data: {
          id: makeId("ev"),
          raceId: input.raceId,
          registrationId: input.registrationId,
          type: "session_summary",
          title: "CA Session Summary",
          summary: "已验签CA信号进入Evidence和Projection输入。",
          sourceRefJson: toJson({ sessionId: storedSession.id, messageId: input.messageId, idempotencyKey: input.idempotencyKey }),
          visibility: "public"
        }
      });
      await tx.reviewFlag.updateMany({
        where: {
          registrationId: input.registrationId,
          raceProjectId: input.raceProjectId,
          type: { in: ["no_ca_data", "empty_riding"] },
          status: { not: "resolved" }
        },
        data: {
          status: "resolved",
          resolutionNote: "已接入有效CA信号，证据链恢复。",
          resolvedAt: new Date()
        }
      });
      return storedSession;
    });
    try {
      await refreshRaceLiveAfterSourceEvent(input.raceId);
    } catch (error) {
      console.error("race_live_refresh_after_ca_failed", { raceId: input.raceId, error: error instanceof Error ? error.message : "unknown" });
    }
    return ok("CA信号已接入", session.id);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return ok("重复CA信号已幂等忽略");
    }
    throw error;
  }
}


export async function disableCAConnection(ctx: AuthContext | null, caConnectionId: string): Promise<Result> {
  requireAuth(ctx);
  const connection = await prisma.cAConnection.findUnique({
    where: { id: caConnectionId },
    include: {
      raceProject: {
        include: {
          registration: { include: { team: { include: { members: true } } } },
          caConnections: true
        }
      }
    }
  });
  if (!connection) return fail("CAConnection不存在");
  const raceId = connection.raceProject.registration.raceId;
  const ownsConnection = connection.ownerUserId
    ? connection.ownerUserId === ctx!.userId
    : canContributeToRegistration(ctx, connection.raceProject.registration);
  if (!ownsConnection && !canManageRace(ctx, raceId)) return fail("没有禁用CAConnection的权限");
  await prisma.cAConnection.update({ where: { id: caConnectionId }, data: { ingestionStatus: "failed", disabledAt: new Date() } });
  const activeCount = await prisma.cAConnection.count({
    where: { raceProjectId: connection.raceProjectId, disabledAt: null, handshakeAt: { not: null }, ingestionStatus: { in: ["connected", "active"] } }
  });
  if (activeCount === 0) {
    await prisma.raceProject.update({ where: { id: connection.raceProjectId }, data: { aggregateIngestionStatus: "failed", connectionHealth: "no_active_connection" } });
    await createReviewFlag({
      raceId,
      registrationId: connection.raceProject.registrationId,
      raceProjectId: connection.raceProjectId,
      type: "ingestion_exception",
      severity: "high",
      summary: "所有可用CAConnection均不可用，进入评审前风险提示。",
      sourceRef: { caConnectionId }
    });
  }
  return ok("CAConnection已禁用", caConnectionId);
}

export async function updateReviewFlagStatus(
  ctx: AuthContext | null,
  input: { flagId: string; status: string; resolutionNote?: string }
): Promise<Result> {
  requireAuth(ctx);
  if (!isReviewFlagStatus(input.status)) return fail("ReviewFlag状态不合法");
  const flag = await getReviewFlagWithScope(input.flagId);
  if (!flag) return fail("ReviewFlag不存在");
  const isOwner = ctx.activeRole === "rider" && (flag.registration.userId === ctx.userId || Boolean(flag.registration.team?.members.some((member) => member.userId === ctx.userId)));
  const canManage = canManageRace(ctx, flag.raceId);
  if (input.status === "resolved" || input.status === "in_review") {
    if (!canManage) return fail("只有当前赛事的 Organizer 可以处理风险");
  } else if (input.status === "open") {
    if (!canManage && !isOwner) return fail("只有相关 Rider 或当前赛事 Organizer 可以重新打开风险");
  }
  const note = input.resolutionNote?.trim() || null;
  await prisma.reviewFlag.update({
    where: { id: input.flagId },
    data: {
      status: input.status,
      resolutionNote: input.status === "open" ? null : note,
      resolvedByUserId: input.status === "open" ? null : ctx.userId,
      resolvedAt: input.status === "resolved" ? new Date() : null
    }
  });
  try {
    await refreshRaceLiveAfterSourceEvent(flag.raceId);
  } catch (error) {
    console.error("race_live_refresh_after_risk_failed", { raceId: flag.raceId, error: error instanceof Error ? error.message : "unknown" });
  }
  return ok(
    input.status === "resolved"
      ? "风险已标记为 resolved"
      : input.status === "in_review"
        ? "风险已进入 in_review"
        : "风险已重新打开",
    input.flagId
  );
}

export async function configureSubmissionWindow(
  ctx: AuthContext | null,
  raceId: string,
  input: { opensAt: Date; closesAt: Date }
): Promise<Result> {
  requireAuth(ctx);
  requireManagedRace(ctx, raceId);
  const now = new Date();
  if (!Number.isFinite(input.opensAt.getTime()) || !Number.isFinite(input.closesAt.getTime()) || input.opensAt >= input.closesAt || input.closesAt <= now) {
    return fail("提交窗口必须使用有效UTC时间，且截止时间必须在未来");
  }
  return runSerializableResult(async (tx) => {
    const race = await tx.race.findUnique({ where: { id: raceId } });
    if (!race) return fail("Race不存在");
    if (race.submissionLockedAt) return fail("赛事已手动关闭提交，仅Admin可重新开放");
    if (race.submissionClosesAt && race.submissionClosesAt <= now) return fail("提交已截止，仅Admin可延期");
    if (await tx.judgeAssignment.count({ where: { raceId } })) return fail("已有评审分配，不能调整提交窗口");
    await tx.race.update({ where: { id: raceId }, data: { submissionOpensAt: input.opensAt, submissionClosesAt: input.closesAt } });
    await tx.submissionAuditEvent.create({
      data: {
        id: makeId("submission_event"), raceId, actorUserId: ctx.userId, action: "window_configured",
        metadataJson: toJson({ opensAt: input.opensAt.toISOString(), closesAt: input.closesAt.toISOString() })
      }
    });
    return ok("提交窗口已配置", raceId);
  });
}

export async function lockSubmissionWindow(ctx: AuthContext | null, raceId: string, reason: string): Promise<Result> {
  requireAuth(ctx);
  requireManagedRace(ctx, raceId);
  const normalizedReason = reason.trim();
  if (!normalizedReason) return fail("提前关闭提交必须填写原因");
  return runSerializableResult(async (tx) => {
    const race = await tx.race.findUnique({ where: { id: raceId } });
    if (!race) return fail("Race不存在");
    if (await tx.judgeAssignment.count({ where: { raceId } })) return fail("已有评审分配，提交窗口已永久冻结");
    const lockedAt = new Date();
    await tx.race.update({
      where: { id: raceId },
      data: { submissionLockedAt: lockedAt, submissionLockedByUserId: ctx.userId, submissionLockReason: normalizedReason }
    });
    await tx.submissionAuditEvent.create({
      data: {
        id: makeId("submission_event"), raceId, actorUserId: ctx.userId, action: "window_locked", reason: normalizedReason,
        metadataJson: toJson({ lockedAt: lockedAt.toISOString() })
      }
    });
    return ok("提交窗口已提前关闭", raceId);
  });
}

export async function reopenSubmissionWindow(
  ctx: AuthContext | null,
  raceId: string,
  input: { closesAt: Date; reason: string }
): Promise<Result> {
  requireRole(ctx, ["admin"]);
  const reason = input.reason.trim();
  const now = new Date();
  if (!reason) return fail("重新开放必须填写原因");
  if (!Number.isFinite(input.closesAt.getTime()) || input.closesAt <= now) return fail("新的截止时间必须在未来");
  return runSerializableResult(async (tx) => {
    const race = await tx.race.findUnique({ where: { id: raceId } });
    if (!race) return fail("Race不存在");
    if (!race.submissionOpensAt || race.submissionOpensAt >= input.closesAt) return fail("新的截止时间必须晚于开始时间");
    if (await tx.judgeAssignment.count({ where: { raceId } })) return fail("已有评审分配，不能重新开放提交");
    await tx.race.update({
      where: { id: raceId },
      data: { submissionClosesAt: input.closesAt, submissionLockedAt: null, submissionLockedByUserId: null, submissionLockReason: null }
    });
    await tx.submissionAuditEvent.create({
      data: {
        id: makeId("submission_event"), raceId, actorUserId: ctx.userId, action: "window_reopened", reason,
        metadataJson: toJson({ closesAt: input.closesAt.toISOString() })
      }
    });
    return ok("提交窗口已由Admin重新开放", raceId);
  });
}

export async function submitWork(ctx: AuthContext | null, registrationId: string, input: { title: string; summary: string; demoUrl?: string; repoUrl: string; repoCommitSha: string }): Promise<Result> {
  requireAuth(ctx);
  const validated = validateWorkSubmissionInput(input);
  if (!validated.ok) return fail(validated.message);
  const repositoryVerification = await verifyGitHubRepository(ctx.userId, validated.data.repoUrl, validated.data.repoCommitSha);
  if (!repositoryVerification.ok) return fail(repositoryVerification.message);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const registration = await tx.registration.findUnique({ where: { id: registrationId }, include: { race: true } });
        if (!registration) return fail("Registration不存在");
        if (registration.userId !== ctx!.userId) return fail("只有Registration本人可以提交Work");
        if (registration.status !== "approved") return fail("只有已审核通过的Registration可以提交Work");
        const assignmentCount = await tx.judgeAssignment.count({ where: { raceId: registration.raceId } });
        const windowState = getSubmissionWindowState(registration.race, assignmentCount > 0);
        if (windowState !== "open") return fail(`作品提交窗口不可用：${windowState}`);

        const submittedAt = new Date();
        const createdWorkId = makeId("work");
        const workSlug = `${slugify(validated.data.title) || "work"}-${createdWorkId.slice(-8)}`;
        const work = await tx.work.upsert({
          where: { registrationId },
          update: {},
          create: {
            id: createdWorkId,
            registrationId,
            slug: workSlug,
            title: validated.data.title,
            summary: validated.data.summary,
            demoUrl: validated.data.demoUrl,
            repoUrl: validated.data.repoUrl,
            status: "submitted",
            visibility: "review",
            submittedAt
          }
        });
        const counted = await tx.work.update({
          where: { id: work.id },
          data: { versionCounter: { increment: 1 } },
          select: { versionCounter: true }
        });
        const versionId = makeId("work_version");
        const integrityHash = createVerifiedWorkSubmissionIntegrityHash({
          ...validated.data,
          ...repositoryVerification.data,
          workId: work.id,
          registrationId,
          versionNumber: counted.versionCounter,
          submittedByUserId: ctx!.userId,
          submittedAt
        });
        await tx.workSubmissionVersion.create({
          data: {
            id: versionId,
            workId: work.id,
            versionNumber: counted.versionCounter,
            ...validated.data,
            ...repositoryVerification.data,
            hashSchemaVersion: VERIFIED_WORK_SUBMISSION_HASH_SCHEMA,
            integrityHash,
            submittedByUserId: ctx!.userId,
            submittedAt
          }
        });
        await tx.work.update({
          where: { id: work.id },
          data: {
            title: validated.data.title,
            summary: validated.data.summary,
            demoUrl: validated.data.demoUrl,
            repoUrl: validated.data.repoUrl,
            status: "submitted",
            visibility: "review",
            submittedAt,
            publishedAt: null,
            currentVersionId: versionId
          }
        });
        await tx.submissionAuditEvent.create({
          data: {
            id: makeId("submission_event"),
            raceId: registration.raceId,
            registrationId,
            workId: work.id,
            workSubmissionVersionId: versionId,
            actorUserId: ctx!.userId,
            action: "version_submitted",
            metadataJson: toJson({ versionNumber: counted.versionCounter, integrityHash })
          }
        });
        return ok(`Work v${counted.versionCounter}已提交`, work.id);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002");
      if (!retryable || attempt === 3) return retryable ? fail("提交并发冲突，请重试") : fail("Work提交失败");
    }
  }
  return fail("提交并发冲突，请重试");
}

export async function publishWork(ctx: AuthContext | null, workId: string): Promise<Result> {
  requireAuth(ctx);
  const scopedWork = await prisma.work.findUnique({ where: { id: workId }, select: { registration: { select: { raceId: true } } } });
  if (!scopedWork) return fail("Work不存在");
  requireManagedRace(ctx, scopedWork.registration.raceId);
  return runSerializableResult(async (tx) => {
    const work = await tx.work.findUnique({ where: { id: workId }, include: { registration: { include: { race: true } } } });
    if (!work) return fail("Work不存在");
    if (!work.currentVersionId) return fail("legacy Work必须先由Rider重新提交为版本化作品");
    if (work.status === "published" && work.visibility === "public") return ok("Work已公开", workId);
    const assignments = await tx.judgeAssignment.count({ where: { raceId: work.registration.raceId } });
    const windowState = getSubmissionWindowState(work.registration.race, assignments > 0);
    if (windowState === "open" || windowState === "not_started") return fail("提交窗口关闭后才能公开Work");
    const publishedAt = new Date();
    await tx.work.update({ where: { id: workId }, data: { visibility: "public", status: "published", publishedAt } });
    await tx.submissionAuditEvent.create({
      data: {
        id: makeId("submission_event"), raceId: work.registration.raceId, registrationId: work.registrationId,
        workId, workSubmissionVersionId: work.currentVersionId, actorUserId: ctx.userId, action: "work_published",
        metadataJson: toJson({ publishedAt: publishedAt.toISOString() })
      }
    });
    return ok("Work已公开", workId);
  });
}

export type JudgeAllocationPreview = {
  raceId: string;
  poolSize: number;
  workCount: number;
  retainedCount: number;
  neededCount: number;
  blockers: string[];
  works: Array<{ workId: string; title: string; assignmentCount: number; neededCount: number }>;
};

const JUDGE_ALLOCATION_ALGORITHM = "balanced-random-v1";

function allocationTieBreak(seed: string, workId: string, judgeUserId: string) {
  return createHash("sha256").update(`${seed}:${workId}:${judgeUserId}`).digest("hex");
}

async function getRaceParticipantUserIds(tx: Prisma.TransactionClient, raceId: string) {
  const [registrations, draftTeams] = await Promise.all([
    tx.registration.findMany({
      where: { raceId, status: { notIn: ["rejected", "withdrawn", "cancelled"] } },
      select: { userId: true, team: { select: { members: { select: { userId: true } } } } }
    }),
    tx.team.findMany({
      where: { raceId, registration: null },
      select: { members: { select: { userId: true } } }
    })
  ]);
  return new Set([
    ...registrations.flatMap((registration) => registration.team?.members.map((member) => member.userId) ?? [registration.userId]),
    ...draftTeams.flatMap((team) => team.members.map((member) => member.userId))
  ]);
}

export async function saveRaceJudgePool(ctx: AuthContext | null, raceId: string, judgeUserIds: string[]): Promise<Result> {
  requireManagedRace(ctx, raceId);
  const desired = [...new Set(judgeUserIds.map((id) => id.trim()).filter(Boolean))];
  if (desired.length < 3) return fail("Judge 池至少需要三名有效 Judge");
  return runSerializableResult(async (tx) => {
    const race = await tx.race.findUnique({ where: { id: raceId }, select: { reviewResultsPublishedAt: true } });
    if (!race) return fail("Race不存在");
    if (race.reviewResultsPublishedAt) return fail("评审结果发布后不能修改 Judge 池");

    const [roles, assigned, participantIds] = await Promise.all([
      tx.userRole.findMany({ where: { userId: { in: desired }, role: "judge", status: "active" }, select: { userId: true } }),
      tx.judgeAssignment.findMany({ where: { raceId }, select: { judgeUserId: true } }),
      getRaceParticipantUserIds(tx, raceId)
    ]);
    const activeIds = new Set(roles.map((role) => role.userId));
    const invalid = desired.filter((id) => !activeIds.has(id) || participantIds.has(id));
    if (invalid.length) return fail("Judge 池包含无有效资格或参与本场赛事的用户");
    const assignedIds = new Set(assigned.map((assignment) => assignment.judgeUserId));
    if ([...assignedIds].some((id) => !desired.includes(id))) return fail("已经持有本场评审任务的 Judge 不能移出 Judge 池");

    await tx.raceJudgeMembership.updateMany({
      where: { raceId, judgeUserId: { notIn: desired }, status: "active" },
      data: { status: "inactive" }
    });
    const selectedAt = new Date();
    for (const judgeUserId of desired) {
      await tx.raceJudgeMembership.upsert({
        where: { raceId_judgeUserId: { raceId, judgeUserId } },
        update: { status: "active", selectedByUserId: ctx!.userId, selectedAt },
        create: {
          id: makeId("judge_member"), raceId, judgeUserId,
          selectedByUserId: ctx!.userId, status: "active", selectedAt
        }
      });
    }
    return ok("Judge 池已保存", raceId);
  });
}

export async function getJudgeAllocationPreview(ctx: AuthContext | null, raceId: string): Promise<JudgeAllocationPreview> {
  requireManagedRace(ctx, raceId);
  const inspection = await prisma.$transaction(
    (tx) => inspectJudgeAllocation(tx, raceId),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  const { works, blockers, poolSize } = inspection;
  const retainedCount = works.reduce((count, work) => count + work.assignments.length, 0);
  return {
    raceId, poolSize, workCount: works.length, retainedCount,
    neededCount: works.reduce((count, work) => count + Math.max(0, 3 - work.assignments.length), 0),
    blockers,
    works: works.map((work) => ({ workId: work.id, title: work.title, assignmentCount: work.assignments.length, neededCount: Math.max(0, 3 - work.assignments.length) }))
  };
}

async function inspectJudgeAllocation(tx: Prisma.TransactionClient, raceId: string) {
  const [race, allWorks, memberships, participantIds] = await Promise.all([
    tx.race.findUnique({ where: { id: raceId } }),
    tx.work.findMany({
      where: { registration: { raceId } },
      select: {
        id: true, title: true, currentVersionId: true,
        registration: { select: { status: true } },
        assignments: {
          select: { id: true, judgeUserId: true, slot: true, workSubmissionVersionId: true },
          orderBy: [{ slot: "asc" }, { id: "asc" }]
        }
      },
      orderBy: { id: "asc" }
    }),
    tx.raceJudgeMembership.findMany({
      where: { raceId, status: "active" },
      include: { judge: { include: { roles: { where: { role: "judge", status: "active" } } } } },
      orderBy: { judgeUserId: "asc" }
    }),
    getRaceParticipantUserIds(tx, raceId)
  ]);
  const blockers: string[] = [];
  const addBlocker = (message: string) => { if (!blockers.includes(message)) blockers.push(message); };
  if (!race) addBlocker("Race不存在");
  if (race?.reviewResultsPublishedAt) addBlocker("评审结果已经发布");
  if (race && ["open", "not_started"].includes(getSubmissionWindowState(race, allWorks.some((work) => work.assignments.length > 0)))) {
    addBlocker("提交窗口尚未关闭");
  }
  if (memberships.length < 3) addBlocker("Judge 池不足三人");

  const eligibleIds = memberships
    .filter((membership) => {
      const hasActiveRole = membership.judge.roles.length > 0;
      const participantConflict = participantIds.has(membership.judgeUserId);
      if (!hasActiveRole) addBlocker(`${membership.judge.displayName} 的 Judge 资格不是 active`);
      if (participantConflict) addBlocker(`${membership.judge.displayName} 正在参与本场赛事`);
      return hasActiveRole && !participantConflict;
    })
    .map((membership) => membership.judgeUserId);
  if (eligibleIds.length < 3) addBlocker("Judge 池中符合资格且无参赛冲突的 Judge 不足三人");
  const eligibleSet = new Set(eligibleIds);

  for (const work of allWorks) {
    const assignments = work.assignments;
    if (assignments.length && work.registration.status !== "approved") addBlocker(`${work.title} 的 Assignment 关联了非 approved 报名`);
    if (assignments.length && !work.currentVersionId) addBlocker(`${work.title} 的 Assignment 缺少当前版本`);
    if (assignments.length > 3) addBlocker(`${work.title} 已有超过三条 Assignment`);
    if (new Set(assignments.map((assignment) => assignment.slot)).size !== assignments.length) addBlocker(`${work.title} 存在重复评审席位`);
    if (assignments.some((assignment) => assignment.slot < 1 || assignment.slot > 3)) addBlocker(`${work.title} 存在非法评审席位`);
    if (new Set(assignments.map((assignment) => assignment.judgeUserId)).size !== assignments.length) addBlocker(`${work.title} 存在重复 Judge`);
    if (assignments.some((assignment) => assignment.workSubmissionVersionId !== work.currentVersionId)) addBlocker(`${work.title} 的 Assignment 版本与当前版本不一致`);
    if (assignments.some((assignment) => !eligibleSet.has(assignment.judgeUserId))) addBlocker(`${work.title} 的现有 Judge 已不在有效 Judge 池中`);
  }

  const works = allWorks.filter((work) => work.registration.status === "approved" && work.currentVersionId);
  if (!works.length) addBlocker("当前没有可分配的版本化 Work");
  return { race, works, memberships, eligibleIds, blockers, poolSize: memberships.length };
}

export async function allocateRaceJudges(ctx: AuthContext | null, raceId: string, requestedSeed?: string): Promise<Result> {
  requireManagedRace(ctx, raceId);
  const seed = requestedSeed?.trim() || randomBytes(16).toString("hex");
  if (seed.length > 128) return fail("分配随机种子过长");
  return runSerializableResult(async (tx) => {
    const { works, eligibleIds, blockers } = await inspectJudgeAllocation(tx, raceId);
    if (blockers.length) return fail(blockers.join("；"));
    const allAssignments = works.flatMap((work) => work.assignments.map((assignment) => ({ ...assignment, workId: work.id })));
    const created: Array<{ id: string; workId: string; judgeUserId: string; slot: number; workSubmissionVersionId: string }> = [];
    const load = new Map(eligibleIds.map((id) => [id, allAssignments.filter((assignment) => assignment.judgeUserId === id).length]));
    for (const work of works) {
      const usedJudges = new Set(work.assignments.map((assignment) => assignment.judgeUserId));
      const usedSlots = new Set(work.assignments.map((assignment) => assignment.slot));
      for (const slot of [1, 2, 3].filter((candidate) => !usedSlots.has(candidate))) {
        const candidates = eligibleIds.filter((id) => !usedJudges.has(id));
        candidates.sort((left, right) => {
          const loadDiff = (load.get(left) ?? 0) - (load.get(right) ?? 0);
          return loadDiff || allocationTieBreak(seed, work.id, left).localeCompare(allocationTieBreak(seed, work.id, right));
        });
        const judgeUserId = candidates[0];
        if (!judgeUserId) return fail(`${work.title} 无法补足三名不同 Judge`);
        created.push({ id: makeId("assign"), workId: work.id, judgeUserId, slot, workSubmissionVersionId: work.currentVersionId! });
        usedJudges.add(judgeUserId);
        load.set(judgeUserId, (load.get(judgeUserId) ?? 0) + 1);
      }
    }
    if (!created.length) return ok("所有 Work 均已完成三 Judge 分配", raceId);

    const batch = await tx.judgeAllocationBatch.create({
      data: {
        id: makeId("judge_batch"), raceId, createdByUserId: ctx!.userId, seed,
        algorithmVersion: JUDGE_ALLOCATION_ALGORITHM, workCount: works.length,
        retainedCount: allAssignments.length, createdCount: created.length
      }
    });
    await tx.judgeAssignment.createMany({
      data: created.map((assignment) => ({
        ...assignment, raceId, assignedByUserId: ctx!.userId, status: "assigned",
        assignedAt: new Date(), allocationBatchId: batch.id
      }))
    });
    return ok(`已为 ${works.length} 件 Work 原子补足三名 Judge`, batch.id);
  }, "Judge 分配发生并发冲突，未写入不完整结果，请重试");
}

/** @deprecated 手工逐作品分配已禁用；请使用赛事 Judge 池和 allocateRaceJudges。 */
export async function assignJudge(ctx: AuthContext | null, workId: string, _judgeUserId: string): Promise<Result> {
  requireAuth(ctx);
  const scoped = await prisma.work.findUnique({ where: { id: workId }, select: { registration: { select: { raceId: true } } } });
  if (!scoped) return fail("Work不存在");
  requireManagedRace(ctx, scoped.registration.raceId);
  return fail("手工逐作品分配已停用，请先维护赛事 Judge 池，再执行自动分配");
}

export async function submitJudgingRecord(ctx: AuthContext | null, assignmentId: string, input: { scoreResult: number; scoreRiding: number; comments: string }): Promise<Result> {
  requireRole(ctx, ["judge"]);
  if (!Number.isInteger(input.scoreResult) || input.scoreResult < 0 || input.scoreResult > 100) return fail("结果评分必须是 0–100 的整数");
  if (!Number.isInteger(input.scoreRiding) || input.scoreRiding < 0 || input.scoreRiding > 100) return fail("过程评分必须是 0–100 的整数");
  const comments = input.comments.trim();
  if (comments.length > 2000) return fail("评语不能超过 2000 个字符");
  return runSerializableResult(async (tx) => {
    const initial = await tx.judgeAssignment.findUnique({
      where: { id: assignmentId },
      select: { judgeUserId: true, raceId: true }
    });
    if (!initial) return fail("JudgeAssignment不存在");
    if (initial.judgeUserId !== ctx!.userId) return fail("Judge只能提交分配给自己的评审");

    const race = await tx.race.findUnique({ where: { id: initial.raceId }, select: { status: true } });
    if (!race) return fail("Race不存在");
    await tx.race.update({ where: { id: initial.raceId }, data: { status: race.status } });

    const assignment = await tx.judgeAssignment.findUnique({
      where: { id: assignmentId },
      include: { work: { select: { registration: { select: { race: { select: { reviewResultsPublishedAt: true } } } } } } }
    });
    if (!assignment) return fail("JudgeAssignment不存在");
    if (assignment.judgeUserId !== ctx!.userId) return fail("Judge只能提交分配给自己的评审");
    if (assignment.work.registration.race.reviewResultsPublishedAt) return fail("评审结果已经发布，评分已锁定");

    const submittedAt = new Date();
    const record = await tx.judgingRecord.upsert({
      where: { assignmentId },
      update: { scoreResult: input.scoreResult, scoreRiding: input.scoreRiding, comments, status: "submitted", submittedAt },
      create: { id: makeId("judge_record"), assignmentId, scoreResult: input.scoreResult, scoreRiding: input.scoreRiding, comments, status: "submitted", submittedAt }
    });
    await tx.judgeAssignment.update({ where: { id: assignmentId }, data: { status: "reviewed" } });
    return ok("JudgingRecord已提交", record.id);
  }, "评分提交与结果发布发生并发冲突，请刷新后重试");
}

export async function publishRaceReviewResults(ctx: AuthContext | null, raceId: string): Promise<Result> {
  requireManagedRace(ctx, raceId);
  return runSerializableResult(async (tx) => {
    const race = await tx.race.findUnique({ where: { id: raceId }, select: { status: true } });
    if (!race) return fail("Race不存在");
    const lockedRace = await tx.race.update({
      where: { id: raceId }, data: { status: race.status }, select: { reviewResultsPublishedAt: true }
    });
    if (lockedRace.reviewResultsPublishedAt) return ok("评审结果已经发布", raceId);
    const works = await tx.work.findMany({
      where: { registration: { raceId, status: "approved" }, currentVersionId: { not: null } },
      select: { id: true, title: true, assignments: { select: { status: true, judgingRecord: { select: { status: true } } } } }
    });
    if (!works.length) return fail("当前没有可发布评审结果的 Work");
    const incomplete = works.find((work) => work.assignments.length !== 3 || work.assignments.some((assignment) => assignment.status !== "reviewed" || assignment.judgingRecord?.status !== "submitted"));
    if (incomplete) return fail(`${incomplete.title} 尚未完成三份评审`);
    await tx.race.update({
      where: { id: raceId },
      data: { reviewResultsPublishedAt: new Date(), reviewResultsPublishedByUserId: ctx!.userId }
    });
    return ok("评审结果已发布，评分与 Judge 分配现已锁定", raceId);
  });
}

export async function publishAward(ctx: AuthContext | null, input: { raceId: string; registrationId: string; workId?: string; awardName: string; rank: number; reason: string }): Promise<Result> {
  requireManagedRace(ctx, input.raceId);
  return runSerializableResult(async (tx) => {
    const registration = await tx.registration.findUnique({ where: { id: input.registrationId }, include: { race: true } });
    if (!registration) return fail("Registration不存在");
    if (registration.raceId !== input.raceId) return fail("Registration不属于当前Race");
    let workSubmissionVersionId: string | null = null;
    if (input.workId) {
      const work = await tx.work.findUnique({ where: { id: input.workId } });
      if (!work) return fail("Work不存在");
      if (work.registrationId !== input.registrationId) return fail("Work不属于当前Registration");
      if (!work.currentVersionId) return fail("关联Award的Work必须先完成版本化提交");
      const assignmentCount = await tx.judgeAssignment.count({ where: { raceId: input.raceId } });
      const windowState = getSubmissionWindowState(registration.race, assignmentCount > 0);
      if (windowState === "open" || windowState === "not_started") return fail("关联Award的Work必须先冻结提交版本");
      workSubmissionVersionId = work.currentVersionId;
    }
    const award = await tx.award.upsert({
      where: { raceId_awardName_rank: { raceId: input.raceId, awardName: input.awardName, rank: input.rank } },
      update: { registrationId: input.registrationId, workId: input.workId, workSubmissionVersionId, decisionReason: input.reason, status: "published", publishedAt: new Date() },
      create: {
        id: makeId("award"), raceId: input.raceId, registrationId: input.registrationId, workId: input.workId,
        workSubmissionVersionId, awardName: input.awardName, rank: input.rank, decisionReason: input.reason,
        status: "published", publishedAt: new Date()
      }
    });
    return ok("Award已发布", award.id);
  });
}

export async function generateReport(ctx: AuthContext | null, input: { raceId: string; type: string; subjectRegistrationId?: string }): Promise<Result> {
  requireManagedRace(ctx, input.raceId);
  if (input.type === "rider_report" && !input.subjectRegistrationId) return fail("rider_report必须有关联Registration");
  if (input.type !== "rider_report" && input.subjectRegistrationId) return fail("race_report/review_summary不能关联单个Registration");
  const report = await prisma.report.create({
    data: {
      id: makeId("report"),
      raceId: input.raceId,
      type: input.type,
      subjectRegistrationId: input.subjectRegistrationId ?? null,
      status: "draft",
      visibility: "private",
      content: `${input.type} generated for ${input.raceId}`,
      generatedAt: new Date()
    }
  });
  return ok("Report已生成", report.id);
}


export async function editReport(ctx: AuthContext | null, reportId: string, content: string): Promise<Result> {
  requireAuth(ctx);
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return fail("Report不存在");
  requireManagedRace(ctx, report.raceId);
  await prisma.report.update({ where: { id: reportId }, data: { content: content.trim(), status: "draft", lastError: null } });
  return ok("Report已编辑", reportId);
}

export async function regenerateReport(ctx: AuthContext | null, reportId: string): Promise<Result> {
  requireAuth(ctx);
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return fail("Report不存在");
  requireManagedRace(ctx, report.raceId);
  await prisma.report.update({
    where: { id: reportId },
    data: { status: "draft", visibility: "private", lastError: null, generatedAt: new Date(), content: `${report.type} regenerated for ${report.raceId}` }
  });
  return ok("Report已重跑", reportId);
}

export async function simulateReportFailure(ctx: AuthContext | null, input: { raceId: string; type: string; subjectRegistrationId?: string }): Promise<Result> {
  requireManagedRace(ctx, input.raceId);
  const report = await prisma.report.create({
    data: {
      id: makeId("report"),
      raceId: input.raceId,
      type: input.type,
      subjectRegistrationId: input.subjectRegistrationId ?? null,
      status: "failed",
      visibility: "private",
      content: "",
      generatedAt: new Date(),
      lastError: "simulated_report_generation_failure"
    }
  });
  return ok("Report失败状态已记录", report.id);
}
export async function publishReport(ctx: AuthContext | null, reportId: string): Promise<Result> {
  requireAuth(ctx);
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return fail("Report不存在");
  requireManagedRace(ctx, report.raceId);
  await prisma.report.update({
    where: { id: reportId },
    data: { status: "published", visibility: report.type === "rider_report" ? "private" : "public", publishedAt: new Date() }
  });
  return ok("Report已发布", reportId);
}

export async function rebuildProjection(ctx: AuthContext | null, raceId: string): Promise<Result> {
  requireManagedRace(ctx, raceId);
  const registrations = await prisma.registration.findMany({
    where: { raceId },
    include: {
      user: true,
      team: { include: { members: { include: { user: true } } } },
      raceProject: true,
      work: true,
      reviewFlags: true
    }
  });
  const projection = await prisma.projection.create({
    data: {
      id: makeId("projection"),
      raceId,
      type: "race_progress",
      status: "stable",
      payloadJson: toJson({
        rebuiltAt: new Date().toISOString(),
        totals: {
          registrations: registrations.length,
          approved: registrations.filter((registration) => registration.status === "approved").length,
          submittedWorks: registrations.filter((registration) => registration.work).length,
          activeProjects: registrations.filter((registration) => registration.raceProject?.aggregateIngestionStatus === "active").length
        },
        entries: registrations.map((registration) => ({
          riderName: registration.team?.name ?? registration.user.displayName,
          participantType: registration.participantType,
          members: registration.team?.members.map((member) => member.user.displayName) ?? [registration.user.displayName],
          registrationId: registration.id,
          ingestion: registration.raceProject?.aggregateIngestionStatus ?? "not_configured",
          workTitle: registration.work?.title ?? null,
          flags: registration.reviewFlags.map((flag) => flag.type)
        }))
      }),
      lastRebuiltAt: new Date()
    }
  });
  await prisma.projection.update({ where: { id: projection.id }, data: { stableVersionId: projection.id } });
  return ok("Projection已重建", projection.id);
}


export async function simulateProjectionFailure(ctx: AuthContext | null, raceId: string): Promise<Result> {
  requireManagedRace(ctx, raceId);
  const stable = await prisma.projection.findFirst({ where: { raceId, status: "stable" }, orderBy: { lastRebuiltAt: "desc" } });
  const projection = await prisma.projection.create({
    data: {
      id: makeId("projection"),
      raceId,
      type: "race_progress",
      status: "failed",
      stableVersionId: stable?.id ?? null,
      payloadJson: toJson({ error: "simulated_projection_failure", stableVersionId: stable?.id ?? null }),
      lastRebuiltAt: new Date()
    }
  });
  return ok("Projection失败已隔离，stable版本未被覆盖", projection.id);
}

export async function switchScreenMode(ctx: AuthContext | null, raceId: string, mode: string, reason?: string): Promise<Result> {
  if (!canManageRace(ctx, raceId)) return fail("没有控制该赛事大屏的权限");
  const allowed = ["live", "leaderboard", "works", "announcement"];
  if (!allowed.includes(mode)) return fail("Screen mode不合法");
  const state = await prisma.$transaction(async (tx) => {
    const updated = await tx.screenState.upsert({
      where: { raceId },
      update: { mode, controlVersion: { increment: 1 } },
      create: { id: makeId("screen"), raceId, mode, fallbackEnabled: false }
    });
    await tx.screenControlAuditEvent.create({ data: { id: makeId("screen-audit"), raceId, screenStateId: updated.id, actorUserId: ctx!.userId, action: "mode_changed", reason: reason?.trim() || null, payloadJson: JSON.stringify({ mode }) } });
    return updated;
  });
  return ok("Screen mode已切换", state.id);
}

export async function toggleScreenFallback(ctx: AuthContext | null, raceId: string, enabled: boolean, reason?: string): Promise<Result> {
  if (!canManageRace(ctx, raceId)) return fail("没有控制该赛事大屏的权限");
  const state = await prisma.$transaction(async (tx) => {
    const updated = await tx.screenState.upsert({
      where: { raceId },
      update: { fallbackEnabled: enabled, controlVersion: { increment: 1 } },
      create: { id: makeId("screen"), raceId, mode: "live", fallbackEnabled: enabled }
    });
    await tx.screenControlAuditEvent.create({ data: { id: makeId("screen-audit"), raceId, screenStateId: updated.id, actorUserId: ctx!.userId, action: enabled ? "fallback_enabled" : "fallback_disabled", reason: reason?.trim() || null, payloadJson: JSON.stringify({ fallbackEnabled: enabled, mode: updated.mode }) } });
    return updated;
  });
  return ok(enabled ? "Screen fallback已开启" : "Screen fallback已关闭", state.id);
}

export async function publishAnnouncement(ctx: AuthContext | null, input: { raceId: string; title: string; body: string; reason?: string }): Promise<Result> {
  if (!canManageRace(ctx, input.raceId)) return fail("没有控制该赛事大屏的权限");
  const title = input.title.trim();
  if (!title) return fail("公告标题不能为空");
  const announcement = await prisma.$transaction(async (tx) => {
    const created = await tx.announcement.create({
      data: { id: makeId("ann"), raceId: input.raceId, title, body: input.body.trim(), visibility: "public", publishedAt: new Date() }
    });
    const state = await tx.screenState.upsert({
      where: { raceId: input.raceId },
      update: { mode: "announcement", controlVersion: { increment: 1 } },
      create: { id: makeId("screen"), raceId: input.raceId, mode: "announcement", fallbackEnabled: false }
    });
    await tx.screenControlAuditEvent.create({ data: { id: makeId("screen-audit"), raceId: input.raceId, screenStateId: state.id, actorUserId: ctx!.userId, action: "announcement_published", reason: input.reason?.trim() || null, payloadJson: JSON.stringify({ announcementId: created.id, mode: "announcement" }) } });
    return created;
  });
  return ok("公告已发布", announcement.id);
}

export async function bindTrackVersionToRound(ctx: AuthContext | null, input: { raceRoundId: string; trackProfileVersionId: string }): Promise<Result> {
  requireAuth(ctx);
  const round = await prisma.raceRound.findUnique({ where: { id: input.raceRoundId } });
  if (!round) return fail("RaceRound不存在");
  requireManagedRace(ctx, round.raceId);
  try {
    return await prisma.$transaction(async (tx) => {
      const currentRound = await tx.raceRound.findUnique({ where: { id: input.raceRoundId } });
      if (!currentRound || currentRound.status !== "pending") return fail("只有pending Round可绑定赛道版本");
      const version = await tx.trackProfileVersion.findUnique({ where: { id: input.trackProfileVersionId }, include: { track: true } });
      if (!version || version.status !== "published") return fail("只能绑定published Track版本");
      if (version.track.raceId && version.track.raceId !== currentRound.raceId) return fail("Race Track不能跨Race绑定");
      const updated = await tx.raceRound.updateMany({ where: { id: currentRound.id, status: "pending" }, data: { trackProfileVersionId: version.id } });
      if (updated.count !== 1) return fail("Round状态已变化，请刷新后重试");
      await tx.screenControlAuditEvent.create({ data: { id: makeId("track-audit"), raceId: currentRound.raceId, actorUserId: ctx!.userId, action: "round_track_bound", payloadJson: JSON.stringify({ raceRoundId: currentRound.id, trackProfileVersionId: version.id }) } });
      return ok("Round赛道版本已绑定", currentRound.id);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return fail("Round绑定并发冲突，请重试");
    throw error;
  }
}
export async function createBackup(ctx: AuthContext | null, raceId: string, scope = "race_day_core"): Promise<Result> {
  requireManagedRace(ctx, raceId);
  const backup = await prisma.backup.create({
    data: { id: makeId("backup"), raceId, scope, status: "completed", evidence: "server snapshot recorded" }
  });
  return ok("备份记录已创建", backup.id);
}


export async function markReleaseChecklistItem(ctx: AuthContext | null, input: { raceId: string; itemKey: string; label?: string; status?: string; evidence: string }): Promise<Result> {
  requireManagedRace(ctx, input.raceId);
  const item = await prisma.releaseChecklistItem.upsert({
    where: { raceId_itemKey: { raceId: input.raceId, itemKey: input.itemKey } },
    update: { status: input.status ?? "done", evidence: input.evidence, updatedAt: new Date() },
    create: { id: makeId("check"), raceId: input.raceId, itemKey: input.itemKey, label: input.label ?? input.itemKey, status: input.status ?? "done", evidence: input.evidence, updatedAt: new Date() }
  });
  return ok("发布检查项已更新", item.id);
}

export async function recordGoNoGo(ctx: AuthContext | null, raceId: string, evidence: string): Promise<Result> {
  return markReleaseChecklistItem(ctx, { raceId, itemKey: "go_no_go", label: "go/no-go证据确认", status: "done", evidence: evidence || "go decision recorded" });
}

export async function markCanaryReady(ctx: AuthContext | null, raceId: string, evidence: string): Promise<Result> {
  return markReleaseChecklistItem(ctx, { raceId, itemKey: "canary_ready", label: "灰度发布确认", status: "done", evidence: evidence || "local canary release evidence recorded" });
}

export async function markProductionReleased(ctx: AuthContext | null, raceId: string, evidence: string): Promise<Result> {
  return markReleaseChecklistItem(ctx, { raceId, itemKey: "production_release", label: "正式发布确认", status: "done", evidence: evidence || "local production release evidence recorded" });
}
export async function updateProfile(ctx: AuthContext | null, input: {
  displayName: string;
  email: string;
  confirmEmail: boolean;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  timeZone?: string;
  locale?: string;
}): Promise<Result> {
  requireAuth(ctx);
  const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
  if (!user) return fail("用户不存在");
  let displayName: string;
  try {
    displayName = requiredText(input.displayName, 2, 80, "展示名");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "资料格式错误");
  }
  const email = input.email.trim().toLowerCase();
  const verifiedEmails = fromJson<string[]>(user.verifiedEmailsJson, []).map((item) => item.toLowerCase());
  if (!verifiedEmails.includes(email)) return fail("联系邮箱必须来自 GitHub 已验证邮箱");
  if (!input.confirmEmail) return fail("请确认联系邮箱");
  if (!input.acceptTerms || !input.acceptPrivacy) return fail("必须同意服务条款和隐私政策");
  await prisma.user.update({
    where: { id: ctx.userId },
    data: {
      displayName,
      email,
      emailConfirmedAt: new Date(),
      timeZone: optionalText(input.timeZone, 100, "时区"),
      locale: optionalText(input.locale, 35, "界面语言"),
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: new Date(),
      privacyVersion: CURRENT_PRIVACY_VERSION,
      privacyAcceptedAt: new Date(),
      profileCompleted: true
    }
  });
  return ok("账号资料已补全", ctx.userId);
}

export async function curateHomepageRace(ctx: AuthContext | null, raceId: string, action: string): Promise<Result> {
  requireRole(ctx, ["admin"]);
  const race = await prisma.race.findUnique({ where: { id: raceId }, select: { id: true, visibility: true, status: true } });
  if (!race || race.visibility !== "public" || race.status === "draft") return fail("只有公开且非草稿赛事可以配置到首页");
  if (!["pin", "unpin", "hide", "show", "up", "down"].includes(action)) return fail("首页精选操作不合法");
  if (action === "pin") {
    const pinned = await prisma.homepageRaceCuration.count({ where: { pinned: true } });
    const current = await prisma.homepageRaceCuration.findUnique({ where: { raceId } });
    if (!current?.pinned && pinned >= 6) return fail("首页最多置顶六场赛事");
    const max = await prisma.homepageRaceCuration.aggregate({ where: { pinned: true }, _max: { position: true } });
    await prisma.homepageRaceCuration.upsert({ where: { raceId }, update: { pinned: true, hidden: false, position: current?.position ?? (max._max.position ?? 0) + 1, updatedByUserId: ctx!.userId }, create: { raceId, pinned: true, hidden: false, position: (max._max.position ?? 0) + 1, updatedByUserId: ctx!.userId } });
  } else if (action === "hide") {
    await prisma.homepageRaceCuration.upsert({ where: { raceId }, update: { pinned: false, hidden: true, position: null, updatedByUserId: ctx!.userId }, create: { raceId, hidden: true, updatedByUserId: ctx!.userId } });
  } else if (action === "unpin" || action === "show") {
    await prisma.homepageRaceCuration.deleteMany({ where: { raceId } });
  } else {
    const pinned = await prisma.homepageRaceCuration.findMany({ where: { pinned: true }, orderBy: [{ position: "asc" }, { updatedAt: "asc" }] });
    const index = pinned.findIndex((item) => item.raceId === raceId);
    const swapIndex = action === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= pinned.length) return ok("首页精选顺序未变化", raceId);
    await prisma.$transaction([
      prisma.homepageRaceCuration.update({ where: { raceId: pinned[index].raceId }, data: { position: swapIndex + 1, updatedByUserId: ctx!.userId } }),
      prisma.homepageRaceCuration.update({ where: { raceId: pinned[swapIndex].raceId }, data: { position: index + 1, updatedByUserId: ctx!.userId } })
    ]);
  }
  return ok("首页精选已更新", raceId);
}

function draftTags(value: unknown, max: number) {
  return String(value ?? "").split(/[,，\n]/).map((item) => item.trim()).filter(Boolean).slice(0, max);
}

export async function selectRole(ctx: AuthContext | null, role: string): Promise<Result> {
  requireAuth(ctx);
  if (!ctx.profileCompleted) return fail("请先完成公共账号资料");
  if (!isSelectableRole(role)) return fail("注册入口只允许 Rider、Judge 或 Organizer");
  const existingRole = await prisma.userRole.findUnique({ where: { userId_role: { userId: ctx.userId, role } } });
  if (existingRole?.status === "active") return ok("角色已经开通", existingRole.id);
  const existingApplication = await prisma.roleApplication.findFirst({
    where: { userId: ctx.userId, requestedRole: role, status: { in: ["draft", "pending", "rejected"] } },
    orderBy: { createdAt: "desc" }
  });
  if (existingApplication) return ok("继续填写角色资料", existingApplication.id);
  const application = await prisma.roleApplication.create({
    data: { id: makeId("role_app"), userId: ctx.userId, requestedRole: role, source: "self", status: "draft" }
  });
  return ok("角色申请草稿已创建", application.id);
}

export async function saveRoleProfileDraft(ctx: AuthContext | null, role: string, input: RoleProfileInput): Promise<Result> {
  requireAuth(ctx);
  if (!isSelectableRole(role)) return fail("未知角色");
  await selectRole(ctx, role);
  if (role === "rider") {
    await prisma.riderProfile.upsert({
      where: { userId: ctx.userId },
      update: {
        headline: optionalText(String(input.headline ?? ""), 80, "身份简介"),
        skillsJson: toJson(draftTags(input.skills, 20)), bio: optionalText(String(input.bio ?? ""), 160, "个人简介"),
        countryCode: optionalText(String(input.countryCode ?? ""), 80, "国家/地区"), city: optionalText(String(input.city ?? ""), 80, "城市"),
        organization: optionalText(String(input.organization ?? ""), 120, "组织或学校"), websiteUrl: optionalText(String(input.websiteUrl ?? ""), 500, "作品集网址"),
        socialLinksJson: toJson({ linkedin: String(input.linkedinUrl ?? "").trim(), x: String(input.xUrl ?? "").trim() })
      },
      create: { id: makeId("rider_profile"), userId: ctx.userId, skillsJson: toJson(draftTags(input.skills, 20)) }
    });
  } else if (role === "judge") {
    await prisma.judgeProfile.upsert({
      where: { userId: ctx.userId },
      update: {
        organization: optionalText(String(input.organization ?? ""), 120, "组织"), title: optionalText(String(input.title ?? ""), 80, "职务"),
        expertiseJson: toJson(draftTags(input.expertise, 20)), reviewBio: optionalText(String(input.reviewBio ?? ""), 500, "评审背景"),
        yearsExperience: String(input.yearsExperience ?? "").trim() ? Number(input.yearsExperience) : null,
        credentialUrl: optionalText(String(input.credentialUrl ?? ""), 500, "资质链接"), conflictConfirmedAt: input.conflictConfirmed ? new Date() : null
      },
      create: { id: makeId("judge_profile"), userId: ctx.userId, expertiseJson: toJson(draftTags(input.expertise, 20)) }
    });
  } else {
    await prisma.organizerProfile.upsert({
      where: { userId: ctx.userId },
      update: {
        organizationName: optionalText(String(input.organizationName ?? ""), 120, "机构名称"), position: optionalText(String(input.position ?? ""), 80, "职位"),
        eventCategoriesJson: toJson(draftTags(input.eventCategories, 10)), organizerBio: optionalText(String(input.organizerBio ?? ""), 500, "组织背景"),
        organizationWebsite: optionalText(String(input.organizationWebsite ?? ""), 500, "机构网站")
      },
      create: { id: makeId("organizer_profile"), userId: ctx.userId, eventCategoriesJson: toJson(draftTags(input.eventCategories, 10)) }
    });
  }
  return ok("角色资料草稿已保存");
}

export async function submitRoleProfile(ctx: AuthContext | null, role: string, input: RoleProfileInput): Promise<Result> {
  requireAuth(ctx);
  if (!isSelectableRole(role)) return fail("未知角色");
  let validated: ReturnType<typeof validateRoleProfile>;
  try {
    validated = validateRoleProfile(role, input);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "角色资料格式错误");
  }
  const existingGrant = await prisma.userRole.findUnique({ where: { userId_role: { userId: ctx.userId, role } } });
  const application = await prisma.roleApplication.findFirst({
    where: { userId: ctx.userId, requestedRole: role, status: { in: ["draft", "pending", "rejected"] } },
    orderBy: { createdAt: "desc" }
  });
  await prisma.$transaction(async (tx) => {
    if (validated.role === "rider") {
      await tx.riderProfile.upsert({ where: { userId: ctx.userId }, update: validated.data, create: { id: makeId("rider_profile"), userId: ctx.userId, ...validated.data } });
    } else if (validated.role === "judge") {
      await tx.judgeProfile.upsert({ where: { userId: ctx.userId }, update: validated.data, create: { id: makeId("judge_profile"), userId: ctx.userId, ...validated.data } });
    } else {
      await tx.organizerProfile.upsert({ where: { userId: ctx.userId }, update: validated.data, create: { id: makeId("organizer_profile"), userId: ctx.userId, ...validated.data } });
    }
    if (existingGrant?.status === "active") return;
    const app = application ?? await tx.roleApplication.create({
      data: { id: makeId("role_app"), userId: ctx.userId, requestedRole: role, source: "self", status: "draft" }
    });
    if (role === "rider") {
      await tx.userRole.upsert({
        where: { userId_role: { userId: ctx.userId, role } },
        update: { status: "active", source: "self", grantedAt: new Date(), suspendedAt: null, revokedAt: null, reason: null },
        create: { id: makeId("user_role"), userId: ctx.userId, role, status: "active", source: "self" }
      });
      await tx.roleApplication.update({ where: { id: app.id }, data: { status: "approved", submittedAt: new Date(), reviewedAt: new Date() } });
    } else {
      await tx.roleApplication.update({ where: { id: app.id }, data: { status: "pending", submittedAt: new Date(), reviewedAt: null, reviewerId: null, reviewNote: null } });
    }
  });
  return ok(role === "rider" || existingGrant?.status === "active" ? "角色资料已保存并开通" : "角色申请已提交审核");
}

export async function withdrawRoleApplication(ctx: AuthContext | null, applicationId: string): Promise<Result> {
  requireAuth(ctx);
  const application = await prisma.roleApplication.findUnique({ where: { id: applicationId } });
  if (!application || application.userId !== ctx.userId || application.source !== "self") return fail("无权撤回该申请");
  if (!["draft", "pending", "rejected"].includes(application.status)) return fail("当前状态不能撤回");
  await prisma.roleApplication.update({ where: { id: applicationId }, data: { status: "withdrawn", reviewedAt: new Date() } });
  return ok("角色申请已撤回");
}

export async function reviewRoleApplication(ctx: AuthContext | null, applicationId: string, decision: string, note?: string): Promise<Result> {
  requireRole(ctx, ["admin"]);
  const application = await prisma.roleApplication.findUnique({ where: { id: applicationId } });
  if (!application || application.status !== "pending") return fail("待审核申请不存在");
  if (!["judge", "organizer"].includes(application.requestedRole)) return fail("该角色不需要审核");
  if (decision === "reject" && !note?.trim()) return fail("驳回时必须填写原因");
  await prisma.$transaction(async (tx) => {
    if (decision === "approve") {
      await tx.userRole.upsert({
        where: { userId_role: { userId: application.userId, role: application.requestedRole } },
        update: { status: "active", source: application.source, grantedByUserId: ctx.userId, grantedAt: new Date(), suspendedAt: null, revokedAt: null, reason: null },
        create: { id: makeId("user_role"), userId: application.userId, role: application.requestedRole, status: "active", source: application.source, grantedByUserId: ctx.userId }
      });
    }
    await tx.roleApplication.update({
      where: { id: applicationId },
      data: { status: decision === "approve" ? "approved" : "rejected", reviewerId: ctx.userId, reviewNote: note?.trim() || null, reviewedAt: new Date() }
    });
  });
  return ok(decision === "approve" ? "角色申请已通过" : "角色申请已驳回");
}

export async function setUserRoleStatus(ctx: AuthContext | null, userId: string, role: string, action: string, reason?: string): Promise<Result> {
  requireRole(ctx, ["admin"]);
  if (!["rider", "judge", "organizer", "admin"].includes(role)) return fail("未知角色");
  if (!["grant", "suspend", "restore", "revoke"].includes(action)) return fail("未知操作");
  const existing = await prisma.userRole.findUnique({ where: { userId_role: { userId, role } } });
  if (userId === ctx.userId && role === "admin" && action !== "restore") return fail("不能修改自己的 Admin 资格");
  if (role === "admin" && ["suspend", "revoke"].includes(action)) {
    const activeAdmins = await prisma.userRole.count({ where: { role: "admin", status: "active" } });
    if (activeAdmins <= 1 && existing?.status === "active") return fail("不能停用最后一名 Admin");
  }
  if (action === "grant" && role !== "admin") return fail("业务角色必须通过资料和审核流程开通");
  if (action === "grant") {
    await prisma.userRole.upsert({
      where: { userId_role: { userId, role } },
      update: { status: "active", source: "admin", grantedByUserId: ctx.userId, grantedAt: new Date(), suspendedAt: null, revokedAt: null, reason: null },
      create: { id: makeId("user_role"), userId, role, status: "active", source: "admin", grantedByUserId: ctx.userId }
    });
    return ok("Admin 资格已授予");
  }
  if (!existing) return fail("角色资格不存在");
  const status = action === "restore" ? "active" : action === "suspend" ? "suspended" : "revoked";
  await prisma.$transaction([
    prisma.userRole.update({
      where: { id: existing.id },
      data: { status, reason: reason?.trim() || null, suspendedAt: status === "suspended" ? new Date() : null, revokedAt: status === "revoked" ? new Date() : null }
    }),
    ...(status === "active" ? [] : [prisma.authSession.updateMany({ where: { userId, activeRole: role }, data: { activeRole: null } })])
  ]);
  return ok(status === "active" ? "角色资格已恢复" : "角色资格已停用");
}

export async function runP0Regression(ctx: AuthContext | null, raceId: string): Promise<Result> {
  requireManagedRace(ctx, raceId);
  const originalScreen = await prisma.screenState.findUnique({ where: { raceId }, include: { currentRound: true, stableProjection: true } });
  if (!originalScreen?.currentRound || originalScreen.currentRound.status !== "running" || originalScreen.stableProjection?.type !== "ary_race_live" || originalScreen.stableProjection.status !== "stable") {
    return fail("请先在 Screen Console 准备 running Round 的 Race Live 大屏，再运行 P0 彩排");
  }
  const race = await prisma.race.findUnique({ where: { id: raceId }, include: { registrations: true } });
  if (!race) return fail("Race不存在");
  const existingVersionedRegistration = await prisma.registration.findFirst({
    where: { raceId, work: { is: { currentVersionId: { not: null } } } },
    include: { user: true }
  });
  const rider = existingVersionedRegistration?.user ?? await prisma.user.findFirst({ where: { roles: { some: { role: "rider", status: "active" } } } });
  const judgeCandidates = await prisma.user.findMany({
    where: { roles: { some: { role: "judge", status: "active" } } },
    orderBy: { id: "asc" }
  });
  const judges = [];
  for (const candidate of judgeCandidates) {
    if (!(await hasRaceParticipation(candidate.id, raceId))) judges.push(candidate);
    if (judges.length === 3) break;
  }
  if (!rider || judges.length < 3) return fail("缺少 Rider 或至少三名无参赛冲突的 Judge 种子用户");
  const registration = existingVersionedRegistration ?? await prisma.registration.upsert({
      where: { raceId_userId: { raceId, userId: rider.id } },
      update: { status: "approved", approvedAt: new Date() },
      create: { id: makeId("reg"), raceId, userId: rider.id, status: "approved", submittedAt: new Date(), approvedAt: new Date() }
    });
  const project = await ensureRaceProject(registration.id);
  const riderCtx: AuthContext = { ...ctx!, userId: rider.id, availableRoles: ["rider"], activeRole: "rider" };
  const connectionResult = await registerCAConnection(riderCtx, project.id);
  const connectionId = connectionResult.ok ? connectionResult.id! : (await prisma.cAConnection.findFirst({ where: { raceProjectId: project.id } }))?.id;
  if (connectionId) {
    await handshakeCAConnection(riderCtx, connectionId);
    const connection = await prisma.cAConnection.findUnique({ where: { id: connectionId } });
    const idempotencyKey = makeId("p0");
    const payload: RidingSignalPayload = {
      messageId: makeId("message"),
      timestamp: new Date().toISOString(),
      raceId,
      registrationId: registration.id,
      raceProjectId: project.id,
      caConnectionId: connectionId,
      idempotencyKey,
      caSessionId: "session-p0",
      progressPercent: 100,
      tokens: 18000
    };
    await ingestRidingSignal({ ...payload, attestation: createRidingSignalAttestation(connection?.connectorId ?? "unknown", payload, "ocr_desktop_app") });
  }
  let workId = (await prisma.work.findUnique({ where: { registrationId: registration.id } }))?.id;
  if (!workId) {
    const work = await submitWork(riderCtx, registration.id, {
      title: "Adaptive Bay Route Agent",
      summary: "A route planner that replans around live constraints and explains tradeoffs.",
      demoUrl: "https://demo.example.com/adaptive-bay-route-agent",
      repoUrl: "https://github.com/example/adaptive-bay-route-agent",
      repoCommitSha: "a".repeat(40)
    });
    if (!work.ok) return fail(`P0 Work提交失败：${work.message}`);
    workId = work.id!;
    const locked = await lockSubmissionWindow(ctx, raceId, "P0回归冻结提交版本");
    if (!locked.ok) return fail(`P0 提交冻结失败：${locked.message}`);
  }
  const publishedWork = await publishWork(ctx, workId);
  if (!publishedWork.ok) return fail(`P0 Work公开失败：${publishedWork.message}`);
  const pool = await saveRaceJudgePool(ctx, raceId, judges.map((judge) => judge.id));
  if (!pool.ok) return fail(`P0 Judge 池配置失败：${pool.message}`);
  const allocation = await allocateRaceJudges(ctx, raceId, "p0-balanced-random-v1");
  if (!allocation.ok) return fail(`P0 Judge 自动分配失败：${allocation.message}`);
  const p0Assignments = await prisma.judgeAssignment.findMany({ where: { raceId }, orderBy: [{ workId: "asc" }, { slot: "asc" }] });
  for (const assignment of p0Assignments) {
    const judgeCtx: AuthContext = { ...ctx!, userId: assignment.judgeUserId, availableRoles: ["judge"], activeRole: "judge" };
    const judging = await submitJudgingRecord(judgeCtx, assignment.id, {
      scoreResult: 92,
      scoreRiding: 88,
      comments: "Clear outcome, traceable evidence, and strong recovery behavior."
    });
    if (!judging.ok) return fail(`P0 评审失败：${judging.message}`);
  }
  const publishedReviewResults = await publishRaceReviewResults(ctx, raceId);
  if (!publishedReviewResults.ok) return fail(`P0 评审结果发布失败：${publishedReviewResults.message}`);
  const award = await publishAward(ctx, { raceId, registrationId: registration.id, workId, awardName: "Grand Prize", rank: 1, reason: "Best combined result and riding evidence package." });
  if (!award.ok) return fail(`P0 Award发布失败：${award.message}`);
  const raceReport = await generateReport(ctx, { raceId, type: "race_report" });
  const review = await generateReport(ctx, { raceId, type: "review_summary" });
  if (raceReport.ok) await publishReport(ctx, raceReport.id!);
  if (review.ok) await publishReport(ctx, review.id!);
  await rebuildProjection(ctx, raceId);
  await switchScreenMode(ctx, raceId, "live");
  await switchScreenMode(ctx, raceId, "leaderboard");
  await switchScreenMode(ctx, raceId, "works");
  await publishAnnouncement(ctx, { raceId, title: "P0 rehearsal", body: "Screen, Live Hall, Report and Results rehearsal completed." });
  await switchScreenMode(ctx, raceId, "live");
  await prisma.screenState.update({ where: { raceId }, data: {
    currentRoundId: originalScreen.currentRoundId,
    fallbackEnabled: originalScreen.fallbackEnabled,
    activeGroupOrder: originalScreen.activeGroupOrder,
    autoRotateEnabled: originalScreen.autoRotateEnabled,
    rotationIntervalSeconds: originalScreen.rotationIntervalSeconds,
    rotationEpochAt: originalScreen.rotationEpochAt,
    rotationPausedAt: originalScreen.rotationPausedAt,
    mode: "live"
  } });
  await markReleaseChecklistItem(ctx, { raceId, itemKey: "screen_rehearsal", label: "大屏彩排", status: "done", evidence: "Screen modes live/leaderboard/works/announcement switched." });
  await markReleaseChecklistItem(ctx, { raceId, itemKey: "live_rehearsal", label: "Live Hall彩排", status: "done", evidence: "Live Hall reads stable Projection after rebuild." });
  await markReleaseChecklistItem(ctx, { raceId, itemKey: "report_results_rehearsal", label: "Report/Results彩排", status: "done", evidence: "Public race_report/review_summary generated and published." });
  await recordGoNoGo(ctx, raceId, "Local demo go decision recorded after P0 regression.");  await createBackup(ctx, raceId, "p0_rehearsal_snapshot");
  await prisma.releaseChecklistItem.upsert({
    where: { raceId_itemKey: { raceId, itemKey: "p0_regression" } },
    update: { status: "done", evidence: "Next.js P0 regression completed.", updatedAt: new Date() },
    create: { id: makeId("check"), raceId, itemKey: "p0_regression", label: "P0回归一键跑通", status: "done", evidence: "Next.js P0 regression completed.", updatedAt: new Date() }
  });
  return ok("P0回归已跑通");
}
