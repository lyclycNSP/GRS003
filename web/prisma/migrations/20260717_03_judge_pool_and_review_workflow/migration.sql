DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "JudgeAssignment" GROUP BY "workId" HAVING COUNT(*) > 3
  ) THEN
    RAISE EXCEPTION 'Cannot migrate JudgeAssignment: at least one Work already has more than three assignments';
  END IF;
END $$;

ALTER TABLE "Race"
  ADD COLUMN "reviewResultsPublishedAt" TIMESTAMP(3),
  ADD COLUMN "reviewResultsPublishedByUserId" TEXT;

ALTER TABLE "Registration"
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNote" TEXT;

CREATE TABLE "RaceJudgeMembership" (
  "id" TEXT NOT NULL,
  "raceId" TEXT NOT NULL,
  "judgeUserId" TEXT NOT NULL,
  "selectedByUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RaceJudgeMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JudgeAllocationBatch" (
  "id" TEXT NOT NULL,
  "raceId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "seed" TEXT NOT NULL,
  "algorithmVersion" TEXT NOT NULL,
  "workCount" INTEGER NOT NULL,
  "retainedCount" INTEGER NOT NULL,
  "createdCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JudgeAllocationBatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "JudgeAssignment"
  ADD COLUMN "slot" INTEGER,
  ADD COLUMN "allocationBatchId" TEXT;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "workId" ORDER BY "assignedAt", "id") AS slot
  FROM "JudgeAssignment"
)
UPDATE "JudgeAssignment" AS assignment
SET "slot" = ranked.slot
FROM ranked
WHERE assignment."id" = ranked."id";

ALTER TABLE "JudgeAssignment"
  ALTER COLUMN "slot" SET NOT NULL,
  ADD CONSTRAINT "JudgeAssignment_slot_check" CHECK ("slot" BETWEEN 1 AND 3);

INSERT INTO "RaceJudgeMembership" (
  "id", "raceId", "judgeUserId", "selectedByUserId", "status", "selectedAt", "updatedAt"
)
SELECT
  'legacy_judge_pool_' || md5("raceId" || ':' || "judgeUserId"),
  "raceId",
  "judgeUserId",
  (array_agg("assignedByUserId" ORDER BY "assignedAt", "id"))[1],
  'active',
  MIN("assignedAt"),
  CURRENT_TIMESTAMP
FROM "JudgeAssignment"
GROUP BY "raceId", "judgeUserId"
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "RaceJudgeMembership_raceId_judgeUserId_key" ON "RaceJudgeMembership"("raceId", "judgeUserId");
CREATE INDEX "RaceJudgeMembership_raceId_status_idx" ON "RaceJudgeMembership"("raceId", "status");
CREATE INDEX "RaceJudgeMembership_judgeUserId_idx" ON "RaceJudgeMembership"("judgeUserId");
CREATE INDEX "JudgeAllocationBatch_raceId_createdAt_idx" ON "JudgeAllocationBatch"("raceId", "createdAt");
CREATE UNIQUE INDEX "JudgeAssignment_workId_slot_key" ON "JudgeAssignment"("workId", "slot");
CREATE INDEX "JudgeAssignment_allocationBatchId_idx" ON "JudgeAssignment"("allocationBatchId");

ALTER TABLE "Race" ADD CONSTRAINT "Race_reviewResultsPublishedByUserId_fkey"
  FOREIGN KEY ("reviewResultsPublishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RaceJudgeMembership" ADD CONSTRAINT "RaceJudgeMembership_raceId_fkey"
  FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceJudgeMembership" ADD CONSTRAINT "RaceJudgeMembership_judgeUserId_fkey"
  FOREIGN KEY ("judgeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceJudgeMembership" ADD CONSTRAINT "RaceJudgeMembership_selectedByUserId_fkey"
  FOREIGN KEY ("selectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JudgeAllocationBatch" ADD CONSTRAINT "JudgeAllocationBatch_raceId_fkey"
  FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JudgeAllocationBatch" ADD CONSTRAINT "JudgeAllocationBatch_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_allocationBatchId_fkey"
  FOREIGN KEY ("allocationBatchId") REFERENCES "JudgeAllocationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
