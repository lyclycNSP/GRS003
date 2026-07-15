ALTER TABLE "ReviewFlag"
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "resolvedByUserId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "ReviewFlag"
SET "updatedAt" = COALESCE("resolvedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "ReviewFlag"
ALTER COLUMN "updatedAt" SET NOT NULL;
