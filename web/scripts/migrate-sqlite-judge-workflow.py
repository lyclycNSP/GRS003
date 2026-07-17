import hashlib
import os
import sqlite3
from pathlib import Path


prisma_dir = Path(__file__).resolve().parents[1] / "prisma"
database_url = os.environ.get("DATABASE_URL")
if not database_url or not database_url.startswith("file:"):
    raise SystemExit("Set DATABASE_URL to an explicit SQLite file: URL")

database_name = database_url.removeprefix("file:").removeprefix("./")
db_path = (prisma_dir / database_name).resolve()
protected_dev_db = (prisma_dir / "dev.db").resolve()
if db_path == protected_dev_db:
    raise SystemExit("Refusing to migrate prisma/dev.db directly; copy it to an isolated file first")
if not db_path.is_file():
    raise SystemExit(f"SQLite database does not exist: {db_path}")


def columns(connection: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')}


def add_column(connection: sqlite3.Connection, table: str, name: str, declaration: str) -> None:
    if name not in columns(connection, table):
        connection.execute(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {declaration}')


def execute_statements(connection: sqlite3.Connection, sql: str) -> None:
    statement = ""
    in_trigger = False
    for line in sql.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        statement += line + "\n"
        if stripped.upper().startswith("CREATE TRIGGER"):
            in_trigger = True
        if (not in_trigger and stripped.endswith(";")) or (in_trigger and stripped.upper() == "END;"):
            connection.execute(statement)
            statement = ""
            in_trigger = False
    if statement.strip():
        connection.execute(statement)


connection = sqlite3.connect(db_path)
try:
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("BEGIN IMMEDIATE")

    oversized = connection.execute(
        'SELECT "workId", COUNT(*) FROM "JudgeAssignment" GROUP BY "workId" HAVING COUNT(*) > 3 LIMIT 1'
    ).fetchone()
    if oversized:
        raise RuntimeError(f"Cannot migrate: Work {oversized[0]} already has {oversized[1]} assignments")

    add_column(connection, "Race", "reviewResultsPublishedAt", "DATETIME")
    add_column(connection, "Race", "reviewResultsPublishedByUserId", "TEXT")
    add_column(connection, "Registration", "reviewedByUserId", "TEXT")
    add_column(connection, "Registration", "reviewedAt", "DATETIME")
    add_column(connection, "Registration", "reviewNote", "TEXT")
    add_column(connection, "JudgeAssignment", "slot", "INTEGER")
    add_column(connection, "JudgeAssignment", "allocationBatchId", "TEXT")

    execute_statements(connection, '''
CREATE TABLE IF NOT EXISTS "RaceJudgeMembership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "judgeUserId" TEXT NOT NULL,
  "selectedByUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "selectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE,
  FOREIGN KEY ("judgeUserId") REFERENCES "User"("id") ON DELETE CASCADE,
  FOREIGN KEY ("selectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS "JudgeAllocationBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "seed" TEXT NOT NULL,
  "algorithmVersion" TEXT NOT NULL,
  "workCount" INTEGER NOT NULL,
  "retainedCount" INTEGER NOT NULL,
  "createdCount" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE,
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT
);
''')

    assignments = connection.execute(
        'SELECT "id", "workId" FROM "JudgeAssignment" ORDER BY "workId", "assignedAt", "id"'
    ).fetchall()
    next_slot: dict[str, int] = {}
    for assignment_id, work_id in assignments:
        slot = next_slot.get(work_id, 1)
        connection.execute('UPDATE "JudgeAssignment" SET "slot" = ? WHERE "id" = ?', (slot, assignment_id))
        next_slot[work_id] = slot + 1

    invalid_slot = connection.execute(
        'SELECT "id" FROM "JudgeAssignment" WHERE "slot" IS NULL OR "slot" NOT BETWEEN 1 AND 3 LIMIT 1'
    ).fetchone()
    if invalid_slot:
        raise RuntimeError(f"Cannot migrate: Assignment {invalid_slot[0]} has no valid slot")

    legacy_members = connection.execute(
        '''
SELECT "raceId", "judgeUserId", "assignedByUserId", MIN("assignedAt")
FROM "JudgeAssignment"
GROUP BY "raceId", "judgeUserId"
ORDER BY "raceId", "judgeUserId"
'''
    ).fetchall()
    for race_id, judge_user_id, selected_by_user_id, selected_at in legacy_members:
        membership_id = "legacy_judge_pool_" + hashlib.sha256(f"{race_id}:{judge_user_id}".encode()).hexdigest()[:32]
        connection.execute(
            '''
INSERT INTO "RaceJudgeMembership" (
  "id", "raceId", "judgeUserId", "selectedByUserId", "status", "selectedAt", "updatedAt"
) SELECT ?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "RaceJudgeMembership" WHERE "raceId" = ? AND "judgeUserId" = ?
)
''',
            (membership_id, race_id, judge_user_id, selected_by_user_id, selected_at, race_id, judge_user_id),
        )

    execute_statements(connection, '''
CREATE UNIQUE INDEX IF NOT EXISTS "RaceJudgeMembership_raceId_judgeUserId_key"
  ON "RaceJudgeMembership"("raceId", "judgeUserId");
CREATE INDEX IF NOT EXISTS "RaceJudgeMembership_raceId_status_idx"
  ON "RaceJudgeMembership"("raceId", "status");
CREATE INDEX IF NOT EXISTS "RaceJudgeMembership_judgeUserId_idx"
  ON "RaceJudgeMembership"("judgeUserId");
CREATE INDEX IF NOT EXISTS "JudgeAllocationBatch_raceId_createdAt_idx"
  ON "JudgeAllocationBatch"("raceId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "JudgeAssignment_workId_slot_key"
  ON "JudgeAssignment"("workId", "slot");
CREATE INDEX IF NOT EXISTS "JudgeAssignment_allocationBatchId_idx"
  ON "JudgeAssignment"("allocationBatchId");
CREATE TRIGGER IF NOT EXISTS "JudgeAssignment_slot_insert_check"
BEFORE INSERT ON "JudgeAssignment"
WHEN NEW."slot" IS NULL OR NEW."slot" NOT BETWEEN 1 AND 3
BEGIN
  SELECT RAISE(ABORT, 'JudgeAssignment slot must be between 1 and 3');
END;
CREATE TRIGGER IF NOT EXISTS "JudgeAssignment_slot_update_check"
BEFORE UPDATE OF "slot" ON "JudgeAssignment"
WHEN NEW."slot" IS NULL OR NEW."slot" NOT BETWEEN 1 AND 3
BEGIN
  SELECT RAISE(ABORT, 'JudgeAssignment slot must be between 1 and 3');
END;
''')

    connection.commit()
    print(f"Applied additive judge workflow migration to isolated SQLite database {db_path}")
except Exception:
    connection.rollback()
    raise
finally:
    connection.close()
