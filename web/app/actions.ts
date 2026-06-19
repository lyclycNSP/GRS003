"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import {
  approveRegistration,
  assignJudge,
  createBackup,
  createRace,
  disableCAConnection,
  editReport,
  generateReport,
  handshakeCAConnection,
  ingestRidingSignal,
  markCanaryReady,
  markProductionReleased,
  markReleaseChecklistItem,
  publishAnnouncement,
  publishAward,
  publishRace,
  publishReport,
  publishWork,
  rebuildProjection,
  regenerateReport,
  recordGoNoGo,
  registerCAConnection,
  runP0Regression,
  simulateProjectionFailure,
  simulateReportFailure,
  submitJudgingRecord,
  submitRegistration,
  submitWork,
  switchScreenMode,
  toggleScreenFallback,
  updateProfile,
  updateUserRoles
} from "@/lib/domain";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function refresh(path = "/console") {
  revalidatePath("/");
  revalidatePath("/console");
  revalidatePath("/ops");
  revalidatePath(path);
}


export async function createRaceAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await createRace(ctx, {
    title: value(formData, "title"),
    challenge: value(formData, "challenge"),
    summary: value(formData, "summary")
  });
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}

export async function publishRaceAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await publishRace(ctx, value(formData, "raceId"));
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}
export async function submitRegistrationAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await submitRegistration(ctx, value(formData, "raceId"));
  refresh("/");
  if (!result.ok) throw new Error(result.message);
}

export async function approveRegistrationAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await approveRegistration(ctx, value(formData, "registrationId"));
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}

export async function registerCAAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await registerCAConnection(ctx, value(formData, "raceProjectId"));
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}

export async function handshakeCAAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await handshakeCAConnection(ctx, value(formData, "caConnectionId"));
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}

export async function ingestSignalAction(formData: FormData) {
  const result = await ingestRidingSignal({
    raceId: value(formData, "raceId"),
    registrationId: value(formData, "registrationId"),
    raceProjectId: value(formData, "raceProjectId"),
    caConnectionId: value(formData, "caConnectionId"),
    idempotencyKey: `ui:${Date.now()}`,
    caSessionId: value(formData, "caSessionId") || "ui-session",
    progressPercent: Number(value(formData, "progressPercent") || 100),
    tokens: Number(value(formData, "tokens") || 12000)
  });
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}


export async function disableCAConnectionAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await disableCAConnection(ctx, value(formData, "caConnectionId"));
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}
export async function submitWorkAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await submitWork(ctx, value(formData, "registrationId"), {
    title: value(formData, "title"),
    summary: value(formData, "summary"),
    demoUrl: value(formData, "demoUrl"),
    repoUrl: value(formData, "repoUrl")
  });
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}

export async function publishWorkAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await publishWork(ctx, value(formData, "workId"));
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}

export async function assignJudgeAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await assignJudge(ctx, value(formData, "workId"), value(formData, "judgeUserId"));
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}

export async function submitJudgingRecordAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await submitJudgingRecord(ctx, value(formData, "assignmentId"), {
    scoreResult: Number(value(formData, "scoreResult") || 0),
    scoreRiding: Number(value(formData, "scoreRiding") || 0),
    comments: value(formData, "comments")
  });
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}

export async function publishAwardAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await publishAward(ctx, {
    raceId: value(formData, "raceId"),
    registrationId: value(formData, "registrationId"),
    workId: value(formData, "workId") || undefined,
    awardName: value(formData, "awardName") || "Grand Prize",
    rank: Number(value(formData, "rank") || 1),
    reason: value(formData, "reason") || "Best combined result and riding evidence package."
  });
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}

export async function generateReportAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await generateReport(ctx, {
    raceId: value(formData, "raceId"),
    type: value(formData, "type"),
    subjectRegistrationId: value(formData, "subjectRegistrationId") || undefined
  });
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}


export async function editReportAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await editReport(ctx, value(formData, "reportId"), value(formData, "content"));
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}

export async function regenerateReportAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await regenerateReport(ctx, value(formData, "reportId"));
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}

export async function simulateReportFailureAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await simulateReportFailure(ctx, {
    raceId: value(formData, "raceId"),
    type: value(formData, "type") || "race_report",
    subjectRegistrationId: value(formData, "subjectRegistrationId") || undefined
  });
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}
export async function publishReportAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await publishReport(ctx, value(formData, "reportId"));
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}

export async function rebuildProjectionAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await rebuildProjection(ctx, value(formData, "raceId"));
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}


export async function simulateProjectionFailureAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await simulateProjectionFailure(ctx, value(formData, "raceId"));
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}
export async function createBackupAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await createBackup(ctx, value(formData, "raceId"), value(formData, "scope") || "manual_snapshot");
  refresh("/ops");
  if (!result.ok) throw new Error(result.message);
}

export async function runP0Action(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await runP0Regression(ctx, value(formData, "raceId"));
  refresh("/ops");
  if (!result.ok) throw new Error(result.message);
}


export async function switchScreenModeAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await switchScreenMode(ctx, value(formData, "raceId"), value(formData, "mode"));
  refresh("/screen");
  if (!result.ok) throw new Error(result.message);
}

export async function toggleScreenFallbackAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await toggleScreenFallback(ctx, value(formData, "raceId"), value(formData, "enabled") === "true");
  refresh("/screen");
  if (!result.ok) throw new Error(result.message);
}

export async function publishAnnouncementAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await publishAnnouncement(ctx, {
    raceId: value(formData, "raceId"),
    title: value(formData, "title"),
    body: value(formData, "body")
  });
  refresh("/screen");
  if (!result.ok) throw new Error(result.message);
}
export async function updateRolesAction(formData: FormData) {
  const ctx = await getAuthContext();
  const roles = ["rider", "judge", "organizer", "admin"].filter((role) => formData.get(role));
  const result = await updateUserRoles(ctx, value(formData, "userId"), roles);
  refresh("/console");
  if (!result.ok) throw new Error(result.message);
}


export async function markReleaseChecklistItemAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await markReleaseChecklistItem(ctx, {
    raceId: value(formData, "raceId"),
    itemKey: value(formData, "itemKey"),
    label: value(formData, "label") || undefined,
    status: value(formData, "status") || "done",
    evidence: value(formData, "evidence")
  });
  refresh("/ops");
  if (!result.ok) throw new Error(result.message);
}

export async function recordGoNoGoAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await recordGoNoGo(ctx, value(formData, "raceId"), value(formData, "evidence"));
  refresh("/ops");
  if (!result.ok) throw new Error(result.message);
}

export async function markCanaryReadyAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await markCanaryReady(ctx, value(formData, "raceId"), value(formData, "evidence"));
  refresh("/ops");
  if (!result.ok) throw new Error(result.message);
}

export async function markProductionReleasedAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await markProductionReleased(ctx, value(formData, "raceId"), value(formData, "evidence"));
  refresh("/ops");
  if (!result.ok) throw new Error(result.message);
}
export async function updateProfileAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await updateProfile(ctx, {
    displayName: value(formData, "displayName"),
    city: value(formData, "city"),
    githubLogin: value(formData, "githubLogin")
  });
  refresh("/profile");
  if (!result.ok) throw new Error(result.message);
  redirect("/console");
}

export async function goConsole() {
  redirect("/console");
}
