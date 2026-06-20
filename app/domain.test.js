const assert = require("assert");
const domain = require("./domain.js");

function latestRegistrationForUser(state, userId, raceId) {
  return state.registrations.find((registration) => {
    return registration.userId === userId && registration.raceId === raceId;
  });
}

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

run("DEV-4 duplicate registration is idempotent per user and race", () => {
  const state = domain.createInitialState();
  const raceId = "race_bay_2026";
  domain.actions.publishRace(state, { raceId, actorId: "user_org_1" });
  const first = domain.actions.submitRegistration(state, { raceId, userId: "user_rider_1" });
  const second = domain.actions.submitRegistration(state, { raceId, userId: "user_rider_1" });
  assert.strictEqual(first.ok, true);
  assert.strictEqual(second.ok, true);
  assert.strictEqual(first.registrationId, second.registrationId);
  assert.strictEqual(
    state.registrations.filter((registration) => registration.userId === "user_rider_1" && registration.raceId === raceId).length,
    1
  );
});

run("DEV-4 approved Registration ensures exactly one RaceProject", () => {
  const state = domain.createInitialState();
  const registrationId = "reg_mira";
  const first = domain.actions.approveRegistration(state, { registrationId, actorId: "user_org_1" });
  const second = domain.actions.ensureRaceProject(state, { registrationId, actorId: "user_org_1" });
  assert.strictEqual(first.ok, true);
  assert.strictEqual(second.ok, true);
  assert.strictEqual(first.raceProjectId, second.raceProjectId);
  assert.strictEqual(state.raceProjects.filter((project) => project.registrationId === registrationId).length, 1);
});

run("DEV-5 invalid CA signal is quarantined and does not create evidence", () => {
  const state = domain.createInitialState();
  const beforeEvidence = state.evidences.length;
  const result = domain.actions.ingestRidingSignal(state, {
    schemaVersion: "ary.ca.riding_signal.v0.1",
    messageId: "bad-message",
    idempotencyKey: "bad-key",
    timestamp: "2026-06-18T10:00:00Z",
    race: { raceId: "race_bay_2026", taskId: "DEV-12" },
    rider: { registrationId: "reg_mira", raceProjectId: "missing_project" },
    ca: {
      caConnectionId: "missing_connection",
      caType: "codex",
      connectorId: "invalid",
      connectorVersion: "0.1.0",
      caProjectId: "invalid",
      caSessionId: "invalid",
    },
    signal: { kind: "event", type: "task_progress", phase: "riding" },
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.quarantined, true);
  assert.strictEqual(state.quarantinedSignals.length, 1);
  assert.strictEqual(state.evidences.length, beforeEvidence);
});

run("DEV-5 accepted CA signal creates active projection input and duplicate is ignored", () => {
  const state = domain.createInitialState();
  domain.actions.approveRegistration(state, { registrationId: "reg_mira", actorId: "user_org_1" });
  const project = domain.selectors.getRaceProjectForRegistration(state, "reg_mira");
  const registered = domain.actions.registerCAConnection(state, {
    raceProjectId: project.id,
    actorId: "user_rider_1",
    caType: "codex",
    connectorId: "codex-test",
    externalProjectRef: "ca-test-project",
  });
  domain.actions.handshakeCAConnection(state, { caConnectionId: registered.caConnectionId, actorId: "user_rider_1" });
  const message = {
    schemaVersion: "ary.ca.riding_signal.v0.1",
    messageId: "good-message",
    idempotencyKey: "good-key",
    timestamp: "2026-06-18T10:10:00Z",
    race: { raceId: "race_bay_2026", taskId: "DEV-12" },
    rider: { registrationId: "reg_mira", raceProjectId: project.id },
    ca: {
      caConnectionId: registered.caConnectionId,
      caType: "codex",
      connectorId: "codex-test",
      connectorVersion: "0.1.0",
      caProjectId: "ca-test-project",
      caSessionId: "session-a",
    },
    attestation: {
      source: "ocr_desktop_app",
      signingKeyId: "ocr_key_codex-test",
      signature: "dev-signature:codex-test:good-key",
      signedAt: "2026-06-18T10:10:00Z",
    },
    signal: { kind: "event", type: "task_completed", phase: "finished", taskStatus: "completed", progressPercent: 100 },
    counters: { tokens: 12000, messageCount: 80, toolCallCount: 20 },
  };
  const first = domain.actions.ingestRidingSignal(state, message);
  const duplicate = domain.actions.ingestRidingSignal(state, message);
  assert.strictEqual(first.ok, true);
  assert.strictEqual(duplicate.ok, true);
  assert.strictEqual(duplicate.duplicate, true);
  assert.strictEqual(project.aggregateIngestionStatus, "active");
  assert.strictEqual(state.sessions.length, 1);
  assert.strictEqual(state.evidences.length, 1);
});

run("DEV-5 forged CA signal without attestation is quarantined", () => {
  const state = domain.createInitialState();
  domain.actions.approveRegistration(state, { registrationId: "reg_mira", actorId: "user_org_1" });
  const project = domain.selectors.getRaceProjectForRegistration(state, "reg_mira");
  const registered = domain.actions.registerCAConnection(state, {
    raceProjectId: project.id,
    actorId: "user_rider_1",
    caType: "codex",
    connectorId: "codex-anti-forgery",
    externalProjectRef: "ca-anti-forgery-project",
  });
  domain.actions.handshakeCAConnection(state, { caConnectionId: registered.caConnectionId, actorId: "user_rider_1" });
  const beforeEvidence = state.evidences.length;
  const result = domain.actions.ingestRidingSignal(state, {
    schemaVersion: "ary.ca.riding_signal.v0.1",
    messageId: "forged-message",
    idempotencyKey: "forged-key",
    timestamp: "2026-06-18T10:15:00Z",
    race: { raceId: "race_bay_2026", taskId: "DEV-12" },
    rider: { registrationId: "reg_mira", raceProjectId: project.id },
    ca: {
      caConnectionId: registered.caConnectionId,
      caType: "codex",
      connectorId: "codex-anti-forgery",
      connectorVersion: "0.1.0",
      caProjectId: "ca-anti-forgery-project",
      caSessionId: "session-forged",
    },
    signal: { kind: "event", type: "task_completed", phase: "finished", taskStatus: "completed", progressPercent: 100 },
    counters: { tokens: 20000, messageCount: 99, toolCallCount: 30 },
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.quarantined, true);
  assert.strictEqual(state.evidences.length, beforeEvidence);
  assert.ok(state.quarantinedSignals[0].reason.includes("认证声明"));
});

run("DEV-5 CA failed does not block Work, Judge, or Award", () => {
  const state = domain.createInitialState();
  const raceId = "race_bay_2026";
  domain.actions.approveRegistration(state, { registrationId: "reg_mira", actorId: "user_org_1" });
  const project = domain.selectors.getRaceProjectForRegistration(state, "reg_mira");
  const registered = domain.actions.registerCAConnection(state, {
    raceProjectId: project.id,
    actorId: "user_rider_1",
    caType: "codex",
    connectorId: "codex-failing",
    externalProjectRef: "ca-failing-project",
  });
  domain.actions.handshakeCAConnection(state, { caConnectionId: registered.caConnectionId, actorId: "user_rider_1" });
  domain.actions.ingestRidingSignal(state, {
    schemaVersion: "ary.ca.riding_signal.v0.1",
    messageId: "fail-message",
    idempotencyKey: "fail-key",
    timestamp: "2026-06-18T10:20:00Z",
    race: { raceId, taskId: "DEV-12" },
    rider: { registrationId: "reg_mira", raceProjectId: project.id },
    ca: {
      caConnectionId: registered.caConnectionId,
      caType: "codex",
      connectorId: "codex-failing",
      connectorVersion: "0.1.0",
      caProjectId: "ca-failing-project",
      caSessionId: "session-failing",
    },
    attestation: {
      source: "registered_ca_connector",
      signingKeyId: "connector_key_codex-failing",
      signature: "dev-signature:codex-failing:fail-key",
      signedAt: "2026-06-18T10:20:00Z",
    },
    signal: { kind: "event", type: "risk_detected", phase: "paused", taskStatus: "blocked" },
    ingestion: { status: "failed", statusReason: "connector_timeout" },
  });
  assert.strictEqual(project.aggregateIngestionStatus, "failed");
  assert.ok(state.reviewFlags.some((flag) => flag.registrationId === "reg_mira" && flag.type === "ingestion_exception"));

  const work = domain.actions.submitWork(state, {
    registrationId: "reg_mira",
    actorId: "user_rider_1",
    title: "Failure Tolerant Agent",
    demoUrl: "https://demo.example.com/failure-tolerant-agent",
    repoUrl: "https://github.com/example/failure-tolerant-agent",
    summary: "Submits despite a failed CA connector, with risk visible for review.",
  });
  const assignment = domain.actions.assignJudge(state, {
    workId: work.workId,
    judgeUserId: "user_judge_1",
    actorId: "user_org_1",
  });
  const record = domain.actions.submitJudgingRecord(state, {
    assignmentId: assignment.assignmentId,
    actorId: "user_judge_1",
    scoreResult: 82,
    scoreRiding: 45,
    comments: "Risk noted and reviewed.",
  });
  const award = domain.actions.publishAward(state, {
    raceId,
    registrationId: "reg_mira",
    workId: work.workId,
    awardName: "Resilience Mention",
    rank: 1,
    actorId: "user_org_1",
  });
  assert.strictEqual(work.ok, true);
  assert.strictEqual(assignment.ok, true);
  assert.strictEqual(record.ok, true);
  assert.strictEqual(award.ok, true);
});

run("DEV-5 projection failure is isolated from facts and keeps stable fallback", () => {
  const state = domain.createInitialState();
  const stable = domain.actions.rebuildProjection(state, { raceId: "race_bay_2026", actorId: "user_org_1" });
  const failed = domain.actions.rebuildProjection(state, {
    raceId: "race_bay_2026",
    actorId: "user_org_1",
    forceFail: true,
    reason: "test_failure",
  });
  const stableProjection = domain.selectors.getLatestStableProjection(state, "race_bay_2026");
  assert.strictEqual(stable.ok, true);
  assert.strictEqual(failed.ok, true);
  assert.strictEqual(stableProjection.id, stable.projectionId);
  assert.ok(state.projections.some((projection) => projection.status === "failed"));
  assert.strictEqual(state.races.find((race) => race.id === "race_bay_2026").status, "draft");
});

run("DEV-7 report visibility keeps rider_report private and public review published", () => {
  const state = domain.createInitialState();
  domain.actions.approveRegistration(state, { registrationId: "reg_mira", actorId: "user_org_1" });
  const riderReport = domain.actions.generateReport(state, {
    raceId: "race_bay_2026",
    type: "rider_report",
    subjectRegistrationId: "reg_mira",
    actorId: "user_org_1",
  });
  const review = domain.actions.generateReport(state, {
    raceId: "race_bay_2026",
    type: "review_summary",
    actorId: "user_org_1",
  });
  domain.actions.publishReport(state, { reportId: riderReport.reportId, actorId: "user_org_1" });
  domain.actions.publishReport(state, { reportId: review.reportId, actorId: "user_org_1" });
  const rider = state.reports.find((report) => report.id === riderReport.reportId);
  const publicReports = domain.selectors.publicReports(state, "race_bay_2026");
  assert.strictEqual(rider.visibility, "private");
  assert.ok(publicReports.some((report) => report.type === "review_summary"));
  assert.ok(!publicReports.some((report) => report.type === "rider_report"));
});

run("DEV-7 failed report generation preserves already published public report", () => {
  const state = domain.createInitialState();
  const generated = domain.actions.generateReport(state, {
    raceId: "race_bay_2026",
    type: "race_report",
    actorId: "user_org_1",
  });
  domain.actions.publishReport(state, { reportId: generated.reportId, actorId: "user_org_1" });
  const failed = domain.actions.generateReport(state, {
    raceId: "race_bay_2026",
    type: "race_report",
    actorId: "user_org_1",
    forceFail: true,
    reason: "renderer_timeout",
  });
  const original = state.reports.find((report) => report.id === generated.reportId);
  const failedReport = state.reports.find((report) => report.id === failed.reportId);
  assert.strictEqual(original.status, "published");
  assert.strictEqual(original.visibility, "public");
  assert.strictEqual(failedReport.status, "failed");
  assert.notStrictEqual(original.id, failedReport.id);
  assert.ok(domain.selectors.publicReports(state, "race_bay_2026").some((report) => report.id === original.id));
});

run("REL-1 and OPS-1 P0 regression reaches release and ops evidence", () => {
  const state = domain.createInitialState();
  const result = domain.actions.runP0Regression(state, {
    raceId: "race_bay_2026",
    actorId: "user_org_1",
  });
  assert.strictEqual(result.ok, true);
  assert.ok(state.awards.some((award) => award.status === "published"));
  assert.ok(domain.selectors.publicReports(state, "race_bay_2026").length >= 2);
  assert.ok(state.releaseChecklist.find((item) => item.id === "p0_regression").status === "done");
  assert.ok(state.backups.length >= 1);
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
