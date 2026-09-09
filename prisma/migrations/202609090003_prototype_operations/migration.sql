ALTER TYPE "TaskActivityType" ADD VALUE 'ATTACHMENT';

ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMPTZ(3);
UPDATE "Task" SET "completedAt" = "updatedAt"
WHERE "columnId" IN (SELECT "id" FROM "TaskColumn" WHERE "isDone" = TRUE);
CREATE INDEX "Task_workspaceId_completedAt_idx" ON "Task"("workspaceId", "completedAt");

CREATE TABLE "SavedTaskView" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "employeeId" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  CONSTRAINT "SavedTaskView_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SavedTaskView_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT,
  CONSTRAINT "SavedTaskView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "SavedTaskView_employeeId_workspaceId_name_key"
  ON "SavedTaskView"("employeeId", "workspaceId", "name");
CREATE INDEX "SavedTaskView_employeeId_workspaceId_idx" ON "SavedTaskView"("employeeId", "workspaceId");

CREATE TABLE "TaskAttachment" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "taskId" UUID NOT NULL,
  CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT,
  CONSTRAINT "TaskAttachment_sizeBytes_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 25000000),
  CONSTRAINT "TaskAttachment_https_check" CHECK ("url" LIKE 'https://%')
);
CREATE INDEX "TaskAttachment_taskId_createdAt_idx" ON "TaskAttachment"("taskId", "createdAt");

CREATE TABLE "TaskMention" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "taskId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "commentId" UUID NOT NULL,
  CONSTRAINT "TaskMention_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskMention_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT,
  CONSTRAINT "TaskMention_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT,
  CONSTRAINT "TaskMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "TaskComment"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "TaskMention_commentId_employeeId_key" ON "TaskMention"("commentId", "employeeId");
CREATE INDEX "TaskMention_employeeId_createdAt_idx" ON "TaskMention"("employeeId", "createdAt");
