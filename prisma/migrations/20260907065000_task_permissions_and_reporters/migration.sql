ALTER TABLE "WorkspaceMembership"
ADD COLUMN "canCreateTasks" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canCreateBoards" BOOLEAN NOT NULL DEFAULT false;

-- Preserve the existing prototype behavior for established department memberships.
UPDATE "WorkspaceMembership"
SET "canCreateTasks" = true
WHERE "milestoneId" IS NULL;
