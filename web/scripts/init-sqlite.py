import sqlite3
from pathlib import Path

db_path = Path(__file__).resolve().parents[1] / "prisma" / "dev.db"
db_path.parent.mkdir(parents=True, exist_ok=True)

conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("PRAGMA foreign_keys=OFF")

tables = [
    "ReleaseChecklistItem", "Incident", "Backup", "Announcement", "Projection", "Report", "Award",
    "JudgingRecord", "JudgeAssignment", "ReviewFlag", "Evidence", "Work", "Session", "CAConnection",
    "RaceProject", "Registration", "Race", "AuthAccount", "User"
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
  "archivedAt" DATETIME
);
CREATE TABLE "Registration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "submittedAt" DATETIME NOT NULL,
  "approvedAt" DATETIME
);
CREATE UNIQUE INDEX "Registration_raceId_userId_key" ON "Registration"("raceId", "userId");
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
CREATE TABLE "CAConnection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceProjectId" TEXT NOT NULL,
  "caType" TEXT NOT NULL,
  "connectorId" TEXT NOT NULL,
  "connectorVersion" TEXT NOT NULL,
  "externalProjectRef" TEXT NOT NULL,
  "ingestionStatus" TEXT NOT NULL,
  "registeredAt" DATETIME NOT NULL,
  "handshakeAt" DATETIME,
  "disabledAt" DATETIME,
  "lastSyncedAt" DATETIME
);
CREATE UNIQUE INDEX "CAConnection_raceProjectId_connectorId_externalProjectRef_key" ON "CAConnection"("raceProjectId", "connectorId", "externalProjectRef");
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
  "publishedAt" DATETIME
);
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
  "sourceRefJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" DATETIME
);
CREATE TABLE "JudgeAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "judgeUserId" TEXT NOT NULL,
  "assignedByUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "assignedAt" DATETIME NOT NULL
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
  "publishedAt" DATETIME
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
  "lastRebuiltAt" DATETIME NOT NULL
);
CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "publishedAt" DATETIME
);
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
