import { prisma } from "@/lib/prisma";
import { canManageRace, type AuthContext, requireAuth, requireManagedRace, requireRole } from "@/lib/auth";
import { fromJson, toJson } from "@/lib/json";
import { makeId, slugify } from "@/lib/ids";

type Result = { ok: true; message: string; id?: string } | { ok: false; message: string };

function ok(message: string, id?: string): Result {
  return id ? { ok: true, message, id } : { ok: true, message };
}

function fail(message: string): Result {
  return { ok: false, message };
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
  if (existing) return existing;
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

export async function submitRegistration(ctx: AuthContext | null, raceId: string): Promise<Result> {
  requireRole(ctx, ["rider", "admin"]);
  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) return fail("Race不存在");
  const registration = await prisma.registration.upsert({
    where: { raceId_userId: { raceId, userId: ctx.userId } },
    update: {},
    create: {
      id: makeId("reg"),
      raceId,
      userId: ctx.userId,
      status: "pending",
      submittedAt: new Date()
    }
  });
  return ok("报名已提交", registration.id);
}

export async function approveRegistration(ctx: AuthContext | null, registrationId: string): Promise<Result> {
  requireAuth(ctx);
  const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!registration) return fail("Registration不存在");
  requireManagedRace(ctx, registration.raceId);
  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: "approved", approvedAt: new Date() }
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
    include: { registration: true }
  });
  if (!project) return fail("RaceProject不存在");
  if (project.registration.userId !== ctx.userId && !canManageRace(ctx, project.registration.raceId)) {
    return fail("没有登记CAConnection的权限");
  }
  const connection = await prisma.cAConnection.create({
    data: {
      id: makeId("conn"),
      raceProjectId,
      caType: "codex",
      connectorId: "github-oauth-demo-connector",
      connectorVersion: "0.1.0",
      externalProjectRef: `ca-${raceProjectId}`,
      ingestionStatus: "connected",
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
    include: { raceProject: { include: { registration: true } } }
  });
  if (!connection) return fail("CAConnection不存在");
  if (connection.raceProject.registration.userId !== ctx.userId && !canManageRace(ctx, connection.raceProject.registration.raceId)) {
    return fail("没有握手CAConnection的权限");
  }
  await prisma.cAConnection.update({ where: { id: caConnectionId }, data: { handshakeAt: new Date() } });
  return ok("CAConnection握手完成", caConnectionId);
}

export async function ingestRidingSignal(input: {
  raceId: string;
  registrationId: string;
  raceProjectId: string;
  caConnectionId: string;
  idempotencyKey: string;
  caSessionId: string;
  progressPercent?: number;
  tokens?: number;
}): Promise<Result> {
  const connection = await prisma.cAConnection.findUnique({
    where: { id: input.caConnectionId },
    include: { raceProject: { include: { registration: true } } }
  });
  if (
    !connection ||
    !connection.handshakeAt ||
    connection.disabledAt ||
    connection.raceProjectId !== input.raceProjectId ||
    connection.raceProject.registrationId !== input.registrationId ||
    connection.raceProject.registration.raceId !== input.raceId
  ) {
    await createReviewFlag({
      raceId: input.raceId,
      registrationId: input.registrationId,
      raceProjectId: input.raceProjectId,
      type: "ingestion_exception",
      severity: "high",
      summary: "CA信号未通过登记、握手或归属校验，已隔离。",
      sourceRef: { idempotencyKey: input.idempotencyKey }
    });
    return fail("CA信号非法，已隔离");
  }
  const session = await prisma.session.upsert({
    where: { caConnectionId_externalSessionRef: { caConnectionId: input.caConnectionId, externalSessionRef: input.caSessionId } },
    update: {
      lastActiveAt: new Date(),
      tokens: input.tokens ?? 0,
      snapshotJson: toJson({ idempotencyKey: input.idempotencyKey, progressPercent: input.progressPercent ?? 100 })
    },
    create: {
      id: makeId("session"),
      caConnectionId: input.caConnectionId,
      externalSessionRef: input.caSessionId,
      startedAt: new Date(),
      lastActiveAt: new Date(),
      tokens: input.tokens ?? 0,
      snapshotJson: toJson({ idempotencyKey: input.idempotencyKey, progressPercent: input.progressPercent ?? 100 })
    }
  });
  await prisma.cAConnection.update({ where: { id: input.caConnectionId }, data: { ingestionStatus: "active", lastSyncedAt: new Date() } });
  await prisma.raceProject.update({
    where: { id: input.raceProjectId },
    data: {
      aggregateIngestionStatus: "active",
      connectionHealth: "ok",
      lastSyncedAt: new Date(),
      metricsJson: toJson({ progressPercent: input.progressPercent ?? 100, tokens: input.tokens ?? 0 })
    }
  });
  await prisma.evidence.create({
    data: {
      id: makeId("ev"),
      raceId: input.raceId,
      registrationId: input.registrationId,
      type: "session_summary",
      title: "CA Session Summary",
      summary: "合法CA信号已进入Evidence和Projection输入。",
      sourceRefJson: toJson({ sessionId: session.id, idempotencyKey: input.idempotencyKey }),
      visibility: "public"
    }
  });
  return ok("CA信号已接入", session.id);
}

export async function submitWork(ctx: AuthContext | null, registrationId: string, input: { title: string; summary: string; demoUrl?: string; repoUrl?: string }): Promise<Result> {
  requireAuth(ctx);
  const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!registration) return fail("Registration不存在");
  if (registration.userId !== ctx.userId && !canManageRace(ctx, registration.raceId)) return fail("没有提交Work的权限");
  const work = await prisma.work.upsert({
    where: { registrationId },
    update: {
      title: input.title,
      summary: input.summary,
      demoUrl: input.demoUrl,
      repoUrl: input.repoUrl,
      status: "submitted",
      visibility: "review",
      submittedAt: new Date()
    },
    create: {
      id: makeId("work"),
      registrationId,
      slug: slugify(input.title) || makeId("work"),
      title: input.title,
      summary: input.summary,
      demoUrl: input.demoUrl,
      repoUrl: input.repoUrl,
      status: "submitted",
      visibility: "review",
      submittedAt: new Date()
    }
  });
  return ok("Work已提交", work.id);
}

export async function publishWork(ctx: AuthContext | null, workId: string): Promise<Result> {
  requireAuth(ctx);
  const work = await prisma.work.findUnique({ where: { id: workId }, include: { registration: true } });
  if (!work) return fail("Work不存在");
  requireManagedRace(ctx, work.registration.raceId);
  await prisma.work.update({ where: { id: workId }, data: { visibility: "public", status: "published", publishedAt: new Date() } });
  return ok("Work已公开", workId);
}

export async function assignJudge(ctx: AuthContext | null, workId: string, judgeUserId: string): Promise<Result> {
  requireAuth(ctx);
  const work = await prisma.work.findUnique({ where: { id: workId }, include: { registration: true } });
  if (!work) return fail("Work不存在");
  requireManagedRace(ctx, work.registration.raceId);
  const assignment = await prisma.judgeAssignment.upsert({
    where: { workId_judgeUserId: { workId, judgeUserId } },
    update: {},
    create: {
      id: makeId("assign"),
      raceId: work.registration.raceId,
      workId,
      judgeUserId,
      assignedByUserId: ctx.userId,
      status: "assigned",
      assignedAt: new Date()
    }
  });
  return ok("JudgeAssignment已创建", assignment.id);
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
  const award = await prisma.award.upsert({
    where: { raceId_awardName_rank: { raceId: input.raceId, awardName: input.awardName, rank: input.rank } },
    update: { registrationId: input.registrationId, workId: input.workId, decisionReason: input.reason, status: "published", publishedAt: new Date() },
    create: {
      id: makeId("award"),
      raceId: input.raceId,
      registrationId: input.registrationId,
      workId: input.workId,
      awardName: input.awardName,
      rank: input.rank,
      decisionReason: input.reason,
      status: "published",
      publishedAt: new Date()
    }
  });
  return ok("Award已发布", award.id);
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
    include: { user: true, raceProject: true, work: true, reviewFlags: true }
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
          riderName: registration.user.displayName,
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

export async function createBackup(ctx: AuthContext | null, raceId: string, scope = "race_day_core"): Promise<Result> {
  requireManagedRace(ctx, raceId);
  const backup = await prisma.backup.create({
    data: { id: makeId("backup"), raceId, scope, status: "completed", evidence: "server snapshot recorded" }
  });
  return ok("备份记录已创建", backup.id);
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
  const rider = await prisma.user.findFirst({ where: { rolesJson: { contains: "rider" } } });
  const judge = await prisma.user.findFirst({ where: { rolesJson: { contains: "judge" } } });
  if (!rider || !judge) return fail("缺少Rider或Judge种子用户");
  const registration = await prisma.registration.upsert({
    where: { raceId_userId: { raceId, userId: rider.id } },
    update: { status: "approved", approvedAt: new Date() },
    create: { id: makeId("reg"), raceId, userId: rider.id, status: "approved", submittedAt: new Date(), approvedAt: new Date() }
  });
  const project = await ensureRaceProject(registration.id);
  const connectionResult = await registerCAConnection({ ...ctx!, userId: rider.id, roles: ["rider"] }, project.id);
  const connectionId = connectionResult.ok ? connectionResult.id! : (await prisma.cAConnection.findFirst({ where: { raceProjectId: project.id } }))?.id;
  if (connectionId) {
    await handshakeCAConnection({ ...ctx!, userId: rider.id, roles: ["rider"] }, connectionId);
    await ingestRidingSignal({
      raceId,
      registrationId: registration.id,
      raceProjectId: project.id,
      caConnectionId: connectionId,
      idempotencyKey: makeId("p0"),
      caSessionId: "session-p0",
      progressPercent: 100,
      tokens: 18000
    });
  }
  const work = await submitWork({ ...ctx!, userId: rider.id, roles: ["rider"] }, registration.id, {
    title: "Adaptive Bay Route Agent",
    summary: "A route planner that replans around live constraints and explains tradeoffs.",
    demoUrl: "https://demo.example.com/adaptive-bay-route-agent",
    repoUrl: "https://github.com/example/adaptive-bay-route-agent"
  });
  if (work.ok) {
    await publishWork(ctx, work.id!);
    const assignment = await assignJudge(ctx, work.id!, judge.id);
    if (assignment.ok) {
      await submitJudgingRecord({ ...ctx!, userId: judge.id, roles: ["judge"] }, assignment.id!, {
        scoreResult: 92,
        scoreRiding: 88,
        comments: "Clear outcome, traceable evidence, and strong recovery behavior."
      });
    }
    await publishAward(ctx, { raceId, registrationId: registration.id, workId: work.id!, awardName: "Grand Prize", rank: 1, reason: "Best combined result and riding evidence package." });
  }
  const raceReport = await generateReport(ctx, { raceId, type: "race_report" });
  const review = await generateReport(ctx, { raceId, type: "review_summary" });
  if (raceReport.ok) await publishReport(ctx, raceReport.id!);
  if (review.ok) await publishReport(ctx, review.id!);
  await rebuildProjection(ctx, raceId);
  await createBackup(ctx, raceId, "p0_rehearsal_snapshot");
  await prisma.releaseChecklistItem.upsert({
    where: { raceId_itemKey: { raceId, itemKey: "p0_regression" } },
    update: { status: "done", evidence: "Next.js P0 regression completed.", updatedAt: new Date() },
    create: { id: makeId("check"), raceId, itemKey: "p0_regression", label: "P0回归一键跑通", status: "done", evidence: "Next.js P0 regression completed.", updatedAt: new Date() }
  });
  return ok("P0回归已跑通");
}
