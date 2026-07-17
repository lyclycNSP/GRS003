ALTER TABLE "User"
  ADD COLUMN "githubUserId" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "verifiedEmailsJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "timeZone" TEXT,
  ADD COLUMN "locale" TEXT,
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyVersion" TEXT,
  ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "preferredRole" TEXT;

ALTER TABLE "AuthSession" ADD COLUMN "activeRole" TEXT;

CREATE UNIQUE INDEX "User_githubUserId_key" ON "User"("githubUserId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "UserRole" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "source" TEXT NOT NULL,
  "grantedByUserId" TEXT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");
CREATE INDEX "UserRole_role_status_idx" ON "UserRole"("role", "status");

CREATE TABLE "RiderProfile" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "headline" TEXT, "skillsJson" TEXT NOT NULL DEFAULT '[]', "bio" TEXT,
  "countryCode" TEXT, "city" TEXT, "organization" TEXT, "websiteUrl" TEXT, "socialLinksJson" TEXT NOT NULL DEFAULT '{}', "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiderProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RiderProfile_userId_key" ON "RiderProfile"("userId");

CREATE TABLE "JudgeProfile" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "organization" TEXT, "title" TEXT, "expertiseJson" TEXT NOT NULL DEFAULT '[]', "reviewBio" TEXT,
  "yearsExperience" INTEGER, "credentialUrl" TEXT, "conflictConfirmedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JudgeProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JudgeProfile_userId_key" ON "JudgeProfile"("userId");

CREATE TABLE "OrganizerProfile" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "organizationName" TEXT, "position" TEXT, "eventCategoriesJson" TEXT NOT NULL DEFAULT '[]',
  "organizerBio" TEXT, "organizationWebsite" TEXT, "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizerProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizerProfile_userId_key" ON "OrganizerProfile"("userId");

CREATE TABLE "RoleApplication" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "requestedRole" TEXT NOT NULL, "source" TEXT NOT NULL, "status" TEXT NOT NULL,
  "reviewerId" TEXT, "reviewNote" TEXT, "submittedAt" TIMESTAMP(3), "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoleApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RoleApplication_userId_requestedRole_status_idx" ON "RoleApplication"("userId", "requestedRole", "status");
CREATE INDEX "RoleApplication_status_requestedRole_idx" ON "RoleApplication"("status", "requestedRole");
CREATE UNIQUE INDEX "RoleApplication_userId_requestedRole_open_key" ON "RoleApplication"("userId", "requestedRole")
WHERE "status" IN ('draft', 'pending', 'rejected');

INSERT INTO "UserRole" ("id", "userId", "role", "status", "source", "grantedAt", "createdAt", "updatedAt")
SELECT 'role_migration_' || md5(u."id" || ':' || role_value), u."id", role_value, 'active', 'migration', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN u."rolesJson" IS NULL OR btrim(u."rolesJson") = '' THEN '[]'::jsonb ELSE u."rolesJson"::jsonb END
) AS role_rows(role_value)
WHERE role_value IN ('rider', 'judge', 'organizer', 'admin')
ON CONFLICT ("userId", "role") DO NOTHING;

UPDATE "User"
SET "preferredRole" = CASE
  WHEN "rolesJson" IS NULL OR btrim("rolesJson") = '' THEN NULL
  ELSE "rolesJson"::jsonb ->> 0
END;

UPDATE "AuthSession" AS session
SET "activeRole" = users."preferredRole"
FROM "User" AS users
WHERE session."userId" = users."id" AND users."preferredRole" IS NOT NULL;

ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiderProfile" ADD CONSTRAINT "RiderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JudgeProfile" ADD CONSTRAINT "JudgeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizerProfile" ADD CONSTRAINT "OrganizerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleApplication" ADD CONSTRAINT "RoleApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleApplication" ADD CONSTRAINT "RoleApplication_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" DROP COLUMN "rolesJson";
