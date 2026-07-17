import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createWorkSubmissionIntegrityHash, WORK_SUBMISSION_HASH_SCHEMA } from "../lib/work-submission";

const prisma = new PrismaClient();
const includeE2EFixtures = process.env.DATABASE_URL?.includes("e2e.db") ?? false;
const metroProfileJson = readFileSync(new URL("../public/tracks/metro-raceway/1.0.0/track.profile.json", import.meta.url), "utf8");
const coastalProfileJson = readFileSync(new URL("../public/tracks/coastal-circuit/1.0.0/track.profile.json", import.meta.url), "utf8");

function json(value: unknown) {
  return JSON.stringify(value);
}

async function main() {
  await prisma.screenControlAuditEvent.deleteMany();
  await prisma.screenState.deleteMany();
  await prisma.releaseChecklistItem.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.backup.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.projection.deleteMany();
  await prisma.report.deleteMany();
  await prisma.award.deleteMany();
  await prisma.judgingRecord.deleteMany();
  await prisma.judgeAssignment.deleteMany();
  await prisma.judgeAllocationBatch.deleteMany();
  await prisma.raceJudgeMembership.deleteMany();
  await prisma.submissionAuditEvent.deleteMany();
  await prisma.work.updateMany({ data: { currentVersionId: null } });
  await prisma.workSubmissionVersion.deleteMany();
  await prisma.reviewFlag.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.work.deleteMany();
  await prisma.session.deleteMany();
  await prisma.cAConnection.deleteMany();
  await prisma.raceProject.deleteMany();
  await prisma.raceRoundEntry.deleteMany();
  await prisma.raceRound.deleteMany();
  await prisma.trackProfileVersion.deleteMany();
  await prisma.trackProfile.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.race.deleteMany();
  await prisma.roleApplication.deleteMany();
  await prisma.riderProfile.deleteMany();
  await prisma.judgeProfile.deleteMany();
  await prisma.organizerProfile.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.authAccount.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      {
        id: "user_org_1",
        slug: "ary-ops",
        displayName: "Lin Organizer",
        githubLogin: "ary-ops",
        githubUserId: "debug-org",
        email: "organizer@example.com",
        verifiedEmailsJson: json(["organizer@example.com"]),
        emailVerifiedAt: new Date(), emailConfirmedAt: new Date(),
        termsVersion: "2026-07-15", termsAcceptedAt: new Date(), privacyVersion: "2026-07-15", privacyAcceptedAt: new Date(),
        preferredRole: "organizer",
        profileCompleted: true,
        city: "San Francisco"
      },
      {
        id: "user_org_2",
        slug: "northstar-ops",
        displayName: "Nora Organizer",
        githubLogin: "northstar-ops",
        githubUserId: "debug-org-2",
        email: "organizer-alt@example.com",
        verifiedEmailsJson: json(["organizer-alt@example.com"]),
        emailVerifiedAt: new Date(), emailConfirmedAt: new Date(),
        termsVersion: "2026-07-15", termsAcceptedAt: new Date(), privacyVersion: "2026-07-15", privacyAcceptedAt: new Date(),
        preferredRole: "organizer",
        profileCompleted: true,
        city: "Singapore"
      },
      {
        id: "user_rider_1",
        slug: "mira-chen",
        displayName: "Mira Chen",
        githubLogin: "mira-ca",
        githubUserId: "debug-rider-1", email: "mira@example.com", verifiedEmailsJson: json(["mira@example.com"]),
        emailVerifiedAt: new Date(), emailConfirmedAt: new Date(), termsVersion: "2026-07-15", termsAcceptedAt: new Date(), privacyVersion: "2026-07-15", privacyAcceptedAt: new Date(), preferredRole: "rider",
        profileCompleted: true,
        city: "Oakland"
      },
      {
        id: "user_rider_2",
        slug: "ana-ruiz",
        displayName: "Ana Ruiz",
        githubLogin: "ana-route",
        githubUserId: "debug-rider-2", email: "ana@example.com", verifiedEmailsJson: json(["ana@example.com"]),
        emailVerifiedAt: new Date(), emailConfirmedAt: new Date(), termsVersion: "2026-07-15", termsAcceptedAt: new Date(), privacyVersion: "2026-07-15", privacyAcceptedAt: new Date(), preferredRole: "rider",
        profileCompleted: true,
        city: "Shenzhen"
      },
      {
        id: "user_judge_1",
        slug: "ava-judge",
        displayName: "Ava Judge",
        githubLogin: "judge-ava",
        githubUserId: "debug-judge", email: "judge@example.com", verifiedEmailsJson: json(["judge@example.com"]),
        emailVerifiedAt: new Date(), emailConfirmedAt: new Date(), termsVersion: "2026-07-15", termsAcceptedAt: new Date(), privacyVersion: "2026-07-15", privacyAcceptedAt: new Date(), preferredRole: "judge",
        profileCompleted: true,
        city: "Seattle"
      },
      {
        id: "user_admin_1", slug: "ary-admin", displayName: "ARY Admin", githubLogin: "ary-admin", githubUserId: "debug-admin",
        email: "admin@example.com", verifiedEmailsJson: json(["admin@example.com"]), emailVerifiedAt: new Date(), emailConfirmedAt: new Date(),
        termsVersion: "2026-07-15", termsAcceptedAt: new Date(), privacyVersion: "2026-07-15", privacyAcceptedAt: new Date(), preferredRole: "admin", profileCompleted: true
      },
      {
        id: "user_multi_1", slug: "multi-role-user", displayName: "Multi Role User", githubLogin: "multi-role", githubUserId: "debug-multi",
        email: "multi@example.com", verifiedEmailsJson: json(["multi@example.com"]), emailVerifiedAt: new Date(), emailConfirmedAt: new Date(),
        termsVersion: "2026-07-15", termsAcceptedAt: new Date(), privacyVersion: "2026-07-15", privacyAcceptedAt: new Date(), preferredRole: "organizer", profileCompleted: true
      },
      ...(includeE2EFixtures ? [{
        id: "user_rider_e2e",
        slug: "e2e-rider",
        displayName: "E2E Rider",
        githubLogin: "e2e-rider",
        githubUserId: "debug-rider-e2e", email: "rider-e2e@example.com", verifiedEmailsJson: json(["rider-e2e@example.com"]),
        emailVerifiedAt: new Date(), emailConfirmedAt: new Date(), termsVersion: "2026-07-15", termsAcceptedAt: new Date(), privacyVersion: "2026-07-15", privacyAcceptedAt: new Date(), preferredRole: "rider",
        profileCompleted: true,
        city: "Test Track"
      }] : [])
    ]
  });

  await prisma.userRole.createMany({ data: [
    { id: "role_org_organizer", userId: "user_org_1", role: "organizer", status: "active", source: "seed" },
    { id: "role_org_alt_organizer", userId: "user_org_2", role: "organizer", status: "active", source: "seed" },
    { id: "role_org_admin", userId: "user_org_1", role: "admin", status: "active", source: "seed" },
    { id: "role_org_judge", userId: "user_org_1", role: "judge", status: "active", source: "seed" },
    { id: "role_org_rider", userId: "user_org_1", role: "rider", status: "active", source: "seed" },
    { id: "role_rider_1", userId: "user_rider_1", role: "rider", status: "active", source: "seed" },
    { id: "role_rider_2", userId: "user_rider_2", role: "rider", status: "active", source: "seed" },
    { id: "role_judge_1", userId: "user_judge_1", role: "judge", status: "active", source: "seed" },
    { id: "role_admin_1", userId: "user_admin_1", role: "admin", status: "active", source: "seed" },
    { id: "role_multi_rider", userId: "user_multi_1", role: "rider", status: "active", source: "seed" },
    { id: "role_multi_judge", userId: "user_multi_1", role: "judge", status: "active", source: "seed" },
    { id: "role_multi_organizer", userId: "user_multi_1", role: "organizer", status: "active", source: "seed" },
    ...(includeE2EFixtures ? [{ id: "role_rider_e2e", userId: "user_rider_e2e", role: "rider", status: "active", source: "seed" }] : [])
  ] });

  await prisma.riderProfile.createMany({ data: [
    { id: "rider_profile_org", userId: "user_org_1", headline: "Agent builder", skillsJson: json(["TypeScript", "Operations"]), completedAt: new Date() },
    { id: "rider_profile_mira", userId: "user_rider_1", headline: "Travel agent rider", skillsJson: json(["TypeScript", "Product Design"]), bio: "Building explainable travel agents.", city: "Oakland", organization: "ARY Community", completedAt: new Date() },
    { id: "rider_profile_ana", userId: "user_rider_2", headline: "Local discovery rider", skillsJson: json(["Python", "Research"]), city: "Shenzhen", completedAt: new Date() },
    { id: "rider_profile_multi", userId: "user_multi_1", headline: "Multi-role community member", skillsJson: json(["AI", "Events"]), completedAt: new Date() },
    ...(includeE2EFixtures ? [{ id: "rider_profile_e2e", userId: "user_rider_e2e", headline: "E2E Rider", skillsJson: json(["Testing"]), completedAt: new Date() }] : [])
  ] });
  await prisma.judgeProfile.createMany({ data: [
    { id: "judge_profile_org", userId: "user_org_1", organization: "ARY", title: "Reviewer", expertiseJson: json(["Agents"]), reviewBio: "Experienced agent product reviewer and event operator.", conflictConfirmedAt: new Date(), completedAt: new Date() },
    { id: "judge_profile_ava", userId: "user_judge_1", organization: "Agent Guild", title: "Senior Judge", expertiseJson: json(["Agent UX", "Evaluation"]), reviewBio: "Reviews agent products with emphasis on evidence and reproducibility.", conflictConfirmedAt: new Date(), completedAt: new Date() },
    { id: "judge_profile_multi", userId: "user_multi_1", organization: "ARY Community", title: "Community Judge", expertiseJson: json(["AI", "Events"]), reviewBio: "Community reviewer with experience organizing and judging agent races.", conflictConfirmedAt: new Date(), completedAt: new Date() }
  ] });
  await prisma.organizerProfile.createMany({ data: [
    { id: "organizer_profile_org", userId: "user_org_1", organizationName: "ARY", position: "Race Director", eventCategoriesJson: json(["Agent Race"]), organizerBio: "Organizes ARY races and manages live event operations.", completedAt: new Date() },
    { id: "organizer_profile_org_alt", userId: "user_org_2", organizationName: "Northstar Labs", position: "Program Lead", eventCategoriesJson: json(["Applied AI"]), organizerBio: "Runs an independent applied-agent race portfolio.", completedAt: new Date() },
    { id: "organizer_profile_multi", userId: "user_multi_1", organizationName: "ARY Community", position: "Organizer", eventCategoriesJson: json(["Community"]), organizerBio: "Organizes community agent events and also participates in other races.", completedAt: new Date() }
  ] });

  await prisma.race.createMany({
    data: [
      {
        id: "race_bay_2026",
        slug: "bay-area-happy-trip",
        title: "湾区开心游",
        status: "running",
        visibility: "public",
        challenge: "构建大湾区旅行、游玩伴随 Agent，让路线、预算、天气和本地灵感成为可展示的赛场作品。",
        summary: "构建大湾区旅行、游玩伴随 Agent，像你身边手头的旅行达人和本地精英，让用户无所不知、玩得尽兴。",
        taskId: "DEV-12",
        organizerJson: json(["user_org_1", "user_multi_1"]),
        scheduleJson: json({ registration: "已结束", race: "进行中", submission: "开放中", judging: "排队中", results: "未发布" }),
        rulesJson: json({ allowCAConnectionUntil: "judging", maxMainWorksPerRegistration: 1, caFailureBlocksSubmission: false }),
        metricsJson: json({ riders: 36, activeRiders: 27, sessions: 188, submittedWorks: 14, totalCost: "$512.70", riskSignals: 5 }),
        submissionOpensAt: new Date("2020-01-01T00:00:00Z"),
        submissionClosesAt: new Date("2099-01-01T00:00:00Z"),
        createdByUserId: "user_org_1"
      },
      {
        id: "race_finance_2026",
        slug: "smart-investment-analyst",
        title: "智能投研助理",
        status: "running",
        visibility: "public",
        challenge: "构建能帮助用户理解金融材料、整理风险点和形成学习笔记的投研辅助 Agent。",
        summary: "面向个人投资学习者的资料整理、术语解释、公司信息摘要和风险提示 Agent。",
        taskId: "DEV-13",
        organizerJson: json(["user_org_2"]),
        scheduleJson: json({ registration: "已结束", race: "进行中", submission: "开放中", judging: "排队中", results: "未发布" }),
        rulesJson: json({ safetyBoundary: "no investment advice" }),
        metricsJson: json({ riders: 28, activeRiders: 21, sessions: 164, submittedWorks: 9, totalCost: "$438.20", riskSignals: 8 }),
        submissionOpensAt: new Date("2020-01-01T00:00:00Z"),
        submissionClosesAt: new Date("2099-01-01T00:00:00Z"),
        createdByUserId: "user_org_2"
      },
      ...(includeE2EFixtures ? [{
        id: "race_submission_e2e",
        slug: "submission-integrity-e2e",
        title: "作品完整性 E2E",
        status: "running",
        visibility: "review",
        challenge: "验证不可变提交版本与全场冻结。",
        summary: "仅供浏览器自动化使用的隔离赛事。",
        taskId: "SEC-WORK-E2E",
        organizerJson: json(["user_org_1"]),
        scheduleJson: json({ registration: "已结束", race: "进行中", submission: "开放中", judging: "未开始", results: "未发布" }),
        rulesJson: json({ maxMainWorksPerRegistration: 1 }),
        metricsJson: json({ riders: 1, submittedWorks: 0 }),
        submissionOpensAt: new Date("2020-01-01T00:00:00Z"),
        submissionClosesAt: new Date("2099-01-01T00:00:00Z"),
        createdByUserId: "user_org_1"
      }] : []),
      {
        id: "race_genesis_2026",
        slug: "genesis-dogfood-race",
        title: "创世骑行挑战赛",
        status: "completed",
        visibility: "public",
        challenge: "用 Agent 协作开发 ARY 自身，让平台从第一场 self-dogfood Race 中诞生。",
        summary: "参赛者骑行 Coding Agent 打造 ARY 的第一场创世赛。",
        taskId: "DEV-1",
        organizerJson: json(["user_org_1"]),
        scheduleJson: json({ registration: "已结束", race: "已完成", submission: "已锁定", judging: "已完成", results: "已发布" }),
        rulesJson: json({ archive: true }),
        metricsJson: json({ riders: 18, submittedWorks: 12, reports: 18, evidenceRefs: 164 }),
        submissionOpensAt: new Date("2026-06-01T00:00:00Z"),
        submissionClosesAt: new Date("2026-06-02T00:00:00Z"),
        createdByUserId: "user_org_1"
      }
    ]
  });

  await prisma.trackProfile.createMany({
    data: [
      { id: "track-metro", trackId: "metro-raceway", name: "Metro Raceway", scope: "system" },
      { id: "track-coastal", trackId: "coastal-circuit", name: "Coastal Circuit", scope: "system" }
    ]
  });

  await prisma.trackProfileVersion.createMany({
    data: [
      {
        id: "track-version-metro-1",
        trackId: "metro-raceway",
        version: "1.0.0",
        status: "published",
        schemaVersion: "1.0.0",
        profileJson: metroProfileJson,
        checksum: "sha256:cb52f18fc1084be220db74372346d8b625630d040e3af34581f46a18f8d74047",
        backgroundAssetRef: "/tracks/metro-raceway/1.0.0/background.webp",
        publishedAt: new Date("2026-06-11T06:00:00.000Z")
      },
      {
        id: "track-version-coastal-1",
        trackId: "coastal-circuit",
        version: "1.0.0",
        status: "published",
        schemaVersion: "1.0.0",
        profileJson: coastalProfileJson,
        checksum: "sha256:5aa1d339b00947446a31a123f972687a089208764f1da8b1d9c0d5bd826ec7aa",
        backgroundAssetRef: "/tracks/coastal-circuit/1.0.0/background.webp",
        publishedAt: new Date("2026-06-12T06:00:00.000Z")
      }
    ]
  });

  await prisma.registration.createMany({
    data: [
      { id: "reg_mira", raceId: "race_bay_2026", userId: "user_rider_1", status: "approved", submittedAt: new Date("2026-06-18T09:00:00Z"), approvedAt: new Date("2026-06-18T09:20:00Z") },
      { id: "reg_ana", raceId: "race_bay_2026", userId: "user_rider_2", status: "approved", submittedAt: new Date("2026-06-18T09:12:00Z"), approvedAt: new Date("2026-06-18T09:24:00Z") },
      { id: "reg_finance_ana", raceId: "race_finance_2026", userId: "user_rider_2", status: "approved", submittedAt: new Date("2026-06-10T09:12:00Z"), approvedAt: new Date("2026-06-10T09:24:00Z") },
      ...(includeE2EFixtures ? [{ id: "reg_rider_e2e", raceId: "race_submission_e2e", userId: "user_rider_e2e", status: "approved", submittedAt: new Date("2026-06-18T09:14:00Z"), approvedAt: new Date("2026-06-18T09:26:00Z") }] : []),
      { id: "reg_genesis_mira", raceId: "race_genesis_2026", userId: "user_rider_1", status: "approved", submittedAt: new Date("2026-06-01T09:00:00Z"), approvedAt: new Date("2026-06-01T09:20:00Z") }
    ]
  });

  await prisma.raceProject.createMany({
    data: [
      { id: "rp_mira", registrationId: "reg_mira", repoUrl: "mock://repo/gba-wandermate", aggregateIngestionStatus: "active", connectionHealth: "ok", metricsJson: json({ progressPercent: 92, tokens: 12000, messageCount: 80, toolCallCount: 20 }) },
      { id: "rp_ana", registrationId: "reg_ana", repoUrl: "mock://repo/localjoy-agent", aggregateIngestionStatus: "connected", connectionHealth: "partial_failed", metricsJson: json({ progressPercent: 84, tokens: 9400, messageCount: 64, toolCallCount: 17 }) },
      ...(includeE2EFixtures ? [{ id: "rp_rider_e2e", registrationId: "reg_rider_e2e", repoUrl: "mock://repo/e2e-rider", aggregateIngestionStatus: "connected", connectionHealth: "ok", metricsJson: json({ progressPercent: 0, tokens: 0, messageCount: 0, toolCallCount: 0 }) }] : [])
    ]
  });

  await prisma.raceRound.create({
    data: {
      id: "round_bay_1",
      raceId: "race_bay_2026",
      trackProfileVersionId: "track-version-metro-1",
      name: "Round 1",
      order: 1,
      status: "running",
      scheduledStartAt: new Date("2026-07-14T10:00:00.000Z"),
      scheduledEndAt: new Date("2026-07-14T14:00:00.000Z"),
      actualStartedAt: new Date("2026-07-14T10:00:00.000Z")
    }
  });
  await prisma.raceRoundEntry.createMany({
    data: [
      { id: "round-entry-mira", raceRoundId: "round_bay_1", registrationId: "reg_mira", displayOrder: 1, status: "active" },
      { id: "round-entry-ana", raceRoundId: "round_bay_1", registrationId: "reg_ana", displayOrder: 2, status: "active" }
    ]
  });

  await prisma.cAConnection.createMany({
    data: [
      { id: "conn_mira_codex", raceProjectId: "rp_mira", ownerUserId: "user_rider_1", caType: "codex", connectorId: "codex-demo", connectorVersion: "0.1.0", signingKeyId: "local-key-codex-demo", externalProjectRef: "gba-wander", ingestionStatus: "active", registeredAt: new Date(), handshakeAt: new Date(), lastSyncedAt: new Date() },
      { id: "conn_ana_codex", raceProjectId: "rp_ana", ownerUserId: "user_rider_2", caType: "codex", connectorId: "codex-demo", connectorVersion: "0.1.0", signingKeyId: "local-key-codex-demo", externalProjectRef: "localjoy", ingestionStatus: "connected", registeredAt: new Date(), handshakeAt: new Date() },
      ...(includeE2EFixtures ? [{ id: "conn_rider_e2e", raceProjectId: "rp_rider_e2e", ownerUserId: "user_rider_e2e", caType: "codex", connectorId: "e2e-connector", connectorVersion: "0.1.0", signingKeyId: "local-key-e2e-connector", externalProjectRef: "e2e-rider", ingestionStatus: "connected", registeredAt: new Date(), handshakeAt: new Date() }] : [])
    ]
  });

  await prisma.work.createMany({
    data: [
      {
        id: "work-gba-wander",
        registrationId: "reg_mira",
        slug: "work-gba-wander",
        title: "GBA WanderMate",
        summary: "三条湾区路线已经上墙：早茶、海岸、夜景，预算和交通都标清。",
        status: "published",
        visibility: "public",
        demoUrl: "mock://demo/gba-wandermate",
        repoUrl: "mock://repo/gba-wandermate",
        submittedAt: new Date(),
        publishedAt: new Date()
      },
      {
        id: "work-localjoy",
        registrationId: "reg_ana",
        slug: "work-localjoy",
        title: "LocalJoy Agent",
        summary: "周末短途游作品，节奏轻快，适合第一次来湾区的朋友。",
        status: "submitted",
        visibility: "review",
        demoUrl: "mock://demo/localjoy-agent",
        repoUrl: "mock://repo/localjoy-agent",
        submittedAt: new Date()
      },
      {
        id: "work-genesis-mira",
        registrationId: "reg_genesis_mira",
        slug: "ary-self-dogfood-agent",
        title: "ARY Self Dogfood Agent",
        summary: "第一场创世赛中沉淀出的平台自举作品。",
        status: "published",
        visibility: "public",
        demoUrl: "mock://demo/ary-self-dogfood",
        repoUrl: "mock://repo/ary-self-dogfood",
        submittedAt: new Date("2026-06-02T10:00:00Z"),
        publishedAt: new Date("2026-06-03T10:00:00Z")
      },
      {
        id: "work-finance-legacy",
        registrationId: "reg_finance_ana",
        slug: "finance-legacy-work",
        title: "Legacy Finance Notes",
        summary: "迁移前提交、尚未形成不可变版本的兼容样例。",
        status: "published",
        visibility: "public",
        demoUrl: "mock://demo/finance-legacy",
        repoUrl: "mock://repo/finance-legacy",
        submittedAt: new Date("2026-06-10T10:00:00Z"),
        publishedAt: new Date("2026-06-11T10:00:00Z")
      }
    ]
  });

  const seededVersions = [
    {
      id: "work-version-gba-1",
      workId: "work-gba-wander",
      registrationId: "reg_mira",
      versionNumber: 1,
      title: "GBA WanderMate",
      summary: "三条湾区路线已经上墙：早茶、海岸、夜景，预算和交通都标清。",
      demoUrl: "mock://demo/gba-wandermate",
      repoUrl: "mock://repo/gba-wandermate",
      repoCommitSha: "1".repeat(40),
      submittedByUserId: "user_rider_1",
      submittedAt: new Date("2026-06-18T10:00:00Z")
    },
    {
      id: "work-version-localjoy-1",
      workId: "work-localjoy",
      registrationId: "reg_ana",
      versionNumber: 1,
      title: "LocalJoy Agent",
      summary: "周末短途游作品，节奏轻快，适合第一次来湾区的朋友。",
      demoUrl: "mock://demo/localjoy-agent",
      repoUrl: "mock://repo/localjoy-agent",
      repoCommitSha: "3".repeat(40),
      submittedByUserId: "user_rider_2",
      submittedAt: new Date("2026-06-18T10:10:00Z")
    },
    {
      id: "work-version-genesis-1",
      workId: "work-genesis-mira",
      registrationId: "reg_genesis_mira",
      versionNumber: 1,
      title: "ARY Self Dogfood Agent",
      summary: "第一场创世赛中沉淀出的平台自举作品。",
      demoUrl: "mock://demo/ary-self-dogfood",
      repoUrl: "mock://repo/ary-self-dogfood",
      repoCommitSha: "2".repeat(40),
      submittedByUserId: "user_rider_1",
      submittedAt: new Date("2026-06-02T10:00:00Z")
    }
  ];
  for (const version of seededVersions) {
    await prisma.workSubmissionVersion.create({
      data: {
        id: version.id,
        workId: version.workId,
        versionNumber: version.versionNumber,
        title: version.title,
        summary: version.summary,
        demoUrl: version.demoUrl,
        repoUrl: version.repoUrl,
        repoCommitSha: version.repoCommitSha,
        hashSchemaVersion: WORK_SUBMISSION_HASH_SCHEMA,
        integrityHash: createWorkSubmissionIntegrityHash(version),
        submittedByUserId: version.submittedByUserId,
        submittedAt: version.submittedAt
      }
    });
    await prisma.work.update({
      where: { id: version.workId },
      data: { currentVersionId: version.id, versionCounter: version.versionNumber }
    });
  }

  await prisma.evidence.createMany({
    data: [
      { id: "ev-bay-001", raceId: "race_bay_2026", registrationId: "reg_mira", workId: "work-gba-wander", type: "session_summary", title: "路线偏好建模", summary: "偏好建模到路线验证已形成公开摘要。", sourceRefJson: json({ session: "session-a" }), visibility: "public" },
      { id: "ev-bay-003", raceId: "race_bay_2026", registrationId: "reg_ana", workId: "work-localjoy", type: "session_summary", title: "LocalJoy 评审摘要", summary: "轻量周末短途游方案进入评审。", sourceRefJson: json({ session: "session-b" }), visibility: "public" }
    ]
  });

  await prisma.reviewFlag.createMany({
    data: [
      {
        id: "flag_ana_cost",
        raceId: "race_bay_2026",
        registrationId: "reg_ana",
        raceProjectId: "rp_ana",
        workId: "work-localjoy",
        type: "cost_watch",
        severity: "warning",
        status: "in_review",
        judgeVisibleSummary: "进入成本观察，作品材料仍可提交。",
        resolutionNote: "Organizer 已要求 Rider 在评审前补充成本解释和纠偏说明。",
        resolvedByUserId: "user_org_1",
        sourceRefJson: json({ scope: "race_project", id: "rp_ana" })
      },
      {
        id: "flag_ana_missing",
        raceId: "race_bay_2026",
        registrationId: "reg_ana",
        raceProjectId: "rp_ana",
        workId: "work-localjoy",
        type: "missing_required_material",
        severity: "warning",
        status: "open",
        judgeVisibleSummary: "作品缺少可公开 Demo 说明，评审前需补齐关键材料。",
        sourceRefJson: json({ scope: "work", id: "work-localjoy", missing: ["demo"] })
      },
      {
        id: "flag_mira_resolved",
        raceId: "race_bay_2026",
        registrationId: "reg_mira",
        raceProjectId: "rp_mira",
        workId: "work-gba-wander",
        type: "empty_riding",
        severity: "info",
        status: "resolved",
        judgeVisibleSummary: "早期骑行摘要为空，后续已补入有效 CA Signal。",
        resolutionNote: "Mira 已补充有效骑行会话，当前证据链完整。",
        resolvedByUserId: "user_org_1",
        resolvedAt: new Date(),
        sourceRefJson: json({ scope: "race_project", id: "rp_mira" })
      }
    ]
  });

  await prisma.raceJudgeMembership.createMany({
    data: ["user_org_1", "user_judge_1", "user_multi_1"].map((judgeUserId, index) => ({
      id: `judge_pool_bay_${index + 1}`, raceId: "race_bay_2026", judgeUserId,
      selectedByUserId: "user_org_1", status: "active", selectedAt: new Date("2026-06-18T11:00:00Z")
    }))
  });
  await prisma.judgeAllocationBatch.create({
    data: {
      id: "judge_batch_bay_seed", raceId: "race_bay_2026", createdByUserId: "user_org_1",
      seed: "seed-bay-2026", algorithmVersion: "balanced-random-v1", workCount: 2,
      retainedCount: 0, createdCount: 6, createdAt: new Date("2026-06-18T11:05:00Z")
    }
  });
  await prisma.judgeAssignment.createMany({
    data: ["work-gba-wander", "work-localjoy"].flatMap((workId) => {
      const workSubmissionVersionId = workId === "work-gba-wander" ? "work-version-gba-1" : "work-version-localjoy-1";
      return ["user_org_1", "user_judge_1", "user_multi_1"].map((judgeUserId, index) => ({
        id: `assign_${workId}_${index + 1}`, raceId: "race_bay_2026", workId, workSubmissionVersionId,
        judgeUserId, assignedByUserId: "user_org_1", status: "assigned", slot: index + 1,
        allocationBatchId: "judge_batch_bay_seed", assignedAt: new Date("2026-06-18T11:05:00Z")
      }));
    })
  });

  await prisma.report.createMany({
    data: [
      { id: "report_genesis_race", raceId: "race_genesis_2026", type: "race_report", status: "published", visibility: "public", content: "创世骑行挑战赛从混乱起跑到作品冲线。", generatedAt: new Date(), publishedAt: new Date() },
      { id: "report_genesis_review", raceId: "race_genesis_2026", type: "review_summary", status: "published", visibility: "public", content: "评审总结已发布，包含高光案例和评委摘录。", generatedAt: new Date(), publishedAt: new Date() }
    ]
  });

  await prisma.award.create({
    data: { id: "award-genesis-001", raceId: "race_genesis_2026", registrationId: "reg_genesis_mira", workId: "work-genesis-mira", workSubmissionVersionId: "work-version-genesis-1", awardName: "最佳自举作品", rank: 1, decisionReason: "第一场创世赛跑出了平台自己的起点。", status: "published", publishedAt: new Date() }
  });

  await prisma.projection.createMany({
    data: [
      {
        id: "projection_bay_stable",
        raceId: "race_bay_2026",
        type: "race_progress",
        status: "stable",
        stableVersionId: "projection_bay_stable",
        lastRebuiltAt: new Date(),
        payloadJson: json({
          headlineMetrics: { ridingSignal: 82, activeRiders: 27, sessions: 188, submittedWorks: 14, totalCost: "$512.70", riskSignals: 5 },
          processLeaderboard: [
            { rank: 1, name: "Mira Chen", score: 94.8, label: "route reasoning" },
            { rank: 2, name: "Ana Ruiz", score: 91.2, label: "recovery loop" }
          ],
          eventStream: [
            { time: "10:42", text: "Mira 完成偏好建模和路线生成 checkpoint。" },
            { time: "11:28", text: "LocalJoy Agent 提交第一版 Demo。" }
          ]
        })
      }
    ]
  });

  const raceLiveEntries = [
    { entryId: "round-entry-mira", registrationId: "reg_mira", raceProjectId: "rp_mira", participantType: "individual", entrantDisplayName: "Mira Chen", participantCount: 1, onlineParticipantCount: 0, rank: 1, roundProgress: 0.92, overallProgress: 0.92, reachedProgressAt: "2026-07-14T12:00:00.000Z", raceStatus: "running", dataStatus: "fresh", riskLevel: "none", agentProviders: ["codex"], costTokens: 12000, updatedAt: "2026-07-14T12:00:00.000Z" },
    { entryId: "round-entry-ana", registrationId: "reg_ana", raceProjectId: "rp_ana", participantType: "individual", entrantDisplayName: "Ana Ruiz", participantCount: 1, onlineParticipantCount: 0, rank: 2, roundProgress: 0.84, overallProgress: 0.84, reachedProgressAt: "2026-07-14T12:00:00.000Z", raceStatus: "running", dataStatus: "fresh", riskLevel: "medium", agentProviders: ["claude"], costTokens: 9400, updatedAt: "2026-07-14T12:00:00.000Z" }
  ];
  const raceLiveSnapshot = {
    schemaVersion: "ary.race-live.v1", raceId: "race_bay_2026", roundId: "round_bay_1", sequence: 1, generatedAt: "2026-07-14T12:00:00.000Z",
    race: { raceId: "race_bay_2026", title: "湾区开心游", organizerDisplayName: "Lin Organizer", status: "live", trackProfileId: "metro-raceway", trackProfileVersion: "1.0.0" },
    round: { roundId: "round_bay_1", name: "Round 1", order: 1, status: "running", scheduledStartAt: "2026-07-14T10:00:00.000Z", scheduledEndAt: "2026-07-14T14:00:00.000Z", actualStartedAt: "2026-07-14T10:00:00.000Z" },
    runtimeConfig: { staleThresholdSeconds: 60, participantOnlineWindowSeconds: 120, bubbleDurationSeconds: 8, maxVisibleBubbles: 3, maxEntriesPerGroup: 8 },
    kpi: { raceRoundProgress: 0.88, totalParticipants: 2, onlineParticipants: 0, activeEntries: 2, totalTokens: 21400 }, totalEntryCount: 2, entries: raceLiveEntries,
    displayGroups: [{ groupId: "round_bay_1:group:1", order: 1, entryIds: raceLiveEntries.map((entry) => entry.entryId) }],
    globalRanking: raceLiveEntries.map((entry) => ({ entryId: entry.entryId, rank: entry.rank, entrantDisplayName: entry.entrantDisplayName, roundProgress: entry.roundProgress })), ridingMessages: [], attentionItems: []
  };
  await prisma.projection.create({
    data: { id: "projection_bay_race_live_1", raceId: "race_bay_2026", type: "ary_race_live", status: "stable", payloadJson: json(raceLiveSnapshot), stableVersionId: "projection_bay_race_live_1", lastRebuiltAt: new Date(raceLiveSnapshot.generatedAt), schemaVersion: raceLiveSnapshot.schemaVersion, sequence: 1, generatedAt: new Date(raceLiveSnapshot.generatedAt), sourceWatermark: "round_bay_1:seed", payloadHash: createHash("sha256").update(json(raceLiveSnapshot)).digest("hex") }
  });

  await prisma.announcement.create({
    data: { id: "ann_seed", raceId: "race_bay_2026", title: "Registration desk open", body: "Organizer desk is validating rider profiles and CA connectors.", visibility: "public", publishedAt: new Date() }
  });


  await prisma.screenState.create({
    data: { id: "screen_bay", raceId: "race_bay_2026", mode: "live", fallbackEnabled: false, currentRoundId: "round_bay_1", stableProjectionId: "projection_bay_race_live_1" }
  });
  for (const item of [
    ["p0_regression", "P0回归一键跑通"],
    ["staging_rehearsal", "staging全流程彩排"],
    ["screen_rehearsal", "Live Hall和大屏彩排"],
    ["rollback_ready", "回滚版本和备份确认"],
    ["go_no_go", "go/no-go证据确认"]
  ]) {
    await prisma.releaseChecklistItem.create({
      data: { id: `check_${item[0]}`, raceId: "race_bay_2026", itemKey: item[0], label: item[1], status: "open", evidence: "" }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
