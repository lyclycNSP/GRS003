import sqlite3
import os
from pathlib import Path

prisma_dir = Path(__file__).resolve().parents[1] / "prisma"
database_url = os.environ.get("DATABASE_URL", "file:./dev.db")
if not database_url.startswith("file:"):
    raise ValueError("init-sqlite.py only supports SQLite file: DATABASE_URL values")
database_name = database_url.removeprefix("file:").removeprefix("./")
db_path = prisma_dir / database_name
db_path.parent.mkdir(parents=True, exist_ok=True)

conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("PRAGMA foreign_keys=OFF")

tables = [
    "ReleaseChecklistItem", "Incident", "Backup", "ScreenControlAuditEvent", "ScreenState", "Announcement", "Projection", "Report", "Award",
    "JudgingRecord", "JudgeAssignment", "SubmissionAuditEvent", "WorkSubmissionVersion", "ReviewFlag", "Evidence", "Work", "CAIngestionReceipt", "Session", "CAConnection",
    "RaceRoundEntry", "RaceRound", "TrackProfileVersion", "TrackProfile", "RaceProject", "Registration", "TeamMember", "Team", "Race", "AuthSession", "AuthAccount", "User"
]
for table in tables:
    cur.execute(f'DROP TABLE IF EXISTS "{table}"')

cur.executescript(
    """
CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "githubLogin" TEXT,
  "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
  "rolesJson" TEXT NOT NULL,
  "city" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "AuthAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "loginName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AuthAccount_provider_providerAccountId_key" ON "AuthAccount"("provider", "providerAccountId");
CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
CREATE TABLE "Race" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "taskId" TEXT,
  "organizerJson" TEXT NOT NULL,
  "scheduleJson" TEXT NOT NULL,
  "rulesJson" TEXT NOT NULL,
  "metricsJson" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" DATETIME,
  "submissionOpensAt" DATETIME,
  "submissionClosesAt" DATETIME,
  "submissionLockedAt" DATETIME,
  "submissionLockedByUserId" TEXT,
  "submissionLockReason" TEXT
);
CREATE TABLE "Team" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "inviteCode" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "maxMembers" INTEGER NOT NULL DEFAULT 5,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Team_raceId_name_key" ON "Team"("raceId", "name");
CREATE TABLE "TeamMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");
CREATE TABLE "Registration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "participantType" TEXT NOT NULL DEFAULT 'individual',
  "teamId" TEXT,
  "status" TEXT NOT NULL,
  "submittedAt" DATETIME NOT NULL,
  "approvedAt" DATETIME
);
CREATE UNIQUE INDEX "Registration_raceId_userId_key" ON "Registration"("raceId", "userId");
CREATE UNIQUE INDEX "Registration_teamId_key" ON "Registration"("teamId");
CREATE TABLE "RaceProject" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "registrationId" TEXT NOT NULL UNIQUE,
  "repoUrl" TEXT,
  "aggregateIngestionStatus" TEXT NOT NULL,
  "connectionHealth" TEXT NOT NULL,
  "metricsJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncedAt" DATETIME
);
CREATE TABLE "TrackProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "trackId" TEXT NOT NULL UNIQUE,
  "raceId" TEXT,
  "name" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'system',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "TrackProfile_raceId_idx" ON "TrackProfile"("raceId");
CREATE TABLE "TrackProfileVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "trackId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "profileJson" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "backgroundAssetRef" TEXT NOT NULL,
  "publishRequestId" TEXT,
  "profileHash" TEXT,
  "backgroundHash" TEXT,
  "validationReportJson" TEXT,
  "publishedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" DATETIME
);
CREATE UNIQUE INDEX "TrackProfileVersion_trackId_version_key" ON "TrackProfileVersion"("trackId", "version");
CREATE UNIQUE INDEX "TrackProfileVersion_publishRequestId_key" ON "TrackProfileVersion"("publishRequestId");
CREATE INDEX "TrackProfileVersion_status_idx" ON "TrackProfileVersion"("status");
CREATE INDEX "TrackProfileVersion_publishedByUserId_idx" ON "TrackProfileVersion"("publishedByUserId");
CREATE TABLE "RaceRound" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "trackProfileVersionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "scheduledStartAt" DATETIME NOT NULL,
  "scheduledEndAt" DATETIME NOT NULL,
  "actualStartedAt" DATETIME,
  "actualEndedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "RaceRound_raceId_order_key" ON "RaceRound"("raceId", "order");
CREATE INDEX "RaceRound_trackProfileVersionId_idx" ON "RaceRound"("trackProfileVersionId");
CREATE TABLE "RaceRoundEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceRoundId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "RaceRoundEntry_raceRoundId_registrationId_key" ON "RaceRoundEntry"("raceRoundId", "registrationId");
CREATE UNIQUE INDEX "RaceRoundEntry_raceRoundId_displayOrder_key" ON "RaceRoundEntry"("raceRoundId", "displayOrder");
CREATE INDEX "RaceRoundEntry_registrationId_idx" ON "RaceRoundEntry"("registrationId");
CREATE TABLE "CAConnection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceProjectId" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "caType" TEXT NOT NULL,
  "connectorId" TEXT NOT NULL,
  "connectorVersion" TEXT NOT NULL,
  "signingKeyId" TEXT NOT NULL,
  "externalProjectRef" TEXT NOT NULL,
  "ingestionStatus" TEXT NOT NULL,
  "registeredAt" DATETIME NOT NULL,
  "handshakeAt" DATETIME,
  "disabledAt" DATETIME,
  "lastSyncedAt" DATETIME
);
CREATE UNIQUE INDEX "CAConnection_raceProjectId_connectorId_externalProjectRef_key" ON "CAConnection"("raceProjectId", "connectorId", "externalProjectRef");
CREATE TABLE "CAIngestionReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "caConnectionId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "signedAt" DATETIME NOT NULL,
  "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CAIngestionReceipt_caConnectionId_messageId_key" ON "CAIngestionReceipt"("caConnectionId", "messageId");
CREATE UNIQUE INDEX "CAIngestionReceipt_caConnectionId_idempotencyKey_key" ON "CAIngestionReceipt"("caConnectionId", "idempotencyKey");
CREATE INDEX "CAIngestionReceipt_receivedAt_idx" ON "CAIngestionReceipt"("receivedAt");
CREATE TABLE "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "caConnectionId" TEXT NOT NULL,
  "externalSessionRef" TEXT NOT NULL,
  "startedAt" DATETIME,
  "endedAt" DATETIME,
  "lastActiveAt" DATETIME,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "toolCallCount" INTEGER NOT NULL DEFAULT 0,
  "tokens" INTEGER NOT NULL DEFAULT 0,
  "snapshotJson" TEXT NOT NULL
);
CREATE UNIQUE INDEX "Session_caConnectionId_externalSessionRef_key" ON "Session"("caConnectionId", "externalSessionRef");
CREATE TABLE "Work" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "registrationId" TEXT NOT NULL UNIQUE,
  "slug" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "demoUrl" TEXT,
  "repoUrl" TEXT,
  "submittedAt" DATETIME,
  "publishedAt" DATETIME,
  "currentVersionId" TEXT UNIQUE,
  "versionCounter" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE "WorkSubmissionVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "demoUrl" TEXT,
  "repoUrl" TEXT NOT NULL,
  "repoCommitSha" TEXT NOT NULL,
  "hashSchemaVersion" TEXT NOT NULL,
  "integrityHash" TEXT NOT NULL,
  "submittedByUserId" TEXT NOT NULL,
  "submittedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Work_id_currentVersionId_key" ON "Work"("id", "currentVersionId");
CREATE UNIQUE INDEX "WorkSubmissionVersion_workId_versionNumber_key" ON "WorkSubmissionVersion"("workId", "versionNumber");
CREATE UNIQUE INDEX "WorkSubmissionVersion_workId_id_key" ON "WorkSubmissionVersion"("workId", "id");
CREATE INDEX "WorkSubmissionVersion_integrityHash_idx" ON "WorkSubmissionVersion"("integrityHash");
CREATE INDEX "WorkSubmissionVersion_submittedAt_idx" ON "WorkSubmissionVersion"("submittedAt");
CREATE TABLE "SubmissionAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "registrationId" TEXT,
  "workId" TEXT,
  "workSubmissionVersionId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "metadataJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("workSubmissionVersionId" IS NULL OR "workId" IS NOT NULL)
);
CREATE INDEX "SubmissionAuditEvent_raceId_createdAt_idx" ON "SubmissionAuditEvent"("raceId", "createdAt");
CREATE INDEX "SubmissionAuditEvent_workId_createdAt_idx" ON "SubmissionAuditEvent"("workId", "createdAt");
CREATE TABLE "Evidence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "workId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "sourceRefJson" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ReviewFlag" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "raceProjectId" TEXT,
  "workId" TEXT,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "judgeVisibleSummary" TEXT NOT NULL,
  "resolutionNote" TEXT,
  "resolvedByUserId" TEXT,
  "sourceRefJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" DATETIME,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "JudgeAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "judgeUserId" TEXT NOT NULL,
  "assignedByUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "assignedAt" DATETIME NOT NULL,
  "workSubmissionVersionId" TEXT
);
CREATE UNIQUE INDEX "JudgeAssignment_workId_judgeUserId_key" ON "JudgeAssignment"("workId", "judgeUserId");
CREATE TABLE "JudgingRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assignmentId" TEXT NOT NULL UNIQUE,
  "scoreResult" INTEGER NOT NULL,
  "scoreRiding" INTEGER NOT NULL,
  "comments" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "submittedAt" DATETIME
);
CREATE TABLE "Award" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "workId" TEXT,
  "awardName" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "decisionReason" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "publishedAt" DATETIME,
  "workSubmissionVersionId" TEXT,
  CHECK ("workSubmissionVersionId" IS NULL OR "workId" IS NOT NULL)
);
CREATE UNIQUE INDEX "Award_raceId_awardName_rank_key" ON "Award"("raceId", "awardName", "rank");
CREATE UNIQUE INDEX "Award_raceId_awardName_registrationId_key" ON "Award"("raceId", "awardName", "registrationId");
CREATE TABLE "Report" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "subjectRegistrationId" TEXT,
  "status" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "generatedAt" DATETIME,
  "publishedAt" DATETIME,
  "lastError" TEXT
);
CREATE TABLE "Projection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "stableVersionId" TEXT,
  "lastRebuiltAt" DATETIME NOT NULL,
  "schemaVersion" TEXT,
  "sequence" INTEGER,
  "generatedAt" DATETIME,
  "sourceWatermark" TEXT,
  "payloadHash" TEXT
);
CREATE UNIQUE INDEX "Projection_raceId_type_sequence_key" ON "Projection"("raceId", "type", "sequence");
CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "publishedAt" DATETIME
);
CREATE TABLE "ScreenState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL UNIQUE,
  "mode" TEXT NOT NULL,
  "fallbackEnabled" BOOLEAN NOT NULL DEFAULT false,
  "currentRoundId" TEXT,
  "stableProjectionId" TEXT,
  "activeGroupOrder" INTEGER NOT NULL DEFAULT 1,
  "autoRotateEnabled" BOOLEAN NOT NULL DEFAULT true,
  "rotationIntervalSeconds" INTEGER NOT NULL DEFAULT 15,
  "rotationEpochAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotationPausedAt" DATETIME,
  "controlVersion" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ScreenState_currentRoundId_idx" ON "ScreenState"("currentRoundId");
CREATE INDEX "ScreenState_stableProjectionId_idx" ON "ScreenState"("stableProjectionId");
CREATE TABLE "ScreenControlAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "screenStateId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "payloadJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ScreenControlAuditEvent_raceId_createdAt_idx" ON "ScreenControlAuditEvent"("raceId", "createdAt");
CREATE INDEX "ScreenControlAuditEvent_actorUserId_idx" ON "ScreenControlAuditEvent"("actorUserId");
CREATE TABLE "Backup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Incident" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "occurredAt" DATETIME NOT NULL,
  "impact" TEXT NOT NULL,
  "affectedRolesJson" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fallbackTriggered" BOOLEAN NOT NULL,
  "rollback" BOOLEAN NOT NULL,
  "followUp" TEXT NOT NULL
);
CREATE TABLE "ReleaseChecklistItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "updatedAt" DATETIME
);
CREATE UNIQUE INDEX "ReleaseChecklistItem_raceId_itemKey_key" ON "ReleaseChecklistItem"("raceId", "itemKey");
"""
)

cur.execute("PRAGMA foreign_keys=ON")
conn.commit()
conn.close()
print(f"Initialized {db_path}")
