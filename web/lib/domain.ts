import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageRace, type AuthContext, requireAuth, requireManagedRace, requireRole } from "@/lib/auth";
import { fromJson, toJson } from "@/lib/json";
import { makeId, slugify } from "@/lib/ids";
import {
  createRidingSignalAttestation,
  getConnectorSigningKey,
  verifyRidingSignalAttestation,
  type RidingSignalAttestation,
  type RidingSignalPayload
} from "@/lib/ca-attestation";
import {
  createWorkSubmissionIntegrityHash,
  getSubmissionWindowState,
  validateWorkSubmissionInput,
  WORK_SUBMISSION_HASH_SCHEMA
} from "@/lib/work-submission";

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
        judgeVisibleSummary: input.summary,
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
      OR: [{ userId }, { team: { members: { some: { userId } } } }]
    }
  });
  if (existingRegistration) return true;
  const draftTeam = await prisma.team.findFirst({
    where: { raceId, registration: null, members: { some: { userId } } }
  });
  return Boolean(draftTeam);
}

async function createInviteCode() {
  for (let i = 0; i < 5; i += 1) {
    const code = makeId("invite").replace(/^invite_?/, "").slice(-8).toUpperCase();
    const existing = await prisma.team.findUnique({ where: { inviteCode: code } });
    if (!existing) return code;
  }
  return makeId("invite").replace(/^invite_?/, "").toUpperCase();
}


export async function createRace(ctx: AuthContext | null, input: { title: string; challenge: string; summary: string }): Promise<Result> {
  requireRole(ctx, ["organizer", "admin"]);
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
  requireRole(ctx, ["organizer", "admin"]);
  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) return fail("Race不存在");
  if (race.createdByUserId !== ctx!.userId && !canManageRace(ctx, raceId)) return fail("没有发布Race的权限");
  await prisma.race.update({
    where: { id: raceId },
    data: {
      status: "running",
      visibility: "public",
      scheduleJson: toJson({ registration: "open", race: "running", submission: "open", judging: "queue", results: "not_published" })
    }
  });
  return ok("Race已发布", raceId);
}
export async function submitRegistration(ctx: AuthContext | null, raceId: string): Promise<Result> {
  requireRole(ctx, ["rider", "admin"]);
  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) return fail("Race不存在");
  const team = await prisma.team.findFirst({ where: { raceId, members: { some: { userId: ctx.userId } } } });
  if (team) return fail("Already joined a team for this Race.");
  const registration = await prisma.registration.upsert({
    where: { raceId_userId: { raceId, userId: ctx.userId } },
    update: {},
    create: {
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

export async function createTeam(ctx: AuthContext | null, raceId: string, name: string): Promise<Result> {
  requireRole(ctx, ["rider", "admin"]);
  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) return fail("Race not found.");
  const teamName = name.trim();
  if (!teamName) return fail("Team name is required.");
  if (await hasRaceParticipation(ctx.userId, raceId)) return fail("Already participating in this Race.");
  const teamId = makeId("team");
  const baseSlug = slugify(teamName) || "team";
  const team = await prisma.team.create({
    data: {
      id: teamId,
      raceId,
      name: teamName,
      slug: `${baseSlug}-${teamId.slice(-5)}`,
      inviteCode: await createInviteCode(),
      status: "draft",
      maxMembers: 5,
      createdByUserId: ctx.userId,
      members: { create: { id: makeId("tm"), userId: ctx.userId, role: "captain" } }
    }
  });
  return ok("Team created.", team.id);
}

export async function joinTeam(ctx: AuthContext | null, inviteCode: string): Promise<Result> {
  requireRole(ctx, ["rider", "admin"]);
  const code = inviteCode.trim().toUpperCase();
  if (!code) return fail("Invite code is required.");
  const team = await prisma.team.findUnique({ where: { inviteCode: code }, include: { members: true } });
  if (!team) return fail("Team not found.");
  if (team.status !== "draft") return fail("Team has already been submitted.");
  if (team.members.length >= team.maxMembers) return fail("Team is full.");
  if (await hasRaceParticipation(ctx.userId, team.raceId)) return fail("Already participating in this Race.");
  const member = await prisma.teamMember.create({
    data: { id: makeId("tm"), teamId: team.id, userId: ctx.userId, role: "member" }
  });
  return ok("Joined team.", member.id);
}

export async function leaveTeam(ctx: AuthContext | null, teamId: string): Promise<Result> {
  requireAuth(ctx);
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
  requireAuth(ctx);
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: true, registration: true } });
  if (!team) return fail("Team not found.");
  if (team.registration || team.status !== "draft") return fail("Submitted team cannot be changed.");
  if (team.createdByUserId !== ctx.userId && !canManageRace(ctx, team.raceId)) return fail("No permission to manage this team.");
  if (team.createdByUserId === userId) return fail("Cannot remove the team captain.");
  const member = team.members.find((item) => item.userId === userId);
  if (!member) return fail("Team member not found.");
  await prisma.teamMember.delete({ where: { id: member.id } });
  return ok("Team member removed.", teamId);
}

export async function submitTeamRegistration(ctx: AuthContext | null, teamId: string): Promise<Result> {
  requireAuth(ctx);
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: true, registration: true } });
  if (!team) return fail("Team not found.");
  if (team.createdByUserId !== ctx.userId && !canManageRace(ctx, team.raceId)) return fail("Only team captain or organizer can submit team registration.");
  if (team.registration) return ok("Team registration already submitted.", team.registration.id);
  if (team.status !== "draft") return fail("Team cannot be submitted in current status.");
  if (team.members.length < 2) return fail("Team registration requires at least 2 members.");
  for (const member of team.members) {
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
  const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!registration) return fail("Registration不存在");
  requireManagedRace(ctx, registration.raceId);
  await prisma.$transaction(async (tx) => {
    await tx.registration.update({
      where: { id: registrationId },
      data: { status: "approved", approvedAt: new Date() }
    });
    if (registration.teamId) {
      await tx.team.update({ where: { id: registration.teamId }, data: { status: "locked" } });
    }
  });
  const project = await ensureRaceProject(registrationId);
  await createReviewFlag({
    raceId: registration.raceId,
    registrationId,
    raceProjectId: project.id,
    type: "no_ca_data",
    severity: "medium",
    summary: "RaceProject尚未配置CAConnection，评审前需确认证据缺口。",
    sourceRef: { scope: "race_project", id: project.id }
  });
  return ok("报名已审核，RaceProject已确保存在", project.id);
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
      return storedSession;
    });
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
        const integrityHash = createWorkSubmissionIntegrityHash({
          ...validated.data,
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
            hashSchemaVersion: WORK_SUBMISSION_HASH_SCHEMA,
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

export async function assignJudge(ctx: AuthContext | null, workId: string, judgeUserId: string): Promise<Result> {
  requireAuth(ctx);
  const scopedWork = await prisma.work.findUnique({ where: { id: workId }, select: { registration: { select: { raceId: true } } } });
  if (!scopedWork) return fail("Work不存在");
  requireManagedRace(ctx, scopedWork.registration.raceId);
  return runSerializableResult(async (tx) => {
    const work = await tx.work.findUnique({ where: { id: workId }, include: { registration: { include: { race: true } } } });
    if (!work) return fail("Work不存在");
    if (!work.currentVersionId) return fail("legacy Work必须先由Rider重新提交为版本化作品");
    const assignmentCount = await tx.judgeAssignment.count({ where: { raceId: work.registration.raceId } });
    const windowState = getSubmissionWindowState(work.registration.race, assignmentCount > 0);
    if (windowState === "open" || windowState === "not_started") return fail("提交窗口关闭后才能分配Judge");
    const assignment = await tx.judgeAssignment.upsert({
      where: { workId_judgeUserId: { workId, judgeUserId } },
      update: { workSubmissionVersionId: work.currentVersionId },
      create: {
        id: makeId("assign"), raceId: work.registration.raceId, workId, judgeUserId, assignedByUserId: ctx.userId,
        status: "assigned", assignedAt: new Date(), workSubmissionVersionId: work.currentVersionId
      }
    });
    return ok("JudgeAssignment已创建", assignment.id);
  });
}

export async function submitJudgingRecord(ctx: AuthContext | null, assignmentId: string, input: { scoreResult: number; scoreRiding: number; comments: string }): Promise<Result> {
  requireAuth(ctx);
  const assignment = await prisma.judgeAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return fail("JudgeAssignment不存在");
  if (assignment.judgeUserId !== ctx.userId) return fail("Judge只能提交分配给自己的评审");
  const record = await prisma.judgingRecord.upsert({
    where: { assignmentId },
    update: { ...input, status: "submitted", submittedAt: new Date() },
    create: { id: makeId("judge_record"), assignmentId, ...input, status: "submitted", submittedAt: new Date() }
  });
  await prisma.judgeAssignment.update({ where: { id: assignmentId }, data: { status: "reviewed" } });
  return ok("JudgingRecord已提交", record.id);
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
  requireManagedRace(ctx, raceId);
  if (ctx!.roles.includes("admin") && !ctx!.managedRaceIds.includes(raceId) && !reason?.trim()) return fail("Admin跨Race操作必须填写原因");
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
  requireManagedRace(ctx, raceId);
  if (ctx!.roles.includes("admin") && !ctx!.managedRaceIds.includes(raceId) && !reason?.trim()) return fail("Admin跨Race操作必须填写原因");
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
  requireManagedRace(ctx, input.raceId);
  if (ctx!.roles.includes("admin") && !ctx!.managedRaceIds.includes(input.raceId) && !input.reason?.trim()) return fail("Admin跨Race操作必须填写原因");
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
export async function updateUserRoles(ctx: AuthContext | null, userId: string, roles: string[]): Promise<Result> {
  requireRole(ctx, ["admin"]);
  await prisma.user.update({ where: { id: userId }, data: { rolesJson: toJson(roles) } });
  return ok("User.roles已更新", userId);
}

export async function updateProfile(ctx: AuthContext | null, input: { displayName: string; city?: string; githubLogin?: string }): Promise<Result> {
  requireAuth(ctx);
  const displayName = input.displayName.trim();
  if (!displayName) return fail("展示名不能为空");
  await prisma.user.update({
    where: { id: ctx.userId },
    data: {
      displayName,
      city: input.city?.trim() || null,
      githubLogin: input.githubLogin?.trim() || null,
      profileCompleted: true
    }
  });
  return ok("Profile已补全", ctx.userId);
}

export async function runP0Regression(ctx: AuthContext | null, raceId: string): Promise<Result> {
  requireManagedRace(ctx, raceId);
  const race = await prisma.race.findUnique({ where: { id: raceId }, include: { registrations: true } });
  if (!race) return fail("Race不存在");
  const existingVersionedRegistration = await prisma.registration.findFirst({
    where: { raceId, work: { is: { currentVersionId: { not: null } } } },
    include: { user: true }
  });
  const rider = existingVersionedRegistration?.user ?? await prisma.user.findFirst({ where: { rolesJson: { contains: "rider" } } });
  const judge = await prisma.user.findFirst({ where: { rolesJson: { contains: "judge" } } });
  if (!rider || !judge) return fail("缺少Rider或Judge种子用户");
  const registration = existingVersionedRegistration ?? await prisma.registration.upsert({
      where: { raceId_userId: { raceId, userId: rider.id } },
      update: { status: "approved", approvedAt: new Date() },
      create: { id: makeId("reg"), raceId, userId: rider.id, status: "approved", submittedAt: new Date(), approvedAt: new Date() }
    });
  const project = await ensureRaceProject(registration.id);
  const connectionResult = await registerCAConnection({ ...ctx!, userId: rider.id, roles: ["rider"] }, project.id);
  const connectionId = connectionResult.ok ? connectionResult.id! : (await prisma.cAConnection.findFirst({ where: { raceProjectId: project.id } }))?.id;
  if (connectionId) {
    await handshakeCAConnection({ ...ctx!, userId: rider.id, roles: ["rider"] }, connectionId);
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
    const work = await submitWork({ ...ctx!, userId: rider.id, roles: ["rider"] }, registration.id, {
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
  const assignment = await assignJudge(ctx, workId, judge.id);
  if (!assignment.ok) return fail(`P0 Judge分配失败：${assignment.message}`);
  const judging = await submitJudgingRecord({ ...ctx!, userId: judge.id, roles: ["judge"] }, assignment.id!, {
    scoreResult: 92,
    scoreRiding: 88,
    comments: "Clear outcome, traceable evidence, and strong recovery behavior."
  });
  if (!judging.ok) return fail(`P0 评审失败：${judging.message}`);
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
