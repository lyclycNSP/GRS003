import os
import sqlite3
from pathlib import Path

prisma_dir = Path(__file__).resolve().parents[1] / "prisma"
database_url = os.environ.get("DATABASE_URL", "file:./dev.db")
if not database_url.startswith("file:"):
    raise ValueError("This additive helper only supports SQLite file: URLs")
db_path = prisma_dir / database_url.removeprefix("file:").removeprefix("./")

conn = sqlite3.connect(db_path)
try:
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("BEGIN IMMEDIATE")
    race_columns = {row[1] for row in conn.execute('PRAGMA table_info("Race")')}
    if "currentProblemVersionId" not in race_columns:
        conn.execute('ALTER TABLE "Race" ADD COLUMN "currentProblemVersionId" TEXT')
    version_columns = {row[1] for row in conn.execute('PRAGMA table_info("WorkSubmissionVersion")')}
    additions = {
        "repositoryNodeId": "TEXT",
        "repositoryVisibility": "TEXT",
        "repositoryVerifiedAt": "DATETIME",
        "repositoryVerificationStatus": "TEXT NOT NULL DEFAULT 'legacy_unverified'",
        "repositoryVerificationDetail": "TEXT",
    }
    for name, sql_type in additions.items():
        if name not in version_columns:
            conn.execute(f'ALTER TABLE "WorkSubmissionVersion" ADD COLUMN "{name}" {sql_type}')
    schema_statements = '''
CREATE TABLE IF NOT EXISTS "RaceProblemUploadIntent" (
  "id" TEXT NOT NULL PRIMARY KEY, "tokenHash" TEXT NOT NULL UNIQUE, "userId" TEXT NOT NULL, "raceId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL, "usedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "RaceProblemVersion" (
  "id" TEXT NOT NULL PRIMARY KEY, "raceId" TEXT NOT NULL, "revision" INTEGER NOT NULL, "displayName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL UNIQUE, "sizeBytes" INTEGER NOT NULL, "mimeType" TEXT NOT NULL, "sha256" TEXT NOT NULL,
  "scanStatus" TEXT NOT NULL, "scanEngine" TEXT, "scanDetail" TEXT, "uploadedByUserId" TEXT NOT NULL,
  "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "changeNote" TEXT, "publishedAt" DATETIME,
  "disabledAt" DATETIME, "disabledReason" TEXT
);
CREATE TABLE IF NOT EXISTS "RaceProblemAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "raceId" TEXT NOT NULL, "problemVersionId" TEXT, "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "detailJson" TEXT NOT NULL DEFAULT '{}', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "GitHubInstallation" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "installationId" TEXT NOT NULL UNIQUE,
  "accountLogin" TEXT NOT NULL, "accountType" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Race_currentProblemVersionId_key" ON "Race"("currentProblemVersionId");
CREATE UNIQUE INDEX IF NOT EXISTS "RaceProblemVersion_raceId_revision_key" ON "RaceProblemVersion"("raceId", "revision");
CREATE INDEX IF NOT EXISTS "RaceProblemVersion_raceId_scanStatus_idx" ON "RaceProblemVersion"("raceId", "scanStatus");
CREATE INDEX IF NOT EXISTS "RaceProblemVersion_sha256_idx" ON "RaceProblemVersion"("sha256");
CREATE INDEX IF NOT EXISTS "RaceProblemAuditEvent_raceId_createdAt_idx" ON "RaceProblemAuditEvent"("raceId", "createdAt");
CREATE INDEX IF NOT EXISTS "RaceProblemAuditEvent_problemVersionId_idx" ON "RaceProblemAuditEvent"("problemVersionId");
CREATE INDEX IF NOT EXISTS "RaceProblemUploadIntent_userId_createdAt_idx" ON "RaceProblemUploadIntent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "RaceProblemUploadIntent_expiresAt_idx" ON "RaceProblemUploadIntent"("expiresAt");
CREATE INDEX IF NOT EXISTS "GitHubInstallation_userId_idx" ON "GitHubInstallation"("userId");
'''
    for statement in schema_statements.split(";"):
        if statement.strip():
            conn.execute(statement)
    conn.commit()
    print(f"Applied additive race-problem security schema to {db_path}")
except Exception:
    conn.rollback()
    raise
finally:
    conn.close()
