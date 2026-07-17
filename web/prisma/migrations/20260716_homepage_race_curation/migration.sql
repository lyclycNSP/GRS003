CREATE TABLE "HomepageRaceCuration" (
  "raceId" TEXT NOT NULL PRIMARY KEY,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER,
  "updatedByUserId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomepageRaceCuration_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HomepageRaceCuration_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "HomepageRaceCuration_pinned_position_idx" ON "HomepageRaceCuration"("pinned", "position");
CREATE INDEX "HomepageRaceCuration_hidden_idx" ON "HomepageRaceCuration"("hidden");
CREATE INDEX "HomepageRaceCuration_updatedByUserId_idx" ON "HomepageRaceCuration"("updatedByUserId");
