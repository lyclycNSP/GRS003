(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ARYDomain = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ROLES = ["rider", "judge", "organizer", "admin"];
  const SCREEN_MODES = ["live", "leaderboard", "works", "announcement", "fallback"];
  const INGESTION_STATUSES = ["not_configured", "connected", "active", "failed"];

  function now() {
    return new Date().toISOString();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createInitialState() {
    return {
      meta: {
        version: "ary-local-mvp-v0.1",
        sequence: 100,
        currentUserId: "user_org_1",
        currentRole: "organizer",
        selectedRaceId: "race_bay_2026",
        lastSavedAt: null,
      },
      users: [
        {
          id: "user_org_1",
          githubLogin: "ary-ops",
          displayName: "Lin Organizer",
          profileCompleted: true,
          roles: ["organizer", "admin", "judge", "rider"],
          city: "San Francisco",
        },
        {
          id: "user_rider_1",
          githubLogin: "mira-ca",
          displayName: "Mira Chen",
          profileCompleted: true,
          roles: ["rider"],
          city: "Oakland",
        },
        {
          id: "user_rider_2",
          githubLogin: "noah-build",
          displayName: "Noah Park",
          profileCompleted: true,
          roles: ["rider"],
          city: "San Jose",
        },
        {
          id: "user_judge_1",
          githubLogin: "judge-ava",
          displayName: "Ava Judge",
          profileCompleted: true,
          roles: ["judge"],
          city: "Seattle",
        },
        {
          id: "user_admin_1",
          githubLogin: "system-admin",
          displayName: "System Admin",
          profileCompleted: true,
          roles: ["admin"],
          city: "Remote",
        },
      ],
      races: [
        {
          id: "race_bay_2026",
          slug: "bay-agent-relay-2026",
          title: "Bay Agent Relay 2026",
          status: "draft",
          visibility: "private",
          challenge: "Build an agentic route planner that adapts to live constraints.",
          taskId: "DEV-12",
          createdByUserId: "user_org_1",
          organizerUserIds: ["user_org_1"],
          schedule: {
            registrationClose: "2026-06-21T16:00:00-07:00",
            raceStart: "2026-06-22T09:00:00-07:00",
            submissionClose: "2026-06-22T18:00:00-07:00",
            judgingClose: "2026-06-23T12:00:00-07:00",
          },
          rules: {
            allowCAConnectionUntil: "judging",
            maxMainWorksPerRegistration: 1,
            caFailureBlocksSubmission: false,
          },
          createdAt: "2026-06-18T08:00:00Z",
        },
      ],
      registrations: [
        {
          id: "reg_mira",
          raceId: "race_bay_2026",
          userId: "user_rider_1",
          status: "pending",
          submittedAt: "2026-06-18T09:00:00Z",
          approvedAt: null,
        },
        {
          id: "reg_noah",
          raceId: "race_bay_2026",
          userId: "user_rider_2",
          status: "approved",
          submittedAt: "2026-06-18T09:12:00Z",
          approvedAt: "2026-06-18T09:20:00Z",
        },
      ],
      raceProjects: [
        {
          id: "rp_noah",
          registrationId: "reg_noah",
          repoUrl: "https://github.com/example/noah-route-agent",
          aggregateIngestionStatus: "not_configured",
          connectionHealth: "no_signal",
          metrics: {
            progressPercent: 0,
            tokens: 0,
            messageCount: 0,
            toolCallCount: 0,
          },
          createdAt: "2026-06-18T09:20:01Z",
          lastSyncedAt: null,
        },
      ],
      caConnections: [],
      sessions: [],
      works: [],
      evidences: [],
      reviewFlags: [
        {
          id: "flag_noah_no_ca",
          raceId: "race_bay_2026",
          registrationId: "reg_noah",
          raceProjectId: "rp_noah",
          workId: null,
          type: "no_ca_data",
          severity: "medium",
          status: "open",
          judgeVisibleSummary: "尚无有效CA数据，评审前需确认证据缺口。",
          sourceRef: { scope: "race_project", id: "rp_noah" },
          createdAt: "2026-06-18T09:21:00Z",
          resolvedAt: null,
        },
      ],
      judgeAssignments: [],
      judgingRecords: [],
      awards: [],
      reports: [],
      projections: [
        {
          id: "projection_seed",
          raceId: "race_bay_2026",
          type: "race_progress",
          status: "stable",
          payload: {
            rebuiltAt: "2026-06-18T09:30:00Z",
            totals: { registrations: 2, approved: 1, submittedWorks: 0, activeProjects: 0 },
            entries: [],
            eventStream: ["赛事草稿已建立", "Noah报名已审核"],
          },
          stableVersionId: "projection_seed",
          lastRebuiltAt: "2026-06-18T09:30:00Z",
        },
      ],
      announcements: [
        {
          id: "ann_seed",
          raceId: "race_bay_2026",
          title: "Registration desk open",
          body: "Organizer desk is validating rider profiles and CA connectors.",
          visibility: "public",
          publishedAt: "2026-06-18T09:00:00Z",
        },
      ],
      screenDisplays: {
        race_bay_2026: {
          mode: "live",
          fallback: "stable_projection",
          updatedAt: "2026-06-18T09:30:00Z",
        },
      },
      releaseChecklist: [
        {
          id: "p0_regression",
          label: "P0回归一键跑通",
          status: "open",
          evidence: "",
        },
        {
          id: "staging_rehearsal",
          label: "staging全流程彩排",
          status: "open",
          evidence: "",
        },
        {
          id: "screen_rehearsal",
          label: "Live Hall和大屏彩排",
          status: "open",
          evidence: "",
        },
        {
          id: "rollback_ready",
          label: "回滚版本和备份确认",
          status: "open",
          evidence: "",
        },
        {
          id: "go_no_go",
          label: "go/no-go证据确认",
          status: "open",
          evidence: "",
        },
      ],
      incidents: [],
      backups: [],
      quarantinedSignals: [],
      ingestionKeys: [],
      auditLog: [
        {
          id: "audit_seed",
          at: "2026-06-18T09:30:00Z",
          actorId: "user_org_1",
          type: "seed_created",
          message: "MVP seed data loaded.",
        },
      ],
    };
  }

  function nextId(state, prefix) {
    state.meta.sequence += 1;
    return `${prefix}_${String(state.meta.sequence).padStart(4, "0")}`;
  }

  function ok(message, data) {
    return Object.assign({ ok: true, message }, data || {});
  }

  function fail(message, data) {
    return Object.assign({ ok: false, message }, data || {});
  }

  function findById(list, id) {
    return list.find((item) => item.id === id);
  }

  function currentUser(state) {
    return findById(state.users, state.meta.currentUserId);
  }

  function roleLabel(role) {
    return role || "public";
  }

  function hasRole(state, actorId, role) {
    const user = findById(state.users, actorId);
    return Boolean(user && user.roles.includes(role));
  }

  function canManageRace(state, raceId, actorId) {
    if (hasRole(state, actorId, "admin")) return true;
    if (!hasRole(state, actorId, "organizer")) return false;
    const race = findById(state.races, raceId);
    return Boolean(race && race.organizerUserIds.includes(actorId));
  }

  function getRaceForRegistration(state, registration) {
    return registration ? findById(state.races, registration.raceId) : null;
  }

  function getRegistrationForUserRace(state, userId, raceId) {
    return state.registrations.find((registration) => {
      return registration.userId === userId && registration.raceId === raceId;
    });
  }

  function getRaceProjectForRegistration(state, registrationId) {
    return state.raceProjects.find((project) => project.registrationId === registrationId);
  }

  function getRaceProjectForConnection(state, caConnection) {
    return caConnection ? findById(state.raceProjects, caConnection.raceProjectId) : null;
  }

  function getWorkForRegistration(state, registrationId) {
    return state.works.find((work) => work.registrationId === registrationId);
  }

  function actorOwnsRegistration(state, actorId, registrationId) {
    const registration = findById(state.registrations, registrationId);
    return Boolean(registration && registration.userId === actorId);
  }

  function actorCanAssistRaceProject(state, actorId, raceProjectId) {
    const project = findById(state.raceProjects, raceProjectId);
    if (!project) return false;
    const registration = findById(state.registrations, project.registrationId);
    return Boolean(
      registration &&
        (registration.userId === actorId || canManageRace(state, registration.raceId, actorId))
    );
  }

  function logAudit(state, actorId, type, message, resource) {
    state.auditLog.unshift({
      id: nextId(state, "audit"),
      at: now(),
      actorId,
      type,
      message,
      resource: resource || null,
    });
    state.auditLog = state.auditLog.slice(0, 80);
  }

  function ensureReviewFlag(state, input) {
    const existing = state.reviewFlags.find((flag) => {
      return (
        flag.registrationId === input.registrationId &&
        flag.type === input.type &&
        flag.status !== "resolved"
      );
    });
    if (existing) {
      existing.severity = input.severity || existing.severity;
      existing.judgeVisibleSummary = input.judgeVisibleSummary || existing.judgeVisibleSummary;
      existing.sourceRef = input.sourceRef || existing.sourceRef;
      existing.workId = input.workId || existing.workId || null;
      existing.raceProjectId = input.raceProjectId || existing.raceProjectId || null;
      return existing;
    }

    const registration = findById(state.registrations, input.registrationId);
    const flag = {
      id: nextId(state, "flag"),
      raceId: input.raceId || (registration ? registration.raceId : null),
      registrationId: input.registrationId,
      raceProjectId: input.raceProjectId || null,
      workId: input.workId || null,
      type: input.type,
      severity: input.severity || "medium",
      status: "open",
      judgeVisibleSummary: input.judgeVisibleSummary,
      sourceRef: input.sourceRef || {},
      createdAt: now(),
      resolvedAt: null,
    };
    state.reviewFlags.push(flag);
    return flag;
  }

  function resolveReviewFlag(state, registrationId, type) {
    state.reviewFlags.forEach((flag) => {
      if (flag.registrationId === registrationId && flag.type === type && flag.status !== "resolved") {
        flag.status = "resolved";
        flag.resolvedAt = now();
      }
    });
  }

  function updateRaceProjectAggregate(state, raceProjectId) {
    const project = findById(state.raceProjects, raceProjectId);
    if (!project) return null;
    const registration = findById(state.registrations, project.registrationId);
    const activeConnections = state.caConnections.filter((connection) => {
      return connection.raceProjectId === raceProjectId && !connection.disabledAt;
    });

    const anyActive = activeConnections.some((connection) => connection.ingestionStatus === "active");
    const anyConnected = activeConnections.some((connection) => connection.ingestionStatus === "connected");
    const anyFailed = activeConnections.some((connection) => connection.ingestionStatus === "failed");

    if (activeConnections.length === 0) {
      project.aggregateIngestionStatus = "not_configured";
      project.connectionHealth = "no_signal";
      if (registration) {
        ensureReviewFlag(state, {
          raceId: registration.raceId,
          registrationId: registration.id,
          raceProjectId: project.id,
          type: "no_ca_data",
          severity: "medium",
          judgeVisibleSummary: "RaceProject尚未配置CAConnection，评审前需确认证据缺口。",
          sourceRef: { scope: "race_project", id: project.id },
        });
      }
      return project;
    }

    if (anyActive) {
      project.aggregateIngestionStatus = "active";
      project.connectionHealth = anyFailed ? "partial_failed" : "ok";
      if (registration) resolveReviewFlag(state, registration.id, "no_ca_data");
      return project;
    }

    if (anyConnected) {
      project.aggregateIngestionStatus = "connected";
      project.connectionHealth = anyFailed ? "partial_failed" : "ok";
      if (registration) resolveReviewFlag(state, registration.id, "no_ca_data");
      return project;
    }

    project.aggregateIngestionStatus = "failed";
    project.connectionHealth = "all_failed";
    if (registration) {
      ensureReviewFlag(state, {
        raceId: registration.raceId,
        registrationId: registration.id,
        raceProjectId: project.id,
        type: "ingestion_exception",
        severity: "high",
        judgeVisibleSummary: "全部CAConnection不可用，提交和评审不被阻断，但评审前必须看到该风险。",
        sourceRef: { scope: "race_project", id: project.id },
      });
    }
    return project;
  }

  function updateAllAggregates(state) {
    state.raceProjects.forEach((project) => updateRaceProjectAggregate(state, project.id));
  }

  function buildProjectionPayload(state, raceId) {
    updateAllAggregates(state);
    const registrations = state.registrations.filter((registration) => registration.raceId === raceId);
    const entries = registrations.map((registration) => {
      const user = findById(state.users, registration.userId);
      const project = getRaceProjectForRegistration(state, registration.id);
      const work = getWorkForRegistration(state, registration.id);
      const award = state.awards.find((item) => item.registrationId === registration.id && item.status === "published");
      const openFlags = state.reviewFlags.filter((flag) => {
        return flag.registrationId === registration.id && flag.status !== "resolved";
      });
      return {
        registrationId: registration.id,
        riderName: user ? user.displayName : "Unknown rider",
        status: registration.status,
        raceProjectId: project ? project.id : null,
        ingestion: project ? project.aggregateIngestionStatus : "not_configured",
        connectionHealth: project ? project.connectionHealth : "no_project",
        progressPercent: project && project.metrics ? project.metrics.progressPercent || 0 : 0,
        tokens: project && project.metrics ? project.metrics.tokens || 0 : 0,
        workTitle: work ? work.title : null,
        workStatus: work ? work.status : "missing",
        awardRank: award ? award.rank : null,
        flags: openFlags.map((flag) => flag.type),
      };
    });

    const eventStream = state.auditLog.slice(0, 8).map((entry) => entry.message);
    return {
      rebuiltAt: now(),
      totals: {
        registrations: registrations.length,
        approved: registrations.filter((registration) => registration.status === "approved").length,
        submittedWorks: state.works.filter((work) => {
          const registration = findById(state.registrations, work.registrationId);
          return registration && registration.raceId === raceId && work.status === "submitted";
        }).length,
        activeProjects: entries.filter((entry) => entry.ingestion === "active").length,
      },
      entries,
      eventStream,
    };
  }

  function getLatestStableProjection(state, raceId) {
    return state.projections.find((projection) => {
      return projection.raceId === raceId && projection.status === "stable";
    });
  }

  function buildLeaderboard(state, raceId) {
    return state.awards
      .filter((award) => award.raceId === raceId && award.status === "published")
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((award) => {
        const registration = findById(state.registrations, award.registrationId);
        const user = registration ? findById(state.users, registration.userId) : null;
        const work = award.workId ? findById(state.works, award.workId) : null;
        return {
          rank: award.rank,
          awardName: award.awardName,
          riderName: user ? user.displayName : "Unknown rider",
          workTitle: work ? work.title : null,
          decisionReason: award.decisionReason,
        };
      });
  }

  function buildReportContent(state, raceId, type, subjectRegistrationId) {
    const race = findById(state.races, raceId);
    const leaderboard = buildLeaderboard(state, raceId);
    const flags = state.reviewFlags.filter((flag) => flag.raceId === raceId && flag.status !== "resolved");
    const evidenceCount = state.evidences.filter((evidence) => evidence.raceId === raceId).length;
    if (type === "rider_report") {
      const registration = findById(state.registrations, subjectRegistrationId);
      const user = registration ? findById(state.users, registration.userId) : null;
      const project = registration ? getRaceProjectForRegistration(state, registration.id) : null;
      return [
        `${user ? user.displayName : "Rider"} rider report`,
        `Race: ${race ? race.title : raceId}`,
        `CA status: ${project ? project.aggregateIngestionStatus : "not_configured"}`,
        `Evidence references: ${evidenceCount}`,
        "Report visibility stays private unless a later rule explicitly publishes it.",
      ].join("\n");
    }

    if (type === "review_summary") {
      return [
        `${race ? race.title : raceId} review summary`,
        `Published leaderboard entries: ${leaderboard.length}`,
        `Open review flags: ${flags.length}`,
        "Judges reviewed submitted work with CA evidence summaries and declared risk notes.",
      ].join("\n");
    }

    return [
      `${race ? race.title : raceId} race report`,
      `Registrations: ${state.registrations.filter((registration) => registration.raceId === raceId).length}`,
      `Evidence references: ${evidenceCount}`,
      `Awards: ${leaderboard.map((item) => `#${item.rank} ${item.riderName}`).join(", ") || "not published"}`,
      "Operational notes include fallback readiness, projection rebuilds, and incident records.",
    ].join("\n");
  }

  const actions = {
    setCurrentUser(state, input) {
      const user = findById(state.users, input.userId);
      if (!user) return fail("用户不存在");
      const nextRole = input.role || user.roles[0];
      if (!user.roles.includes(nextRole)) return fail(`该用户没有${roleLabel(nextRole)}角色`);
      state.meta.currentUserId = user.id;
      state.meta.currentRole = nextRole;
      return ok(`当前身份切换为${user.displayName}/${nextRole}`);
    },

    setSelectedRace(state, raceId) {
      const race = findById(state.races, raceId);
      if (!race) return fail("赛事不存在");
      state.meta.selectedRaceId = raceId;
      return ok(`当前赛事切换为${race.title}`);
    },

    createRace(state, input) {
      if (!hasRole(state, input.actorId, "organizer") && !hasRole(state, input.actorId, "admin")) {
        return fail("只有Organizer或Admin可以创建Race");
      }
      const race = {
        id: nextId(state, "race"),
        slug: (input.title || "new-race").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        title: input.title || "Untitled Agent Race",
        status: "draft",
        visibility: "private",
        challenge: input.challenge || "TBD",
        taskId: input.taskId || "DEV-X",
        createdByUserId: input.actorId,
        organizerUserIds: [input.actorId],
        schedule: input.schedule || {},
        rules: {
          allowCAConnectionUntil: "judging",
          maxMainWorksPerRegistration: 1,
          caFailureBlocksSubmission: false,
        },
        createdAt: now(),
      };
      state.races.push(race);
      state.meta.selectedRaceId = race.id;
      logAudit(state, input.actorId, "race_created", `创建赛事${race.title}`, { raceId: race.id });
      return ok("Race已创建", { raceId: race.id });
    },

    publishRace(state, input) {
      const race = findById(state.races, input.raceId);
      if (!race) return fail("赛事不存在");
      if (!canManageRace(state, race.id, input.actorId)) return fail("没有管理该Race的权限");
      race.status = input.nextStatus || "registration";
      race.visibility = "public";
      race.publishedAt = race.publishedAt || now();
      logAudit(state, input.actorId, "race_published", `发布赛事${race.title}`, { raceId: race.id });
      return ok("Race已发布并开放公开页面");
    },

    submitRegistration(state, input) {
      if (!hasRole(state, input.userId, "rider")) return fail("报名用户必须拥有rider角色");
      const race = findById(state.races, input.raceId);
      if (!race || race.visibility !== "public") return fail("只能报名已公开Race");
      const existing = getRegistrationForUserRace(state, input.userId, input.raceId);
      if (existing) return ok("该用户已报名同一Race", { registrationId: existing.id });
      const registration = {
        id: nextId(state, "reg"),
        raceId: input.raceId,
        userId: input.userId,
        status: "pending",
        submittedAt: now(),
        approvedAt: null,
      };
      state.registrations.push(registration);
      logAudit(state, input.userId, "registration_submitted", "提交报名", {
        raceId: input.raceId,
        registrationId: registration.id,
      });
      return ok("报名已提交", { registrationId: registration.id });
    },

    ensureRaceProject(state, input) {
      const registration = findById(state.registrations, input.registrationId);
      if (!registration) return fail("报名不存在");
      if (registration.status !== "approved") return fail("只有approved Registration可以生成RaceProject");
      const existing = getRaceProjectForRegistration(state, registration.id);
      if (existing) {
        updateRaceProjectAggregate(state, existing.id);
        return ok("RaceProject已存在", { raceProjectId: existing.id, created: false });
      }
      const project = {
        id: nextId(state, "rp"),
        registrationId: registration.id,
        repoUrl: "",
        aggregateIngestionStatus: "not_configured",
        connectionHealth: "no_signal",
        metrics: { progressPercent: 0, tokens: 0, messageCount: 0, toolCallCount: 0 },
        createdAt: now(),
        lastSyncedAt: null,
      };
      state.raceProjects.push(project);
      updateRaceProjectAggregate(state, project.id);
      logAudit(state, input.actorId || "system", "race_project_ensured", "幂等生成RaceProject", {
        registrationId: registration.id,
        raceProjectId: project.id,
      });
      return ok("RaceProject已生成", { raceProjectId: project.id, created: true });
    },

    approveRegistration(state, input) {
      const registration = findById(state.registrations, input.registrationId);
      if (!registration) return fail("报名不存在");
      if (!canManageRace(state, registration.raceId, input.actorId)) return fail("没有审核该报名的权限");
      registration.status = "approved";
      registration.approvedAt = registration.approvedAt || now();
      const ensured = actions.ensureRaceProject(state, {
        registrationId: registration.id,
        actorId: input.actorId,
      });
      logAudit(state, input.actorId, "registration_approved", "审核通过报名", {
        raceId: registration.raceId,
        registrationId: registration.id,
      });
      return ok("报名已审核通过，RaceProject已幂等确认", ensured);
    },

    rejectRegistration(state, input) {
      const registration = findById(state.registrations, input.registrationId);
      if (!registration) return fail("报名不存在");
      if (!canManageRace(state, registration.raceId, input.actorId)) return fail("没有拒绝该报名的权限");
      registration.status = "rejected";
      registration.rejectedAt = now();
      logAudit(state, input.actorId, "registration_rejected", "拒绝报名", {
        registrationId: registration.id,
      });
      return ok("报名已拒绝");
    },

    registerCAConnection(state, input) {
      const project = findById(state.raceProjects, input.raceProjectId);
      if (!project) return fail("RaceProject不存在");
      if (!actorCanAssistRaceProject(state, input.actorId, project.id)) return fail("没有登记该CAConnection的权限");
      const connection = {
        id: nextId(state, "conn"),
        raceProjectId: project.id,
        caType: input.caType || "codex",
        connectorId: input.connectorId || `connector-${state.meta.sequence}`,
        connectorVersion: input.connectorVersion || "0.1.0",
        externalProjectRef: input.externalProjectRef || `ca-project-${state.meta.sequence}`,
        ingestionStatus: "not_configured",
        registeredAt: now(),
        handshakeAt: null,
        disabledAt: null,
        lastSyncedAt: null,
        lastError: null,
      };
      state.caConnections.push(connection);
      updateRaceProjectAggregate(state, project.id);
      logAudit(state, input.actorId, "ca_connection_registered", "登记CAConnection", {
        raceProjectId: project.id,
        caConnectionId: connection.id,
      });
      return ok("CAConnection已登记，等待握手", { caConnectionId: connection.id });
    },

    handshakeCAConnection(state, input) {
      const connection = findById(state.caConnections, input.caConnectionId);
      if (!connection) return fail("CAConnection不存在");
      if (!actorCanAssistRaceProject(state, input.actorId, connection.raceProjectId)) {
        return fail("没有握手该CAConnection的权限");
      }
      connection.ingestionStatus = "connected";
      connection.handshakeAt = connection.handshakeAt || now();
      connection.lastError = null;
      updateRaceProjectAggregate(state, connection.raceProjectId);
      logAudit(state, input.actorId, "ca_connection_connected", "CAConnection握手成功", {
        caConnectionId: connection.id,
      });
      return ok("CAConnection握手成功");
    },

    disableCAConnection(state, input) {
      const connection = findById(state.caConnections, input.caConnectionId);
      if (!connection) return fail("CAConnection不存在");
      if (!actorCanAssistRaceProject(state, input.actorId, connection.raceProjectId)) {
        return fail("没有禁用该CAConnection的权限");
      }
      connection.disabledAt = now();
      connection.lastError = input.reason || "disabled_by_operator";
      updateRaceProjectAggregate(state, connection.raceProjectId);
      logAudit(state, input.actorId, "ca_connection_disabled", "禁用CAConnection", {
        caConnectionId: connection.id,
      });
      return ok("CAConnection已禁用");
    },

    ingestRidingSignal(state, message) {
      const idempotencyKey = message.idempotencyKey;
      if (!idempotencyKey) return fail("缺少idempotencyKey");
      if (state.ingestionKeys.includes(idempotencyKey)) {
        return ok("重复信号已幂等忽略", { duplicate: true });
      }

      const connectionId = message.ca && message.ca.caConnectionId;
      const connection = findById(state.caConnections, connectionId);
      const project = getRaceProjectForConnection(state, connection);
      const registration = project ? findById(state.registrations, project.registrationId) : null;
      const incomingProjectId = message.rider && message.rider.raceProjectId;
      const incomingRegistrationId = message.rider && message.rider.registrationId;
      const incomingRaceId = message.race && message.race.raceId;

      const reject = (reason) => {
        state.quarantinedSignals.unshift({
          id: nextId(state, "quarantine"),
          reason,
          receivedAt: now(),
          message: clone(message),
        });
        return fail(reason, { quarantined: true });
      };

      if (!connection) return reject("未登记CAConnection，信号已隔离");
      if (!project || !registration) return reject("CAConnection归属缺失，信号已隔离");
      if (connection.disabledAt) return reject("CAConnection已禁用，信号已隔离");
      if (!connection.handshakeAt || connection.ingestionStatus === "not_configured") {
        return reject("CAConnection未完成握手，信号已隔离");
      }
      if (incomingProjectId !== project.id || incomingRegistrationId !== registration.id) {
        return reject("RaceProject或Registration归属错误，信号已隔离");
      }
      if (incomingRaceId !== registration.raceId) return reject("Race归属错误，信号已隔离");

      state.ingestionKeys.push(idempotencyKey);
      state.ingestionKeys = state.ingestionKeys.slice(-500);

      if (message.ingestion && message.ingestion.status === "failed") {
        connection.ingestionStatus = "failed";
        connection.lastError = message.ingestion.statusReason || "connector_failed";
        connection.lastSyncedAt = message.timestamp || now();
        ensureReviewFlag(state, {
          raceId: registration.raceId,
          registrationId: registration.id,
          raceProjectId: project.id,
          type: "ingestion_exception",
          severity: "high",
          judgeVisibleSummary: `CAConnection接入失败：${connection.lastError}`,
          sourceRef: { scope: "ca_connection", id: connection.id },
        });
        updateRaceProjectAggregate(state, project.id);
        logAudit(state, "connector", "riding_signal_failed", "CA接入失败信号已记录", {
          caConnectionId: connection.id,
        });
        return ok("失败信号已记录为评审前风险", { caConnectionId: connection.id });
      }

      connection.ingestionStatus = "active";
      connection.lastSyncedAt = message.timestamp || now();
      connection.lastError = null;

      const externalSessionRef = message.ca.caSessionId;
      let session = state.sessions.find((item) => {
        return item.caConnectionId === connection.id && item.externalSessionRef === externalSessionRef;
      });
      if (!session) {
        session = {
          id: nextId(state, "session"),
          caConnectionId: connection.id,
          externalSessionRef,
          startedAt: message.timestamp || now(),
          endedAt: null,
          lastActiveAt: message.timestamp || now(),
          messageCount: 0,
          toolCallCount: 0,
          tokenCost: 0,
          progressPercent: 0,
          taskStatus: "in_progress",
          snapshotVersion: 1,
        };
        state.sessions.push(session);
      }

      session.lastActiveAt = message.timestamp || now();
      session.messageCount = Math.max(session.messageCount || 0, (message.counters && message.counters.messageCount) || 0);
      session.toolCallCount = Math.max(session.toolCallCount || 0, (message.counters && message.counters.toolCallCount) || 0);
      session.tokenCost = Math.max(session.tokenCost || 0, (message.counters && message.counters.tokens) || 0);
      session.progressPercent = Math.max(session.progressPercent || 0, (message.signal && message.signal.progressPercent) || 0);
      session.taskStatus = (message.signal && message.signal.taskStatus) || session.taskStatus;
      if (message.signal && message.signal.phase === "finished") session.endedAt = message.timestamp || now();
      session.snapshotVersion += 1;

      project.metrics.progressPercent = Math.max(project.metrics.progressPercent || 0, session.progressPercent || 0);
      project.metrics.tokens = Math.max(project.metrics.tokens || 0, session.tokenCost || 0);
      project.metrics.messageCount = Math.max(project.metrics.messageCount || 0, session.messageCount || 0);
      project.metrics.toolCallCount = Math.max(project.metrics.toolCallCount || 0, session.toolCallCount || 0);
      project.lastSyncedAt = connection.lastSyncedAt;

      const evidenceExists = state.evidences.some((evidence) => {
        return evidence.sourceRef && evidence.sourceRef.sessionId === session.id;
      });
      if (!evidenceExists) {
        state.evidences.push({
          id: nextId(state, "evidence"),
          raceId: registration.raceId,
          registrationId: registration.id,
          type: "session_summary",
          title: "CA session summary",
          summary: "Accepted real-time CA signal generated a session summary for review.",
          sourceRef: { sessionId: session.id, caConnectionId: connection.id },
          visibility: "private_summary",
          createdAt: now(),
        });
      }

      updateRaceProjectAggregate(state, project.id);
      logAudit(state, "connector", "riding_signal_accepted", "合法CA骑行信号已进入Projection输入", {
        caConnectionId: connection.id,
        sessionId: session.id,
      });
      return ok("骑行信号已接收", { sessionId: session.id, caConnectionId: connection.id });
    },

    submitWork(state, input) {
      const registration = findById(state.registrations, input.registrationId);
      if (!registration) return fail("报名不存在");
      if (registration.status !== "approved") return fail("只有approved Registration可以提交Work");
      if (!actorOwnsRegistration(state, input.actorId, registration.id) && !hasRole(state, input.actorId, "admin")) {
        return fail("Rider只能提交自己的Work");
      }

      let work = getWorkForRegistration(state, registration.id);
      if (!work) {
        work = {
          id: nextId(state, "work"),
          registrationId: registration.id,
          slug: `work-${registration.id}`,
          title: input.title || "Untitled Work",
          summary: input.summary || "",
          status: "draft",
          visibility: "private",
          demoUrl: "",
          videoUrl: "",
          repoUrl: "",
          submittedAt: null,
          publishedAt: null,
        };
        state.works.push(work);
      }

      work.title = input.title || work.title;
      work.summary = input.summary || work.summary;
      work.demoUrl = input.demoUrl || work.demoUrl;
      work.videoUrl = input.videoUrl || work.videoUrl;
      work.repoUrl = input.repoUrl || work.repoUrl;
      work.status = "submitted";
      work.submittedAt = work.submittedAt || now();

      const project = getRaceProjectForRegistration(state, registration.id);
      if (project && input.repoUrl) project.repoUrl = input.repoUrl;
      if (!work.repoUrl || !work.demoUrl) {
        ensureReviewFlag(state, {
          raceId: registration.raceId,
          registrationId: registration.id,
          raceProjectId: project ? project.id : null,
          workId: work.id,
          type: "missing_required_material",
          severity: "medium",
          judgeVisibleSummary: "Work缺少必填Demo或Repo材料，评审前需处理。",
          sourceRef: { scope: "work", id: work.id },
        });
      }
      if (project) updateRaceProjectAggregate(state, project.id);

      logAudit(state, input.actorId, "work_submitted", `提交作品${work.title}`, {
        registrationId: registration.id,
        workId: work.id,
      });
      return ok("Work已提交", { workId: work.id });
    },

    publishWork(state, input) {
      const work = findById(state.works, input.workId);
      if (!work) return fail("作品不存在");
      const registration = findById(state.registrations, work.registrationId);
      if (!registration || !canManageRace(state, registration.raceId, input.actorId)) {
        return fail("没有发布该Work的权限");
      }
      work.visibility = "public";
      work.publishedAt = work.publishedAt || now();
      logAudit(state, input.actorId, "work_published", `发布作品${work.title}`, { workId: work.id });
      return ok("Work已发布到Public Site");
    },

    assignJudge(state, input) {
      const work = findById(state.works, input.workId);
      if (!work) return fail("作品不存在");
      const registration = findById(state.registrations, work.registrationId);
      if (!registration || !canManageRace(state, registration.raceId, input.actorId)) {
        return fail("没有分配该Work评委的权限");
      }
      if (!hasRole(state, input.judgeUserId, "judge")) return fail("被分配用户必须拥有judge角色");
      const existing = state.judgeAssignments.find((assignment) => {
        return assignment.workId === work.id && assignment.judgeUserId === input.judgeUserId;
      });
      if (existing) return ok("JudgeAssignment已存在", { assignmentId: existing.id });
      const assignment = {
        id: nextId(state, "assign"),
        raceId: registration.raceId,
        workId: work.id,
        judgeUserId: input.judgeUserId,
        assignedByUserId: input.actorId,
        status: "assigned",
        assignedAt: now(),
      };
      state.judgeAssignments.push(assignment);
      logAudit(state, input.actorId, "judge_assigned", "分配评委", {
        workId: work.id,
        judgeUserId: input.judgeUserId,
      });
      return ok("JudgeAssignment已创建", { assignmentId: assignment.id });
    },

    submitJudgingRecord(state, input) {
      const assignment = findById(state.judgeAssignments, input.assignmentId);
      if (!assignment) return fail("JudgeAssignment不存在");
      if (assignment.judgeUserId !== input.actorId) return fail("Judge只能提交分配给自己的评审");
      let record = state.judgingRecords.find((item) => item.assignmentId === assignment.id);
      if (!record) {
        record = {
          id: nextId(state, "judge_record"),
          assignmentId: assignment.id,
          scoreResult: 0,
          scoreRiding: 0,
          comments: "",
          status: "draft",
          submittedAt: null,
        };
        state.judgingRecords.push(record);
      }
      record.scoreResult = Number(input.scoreResult || 0);
      record.scoreRiding = Number(input.scoreRiding || 0);
      record.comments = input.comments || record.comments;
      record.status = "submitted";
      record.submittedAt = record.submittedAt || now();
      assignment.status = "reviewed";
      logAudit(state, input.actorId, "judging_record_submitted", "提交评审记录", {
        assignmentId: assignment.id,
        judgingRecordId: record.id,
      });
      return ok("JudgingRecord已提交", { judgingRecordId: record.id });
    },

    publishAward(state, input) {
      const registration = findById(state.registrations, input.registrationId);
      if (!registration) return fail("Registration不存在");
      if (!canManageRace(state, registration.raceId, input.actorId)) return fail("没有发布Award的权限");
      const awardName = input.awardName || "Grand Prize";
      let award = state.awards.find((item) => {
        return item.raceId === registration.raceId && item.awardName === awardName && item.rank === Number(input.rank || 1);
      });
      if (!award) {
        award = {
          id: nextId(state, "award"),
          raceId: registration.raceId,
          registrationId: registration.id,
          workId: input.workId || (getWorkForRegistration(state, registration.id) || {}).id || null,
          awardName,
          rank: Number(input.rank || 1),
          decisionReason: input.decisionReason || "Strong result and clear evidence package.",
          status: "published",
          publishedAt: now(),
        };
        state.awards.push(award);
      } else {
        award.registrationId = registration.id;
        award.workId = input.workId || award.workId;
        award.decisionReason = input.decisionReason || award.decisionReason;
        award.status = "published";
        award.publishedAt = award.publishedAt || now();
      }
      logAudit(state, input.actorId, "award_published", `发布${awardName}#${award.rank}`, {
        raceId: registration.raceId,
        awardId: award.id,
      });
      return ok("Award和Leaderboard已发布", { awardId: award.id });
    },

    rebuildProjection(state, input) {
      if (!canManageRace(state, input.raceId, input.actorId)) return fail("没有重建Projection的权限");
      if (input.forceFail) {
        const failedProjection = {
          id: nextId(state, "projection"),
          raceId: input.raceId,
          type: "race_progress",
          status: "failed",
          payload: { failedAt: now(), reason: input.reason || "manual_failure_simulation" },
          stableVersionId: (getLatestStableProjection(state, input.raceId) || {}).id || null,
          lastRebuiltAt: now(),
        };
        state.projections.unshift(failedProjection);
        logAudit(state, input.actorId, "projection_failed", "Projection重建失败，保留稳定版本", {
          raceId: input.raceId,
        });
        return ok("Projection失败已隔离，事实数据未被污染", { projectionId: failedProjection.id });
      }

      const projection = {
        id: nextId(state, "projection"),
        raceId: input.raceId,
        type: "race_progress",
        status: "stable",
        payload: buildProjectionPayload(state, input.raceId),
        stableVersionId: null,
        lastRebuiltAt: now(),
      };
      projection.stableVersionId = projection.id;
      state.projections.unshift(projection);
      logAudit(state, input.actorId, "projection_rebuilt", "Projection已重建为稳定版本", {
        raceId: input.raceId,
        projectionId: projection.id,
      });
      return ok("Projection已重建", { projectionId: projection.id });
    },

    switchScreenMode(state, input) {
      if (!SCREEN_MODES.includes(input.mode)) return fail("未知Screen模式");
      if (!canManageRace(state, input.raceId, input.actorId)) return fail("没有切换大屏的权限");
      state.screenDisplays[input.raceId] = state.screenDisplays[input.raceId] || {};
      state.screenDisplays[input.raceId].mode = input.mode;
      state.screenDisplays[input.raceId].fallback = input.fallback || state.screenDisplays[input.raceId].fallback || "stable_projection";
      state.screenDisplays[input.raceId].updatedAt = now();
      logAudit(state, input.actorId, "screen_mode_switched", `Screen切换到${input.mode}`, {
        raceId: input.raceId,
      });
      return ok("Screen Console模式已切换");
    },

    generateReport(state, input) {
      if (!canManageRace(state, input.raceId, input.actorId)) return fail("没有生成Report的权限");
      if (input.type === "rider_report" && !input.subjectRegistrationId) return fail("rider_report必须有关联Registration");
      if (input.type !== "rider_report" && input.subjectRegistrationId) {
        return fail("race_report和review_summary不能关联单个Registration");
      }
      const existing = input.forceFail
        ? null
        : state.reports.find((report) => {
            return (
              report.raceId === input.raceId &&
              report.type === input.type &&
              (report.subjectRegistrationId || null) === (input.subjectRegistrationId || null)
            );
          });
      const report = existing || {
        id: nextId(state, "report"),
        raceId: input.raceId,
        type: input.type,
        subjectRegistrationId: input.subjectRegistrationId || null,
        status: "draft",
        visibility: "private",
        content: "",
        generatedAt: null,
        publishedAt: null,
        lastError: null,
      };
      if (input.forceFail) {
        report.status = "failed";
        report.lastError = input.reason || "generator_failed";
        report.generatedAt = now();
        if (!existing) state.reports.push(report);
        logAudit(state, input.actorId, "report_generate_failed", `${input.type}生成失败`, {
          reportId: report.id,
        });
        return ok("Report生成失败已记录，可重跑或人工编辑", { reportId: report.id });
      }
      report.status = "draft";
      report.visibility = "private";
      report.content = input.content || buildReportContent(state, input.raceId, input.type, input.subjectRegistrationId);
      report.generatedAt = now();
      report.lastError = null;
      if (!existing) state.reports.push(report);
      logAudit(state, input.actorId, "report_generated", `${input.type}已生成`, { reportId: report.id });
      return ok("Report已生成草稿", { reportId: report.id });
    },

    editReport(state, input) {
      const report = findById(state.reports, input.reportId);
      if (!report) return fail("Report不存在");
      if (!canManageRace(state, report.raceId, input.actorId)) return fail("没有编辑Report的权限");
      report.content = input.content || report.content;
      report.status = report.status === "failed" ? "draft" : report.status;
      report.lastError = null;
      logAudit(state, input.actorId, "report_edited", `${report.type}已人工编辑`, { reportId: report.id });
      return ok("Report已编辑");
    },

    publishReport(state, input) {
      const report = findById(state.reports, input.reportId);
      if (!report) return fail("Report不存在");
      if (!canManageRace(state, report.raceId, input.actorId)) return fail("没有发布Report的权限");
      if (!report.content) return fail("空Report不能发布");
      report.status = "published";
      report.visibility = report.type === "rider_report" ? "private" : "public";
      report.publishedAt = report.publishedAt || now();
      logAudit(state, input.actorId, "report_published", `${report.type}已发布`, { reportId: report.id });
      return ok("Report已发布");
    },

    markChecklistItem(state, input) {
      const raceId = input.raceId || state.meta.selectedRaceId;
      if (!canManageRace(state, raceId, input.actorId)) return fail("没有更新发布检查项的权限");
      const item = findById(state.releaseChecklist, input.id);
      if (!item) return fail("检查项不存在");
      item.status = input.status || "done";
      item.evidence = input.evidence || item.evidence;
      item.updatedAt = now();
      logAudit(state, input.actorId, "release_checklist_updated", `发布检查项：${item.label}`, {
        checklistId: item.id,
      });
      return ok("发布检查项已更新");
    },

    createBackup(state, input) {
      const race = findById(state.races, input.raceId);
      if (!race) return fail("Race不存在");
      if (!canManageRace(state, race.id, input.actorId)) return fail("没有创建备份记录的权限");
      const backup = {
        id: nextId(state, "backup"),
        raceId: race.id,
        scope: input.scope || "race_day_core",
        status: "completed",
        createdAt: now(),
        evidence: input.evidence || "local snapshot recorded",
      };
      state.backups.unshift(backup);
      logAudit(state, input.actorId, "backup_created", `创建${backup.scope}备份记录`, {
        backupId: backup.id,
      });
      return ok("备份记录已创建", { backupId: backup.id });
    },

    recordIncident(state, input) {
      const race = findById(state.races, input.raceId);
      if (!race) return fail("Race不存在");
      if (!canManageRace(state, race.id, input.actorId)) return fail("没有记录事故的权限");
      const incident = {
        id: nextId(state, "incident"),
        raceId: race.id,
        occurredAt: input.occurredAt || now(),
        impact: input.impact || "screen degraded",
        affectedRoles: input.affectedRoles || ["public", "screen"],
        action: input.action || "fallback_to_stable_projection",
        fallbackTriggered: Boolean(input.fallbackTriggered),
        rollback: Boolean(input.rollback),
        followUp: input.followUp || "review after race",
      };
      state.incidents.unshift(incident);
      logAudit(state, input.actorId, "incident_recorded", `事故记录：${incident.impact}`, {
        incidentId: incident.id,
      });
      return ok("事故记录已保存", { incidentId: incident.id });
    },

    archiveRace(state, input) {
      const race = findById(state.races, input.raceId);
      if (!race) return fail("Race不存在");
      if (!canManageRace(state, race.id, input.actorId)) return fail("没有归档Race的权限");
      race.status = "archived";
      race.archivedAt = now();
      actions.createBackup(state, {
        raceId: race.id,
        actorId: input.actorId,
        scope: "post_race_archive",
        evidence: "Race, Registration, Work, Award, Report, Incident archived in local MVP state.",
      });
      logAudit(state, input.actorId, "race_archived", `归档赛事${race.title}`, { raceId: race.id });
      return ok("赛事已归档");
    },

    updateUserRoles(state, input) {
      if (!hasRole(state, input.actorId, "admin")) return fail("只有Admin可以维护User.roles");
      const user = findById(state.users, input.userId);
      if (!user) return fail("用户不存在");
      const roles = (input.roles || []).filter((role) => ROLES.includes(role));
      if (roles.length === 0) return fail("至少保留一个有效角色");
      user.roles = Array.from(new Set(roles));
      if (!user.roles.includes(state.meta.currentRole) && user.id === state.meta.currentUserId) {
        state.meta.currentRole = user.roles[0];
      }
      logAudit(state, input.actorId, "user_roles_updated", `更新${user.displayName}角色`, {
        userId: user.id,
      });
      return ok("User.roles已更新");
    },

    runP0Regression(state, input) {
      const raceId = input.raceId || state.meta.selectedRaceId;
      const org = input.actorId || "user_org_1";
      const rider = "user_rider_1";
      const judge = "user_judge_1";
      const race = findById(state.races, raceId);
      if (!race) return fail("Race不存在");
      if (!canManageRace(state, raceId, org)) return fail("没有执行P0回归的权限");

      const steps = [];
      const pushStep = (label, result) => {
        steps.push({ label, ok: result.ok, message: result.message });
        return result;
      };

      pushStep("发布Race", actions.publishRace(state, { raceId, actorId: org, nextStatus: "registration" }));
      let registration = getRegistrationForUserRace(state, rider, raceId);
      if (!registration) {
        const submitted = pushStep("Rider报名", actions.submitRegistration(state, { raceId, userId: rider }));
        registration = findById(state.registrations, submitted.registrationId);
      }
      pushStep("审核报名并生成RaceProject", actions.approveRegistration(state, { registrationId: registration.id, actorId: org }));
      const project = getRaceProjectForRegistration(state, registration.id);
      let connection = state.caConnections.find((item) => item.raceProjectId === project.id && !item.disabledAt);
      if (!connection) {
        const registered = pushStep(
          "登记CAConnection",
          actions.registerCAConnection(state, {
            raceProjectId: project.id,
            actorId: rider,
            caType: "codex",
            connectorId: "codex-rehearsal",
            externalProjectRef: "codex-rehearsal-project",
          })
        );
        connection = findById(state.caConnections, registered.caConnectionId);
      }
      pushStep("握手CAConnection", actions.handshakeCAConnection(state, { caConnectionId: connection.id, actorId: rider }));
      pushStep(
        "接收实时CA信号",
        actions.ingestRidingSignal(state, {
          schemaVersion: "ary.ca.riding_signal.v0.1",
          messageId: nextId(state, "msg"),
          idempotencyKey: `p0:${raceId}:${registration.id}:${connection.id}:${Date.now()}`,
          sequence: 1,
          timestamp: now(),
          race: { raceId, taskId: race.taskId },
          rider: { registrationId: registration.id, raceProjectId: project.id },
          ca: {
            caConnectionId: connection.id,
            caType: connection.caType,
            connectorId: connection.connectorId,
            connectorVersion: connection.connectorVersion,
            caProjectId: connection.externalProjectRef,
            caSessionId: "session-p0-regression",
          },
          signal: {
            kind: "event",
            type: "task_completed",
            phase: "finished",
            taskStatus: "completed",
            progressPercent: 100,
          },
          counters: { tokens: 18400, messageCount: 212, toolCallCount: 41 },
        })
      );
      pushStep("重建Projection", actions.rebuildProjection(state, { raceId, actorId: org }));
      const workResult = pushStep(
        "提交Work",
        actions.submitWork(state, {
          registrationId: registration.id,
          actorId: rider,
          title: "Adaptive Bay Route Agent",
          summary: "A route planner that replans around live constraints and explains tradeoffs.",
          repoUrl: "https://github.com/example/adaptive-bay-route-agent",
          demoUrl: "https://demo.example.com/adaptive-bay-route-agent",
        })
      );
      pushStep("发布Work", actions.publishWork(state, { workId: workResult.workId, actorId: org }));
      const assignment = pushStep("分配Judge", actions.assignJudge(state, { workId: workResult.workId, judgeUserId: judge, actorId: org }));
      pushStep(
        "提交JudgingRecord",
        actions.submitJudgingRecord(state, {
          assignmentId: assignment.assignmentId,
          actorId: judge,
          scoreResult: 92,
          scoreRiding: 88,
          comments: "Clear outcome, traceable evidence, and strong recovery behavior.",
        })
      );
      pushStep(
        "发布Award",
        actions.publishAward(state, {
          raceId,
          registrationId: registration.id,
          workId: workResult.workId,
          awardName: "Grand Prize",
          rank: 1,
          decisionReason: "Best combined result and riding evidence package.",
          actorId: org,
        })
      );
      const raceReport = pushStep("生成race_report", actions.generateReport(state, { raceId, type: "race_report", actorId: org }));
      const reviewReport = pushStep("生成review_summary", actions.generateReport(state, { raceId, type: "review_summary", actorId: org }));
      pushStep("发布race_report", actions.publishReport(state, { reportId: raceReport.reportId, actorId: org }));
      pushStep("发布review_summary", actions.publishReport(state, { reportId: reviewReport.reportId, actorId: org }));
      pushStep("切换Screen live", actions.switchScreenMode(state, { raceId, actorId: org, mode: "live" }));
      pushStep(
        "记录备份",
        actions.createBackup(state, { raceId, actorId: org, scope: "p0_rehearsal_snapshot", evidence: "P0 local regression state snapshot" })
      );
      pushStep(
        "完成P0检查项",
        actions.markChecklistItem(state, {
          id: "p0_regression",
          raceId,
          actorId: org,
          status: "done",
          evidence: "Local MVP P0 regression completed.",
        })
      );

      const failed = steps.filter((step) => !step.ok);
      logAudit(state, org, "p0_regression_run", failed.length ? "P0回归存在失败步骤" : "P0回归已跑通", {
        raceId,
        failed: failed.length,
      });
      return failed.length ? fail("P0回归存在失败步骤", { steps }) : ok("P0回归已跑通", { steps });
    },
  };

  const selectors = {
    currentUser,
    hasRole,
    canManageRace,
    getRegistrationForUserRace,
    getRaceProjectForRegistration,
    getWorkForRegistration,
    getLatestStableProjection,
    buildLeaderboard,
    buildProjectionPayload,
    publicReports(state, raceId) {
      return state.reports.filter((report) => {
        return report.raceId === raceId && report.status === "published" && report.visibility === "public";
      });
    },
    screenFeed(state, raceId) {
      const display = state.screenDisplays[raceId] || { mode: "live", fallback: "stable_projection" };
      const projection = getLatestStableProjection(state, raceId);
      return {
        mode: display.mode,
        fallback: display.fallback,
        projection,
        leaderboard: buildLeaderboard(state, raceId),
        works: state.works.filter((work) => {
          const registration = findById(state.registrations, work.registrationId);
          return registration && registration.raceId === raceId && work.visibility === "public";
        }),
        announcements: state.announcements.filter((item) => item.raceId === raceId && item.visibility === "public"),
      };
    },
  };

  return {
    constants: { ROLES, SCREEN_MODES, INGESTION_STATUSES },
    createInitialState,
    actions,
    selectors,
  };
});
