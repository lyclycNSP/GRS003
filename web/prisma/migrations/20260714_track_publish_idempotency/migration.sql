ALTER TABLE "TrackProfileVersion"
ADD COLUMN "publishRequestId" TEXT,
ADD COLUMN "profileHash" TEXT,
ADD COLUMN "backgroundHash" TEXT,
ADD COLUMN "validationReportJson" TEXT,
ADD COLUMN "publishedByUserId" TEXT;

CREATE UNIQUE INDEX "TrackProfileVersion_publishRequestId_key" ON "TrackProfileVersion"("publishRequestId");
CREATE INDEX "TrackProfileVersion_publishedByUserId_idx" ON "TrackProfileVersion"("publishedByUserId");
ALTER TABLE "TrackProfileVersion" ADD CONSTRAINT "TrackProfileVersion_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
