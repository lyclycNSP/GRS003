(function () {
  const STORAGE_KEY = "ary.local.mvp.state.v1";
  const domain = window.ARYDomain;
  let state = loadState();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function loadState() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (error) {
      console.warn("Unable to load state", error);
    }
    return domain.createInitialState();
  }

  function saveState() {
    state.meta.lastSavedAt = new Date().toISOString();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatTime(value) {
    if (!value) return "n/a";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getRace() {
    return state.races.find((race) => race.id === state.meta.selectedRaceId) || state.races[0];
  }

  function getUser(userId) {
    return state.users.find((user) => user.id === userId);
  }

  function getRegistration(registrationId) {
    return state.registrations.find((registration) => registration.id === registrationId);
  }

  function getProject(registrationId) {
    return domain.selectors.getRaceProjectForRegistration(state, registrationId);
  }

  function getWork(registrationId) {
    return domain.selectors.getWorkForRegistration(state, registrationId);
  }

  function chip(label, variant) {
    return `<span class="chip ${variant || ""}">${escapeHtml(label)}</span>`;
  }

  function statusVariant(value) {
    if (["published", "approved", "active", "connected", "stable", "done", "reviewed"].includes(value)) return "ok";
    if (["pending", "draft", "not_configured", "open", "assigned"].includes(value)) return "warn";
    if (["failed", "rejected", "archived"].includes(value)) return "danger";
    return "info";
  }

  function notify(resultOrMessage) {
    const notice = $("#notice");
    const message = typeof resultOrMessage === "string" ? resultOrMessage : resultOrMessage.message;
    notice.textContent = message || "Done";
    notice.hidden = false;
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => {
      notice.hidden = true;
    }, 3200);
  }

  function commit(result) {
    saveState();
    render();
    notify(result);
    return result;
  }

  function activeActor() {
    return state.meta.currentUserId;
  }

  function selectedRaceRegistrations() {
    const race = getRace();
    return state.registrations.filter((registration) => registration.raceId === race.id);
  }

  function selectedRaceWorks() {
    return state.works.filter((work) => {
      const registration = getRegistration(work.registrationId);
      return registration && registration.raceId === getRace().id;
    });
  }

  function firstApprovedRegistrationWithoutWork() {
    return selectedRaceRegistrations().find((registration) => {
      return registration.status === "approved" && !getWork(registration.id);
    });
  }

  function firstSubmittedWork() {
    return selectedRaceWorks().find((work) => work.status === "submitted") || selectedRaceWorks()[0];
  }

  function firstAssignmentForCurrentJudge() {
    const userId = activeActor();
    return (
      state.judgeAssignments.find((assignment) => assignment.judgeUserId === userId) ||
      state.judgeAssignments[0]
    );
  }

  function render() {
    renderIdentity();
    renderNav();
    renderTopbar();
    renderOverview();
    renderRace();
    renderCA();
    renderScreen();
    renderReports();
    renderPublic();
    renderOps();
    renderAdmin();
  }

  function renderIdentity() {
    const userSelect = $("#user-select");
    const roleSelect = $("#role-select");
    const current = domain.selectors.currentUser(state);

    userSelect.innerHTML = state.users
      .map((user) => {
        const selected = user.id === state.meta.currentUserId ? "selected" : "";
        return `<option value="${escapeHtml(user.id)}" ${selected}>${escapeHtml(user.displayName)}</option>`;
      })
      .join("");

    roleSelect.innerHTML = (current ? current.roles : [])
      .map((role) => {
        const selected = role === state.meta.currentRole ? "selected" : "";
        return `<option value="${escapeHtml(role)}" ${selected}>${escapeHtml(role)}</option>`;
      })
      .join("");
  }

  function renderNav() {
    const hash = ((window.location.hash || "#overview").replace("#", "").split(/[?&]/)[0]) || "overview";
    $$(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${hash}`));
    $$("[data-nav]").forEach((nav) => nav.classList.toggle("active", nav.dataset.nav === hash));
    const titles = {
      overview: "ARY赛事执行工作台",
      race: "报名与评审流程",
      ca: "CA接入与Projection",
      screen: "Screen Console",
      reports: "报告与公开结果",
      public: "Public Site读取模型",
      ops: "发布与值守",
      admin: "账号与角色",
    };
    $("#page-title").textContent = titles[hash] || titles.overview;
  }

  function renderTopbar() {
    const race = getRace();
    const user = domain.selectors.currentUser(state);
    const projection = domain.selectors.getLatestStableProjection(state, race.id);
    const openFlags = state.reviewFlags.filter((flag) => flag.raceId === race.id && flag.status !== "resolved");
    $("#status-strip").innerHTML = [
      chip(race.title, "info"),
      chip(`Race ${race.status}`, statusVariant(race.status)),
      chip(`${user.displayName}/${state.meta.currentRole}`, "info"),
      chip(`${openFlags.length} flags`, openFlags.length ? "warn" : "ok"),
      chip(projection ? `Projection ${formatTime(projection.lastRebuiltAt)}` : "No projection", projection ? "ok" : "warn"),
    ].join("");
  }

  function renderOverview() {
    const race = getRace();
    const registrations = selectedRaceRegistrations();
    const approved = registrations.filter((registration) => registration.status === "approved");
    const works = selectedRaceWorks();
    const reports = domain.selectors.publicReports(state, race.id);
    const checklistDone = state.releaseChecklist.filter((item) => item.status === "done").length;

    $("#overview-metrics").innerHTML = [
      metric("Registrations", registrations.length, `${approved.length} approved`),
      metric("RaceProjects", state.raceProjects.length, "idempotent"),
      metric("Submitted Works", works.filter((work) => work.status === "submitted").length, "main work limit"),
      metric("Release Ready", `${checklistDone}/${state.releaseChecklist.length}`, `${reports.length} public reports`),
    ].join("");

    const coverage = [
      ["DEV-4", "Race发布、报名审核、RaceProject、Work、Judge结构流程", approved.length && works.length && state.judgingRecords.length],
      ["DEV-5", "CA登记握手、合法信号、隔离、Projection和Live Hall", state.caConnections.length && state.projections.length],
      ["DEV-6", "Screen Console模式切换和fallback", Boolean(state.screenDisplays[race.id])],
      ["DEV-7", "Award、Report、Results、Review公开联动", Boolean(state.awards.length && reports.length)],
      ["REL-1", "P0回归、彩排、灰度发布证据", checklistDone >= 3],
      ["OPS-1", "备份、事故记录、赛后归档入口", Boolean(state.backups.length || state.incidents.length || race.status === "archived")],
    ];

    $("#coverage-list").innerHTML = coverage
      .map(([id, text, done]) => {
        return `<div class="coverage-item">
          <strong>${escapeHtml(id)}</strong>
          <span>${escapeHtml(text)}</span>
          ${chip(done ? "covered" : "open", done ? "ok" : "warn")}
        </div>`;
      })
      .join("");

    $("#audit-list").innerHTML = state.auditLog
      .slice(0, 10)
      .map((entry) => `<div class="timeline-item"><time>${formatTime(entry.at)}</time><p>${escapeHtml(entry.message)}</p></div>`)
      .join("");
  }

  function metric(label, value, sub) {
    return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><span>${escapeHtml(sub)}</span></div>`;
  }

  function renderRace() {
    const rows = selectedRaceRegistrations()
      .map((registration) => {
        const user = getUser(registration.userId);
        const project = getProject(registration.id);
        const work = getWork(registration.id);
        const caCount = project ? state.caConnections.filter((connection) => connection.raceProjectId === project.id).length : 0;
        const action =
          registration.status === "pending"
            ? `<button class="button small" data-approve="${escapeHtml(registration.id)}">Approve</button>`
            : `<button class="button small" data-submit-work-for="${escapeHtml(registration.id)}">Submit Work</button>`;
        return `<tr>
          <td><strong>${escapeHtml(user ? user.displayName : registration.userId)}</strong><br>${escapeHtml(registration.id)}</td>
          <td>${chip(registration.status, statusVariant(registration.status))}</td>
          <td>${project ? chip(project.aggregateIngestionStatus, statusVariant(project.aggregateIngestionStatus)) : chip("missing", "warn")}</td>
          <td>${caCount} connection${caCount === 1 ? "" : "s"}</td>
          <td>${work ? `${escapeHtml(work.title)}<br>${chip(work.status, statusVariant(work.status))}` : chip("missing", "warn")}</td>
          <td>${action}</td>
        </tr>`;
      })
      .join("");
    $("#registration-table").innerHTML = rows || `<tr><td colspan="6">No registrations</td></tr>`;

    const workRegistrationSelect = $("#work-form select[name='registrationId']");
    workRegistrationSelect.innerHTML = selectedRaceRegistrations()
      .filter((registration) => registration.status === "approved")
      .map((registration) => {
        const user = getUser(registration.userId);
        return `<option value="${escapeHtml(registration.id)}">${escapeHtml(user ? user.displayName : registration.id)}</option>`;
      })
      .join("");

    $("#assignment-list").innerHTML =
      state.judgeAssignments
        .filter((assignment) => assignment.raceId === getRace().id)
        .map((assignment) => {
          const judge = getUser(assignment.judgeUserId);
          const work = state.works.find((item) => item.id === assignment.workId);
          const record = state.judgingRecords.find((item) => item.assignmentId === assignment.id);
          return miniCard(work ? work.title : assignment.workId, [
            chip(judge ? judge.displayName : assignment.judgeUserId, "info"),
            chip(assignment.status, statusVariant(assignment.status)),
            record ? chip(`score ${record.scoreResult}/${record.scoreRiding}`, "ok") : chip("record open", "warn"),
          ]);
        })
        .join("") || empty("No judge assignments");

    const judgingSelect = $("#judging-form select[name='assignmentId']");
    judgingSelect.innerHTML = state.judgeAssignments
      .filter((assignment) => assignment.raceId === getRace().id)
      .map((assignment) => {
        const work = state.works.find((item) => item.id === assignment.workId);
        return `<option value="${escapeHtml(assignment.id)}">${escapeHtml(work ? work.title : assignment.id)}</option>`;
      })
      .join("");
  }

  function renderCA() {
    const raceId = getRace().id;
    const connections = state.caConnections.filter((connection) => {
      const project = state.raceProjects.find((item) => item.id === connection.raceProjectId);
      const registration = project ? getRegistration(project.registrationId) : null;
      return registration && registration.raceId === raceId;
    });

    $("#ca-list").innerHTML =
      connections
        .map((connection) => {
          const project = state.raceProjects.find((item) => item.id === connection.raceProjectId);
          const registration = project ? getRegistration(project.registrationId) : null;
          const rider = registration ? getUser(registration.userId) : null;
          return miniCard(`${connection.caType} / ${connection.connectorId}`, [
            chip(rider ? rider.displayName : "unknown", "info"),
            chip(connection.ingestionStatus, statusVariant(connection.ingestionStatus)),
            chip(project ? project.connectionHealth : "no_project", statusVariant(project ? project.connectionHealth : "failed")),
            connection.handshakeAt ? chip("handshaked", "ok") : chip("no handshake", "warn"),
          ]);
        })
        .join("") || empty("No CA connections");

    const projection = domain.selectors.getLatestStableProjection(state, raceId);
    $("#projection-preview").innerHTML = projection
      ? projection.payload.entries
          .map((entry) => {
            return `<div class="projection-entry">
              <div>
                <strong>${escapeHtml(entry.riderName)}</strong>
                <div class="bar"><span style="width:${Math.max(0, Math.min(entry.progressPercent, 100))}%"></span></div>
              </div>
              <div>${chip(entry.ingestion, statusVariant(entry.ingestion))}</div>
            </div>`;
          })
          .join("") || empty("Projection has no entries")
      : empty("No stable projection");

    $("#flag-list").innerHTML =
      state.reviewFlags
        .filter((flag) => flag.raceId === raceId && flag.status !== "resolved")
        .map((flag) => miniCard(flag.type, [chip(flag.severity, statusVariant(flag.severity === "high" ? "failed" : "pending")), chip(flag.status, "warn")], flag.judgeVisibleSummary))
        .join("") || empty("No open review flags");

    $("#quarantine-list").innerHTML =
      state.quarantinedSignals
        .slice(0, 6)
        .map((item) => miniCard(item.reason, [chip(formatTime(item.receivedAt), "danger")]))
        .join("") || empty("No quarantined signals");
  }

  function renderScreen() {
    const race = getRace();
    const feed = domain.selectors.screenFeed(state, race.id);
    $("#screen-mode-buttons").innerHTML = domain.constants.SCREEN_MODES.map((mode) => {
      const active = mode === feed.mode ? "active" : "";
      return `<button class="button small ${active}" data-screen-mode="${escapeHtml(mode)}">${escapeHtml(mode)}</button>`;
    }).join("");

    const projection = feed.projection;
    const entries = projection && projection.payload.entries ? projection.payload.entries : [];
    let content = "";

    if (feed.mode === "leaderboard") {
      content = `<h3>${escapeHtml(race.title)}</h3><div class="screen-grid">${
        feed.leaderboard
          .map((row) => `<div class="screen-card"><strong>#${row.rank} ${escapeHtml(row.riderName)}</strong><p>${escapeHtml(row.workTitle || row.awardName)}</p></div>`)
          .join("") || `<div class="screen-card"><strong>No results</strong><p>Award publication is pending.</p></div>`
      }</div>`;
    } else if (feed.mode === "works") {
      content = `<h3>Works</h3><div class="screen-grid">${
        feed.works
          .map((work) => `<div class="screen-card"><strong>${escapeHtml(work.title)}</strong><p>${escapeHtml(work.summary)}</p></div>`)
          .join("") || `<div class="screen-card"><strong>No public work</strong><p>Submitted work is not public yet.</p></div>`
      }</div>`;
    } else if (feed.mode === "announcement") {
      content = `<h3>Announcements</h3><div class="screen-grid">${
        feed.announcements
          .map((item) => `<div class="screen-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p></div>`)
          .join("") || `<div class="screen-card"><strong>Stand by</strong><p>Operator announcement channel is open.</p></div>`
      }</div>`;
    } else if (feed.mode === "fallback") {
      content = `<h3>Fallback Active</h3><div class="screen-grid"><div class="screen-card"><strong>${escapeHtml(feed.fallback)}</strong><p>Stable projection or static display is being used.</p></div>${
        entries.slice(0, 2).map((entry) => `<div class="screen-card"><strong>${escapeHtml(entry.riderName)}</strong><p>${escapeHtml(entry.ingestion)} / ${entry.progressPercent}%</p></div>`).join("")
      }</div>`;
    } else {
      content = `<h3>Live Hall</h3><div class="screen-grid">${
        entries
          .slice(0, 6)
          .map((entry) => `<div class="screen-card"><strong>${escapeHtml(entry.riderName)}</strong><p>${escapeHtml(entry.ingestion)} · ${entry.progressPercent}% · ${entry.tokens} tokens</p></div>`)
          .join("") || `<div class="screen-card"><strong>Waiting</strong><p>Projection will appear after rebuild.</p></div>`
      }</div>`;
    }

    $("#screen-stage").innerHTML = content;
  }

  function renderReports() {
    const raceId = getRace().id;
    const leaderboard = domain.selectors.buildLeaderboard(state, raceId);
    $("#leaderboard-list").innerHTML =
      leaderboard
        .map((row) => `<div class="leaderboard-row"><div class="rank">#${row.rank}</div><div><strong>${escapeHtml(row.riderName)}</strong><p>${escapeHtml(row.workTitle || row.awardName)}</p>${chip(row.awardName, "ok")}</div></div>`)
        .join("") || empty("No published awards");

    const raceReports = state.reports.filter((report) => report.raceId === raceId);
    $("#report-list").innerHTML =
      raceReports
        .map((report) => {
          const actions = [
            chip(report.type, "info"),
            chip(report.status, statusVariant(report.status)),
            chip(report.visibility, report.visibility === "public" ? "ok" : "warn"),
          ];
          if (report.lastError) actions.push(chip(report.lastError, "danger"));
          return miniCard(report.id, actions, report.content || "No content");
        })
        .join("") || empty("No reports");

    const reportSelect = $("#report-form select[name='reportId']");
    const selectedReportId = reportSelect.value;
    reportSelect.innerHTML = raceReports
      .map((report) => `<option value="${escapeHtml(report.id)}">${escapeHtml(report.type)} / ${escapeHtml(report.status)}</option>`)
      .join("");
    if (selectedReportId && raceReports.some((report) => report.id === selectedReportId)) {
      reportSelect.value = selectedReportId;
    }
    const selected = raceReports.find((report) => report.id === reportSelect.value) || raceReports[0];
    $("#report-form textarea[name='content']").value = selected ? selected.content || "" : "";
  }

  function renderPublic() {
    const raceId = getRace().id;
    const leaderboard = domain.selectors.buildLeaderboard(state, raceId);
    $("#public-results").innerHTML =
      leaderboard.map((row) => miniCard(`#${row.rank} ${row.riderName}`, [chip(row.awardName, "ok")], row.decisionReason)).join("") ||
      empty("No public results");

    const reviewReports = domain.selectors
      .publicReports(state, raceId)
      .filter((report) => report.type === "review_summary");
    $("#public-review").innerHTML =
      reviewReports.map((report) => miniCard(report.type, [chip("published", "ok")], report.content)).join("") ||
      empty("No public review summary");

    const works = selectedRaceWorks().filter((work) => work.visibility === "public");
    $("#public-works").innerHTML =
      works.map((work) => miniCard(work.title, [chip(work.status, "ok"), chip("public", "ok")], work.summary)).join("") ||
      empty("No public works");
  }

  function renderOps() {
    $("#release-list").innerHTML = state.releaseChecklist
      .map((item) => {
        return `<div class="mini-card">
          <strong>${escapeHtml(item.label)}</strong>
          <p>${escapeHtml(item.evidence || "evidence pending")}</p>
          <div class="meta">
            ${chip(item.status, statusVariant(item.status))}
            <button class="button small" data-checklist="${escapeHtml(item.id)}">Done</button>
          </div>
        </div>`;
      })
      .join("");

    $("#incident-list").innerHTML =
      state.incidents
        .map((incident) => miniCard(incident.impact, [chip(formatTime(incident.occurredAt), "warn"), chip(incident.action, "info")], incident.followUp))
        .join("") || empty("No incidents");

    $("#backup-list").innerHTML =
      state.backups
        .map((backup) => miniCard(backup.scope, [chip(backup.status, "ok")], backup.evidence))
        .join("") || empty("No backups");
  }

  function renderAdmin() {
    $("#user-table").innerHTML = state.users
      .map((user) => {
        const roles = domain.constants.ROLES.map((role) => {
          const active = user.roles.includes(role) ? "active" : "";
          return `<button class="role-toggle ${active}" data-user-role="${escapeHtml(user.id)}:${escapeHtml(role)}">${escapeHtml(role)}</button>`;
        }).join(" ");
        return `<tr>
          <td><strong>${escapeHtml(user.displayName)}</strong><br>${escapeHtml(user.city)}</td>
          <td>${escapeHtml(user.githubLogin)}</td>
          <td>${chip(user.profileCompleted ? "complete" : "missing", user.profileCompleted ? "ok" : "warn")}</td>
          <td>${roles}</td>
        </tr>`;
      })
      .join("");
  }

  function miniCard(title, chips, body) {
    return `<div class="mini-card"><strong>${escapeHtml(title)}</strong>${body ? `<p>${escapeHtml(body)}</p>` : ""}<div class="meta">${chips.join("")}</div></div>`;
  }

  function empty(text) {
    return `<div class="empty">${escapeHtml(text)}</div>`;
  }

  function action(name, payload) {
    const race = getRace();
    switch (name) {
      case "run-p0":
        return commit(domain.actions.runP0Regression(state, { raceId: race.id, actorId: activeActor() }));
      case "reset-state":
        state = domain.createInitialState();
        saveState();
        render();
        return notify("Seed state restored");
      case "publish-race":
        return commit(domain.actions.publishRace(state, { raceId: race.id, actorId: activeActor(), nextStatus: "registration" }));
      case "approve-first": {
        const pending = selectedRaceRegistrations().find((registration) => registration.status === "pending");
        return commit(pending ? domain.actions.approveRegistration(state, { registrationId: pending.id, actorId: activeActor() }) : { ok: true, message: "No pending registration" });
      }
      case "submit-sample-registration": {
        const candidate = state.users.find((user) => user.roles.includes("rider") && !domain.selectors.getRegistrationForUserRace(state, user.id, race.id));
        return commit(candidate ? domain.actions.submitRegistration(state, { raceId: race.id, userId: candidate.id }) : { ok: true, message: "No sample rider available" });
      }
      case "assign-first-judge": {
        const work = firstSubmittedWork();
        const judge = state.users.find((user) => user.roles.includes("judge"));
        return commit(work && judge ? domain.actions.assignJudge(state, { workId: work.id, judgeUserId: judge.id, actorId: activeActor() }) : { ok: false, message: "Need submitted work and judge" });
      }
      case "register-ca": {
        const registration = selectedRaceRegistrations().find((item) => item.status === "approved");
        const project = registration && getProject(registration.id);
        if (!project) return commit({ ok: false, message: "Need approved Registration with RaceProject" });
        const registered = domain.actions.registerCAConnection(state, {
          raceProjectId: project.id,
          actorId: activeActor(),
          caType: "codex",
          connectorId: `codex-${Date.now().toString().slice(-4)}`,
          externalProjectRef: `ca-${project.id}`,
        });
        if (registered.ok) {
          domain.actions.handshakeCAConnection(state, { caConnectionId: registered.caConnectionId, actorId: activeActor() });
        }
        return commit({ ok: registered.ok, message: registered.ok ? "CAConnection已登记并握手" : registered.message });
      }
      case "accept-signal": {
        const connection = state.caConnections.find((item) => {
          const project = state.raceProjects.find((candidate) => candidate.id === item.raceProjectId);
          const registration = project && getRegistration(project.registrationId);
          return registration && registration.raceId === race.id && item.handshakeAt && !item.disabledAt;
        });
        if (!connection) return commit({ ok: false, message: "Need handshaked CAConnection" });
        const project = state.raceProjects.find((item) => item.id === connection.raceProjectId);
        const registration = getRegistration(project.registrationId);
        return commit(
          domain.actions.ingestRidingSignal(state, {
            schemaVersion: "ary.ca.riding_signal.v0.1",
            messageId: `msg-${Date.now()}`,
            idempotencyKey: `ui:${connection.id}:${Date.now()}`,
            sequence: Date.now(),
            timestamp: new Date().toISOString(),
            race: { raceId: race.id, taskId: race.taskId },
            rider: { registrationId: registration.id, raceProjectId: project.id },
            ca: {
              caConnectionId: connection.id,
              caType: connection.caType,
              connectorId: connection.connectorId,
              connectorVersion: connection.connectorVersion,
              caProjectId: connection.externalProjectRef,
              caSessionId: "ui-live-session",
            },
            signal: {
              kind: "note",
              type: "task_progress",
              phase: "riding",
              taskStatus: "in_progress",
              progressPercent: Math.min(100, (project.metrics.progressPercent || 0) + 24),
            },
            counters: {
              tokens: (project.metrics.tokens || 0) + 3200,
              messageCount: (project.metrics.messageCount || 0) + 36,
              toolCallCount: (project.metrics.toolCallCount || 0) + 7,
            },
          })
        );
      }
      case "reject-signal":
        return commit(
          domain.actions.ingestRidingSignal(state, {
            schemaVersion: "ary.ca.riding_signal.v0.1",
            messageId: `bad-${Date.now()}`,
            idempotencyKey: `bad:${Date.now()}`,
            timestamp: new Date().toISOString(),
            race: { raceId: race.id, taskId: race.taskId },
            rider: { registrationId: "wrong_reg", raceProjectId: "wrong_project" },
            ca: {
              caConnectionId: "unregistered_conn",
              caType: "codex",
              connectorId: "invalid",
              connectorVersion: "0.1.0",
              caProjectId: "invalid",
              caSessionId: "invalid",
            },
            signal: { kind: "event", type: "task_progress", phase: "riding" },
          })
        );
      case "rebuild-projection":
        return commit(domain.actions.rebuildProjection(state, { raceId: race.id, actorId: activeActor() }));
      case "fail-projection":
        return commit(domain.actions.rebuildProjection(state, { raceId: race.id, actorId: activeActor(), forceFail: true }));
      case "publish-award": {
        const work = firstSubmittedWork();
        const registration = work ? getRegistration(work.registrationId) : selectedRaceRegistrations().find((item) => item.status === "approved");
        return commit(
          registration
            ? domain.actions.publishAward(state, {
                raceId: race.id,
                registrationId: registration.id,
                workId: work ? work.id : null,
                awardName: "Grand Prize",
                rank: 1,
                decisionReason: "Best combined result and evidence package.",
                actorId: activeActor(),
              })
            : { ok: false, message: "Need approved registration" }
        );
      }
      case "generate-reports": {
        const raceReport = domain.actions.generateReport(state, { raceId: race.id, type: "race_report", actorId: activeActor() });
        const reviewReport = domain.actions.generateReport(state, { raceId: race.id, type: "review_summary", actorId: activeActor() });
        if (raceReport.ok) domain.actions.publishReport(state, { reportId: raceReport.reportId, actorId: activeActor() });
        if (reviewReport.ok) domain.actions.publishReport(state, { reportId: reviewReport.reportId, actorId: activeActor() });
        return commit({ ok: raceReport.ok && reviewReport.ok, message: "Reports generated and public reports published" });
      }
      case "simulate-report-fail":
        return commit(domain.actions.generateReport(state, { raceId: race.id, type: "race_report", actorId: activeActor(), forceFail: true }));
      case "publish-selected-report": {
        const reportId = $("#report-form select[name='reportId']").value;
        return commit(reportId ? domain.actions.publishReport(state, { reportId, actorId: activeActor() }) : { ok: false, message: "No selected report" });
      }
      case "mark-all-release": {
        state.releaseChecklist.forEach((item) => {
          domain.actions.markChecklistItem(state, {
            id: item.id,
            raceId: race.id,
            actorId: activeActor(),
            status: "done",
            evidence: `${item.label} completed in local MVP.`,
          });
        });
        domain.actions.createBackup(state, { raceId: race.id, actorId: activeActor(), scope: "release_ready_snapshot" });
        return commit({ ok: true, message: "Release checklist marked ready" });
      }
      case "record-incident":
        return commit(
          domain.actions.recordIncident(state, {
            raceId: race.id,
            actorId: activeActor(),
            impact: "Screen Console degraded",
            action: "fallback_to_stable_projection",
            fallbackTriggered: true,
            followUp: "Confirm venue browser and network before next run.",
          })
        );
      case "archive-race":
        return commit(domain.actions.archiveRace(state, { raceId: race.id, actorId: activeActor() }));
      default:
        return commit({ ok: false, message: `Unknown action ${name}` });
    }
  }

  function handleWorkForm(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    commit(
      domain.actions.submitWork(state, {
        registrationId: data.get("registrationId"),
        actorId: activeActor(),
        title: data.get("title"),
        summary: data.get("summary"),
        demoUrl: data.get("demoUrl"),
        repoUrl: data.get("repoUrl"),
      })
    );
  }

  function handleJudgingForm(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    commit(
      domain.actions.submitJudgingRecord(state, {
        assignmentId: data.get("assignmentId"),
        actorId: activeActor(),
        scoreResult: data.get("scoreResult"),
        scoreRiding: data.get("scoreRiding"),
        comments: data.get("comments"),
      })
    );
  }

  function handleReportForm(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    commit(
      domain.actions.editReport(state, {
        reportId: data.get("reportId"),
        content: data.get("content"),
        actorId: activeActor(),
      })
    );
  }

  function bindEvents() {
    window.addEventListener("hashchange", renderNav);

    $("#user-select").addEventListener("change", (event) => {
      const user = getUser(event.target.value);
      commit(domain.actions.setCurrentUser(state, { userId: user.id, role: user.roles[0] }));
    });

    $("#role-select").addEventListener("change", (event) => {
      commit(domain.actions.setCurrentUser(state, { userId: state.meta.currentUserId, role: event.target.value }));
    });

    document.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-action]");
      if (actionButton) {
        action(actionButton.dataset.action);
        return;
      }

      const approve = event.target.closest("[data-approve]");
      if (approve) {
        commit(domain.actions.approveRegistration(state, { registrationId: approve.dataset.approve, actorId: activeActor() }));
        return;
      }

      const submitFor = event.target.closest("[data-submit-work-for]");
      if (submitFor) {
        const registrationId = submitFor.dataset.submitWorkFor;
        $("#work-form select[name='registrationId']").value = registrationId;
        window.location.hash = "#race";
        notify("Work form focused for selected Registration");
        return;
      }

      const screenMode = event.target.closest("[data-screen-mode]");
      if (screenMode) {
        commit(
          domain.actions.switchScreenMode(state, {
            raceId: getRace().id,
            actorId: activeActor(),
            mode: screenMode.dataset.screenMode,
          })
        );
        return;
      }

      const checklist = event.target.closest("[data-checklist]");
      if (checklist) {
        commit(
          domain.actions.markChecklistItem(state, {
            id: checklist.dataset.checklist,
            raceId: getRace().id,
            actorId: activeActor(),
            status: "done",
            evidence: "Confirmed in local MVP run.",
          })
        );
        return;
      }

      const roleToggle = event.target.closest("[data-user-role]");
      if (roleToggle) {
        const [userId, role] = roleToggle.dataset.userRole.split(":");
        const user = getUser(userId);
        const nextRoles = new Set(user.roles);
        if (nextRoles.has(role)) nextRoles.delete(role);
        else nextRoles.add(role);
        commit(
          domain.actions.updateUserRoles(state, {
            actorId: activeActor(),
            userId,
            roles: Array.from(nextRoles),
          })
        );
      }
    });

    $("#work-form").addEventListener("submit", handleWorkForm);
    $("#judging-form").addEventListener("submit", handleJudgingForm);
    $("#report-form").addEventListener("submit", handleReportForm);
    $("#report-form select[name='reportId']").addEventListener("change", renderReports);
  }

  bindEvents();
  if (!window.location.hash) window.location.hash = "#overview";
  render();
})();
