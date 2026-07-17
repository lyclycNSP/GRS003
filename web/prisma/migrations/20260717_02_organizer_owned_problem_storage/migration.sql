ALTER TABLE "RaceProblemVersion" ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'platform_legacy';
ALTER TABLE "RaceProblemVersion" ADD COLUMN "storageOwnerUserId" TEXT;

CREATE INDEX "RaceProblemVersion_storageProvider_idx"
ON "RaceProblemVersion"("storageProvider");
