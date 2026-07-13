-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "githubLogin" TEXT,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "rolesJson" TEXT NOT NULL,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "loginName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceProject" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "repoUrl" TEXT,
    "aggregateIngestionStatus" TEXT NOT NULL,
    "connectionHealth" TEXT NOT NULL,
    "metricsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "RaceProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CAConnection" (
    "id" TEXT NOT NULL,
    "raceProjectId" TEXT NOT NULL,
    "caType" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "connectorVersion" TEXT NOT NULL,
    "signingKeyId" TEXT NOT NULL,
    "externalProjectRef" TEXT NOT NULL,
    "ingestionStatus" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "handshakeAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "CAConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CAIngestionReceipt" (
    "id" TEXT NOT NULL,
    "caConnectionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CAIngestionReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "caConnectionId" TEXT NOT NULL,
    "externalSessionRef" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "snapshotJson" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "demoUrl" TEXT,
    "repoUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "workId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceRefJson" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewFlag" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "raceProjectId" TEXT,
    "workId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "judgeVisibleSummary" TEXT NOT NULL,
    "sourceRefJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeAssignment" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "judgeUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgingRecord" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "scoreResult" INTEGER NOT NULL,
    "scoreRiding" INTEGER NOT NULL,
    "comments" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "JudgingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "workId" TEXT,
    "awardName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "decisionReason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subjectRegistrationId" TEXT,
    "status" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Projection" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "stableVersionId" TEXT,
    "lastRebuiltAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Projection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenState" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "fallbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "impact" TEXT NOT NULL,
    "affectedRolesJson" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fallbackTriggered" BOOLEAN NOT NULL,
    "rollback" BOOLEAN NOT NULL,
    "followUp" TEXT NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseChecklistItem" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ReleaseChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_provider_providerAccountId_key" ON "AuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Race_slug_key" ON "Race"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_raceId_userId_key" ON "Registration"("raceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RaceProject_registrationId_key" ON "RaceProject"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "CAConnection_raceProjectId_connectorId_externalProjectRef_key" ON "CAConnection"("raceProjectId", "connectorId", "externalProjectRef");

-- CreateIndex
CREATE INDEX "CAIngestionReceipt_receivedAt_idx" ON "CAIngestionReceipt"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CAIngestionReceipt_caConnectionId_messageId_key" ON "CAIngestionReceipt"("caConnectionId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "CAIngestionReceipt_caConnectionId_idempotencyKey_key" ON "CAIngestionReceipt"("caConnectionId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Session_caConnectionId_externalSessionRef_key" ON "Session"("caConnectionId", "externalSessionRef");

-- CreateIndex
CREATE UNIQUE INDEX "Work_registrationId_key" ON "Work"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "Work_slug_key" ON "Work"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "JudgeAssignment_workId_judgeUserId_key" ON "JudgeAssignment"("workId", "judgeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "JudgingRecord_assignmentId_key" ON "JudgingRecord"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Award_raceId_awardName_rank_key" ON "Award"("raceId", "awardName", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Award_raceId_awardName_registrationId_key" ON "Award"("raceId", "awardName", "registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenState_raceId_key" ON "ScreenState"("raceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseChecklistItem_raceId_itemKey_key" ON "ReleaseChecklistItem"("raceId", "itemKey");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceProject" ADD CONSTRAINT "RaceProject_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAConnection" ADD CONSTRAINT "CAConnection_raceProjectId_fkey" FOREIGN KEY ("raceProjectId") REFERENCES "RaceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAIngestionReceipt" ADD CONSTRAINT "CAIngestionReceipt_caConnectionId_fkey" FOREIGN KEY ("caConnectionId") REFERENCES "CAConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_caConnectionId_fkey" FOREIGN KEY ("caConnectionId") REFERENCES "CAConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Work" ADD CONSTRAINT "Work_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFlag" ADD CONSTRAINT "ReviewFlag_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFlag" ADD CONSTRAINT "ReviewFlag_raceProjectId_fkey" FOREIGN KEY ("raceProjectId") REFERENCES "RaceProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFlag" ADD CONSTRAINT "ReviewFlag_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_judgeUserId_fkey" FOREIGN KEY ("judgeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingRecord" ADD CONSTRAINT "JudgingRecord_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "JudgeAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_subjectRegistrationId_fkey" FOREIGN KEY ("subjectRegistrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projection" ADD CONSTRAINT "Projection_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenState" ADD CONSTRAINT "ScreenState_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Backup" ADD CONSTRAINT "Backup_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseChecklistItem" ADD CONSTRAINT "ReleaseChecklistItem_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;
