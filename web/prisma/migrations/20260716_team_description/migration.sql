-- Add optional team profile text without changing existing teams or registrations.
ALTER TABLE "Team" ADD COLUMN "description" TEXT;
