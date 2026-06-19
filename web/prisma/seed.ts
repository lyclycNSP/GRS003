import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function json(value: unknown) {
  return JSON.stringify(value);
}

async function main() {
  await prisma.releaseChecklistItem.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.backup.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.projection.deleteMany();
  await prisma.report.deleteMany();
  await prisma.award.deleteMany();
  await prisma.judgingRecord.deleteMany();
  await prisma.judgeAssignment.deleteMany();
  await prisma.reviewFlag.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.work.deleteMany();
  await prisma.session.deleteMany();
  await prisma.cAConnection.deleteMany();
  await prisma.raceProject.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.race.deleteMany();
  await prisma.authAccount.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      {
        id: "user_org_1",
        slug: "ary-ops",
        displayName: "Lin Organizer",
        githubLogin: "ary-ops",
        profileCompleted: true,
        rolesJson: json(["organizer", "admin", "judge", "rider"]),
        city: "San Francisco"
      },
      {
        id: "user_rider_1",
        slug: "mira-chen",
        displayName: "Mira Chen",
        githubLogin: "mira-ca",
        profileCompleted: true,
        rolesJson: json(["rider"]),
        city: "Oakland"
      },
      {
        id: "user_rider_2",
        slug: "ana-ruiz",
        displayName: "Ana Ruiz",
        githubLogin: "ana-route",
        profileCompleted: true,
        rolesJson: json(["rider"]),
        city: "Shenzhen"
      },
      {
        id: "user_judge_1",
        slug: "ava-judge",
        displayName: "Ava Judge",
        githubLogin: "judge-ava",
        profileCompleted: true,
        rolesJson: json(["judge"]),
        city: "Seattle"
      }
    ]
  });

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
        organizerJson: json(["user_org_1"]),
        scheduleJson: json({ registration: "已结束", race: "进行中", submission: "开放中", judging: "排队中", results: "未发布" }),
        rulesJson: json({ allowCAConnectionUntil: "judging", maxMainWorksPerRegistration: 1, caFailureBlocksSubmission: false }),
        metricsJson: json({ riders: 36, activeRiders: 27, sessions: 188, submittedWorks: 14, totalCost: "$512.70", riskSignals: 5 }),
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
        organizerJson: json(["user_org_1"]),
        scheduleJson: json({ registration: "已结束", race: "进行中", submission: "开放中", judging: "排队中", results: "未发布" }),
        rulesJson: json({ safetyBoundary: "no investment advice" }),
        metricsJson: json({ riders: 28, activeRiders: 21, sessions: 164, submittedWorks: 9, totalCost: "$438.20", riskSignals: 8 }),
        createdByUserId: "user_org_1"
      },
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
        createdByUserId: "user_org_1"
      }
    ]
  });

  await prisma.registration.createMany({
    data: [
      { id: "reg_mira", raceId: "race_bay_2026", userId: "user_rider_1", status: "approved", submittedAt: new Date("2026-06-18T09:00:00Z"), approvedAt: new Date("2026-06-18T09:20:00Z") },
      { id: "reg_ana", raceId: "race_bay_2026", userId: "user_rider_2", status: "approved", submittedAt: new Date("2026-06-18T09:12:00Z"), approvedAt: new Date("2026-06-18T09:24:00Z") }
    ]
  });

  await prisma.raceProject.createMany({
    data: [
      { id: "rp_mira", registrationId: "reg_mira", repoUrl: "mock://repo/gba-wandermate", aggregateIngestionStatus: "active", connectionHealth: "ok", metricsJson: json({ progressPercent: 92, tokens: 12000, messageCount: 80, toolCallCount: 20 }) },
      { id: "rp_ana", registrationId: "reg_ana", repoUrl: "mock://repo/localjoy-agent", aggregateIngestionStatus: "connected", connectionHealth: "partial_failed", metricsJson: json({ progressPercent: 84, tokens: 9400, messageCount: 64, toolCallCount: 17 }) }
    ]
  });

  await prisma.cAConnection.createMany({
    data: [
      { id: "conn_mira_codex", raceProjectId: "rp_mira", caType: "codex", connectorId: "codex-demo", connectorVersion: "0.1.0", externalProjectRef: "gba-wander", ingestionStatus: "active", registeredAt: new Date(), handshakeAt: new Date(), lastSyncedAt: new Date() },
      { id: "conn_ana_codex", raceProjectId: "rp_ana", caType: "codex", connectorId: "codex-demo", connectorVersion: "0.1.0", externalProjectRef: "localjoy", ingestionStatus: "connected", registeredAt: new Date(), handshakeAt: new Date() }
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
      }
    ]
  });

  await prisma.evidence.createMany({
    data: [
      { id: "ev-bay-001", raceId: "race_bay_2026", registrationId: "reg_mira", workId: "work-gba-wander", type: "session_summary", title: "路线偏好建模", summary: "偏好建模到路线验证已形成公开摘要。", sourceRefJson: json({ session: "session-a" }), visibility: "public" },
      { id: "ev-bay-003", raceId: "race_bay_2026", registrationId: "reg_ana", workId: "work-localjoy", type: "session_summary", title: "LocalJoy 评审摘要", summary: "轻量周末短途游方案进入评审。", sourceRefJson: json({ session: "session-b" }), visibility: "public" }
    ]
  });

  await prisma.reviewFlag.createMany({
    data: [
      { id: "flag_ana_cost", raceId: "race_bay_2026", registrationId: "reg_ana", raceProjectId: "rp_ana", workId: "work-localjoy", type: "cost_watch", severity: "warning", status: "open", judgeVisibleSummary: "进入成本观察，作品材料仍可提交。", sourceRefJson: json({ scope: "race_project", id: "rp_ana" }) },
      { id: "flag_ana_summary", raceId: "race_bay_2026", registrationId: "reg_ana", raceProjectId: "rp_ana", workId: "work-localjoy", type: "evidence_summary_ready", severity: "info", status: "open", judgeVisibleSummary: "本地摘要已生成：偏好建模 → 路线验证。", sourceRefJson: json({ scope: "work", id: "work-localjoy" }) }
    ]
  });

  await prisma.judgeAssignment.create({
    data: { id: "assign_localjoy_ava", raceId: "race_bay_2026", workId: "work-localjoy", judgeUserId: "user_judge_1", assignedByUserId: "user_org_1", status: "assigned", assignedAt: new Date() }
  });

  await prisma.report.createMany({
    data: [
      { id: "report_genesis_race", raceId: "race_genesis_2026", type: "race_report", status: "published", visibility: "public", content: "创世骑行挑战赛从混乱起跑到作品冲线。", generatedAt: new Date(), publishedAt: new Date() },
      { id: "report_genesis_review", raceId: "race_genesis_2026", type: "review_summary", status: "published", visibility: "public", content: "评审总结已发布，包含高光案例和评委摘录。", generatedAt: new Date(), publishedAt: new Date() }
    ]
  });

  await prisma.award.create({
    data: { id: "award-genesis-001", raceId: "race_genesis_2026", registrationId: "reg_mira", workId: "work-gba-wander", awardName: "最佳自举作品", rank: 1, decisionReason: "第一场创世赛跑出了平台自己的起点。", status: "published", publishedAt: new Date() }
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

  await prisma.announcement.create({
    data: { id: "ann_seed", raceId: "race_bay_2026", title: "Registration desk open", body: "Organizer desk is validating rider profiles and CA connectors.", visibility: "public", publishedAt: new Date() }
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
