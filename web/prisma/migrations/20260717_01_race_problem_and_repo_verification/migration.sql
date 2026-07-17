ALTER TABLE "Race" ADD COLUMN "currentProblemVersionId" TEXT;

ALTER TABLE "WorkSubmissionVersion"
  ADD COLUMN "repositoryNodeId" TEXT,
  ADD COLUMN "repositoryVisibility" TEXT,
  ADD COLUMN "repositoryVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "repositoryVerificationStatus" TEXT NOT NULL DEFAULT 'legacy_unverified',
  ADD COLUMN "repositoryVerificationDetail" TEXT;

CREATE TABLE "RaceProblemVersion" (
  "id" TEXT NOT NULL,
  "raceId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "displayName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "scanStatus" TEXT NOT NULL,
  "scanEngine" TEXT,
  "scanDetail" TEXT,
  "uploadedByUserId" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changeNote" TEXT,
  "publishedAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "disabledReason" TEXT,
  CONSTRAINT "RaceProblemVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaceProblemVersion_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RaceProblemVersion_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "RaceProblemUploadIntent" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "raceId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RaceProblemUploadIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaceProblemUploadIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RaceProblemUploadIntent_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RaceProblemAuditEvent" (
  "id" TEXT NOT NULL,
  "raceId" TEXT NOT NULL,
  "problemVersionId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "detailJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RaceProblemAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaceProblemAuditEvent_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RaceProblemAuditEvent_problemVersionId_fkey" FOREIGN KEY ("problemVersionId") REFERENCES "RaceProblemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RaceProblemAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "GitHubInstallation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "accountLogin" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GitHubInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Race_currentProblemVersionId_key" ON "Race"("currentProblemVersionId");
CREATE UNIQUE INDEX "RaceProblemVersion_storageKey_key" ON "RaceProblemVersion"("storageKey");
CREATE UNIQUE INDEX "RaceProblemUploadIntent_tokenHash_key" ON "RaceProblemUploadIntent"("tokenHash");
CREATE INDEX "RaceProblemUploadIntent_userId_createdAt_idx" ON "RaceProblemUploadIntent"("userId", "createdAt");
CREATE INDEX "RaceProblemUploadIntent_expiresAt_idx" ON "RaceProblemUploadIntent"("expiresAt");
CREATE UNIQUE INDEX "RaceProblemVersion_raceId_revision_key" ON "RaceProblemVersion"("raceId", "revision");
CREATE INDEX "RaceProblemVersion_raceId_scanStatus_idx" ON "RaceProblemVersion"("raceId", "scanStatus");
CREATE INDEX "RaceProblemVersion_sha256_idx" ON "RaceProblemVersion"("sha256");
CREATE INDEX "RaceProblemAuditEvent_raceId_createdAt_idx" ON "RaceProblemAuditEvent"("raceId", "createdAt");
CREATE INDEX "RaceProblemAuditEvent_problemVersionId_idx" ON "RaceProblemAuditEvent"("problemVersionId");
CREATE UNIQUE INDEX "GitHubInstallation_installationId_key" ON "GitHubInstallation"("installationId");
CREATE INDEX "GitHubInstallation_userId_idx" ON "GitHubInstallation"("userId");

ALTER TABLE "Race" ADD CONSTRAINT "Race_currentProblemVersionId_fkey"
  FOREIGN KEY ("currentProblemVersionId") REFERENCES "RaceProblemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
