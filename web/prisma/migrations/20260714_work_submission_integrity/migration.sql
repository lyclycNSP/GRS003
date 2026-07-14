-- AlterTable
ALTER TABLE "Race"
ADD COLUMN "submissionOpensAt" TIMESTAMP(3),
ADD COLUMN "submissionClosesAt" TIMESTAMP(3),
ADD COLUMN "submissionLockedAt" TIMESTAMP(3),
ADD COLUMN "submissionLockedByUserId" TEXT,
ADD COLUMN "submissionLockReason" TEXT;

ALTER TABLE "Work"
ADD COLUMN "currentVersionId" TEXT,
ADD COLUMN "versionCounter" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "JudgeAssignment" ADD COLUMN "workSubmissionVersionId" TEXT;
ALTER TABLE "Award" ADD COLUMN "workSubmissionVersionId" TEXT;

-- CreateTable
CREATE TABLE "WorkSubmissionVersion" (
    "id" TEXT NOT NULL,
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
    "submittedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkSubmissionVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubmissionAuditEvent" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "registrationId" TEXT,
    "workId" TEXT,
    "workSubmissionVersionId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadataJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubmissionAuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SubmissionAuditEvent_version_requires_work" CHECK ("workSubmissionVersionId" IS NULL OR "workId" IS NOT NULL)
);

ALTER TABLE "Award" ADD CONSTRAINT "Award_version_requires_work" CHECK ("workSubmissionVersionId" IS NULL OR "workId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "Work_currentVersionId_key" ON "Work"("currentVersionId");
CREATE UNIQUE INDEX "Work_id_currentVersionId_key" ON "Work"("id", "currentVersionId");
CREATE UNIQUE INDEX "WorkSubmissionVersion_workId_versionNumber_key" ON "WorkSubmissionVersion"("workId", "versionNumber");
CREATE UNIQUE INDEX "WorkSubmissionVersion_workId_id_key" ON "WorkSubmissionVersion"("workId", "id");
CREATE INDEX "WorkSubmissionVersion_integrityHash_idx" ON "WorkSubmissionVersion"("integrityHash");
CREATE INDEX "WorkSubmissionVersion_submittedAt_idx" ON "WorkSubmissionVersion"("submittedAt");
CREATE INDEX "SubmissionAuditEvent_raceId_createdAt_idx" ON "SubmissionAuditEvent"("raceId", "createdAt");
CREATE INDEX "SubmissionAuditEvent_workId_createdAt_idx" ON "SubmissionAuditEvent"("workId", "createdAt");

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_submissionLockedByUserId_fkey" FOREIGN KEY ("submissionLockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkSubmissionVersion" ADD CONSTRAINT "WorkSubmissionVersion_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkSubmissionVersion" ADD CONSTRAINT "WorkSubmissionVersion_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Work" ADD CONSTRAINT "Work_id_currentVersionId_fkey" FOREIGN KEY ("id", "currentVersionId") REFERENCES "WorkSubmissionVersion"("workId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "SubmissionAuditEvent" ADD CONSTRAINT "SubmissionAuditEvent_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubmissionAuditEvent" ADD CONSTRAINT "SubmissionAuditEvent_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubmissionAuditEvent" ADD CONSTRAINT "SubmissionAuditEvent_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubmissionAuditEvent" ADD CONSTRAINT "SubmissionAuditEvent_workId_workSubmissionVersionId_fkey" FOREIGN KEY ("workId", "workSubmissionVersionId") REFERENCES "WorkSubmissionVersion"("workId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubmissionAuditEvent" ADD CONSTRAINT "SubmissionAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_workId_workSubmissionVersionId_fkey" FOREIGN KEY ("workId", "workSubmissionVersionId") REFERENCES "WorkSubmissionVersion"("workId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Award" ADD CONSTRAINT "Award_workId_workSubmissionVersionId_fkey" FOREIGN KEY ("workId", "workSubmissionVersionId") REFERENCES "WorkSubmissionVersion"("workId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
