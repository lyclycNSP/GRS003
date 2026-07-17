import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActionOutcomePanel } from "../app/components/ui/ActionOutcomePanel";
import { PendingActionButton } from "../app/components/ui/PendingActionButton";

const successMarkup = renderToStaticMarkup(
  <ActionOutcomePanel
    actionCode="registration-approved"
    description="报名已从待审核队列移入参赛选手库。"
    entity={{ label: "参赛者", value: "Mira Chen" }}
    nextAction={<a href="/participants">进入选手库</a>}
    outcome="success"
    title="审核通过"
  />,
);

assert.match(successMarkup, /role="status"/);
assert.match(successMarkup, /aria-live="polite"/);
assert.match(successMarkup, /data-action-code="registration-approved"/);
assert.match(successMarkup, /data-outcome="success"/);
assert.match(successMarkup, /进入选手库/);
assert.match(successMarkup, /Mira Chen/);

const errorMarkup = renderToStaticMarkup(
  <ActionOutcomePanel actionCode="judge-pool-invalid" outcome="error" title="Judge 池人数不足" />,
);
assert.match(errorMarkup, /role="alert"/);
assert.match(errorMarkup, /aria-live="assertive"/);

const idleButtonMarkup = renderToStaticMarkup(
  <PendingActionButton label="审核通过" pendingLabel="正在审核…" testId="approve-registration" />,
);
assert.match(idleButtonMarkup, /type="submit"/);
assert.match(idleButtonMarkup, /aria-busy="false"/);
assert.match(idleButtonMarkup, /data-testid="approve-registration"/);
assert.match(idleButtonMarkup, /审核通过/);

const pendingButtonMarkup = renderToStaticMarkup(
  <PendingActionButton isPending label="审核通过" pendingLabel="正在审核…" />,
);
assert.match(pendingButtonMarkup, /aria-busy="true"/);
assert.match(pendingButtonMarkup, /disabled=""/);
assert.match(pendingButtonMarkup, /正在审核…/);

const actionsSource = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
const controlledCodes = [
  "ca-registered", "ca-register-failed", "ca-handshake-completed", "ca-handshake-failed",
  "ca-signal-ingested", "ca-signal-ingest-failed", "ca-signal-mock-disabled", "ca-disabled", "ca-disable-failed",
  "work-published", "work-publish-failed", "award-published", "award-publish-failed",
  "report-generated", "report-generate-failed", "report-edited", "report-edit-failed",
  "report-regenerated", "report-regenerate-failed", "report-failure-recorded", "report-failure-record-failed",
  "report-published", "report-publish-failed", "projection-rebuilt", "projection-rebuild-failed",
  "projection-failure-recorded", "projection-failure-record-failed", "backup-created", "backup-create-failed",
  "p0-completed", "p0-failed", "release-checklist-updated", "release-checklist-update-failed",
  "go-no-go-recorded", "go-no-go-record-failed", "canary-ready", "canary-ready-failed",
  "production-released", "production-release-failed"
];
for (const code of controlledCodes) assert.ok(actionsSource.includes(`"${code}"`), `missing controlled action code ${code}`);

for (const actionName of [
  "registerCAAction", "handshakeCAAction", "ingestSignalAction", "disableCAConnectionAction", "publishWorkAction",
  "publishAwardAction", "generateReportAction", "editReportAction", "regenerateReportAction", "simulateReportFailureAction",
  "publishReportAction", "rebuildProjectionAction", "simulateProjectionFailureAction", "createBackupAction", "runP0Action",
  "markReleaseChecklistItemAction", "recordGoNoGoAction", "markCanaryReadyAction", "markProductionReleasedAction"
]) {
  const body = actionsSource.match(new RegExp(`export async function ${actionName}\\([\\s\\S]*?(?=\\nexport async function|$)`))?.[0];
  assert.ok(body, `missing action ${actionName}`);
  assert.doesNotMatch(body, /if \(!result\.ok\) throw new Error/);
}

console.log("action feedback component tests passed");
