"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSession, getAuthContext, isRole, switchActiveRole } from "@/lib/auth";
import { createRidingSignalAttestation, type RidingSignalPayload } from "@/lib/ca-attestation";
import { makeId } from "@/lib/ids";
import { buildLoginPath } from "@/lib/login-redirect";
import { prisma } from "@/lib/prisma";
import { configureScreenRotation, moveScreenDisplayGroup, pauseScreenRotation, resumeScreenRotation } from "@/lib/race-live/controls";
import {
  createRaceRound,
  finishRaceRound,
  moveRaceRoundEntry,
  prepareRaceLive,
  refreshRaceLive,
  setRaceRoundEntryStatus,
  syncRaceRoundRoster
} from "@/lib/race-live/management";
import { publishTrackProfileVersion } from "@/lib/track-calibrator/publish";
import { archiveTrackProfileVersion, deleteArchivedTrackProfileVersion } from "@/lib/track-calibrator/version-lifecycle";
import {
  approveRegistration,
  rejectRegistration,
  allocateRaceJudges,
  bindTrackVersionToRound,
  assignJudge,
  publishRaceReviewResults,
  saveRaceJudgePool,
  createBackup,
  createRace,
  configureSubmissionWindow,
  curateHomepageRace,
  createTeam,
  disableCAConnection,
  editReport,
  generateReport,
  handshakeCAConnection,
  ingestRidingSignal,
  joinTeam,
  leaveTeam,
  markCanaryReady,
  markProductionReleased,
  markReleaseChecklistItem,
  publishAnnouncement,
  publishAward,
  publishRace,
  publishReport,
  publishWork,
  lockSubmissionWindow,
  rebuildProjection,
  removeTeamMember,
  regenerateReport,
  recordGoNoGo,
  registerCAConnection,
  runP0Regression,
  reopenSubmissionWindow,
  simulateProjectionFailure,
  simulateReportFailure,
  submitJudgingRecord,
  submitRegistration,
  submitTeamRegistration,
  submitWork,
  selectRole,
  saveRoleProfileDraft,
  submitRoleProfile,
  withdrawRoleApplication,
  reviewRoleApplication,
  setUserRoleStatus,
  switchScreenMode,
  toggleScreenFallback,
  updateTeam,
  updateReviewFlagStatus,
  updateProfile
} from "@/lib/domain";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true" || formData.get(key) === "1";
}

export async function curateHomepageRaceAction(formData: FormData) {
  const raceId = value(formData, "raceId");
  const curationAction = value(formData, "curationAction");
  const result = await curateHomepageRace(await getAuthContext(), raceId, curationAction);
  if (!result.ok) redirect(`/console/admin?action=curation-failed&actionError=${encodeURIComponent(result.message)}#homepage-curation`);
  revalidatePath("/");
  revalidatePath("/console/admin");
  const codes: Record<string, string> = {
    pin: "curation-pinned", unpin: "curation-unpinned", hide: "curation-hidden",
    show: "curation-restored", up: "curation-moved-up", down: "curation-moved-down"
  };
  redirect(`/console/admin?action=${codes[curationAction] ?? "curation-updated"}&entityId=${encodeURIComponent(raceId)}#homepage-curation`);
}

function roleProfileInput(formData: FormData) {
  return {
    headline: value(formData, "headline"), skills: value(formData, "skills"), bio: value(formData, "bio"),
    countryCode: value(formData, "countryCode"), city: value(formData, "city"), organization: value(formData, "organization"),
    websiteUrl: value(formData, "websiteUrl"), linkedinUrl: value(formData, "linkedinUrl"), xUrl: value(formData, "xUrl"),
    title: value(formData, "title"), expertise: value(formData, "expertise"), reviewBio: value(formData, "reviewBio"),
    yearsExperience: value(formData, "yearsExperience"), credentialUrl: value(formData, "credentialUrl"), conflictConfirmed: checked(formData, "conflictConfirmed"),
    organizationName: value(formData, "organizationName"), position: value(formData, "position"),
    eventCategories: value(formData, "eventCategories"), organizerBio: value(formData, "organizerBio"), organizationWebsite: value(formData, "organizationWebsite")
  };
}

function refresh(path = "/console") {
  revalidatePath("/");
  revalidatePath("/console");
  revalidatePath("/console/risk-center");
  revalidatePath("/ops");
  revalidatePath(path);
}

function consoleRedirect(raceId: string, message: string) {
  redirect(`/console?raceId=${encodeURIComponent(raceId)}&actionMessage=${encodeURIComponent(message)}`);
}

type ActionResult = { ok: true; message: string; id?: string } | { ok: false; message: string };

function actionResultRedirect(
  destination: string,
  result: ActionResult,
  successCode: string,
  failureCode: string,
  entityId?: string,
  anchor = ""
) {
  const separator = destination.includes("?") ? "&" : "?";
  const code = result.ok ? successCode : failureCode;
  const detailKey = result.ok ? "entityId" : "actionError";
  const detail = result.ok ? entityId ?? result.id ?? "" : result.message;
  redirect(`${destination}${separator}action=${encodeURIComponent(code)}&${detailKey}=${encodeURIComponent(detail)}${anchor}`);
}

function roleWorkspaceDestination(activeRole: string | null | undefined, raceId?: string | null) {
  if (!raceId) return "/console";
  if (activeRole === "organizer") return `/console/organizer/races/${encodeURIComponent(raceId)}`;
  if (activeRole === "rider") return `/console/rider/races/${encodeURIComponent(raceId)}`;
  if (activeRole === "judge") return "/console/judge";
  if (activeRole === "admin") return "/console/admin";
  return "/console";
}

async function raceIdForRaceProject(raceProjectId: string) {
  return (await prisma.raceProject.findUnique({
    where: { id: raceProjectId }, select: { registration: { select: { raceId: true } } }
  }))?.registration.raceId;
}

async function raceIdForConnection(caConnectionId: string) {
  return (await prisma.cAConnection.findUnique({
    where: { id: caConnectionId }, select: { raceProject: { select: { registration: { select: { raceId: true } } } } }
  }))?.raceProject.registration.raceId;
}

async function raceIdForWork(workId: string) {
  return (await prisma.work.findUnique({
    where: { id: workId }, select: { registration: { select: { raceId: true } } }
  }))?.registration.raceId;
}

async function raceIdForReport(reportId: string) {
  return (await prisma.report.findUnique({ where: { id: reportId }, select: { raceId: true } }))?.raceId;
}

function utcDate(formData: FormData, key: string) {
  const raw = value(formData, key);
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}


export async function createRaceAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(buildLoginPath("/console/organizer"));
  if (ctx.activeRole !== "organizer") {
    const currentRole = ctx.activeRole ?? "未选择";
    redirect(`/console?action=race-create-failed&actionError=${encodeURIComponent(`当前会话角色为 ${currentRole}；创建 Race 需要 organizer，请切换角色后重试。`)}`);
  }
  const result = await createRace(ctx, {
    title: value(formData, "title"),
    challenge: value(formData, "challenge"),
    summary: value(formData, "summary")
  });
  refresh("/console/organizer");
  if (!result.ok) redirect(`/console/organizer?action=race-create-failed&actionError=${encodeURIComponent(result.message)}`);
  if (!result.id) redirect("/console/organizer?action=race-create-failed&actionError=Race%20%E5%B7%B2%E5%88%9B%E5%BB%BA%EF%BC%8C%E4%BD%86%E6%9C%AA%E8%BF%94%E5%9B%9E%E8%B5%84%E6%BA%90%20ID%E3%80%82");
  redirect(`/console/organizer/races/${encodeURIComponent(result.id)}?action=race-created&entityId=${encodeURIComponent(result.id)}`);
}

export async function publishRaceAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await publishRace(ctx, raceId);
  const destination = `/console/organizer/races/${encodeURIComponent(raceId)}`;
  refresh(destination);
  if (!result.ok) redirect(`${destination}?action=race-publish-failed&actionError=${encodeURIComponent(result.message)}`);
  redirect(`${destination}?action=race-published&entityId=${encodeURIComponent(raceId)}`);
}
export async function submitRegistrationAction(formData: FormData) {
  const raceSlug = value(formData, "raceSlug");
  const destination = raceSlug ? `/races/${encodeURIComponent(raceSlug)}` : "/";
  const ctx = await getAuthContext();
  if (!ctx) redirect(buildLoginPath(destination));
  if (ctx.activeRole !== "rider") {
    redirect(`${destination}?registrationError=${encodeURIComponent(`当前角色为 ${ctx.activeRole ?? "未选择"}，请切换到 Rider 后报名`)}`);
  }
  const result = await submitRegistration(ctx, value(formData, "raceId"));
  refresh(destination);
  if (!result.ok) redirect(`${destination}?registrationError=${encodeURIComponent(result.message)}`);
  redirect(`${destination}?registrationMessage=${encodeURIComponent(result.message)}`);
}

export async function createTeamAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const raceSlug = value(formData, "raceSlug");
  const failurePath = raceSlug ? `/races/${encodeURIComponent(raceSlug)}` : `/console/rider?raceId=${encodeURIComponent(raceId)}`;
  const result = await createTeam(ctx, {
    raceId,
    name: value(formData, "name"),
    description: value(formData, "description"),
    maxMembers: Number(value(formData, "maxMembers") || "5")
  });
  refresh(failurePath);
  if (!result.ok) redirect(`${failurePath}${failurePath.includes("?") ? "&" : "?"}actionError=${encodeURIComponent(result.message)}&registrationError=${encodeURIComponent(result.message)}`);
  redirect(`/console/rider?raceId=${encodeURIComponent(raceId)}&actionMessage=${encodeURIComponent(result.message)}`);
}

export async function joinTeamAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const raceSlug = value(formData, "raceSlug");
  const failurePath = raceSlug ? `/races/${encodeURIComponent(raceSlug)}` : `/console/rider?raceId=${encodeURIComponent(raceId)}`;
  const result = await joinTeam(ctx, raceId, value(formData, "inviteCode"));
  refresh(failurePath);
  if (!result.ok) redirect(`${failurePath}${failurePath.includes("?") ? "&" : "?"}actionError=${encodeURIComponent(result.message)}&registrationError=${encodeURIComponent(result.message)}`);
  redirect(`/console/rider?raceId=${encodeURIComponent(raceId)}&actionMessage=${encodeURIComponent(result.message)}`);
}

export async function updateTeamAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const destination = `/console/rider?raceId=${encodeURIComponent(raceId)}`;
  const result = await updateTeam(ctx, value(formData, "teamId"), {
    name: value(formData, "name"),
    description: value(formData, "description"),
    maxMembers: Number(value(formData, "maxMembers"))
  });
  refresh(destination);
  redirect(`${destination}&${result.ok ? "actionMessage" : "actionError"}=${encodeURIComponent(result.message)}`);
}

export async function leaveTeamAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const destination = `/console/rider?raceId=${encodeURIComponent(raceId)}`;
  const result = await leaveTeam(ctx, value(formData, "teamId"));
  refresh(destination);
  redirect(`${destination}&${result.ok ? "actionMessage" : "actionError"}=${encodeURIComponent(result.message)}`);
}

export async function removeTeamMemberAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const destination = `/console/rider?raceId=${encodeURIComponent(raceId)}`;
  const result = await removeTeamMember(ctx, value(formData, "teamId"), value(formData, "userId"));
  refresh(destination);
  redirect(`${destination}&${result.ok ? "actionMessage" : "actionError"}=${encodeURIComponent(result.message)}`);
}

export async function submitTeamRegistrationAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const destination = `/console/rider?raceId=${encodeURIComponent(raceId)}`;
  const result = await submitTeamRegistration(ctx, value(formData, "teamId"));
  refresh(destination);
  redirect(`${destination}&${result.ok ? "actionMessage" : "actionError"}=${encodeURIComponent(result.message)}`);
}

export async function approveRegistrationAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await approveRegistration(ctx, value(formData, "registrationId"));
  const destination = raceId ? `/console/organizer/races/${encodeURIComponent(raceId)}` : "/console/organizer";
  refresh(destination);
  redirect(`${destination}?${result.ok ? "action=registration-approved" : "action=registration-approve-failed"}&${result.ok ? "entityId" : "actionError"}=${encodeURIComponent(result.ok ? value(formData, "registrationId") : result.message)}`);
}

export async function rejectRegistrationAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await rejectRegistration(ctx, value(formData, "registrationId"), value(formData, "reason"));
  const destination = raceId ? `/console/organizer/races/${encodeURIComponent(raceId)}` : "/console/organizer";
  refresh(destination);
  redirect(`${destination}?${result.ok ? "action=registration-rejected" : "action=registration-reject-failed"}&${result.ok ? "entityId" : "actionError"}=${encodeURIComponent(result.ok ? value(formData, "registrationId") : result.message)}`);
}

export async function registerCAAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceProjectId = value(formData, "raceProjectId");
  const raceId = await raceIdForRaceProject(raceProjectId);
  const result = await registerCAConnection(ctx, raceProjectId);
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "ca-registered", "ca-register-failed", result.ok ? result.id : undefined, "#ca-workspace");
}

export async function handshakeCAAction(formData: FormData) {
  const ctx = await getAuthContext();
  const caConnectionId = value(formData, "caConnectionId");
  const raceId = await raceIdForConnection(caConnectionId);
  const result = await handshakeCAConnection(ctx, caConnectionId);
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "ca-handshake-completed", "ca-handshake-failed", caConnectionId, "#ca-workspace");
}

export async function ingestSignalAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  if (process.env.NODE_ENV === "production") {
    actionResultRedirect(destination, { ok: false, message: "浏览器模拟CA信号在生产环境中已禁用" }, "ca-signal-ingested", "ca-signal-mock-disabled", undefined, "#ca-workspace");
  }
  const idempotencyKey = `ui:${Date.now()}`;
  const connectorId = value(formData, "connectorId") || "codex-ui";
  const payload: RidingSignalPayload = {
    messageId: makeId("message"),
    timestamp: new Date().toISOString(),
    raceId: value(formData, "raceId"),
    registrationId: value(formData, "registrationId"),
    raceProjectId: value(formData, "raceProjectId"),
    caConnectionId: value(formData, "caConnectionId"),
    idempotencyKey,
    caSessionId: value(formData, "caSessionId") || "ui-session",
    progressPercent: Number(value(formData, "progressPercent") || 100),
    tokens: Number(value(formData, "tokens") || 12000)
  };
  const result = await ingestRidingSignal({ ...payload, attestation: createRidingSignalAttestation(connectorId, payload, "ocr_desktop_app") });
  refresh(destination);
  actionResultRedirect(destination, result, "ca-signal-ingested", "ca-signal-ingest-failed", value(formData, "caConnectionId"), "#ca-workspace");
}


export async function disableCAConnectionAction(formData: FormData) {
  const ctx = await getAuthContext();
  const caConnectionId = value(formData, "caConnectionId");
  const raceId = await raceIdForConnection(caConnectionId);
  const result = await disableCAConnection(ctx, caConnectionId);
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "ca-disabled", "ca-disable-failed", caConnectionId, "#ca-workspace");
}

export async function updateReviewFlagStatusAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await updateReviewFlagStatus(ctx, {
    flagId: value(formData, "flagId"),
    status: value(formData, "status"),
    resolutionNote: value(formData, "resolutionNote")
  });
  const raceId = value(formData, "raceId");
  if (!result.ok) redirect(`/console/risk-center?${raceId ? `raceId=${encodeURIComponent(raceId)}&` : ""}actionError=${encodeURIComponent(result.message)}`);
  refresh("/console/risk-center");
}
export async function submitWorkAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await submitWork(ctx, value(formData, "registrationId"), {
    title: value(formData, "title"),
    summary: value(formData, "summary"),
    demoUrl: value(formData, "demoUrl"),
    repoUrl: value(formData, "repoUrl"),
    repoCommitSha: value(formData, "repoCommitSha")
  });
  refresh("/console");
  consoleRedirect(value(formData, "raceId"), result.message);
}

export async function configureSubmissionWindowAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await configureSubmissionWindow(ctx, raceId, {
    opensAt: utcDate(formData, "submissionOpensAt"),
    closesAt: utcDate(formData, "submissionClosesAt")
  });
  refresh("/console");
  consoleRedirect(raceId, result.message);
}

export async function lockSubmissionWindowAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await lockSubmissionWindow(ctx, raceId, value(formData, "reason"));
  refresh("/console");
  consoleRedirect(raceId, result.message);
}

export async function reopenSubmissionWindowAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await reopenSubmissionWindow(ctx, raceId, {
    closesAt: utcDate(formData, "submissionClosesAt"),
    reason: value(formData, "reason")
  });
  refresh("/console");
  consoleRedirect(raceId, result.message);
}

export async function publishWorkAction(formData: FormData) {
  const ctx = await getAuthContext();
  const workId = value(formData, "workId");
  const raceId = await raceIdForWork(workId);
  const result = await publishWork(ctx, workId);
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "work-published", "work-publish-failed", workId, "#publishing");
}

export async function assignJudgeAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  let result;
  try {
    result = await assignJudge(ctx, value(formData, "workId"), value(formData, "judgeUserId"));
  } catch {
    result = { ok: false, message: "当前账号无权为该赛事分配 Judge" };
  }
  refresh(`/console/organizer/races/${raceId}`);
  redirect(`/console/organizer/races/${encodeURIComponent(raceId)}?${result.ok ? "actionMessage" : "actionError"}=${encodeURIComponent(result.message)}`);
}

export async function saveRaceJudgePoolAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const judgeUserIds = formData.getAll("judgeUserIds").map(String);
  const result = await saveRaceJudgePool(ctx, raceId, judgeUserIds);
  const destination = `/console/organizer/races/${encodeURIComponent(raceId)}`;
  refresh(destination);
  redirect(`${destination}?${result.ok ? "action=judge-pool-saved" : "action=judge-pool-save-failed"}&${result.ok ? "entityId" : "actionError"}=${encodeURIComponent(result.ok ? raceId : result.message)}#judge-allocation`);
}

export async function allocateRaceJudgesAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await allocateRaceJudges(ctx, raceId);
  const destination = `/console/organizer/races/${encodeURIComponent(raceId)}`;
  refresh(destination);
  redirect(`${destination}?${result.ok ? "action=judges-allocated" : "action=judge-allocation-failed"}&${result.ok ? "entityId" : "actionError"}=${encodeURIComponent(result.ok ? result.id ?? raceId : result.message)}#judge-allocation`);
}

export async function publishRaceReviewResultsAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await publishRaceReviewResults(ctx, raceId);
  const destination = `/console/organizer/races/${encodeURIComponent(raceId)}`;
  refresh(destination);
  redirect(`${destination}?${result.ok ? "action=review-results-published" : "action=review-results-publish-failed"}&${result.ok ? "entityId" : "actionError"}=${encodeURIComponent(result.ok ? raceId : result.message)}#judge-allocation`);
}

export async function submitJudgingRecordAction(formData: FormData) {
  const ctx = await getAuthContext();
  const redirectTo = value(formData, "redirectTo");
  const result = await submitJudgingRecord(ctx, value(formData, "assignmentId"), {
    scoreResult: Number(value(formData, "scoreResult") || 0),
    scoreRiding: Number(value(formData, "scoreRiding") || 0),
    comments: value(formData, "comments")
  });
  refresh("/console");
  const destination = redirectTo.startsWith("/works/") ? redirectTo : "/console/judge";
  redirect(`${destination}?${result.ok ? "action=judging-submitted" : "action=judging-submit-failed"}&${result.ok ? "entityId" : "actionError"}=${encodeURIComponent(result.ok ? result.id ?? value(formData, "assignmentId") : result.message)}`);
}

export async function publishAwardAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await publishAward(ctx, {
    raceId,
    registrationId: value(formData, "registrationId"),
    workId: value(formData, "workId") || undefined,
    awardName: value(formData, "awardName") || "Grand Prize",
    rank: Number(value(formData, "rank") || 1),
    reason: value(formData, "reason") || "Best combined result and riding evidence package."
  });
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "award-published", "award-publish-failed", result.ok ? result.id : undefined, "#publishing");
}

export async function generateReportAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await generateReport(ctx, {
    raceId,
    type: value(formData, "type"),
    subjectRegistrationId: value(formData, "subjectRegistrationId") || undefined
  });
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "report-generated", "report-generate-failed", result.ok ? result.id : undefined, "#publishing");
}


export async function editReportAction(formData: FormData) {
  const ctx = await getAuthContext();
  const reportId = value(formData, "reportId");
  const raceId = await raceIdForReport(reportId);
  const result = await editReport(ctx, reportId, value(formData, "content"));
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "report-edited", "report-edit-failed", reportId, "#publishing");
}

export async function regenerateReportAction(formData: FormData) {
  const ctx = await getAuthContext();
  const reportId = value(formData, "reportId");
  const raceId = await raceIdForReport(reportId);
  const result = await regenerateReport(ctx, reportId);
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "report-regenerated", "report-regenerate-failed", reportId, "#publishing");
}

export async function simulateReportFailureAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await simulateReportFailure(ctx, {
    raceId,
    type: value(formData, "type") || "race_report",
    subjectRegistrationId: value(formData, "subjectRegistrationId") || undefined
  });
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "report-failure-recorded", "report-failure-record-failed", result.ok ? result.id : undefined, "#publishing");
}
export async function publishReportAction(formData: FormData) {
  const ctx = await getAuthContext();
  const reportId = value(formData, "reportId");
  const raceId = await raceIdForReport(reportId);
  const result = await publishReport(ctx, reportId);
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "report-published", "report-publish-failed", reportId, "#publishing");
}

export async function rebuildProjectionAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await rebuildProjection(ctx, raceId);
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "projection-rebuilt", "projection-rebuild-failed", result.ok ? result.id : undefined, "#publishing");
}


export async function simulateProjectionFailureAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await simulateProjectionFailure(ctx, raceId);
  const destination = roleWorkspaceDestination(ctx?.activeRole, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "projection-failure-recorded", "projection-failure-record-failed", result.ok ? result.id : undefined, "#publishing");
}
export async function createBackupAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const destination = `/ops?raceId=${encodeURIComponent(raceId)}`;
  const result = await createBackup(ctx, raceId, value(formData, "scope") || "manual_snapshot");
  refresh(destination);
  actionResultRedirect(destination, result, "backup-created", "backup-create-failed", result.ok ? result.id : undefined, "#backup");
}

export async function runP0Action(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const destination = `/ops?raceId=${encodeURIComponent(raceId)}`;
  const result = await runP0Regression(ctx, raceId);
  refresh(destination);
  actionResultRedirect(destination, result, "p0-completed", "p0-failed", raceId, "#p0-regression");
}


export async function switchScreenModeAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await switchScreenMode(ctx, raceId, value(formData, "mode"), value(formData, "reason"));
  refresh(`/screen?raceId=${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}`);
}

export async function createRaceRoundAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await createRaceRound(ctx, {
    raceId,
    name: value(formData, "name"),
    order: Number(value(formData, "order")),
    scheduledStartAt: new Date(value(formData, "scheduledStartAt")),
    scheduledEndAt: new Date(value(formData, "scheduledEndAt")),
    trackProfileVersionId: value(formData, "trackProfileVersionId")
  });
  revalidatePath(`/console/organizer/races/${raceId}`);
  revalidatePath(`/screen?raceId=${raceId}`);
  if (!result.ok) redirect(`/console/organizer/races/${encodeURIComponent(raceId)}?screenError=${encodeURIComponent(result.message)}#race-live-setup`);
}

export async function syncRaceRoundRosterAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await syncRaceRoundRoster(ctx, raceId, value(formData, "roundId"));
  revalidatePath(`/console/organizer/races/${raceId}`);
  revalidatePath(`/screen?raceId=${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}#race-live-setup`);
}

export async function setRaceRoundEntryStatusAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await setRaceRoundEntryStatus(ctx, {
    raceId,
    roundEntryId: value(formData, "roundEntryId"),
    status: value(formData, "status") === "excluded" ? "excluded" : "active"
  });
  revalidatePath(`/screen?raceId=${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}#race-live-setup`);
}

export async function moveRaceRoundEntryAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await moveRaceRoundEntry(ctx, {
    raceId,
    roundEntryId: value(formData, "roundEntryId"),
    direction: value(formData, "direction") === "up" ? "up" : "down"
  });
  revalidatePath(`/screen?raceId=${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}#race-live-setup`);
}

export async function prepareRaceLiveAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await prepareRaceLive(ctx, raceId, value(formData, "roundId"), checked(formData, "confirmStart"));
  revalidatePath(`/screen?raceId=${raceId}`);
  revalidatePath(`/screen/display/${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}#race-live-setup`);
  redirect(`/screen?raceId=${encodeURIComponent(raceId)}&prepared=1#race-live-setup`);
}

export async function refreshRaceLiveAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await refreshRaceLive(ctx, raceId);
  revalidatePath(`/screen?raceId=${raceId}`);
  revalidatePath(`/screen/display/${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}#race-live-setup`);
}

export async function finishRaceRoundAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await finishRaceRound(ctx, raceId, value(formData, "roundId"));
  revalidatePath(`/screen?raceId=${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}#race-live-setup`);
}

export async function toggleScreenFallbackAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await toggleScreenFallback(ctx, raceId, value(formData, "enabled") === "true", value(formData, "reason"));
  refresh(`/screen?raceId=${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}`);
}

export async function pauseScreenRotationAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await pauseScreenRotation(ctx, { raceId, reason: value(formData, "reason") });
  refresh(`/screen?raceId=${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}`);
}

export async function resumeScreenRotationAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await resumeScreenRotation(ctx, { raceId, reason: value(formData, "reason") });
  refresh(`/screen?raceId=${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}`);
}

export async function moveScreenDisplayGroupAction(formData: FormData) {
  const ctx = await getAuthContext();
  const direction = value(formData, "direction") === "previous" ? "previous" : "next";
  const raceId = value(formData, "raceId");
  const result = await moveScreenDisplayGroup(ctx, { raceId, direction, reason: value(formData, "reason") });
  refresh(`/screen?raceId=${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}`);
}

export async function configureScreenRotationAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await configureScreenRotation(ctx, {
    raceId,
    intervalSeconds: Number(value(formData, "intervalSeconds")),
    reason: value(formData, "reason")
  });
  refresh(`/screen?raceId=${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}`);
}

export async function publishAnnouncementAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await publishAnnouncement(ctx, {
    raceId,
    title: value(formData, "title"),
    body: value(formData, "body"),
    reason: value(formData, "reason")
  });
  refresh(`/screen?raceId=${raceId}`);
  if (!result.ok) redirect(`/screen?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}`);
}

export async function publishTrackProfileVersionAction(formData: FormData) {
  const ctx = await getAuthContext();
  const background = formData.get("background");
  if (!(background instanceof File)) return { ok: false as const, message: "请选择背景文件" };
  return publishTrackProfileVersion(ctx, {
    publishRequestId: value(formData, "publishRequestId"),
    raceId: value(formData, "raceId") || undefined,
    profileJson: value(formData, "profileJson"),
    validationReportJson: value(formData, "validationReportJson"),
    manualValidationJson: value(formData, "manualValidationJson"),
    background
  });
}

export async function archiveTrackProfileVersionAction(formData: FormData) {
  const result = await archiveTrackProfileVersion(await getAuthContext(), value(formData, "versionId"));
  refresh("/console/tracks");
  refresh("/console/tracks/calibrator");
  return result;
}

export async function deleteArchivedTrackProfileVersionAction(formData: FormData) {
  const result = await deleteArchivedTrackProfileVersion(await getAuthContext(), value(formData, "versionId"));
  refresh("/console/tracks");
  refresh("/console/tracks/calibrator");
  return result;
}

export async function bindTrackVersionToRoundAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const result = await bindTrackVersionToRound(ctx, { raceRoundId: value(formData, "raceRoundId"), trackProfileVersionId: value(formData, "trackProfileVersionId") });
  refresh("/console/tracks");
  if (!result.ok) redirect(`/console/tracks?raceId=${encodeURIComponent(raceId)}&error=${encodeURIComponent(result.message)}`);
}
export async function switchActiveRoleAction(formData: FormData) {
  const role = value(formData, "role");
  if (!isRole(role)) redirect("/console/admin?action=user-role-update-failed&actionError=%E6%9C%AA%E7%9F%A5%E8%A7%92%E8%89%B2");
  await switchActiveRole(role);
  redirect(`/console/${role}`);
}

export async function selectRoleAction(formData: FormData) {
  const role = value(formData, "role");
  const result = await selectRole(await getAuthContext(), role);
  if (!result.ok) redirect(`/onboarding/role?error=${encodeURIComponent(result.message)}`);
  redirect(`/onboarding/${role}`);
}

export async function saveRoleProfileDraftAction(formData: FormData) {
  const role = value(formData, "role");
  const result = await saveRoleProfileDraft(await getAuthContext(), role, roleProfileInput(formData));
  if (!result.ok) redirect(`/onboarding/${role}?error=${encodeURIComponent(result.message)}`);
  redirect(`/onboarding/${role}?saved=1`);
}

export async function submitRoleProfileAction(formData: FormData) {
  const role = value(formData, "role");
  const ctx = await getAuthContext();
  const result = await submitRoleProfile(ctx, role, roleProfileInput(formData));
  if (!result.ok) redirect(`/onboarding/${role}?error=${encodeURIComponent(result.message)}`);
  if (isRole(role) && (role === "rider" || ctx?.availableRoles.includes(role))) {
    await switchActiveRole(role);
    redirect(`/console/${role}`);
  }
  redirect(`/onboarding/status?role=${encodeURIComponent(role)}`);
}

export async function withdrawRoleApplicationAction(formData: FormData) {
  const result = await withdrawRoleApplication(await getAuthContext(), value(formData, "applicationId"));
  if (!result.ok) redirect(`/onboarding/status?error=${encodeURIComponent(result.message)}`);
  redirect("/onboarding/role");
}

export async function reviewRoleApplicationAction(formData: FormData) {
  const applicationId = value(formData, "applicationId");
  const decision = value(formData, "decision");
  const result = await reviewRoleApplication(
    await getAuthContext(), applicationId, decision, value(formData, "note")
  );
  if (!result.ok) redirect(`/console/admin?action=role-application-review-failed&actionError=${encodeURIComponent(result.message)}`);
  refresh("/console/admin");
  redirect(`/console/admin?action=${decision === "approve" ? "role-application-approved" : "role-application-rejected"}&entityId=${encodeURIComponent(applicationId)}`);
}

export async function setUserRoleStatusAction(formData: FormData) {
  const userId = value(formData, "userId");
  const role = value(formData, "role");
  const roleAction = value(formData, "roleAction");
  const result = await setUserRoleStatus(
    await getAuthContext(), userId, role, roleAction, value(formData, "reason")
  );
  if (!result.ok) redirect(`/console/admin?action=user-role-update-failed&actionError=${encodeURIComponent(result.message)}`);
  refresh("/console/admin");
  const codes: Record<string, string> = {
    grant: "user-role-granted", suspend: "user-role-suspended", restore: "user-role-restored", revoke: "user-role-revoked"
  };
  redirect(`/console/admin?action=${codes[roleAction] ?? "user-role-updated"}&entityId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}`);
}


export async function markReleaseChecklistItemAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const destination = `/ops?raceId=${encodeURIComponent(raceId)}`;
  const result = await markReleaseChecklistItem(ctx, {
    raceId,
    itemKey: value(formData, "itemKey"),
    label: value(formData, "label") || undefined,
    status: value(formData, "status") || "done",
    evidence: value(formData, "evidence")
  });
  refresh(destination);
  actionResultRedirect(destination, result, "release-checklist-updated", "release-checklist-update-failed", value(formData, "itemKey"), "#release-checklist");
}

export async function recordGoNoGoAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const destination = `/ops?raceId=${encodeURIComponent(raceId)}`;
  const result = await recordGoNoGo(ctx, raceId, value(formData, "evidence"));
  refresh(destination);
  actionResultRedirect(destination, result, "go-no-go-recorded", "go-no-go-record-failed", raceId, "#release-decision");
}

export async function markCanaryReadyAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const destination = `/ops?raceId=${encodeURIComponent(raceId)}`;
  const result = await markCanaryReady(ctx, raceId, value(formData, "evidence"));
  refresh(destination);
  actionResultRedirect(destination, result, "canary-ready", "canary-ready-failed", raceId, "#release-decision");
}

export async function markProductionReleasedAction(formData: FormData) {
  const ctx = await getAuthContext();
  const raceId = value(formData, "raceId");
  const destination = `/ops?raceId=${encodeURIComponent(raceId)}`;
  const result = await markProductionReleased(ctx, raceId, value(formData, "evidence"));
  refresh(destination);
  actionResultRedirect(destination, result, "production-released", "production-release-failed", raceId, "#release-decision");
}
export async function updateProfileAction(formData: FormData) {
  const ctx = await getAuthContext();
  const result = await updateProfile(ctx, {
    displayName: value(formData, "displayName"),
    email: value(formData, "email"),
    confirmEmail: checked(formData, "confirmEmail"),
    acceptTerms: checked(formData, "acceptTerms"),
    acceptPrivacy: checked(formData, "acceptPrivacy"),
    timeZone: value(formData, "timeZone"),
    locale: value(formData, "locale")
  });
  refresh("/profile");
  if (!result.ok) redirect(`/profile?error=${encodeURIComponent(result.message)}`);
  if (!ctx?.availableRoles.length) redirect("/onboarding/role");
  redirect("/console");
}

export async function goConsole() {
  redirect("/console");
}
