-- Race Live domain foundation. Legacy projections remain readable and unversioned.
CREATE TABLE "TrackProfile" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "raceId" TEXT,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackProfileVersion" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "profileJson" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "backgroundAssetRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "TrackProfileVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaceRound" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "trackProfileVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "scheduledStartAt" TIMESTAMP(3) NOT NULL,
    "scheduledEndAt" TIMESTAMP(3) NOT NULL,
    "actualStartedAt" TIMESTAMP(3),
    "actualEndedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RaceRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaceRoundEntry" (
    "id" TEXT NOT NULL,
    "raceRoundId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RaceRoundEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Projection"
ADD COLUMN "schemaVersion" TEXT,
ADD COLUMN "sequence" INTEGER,
ADD COLUMN "generatedAt" TIMESTAMP(3),
ADD COLUMN "sourceWatermark" TEXT,
ADD COLUMN "payloadHash" TEXT;

UPDATE "ScreenState"
SET "mode" = 'live', "fallbackEnabled" = true
WHERE "mode" = 'fallback';

ALTER TABLE "ScreenState"
ADD COLUMN "currentRoundId" TEXT,
ADD COLUMN "stableProjectionId" TEXT,
ADD COLUMN "activeGroupOrder" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "autoRotateEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "rotationIntervalSeconds" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN "rotationEpochAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "rotationPausedAt" TIMESTAMP(3),
ADD COLUMN "controlVersion" INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT "ScreenState_mode_check" CHECK ("mode" IN ('live', 'leaderboard', 'works', 'announcement')),
ADD CONSTRAINT "ScreenState_rotation_interval_check" CHECK ("rotationIntervalSeconds" BETWEEN 5 AND 120),
ADD CONSTRAINT "ScreenState_active_group_check" CHECK ("activeGroupOrder" >= 1);

CREATE TABLE "ScreenControlAuditEvent" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "screenStateId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "payloadJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScreenControlAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrackProfile_trackId_key" ON "TrackProfile"("trackId");
CREATE INDEX "TrackProfile_raceId_idx" ON "TrackProfile"("raceId");
CREATE UNIQUE INDEX "TrackProfileVersion_trackId_version_key" ON "TrackProfileVersion"("trackId", "version");
CREATE INDEX "TrackProfileVersion_status_idx" ON "TrackProfileVersion"("status");
CREATE UNIQUE INDEX "RaceRound_raceId_order_key" ON "RaceRound"("raceId", "order");
CREATE INDEX "RaceRound_trackProfileVersionId_idx" ON "RaceRound"("trackProfileVersionId");
CREATE UNIQUE INDEX "RaceRoundEntry_raceRoundId_registrationId_key" ON "RaceRoundEntry"("raceRoundId", "registrationId");
CREATE UNIQUE INDEX "RaceRoundEntry_raceRoundId_displayOrder_key" ON "RaceRoundEntry"("raceRoundId", "displayOrder");
CREATE INDEX "RaceRoundEntry_registrationId_idx" ON "RaceRoundEntry"("registrationId");
CREATE UNIQUE INDEX "Projection_raceId_type_sequence_key" ON "Projection"("raceId", "type", "sequence");
CREATE INDEX "ScreenState_currentRoundId_idx" ON "ScreenState"("currentRoundId");
CREATE INDEX "ScreenState_stableProjectionId_idx" ON "ScreenState"("stableProjectionId");
CREATE INDEX "ScreenControlAuditEvent_raceId_createdAt_idx" ON "ScreenControlAuditEvent"("raceId", "createdAt");
CREATE INDEX "ScreenControlAuditEvent_actorUserId_idx" ON "ScreenControlAuditEvent"("actorUserId");

ALTER TABLE "TrackProfile" ADD CONSTRAINT "TrackProfile_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackProfileVersion" ADD CONSTRAINT "TrackProfileVersion_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "TrackProfile"("trackId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceRound" ADD CONSTRAINT "RaceRound_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceRound" ADD CONSTRAINT "RaceRound_trackProfileVersionId_fkey" FOREIGN KEY ("trackProfileVersionId") REFERENCES "TrackProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RaceRoundEntry" ADD CONSTRAINT "RaceRoundEntry_raceRoundId_fkey" FOREIGN KEY ("raceRoundId") REFERENCES "RaceRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceRoundEntry" ADD CONSTRAINT "RaceRoundEntry_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreenState" ADD CONSTRAINT "ScreenState_currentRoundId_fkey" FOREIGN KEY ("currentRoundId") REFERENCES "RaceRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScreenState" ADD CONSTRAINT "ScreenState_stableProjectionId_fkey" FOREIGN KEY ("stableProjectionId") REFERENCES "Projection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScreenControlAuditEvent" ADD CONSTRAINT "ScreenControlAuditEvent_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreenControlAuditEvent" ADD CONSTRAINT "ScreenControlAuditEvent_screenStateId_fkey" FOREIGN KEY ("screenStateId") REFERENCES "ScreenState"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScreenControlAuditEvent" ADD CONSTRAINT "ScreenControlAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
