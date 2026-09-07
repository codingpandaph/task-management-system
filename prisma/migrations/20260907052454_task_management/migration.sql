-- CreateEnum
CREATE TYPE "WorkspaceFunction" AS ENUM ('ENGINEERING_PRODUCT', 'MARKETING_CREATIVE', 'SALES_ACCOUNT_MANAGEMENT', 'HR_OPERATIONS', 'FINANCE_LEGAL');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskLinkType" AS ENUM ('BLOCKS', 'BLOCKED_BY', 'RELATES_TO');

-- CreateEnum
CREATE TYPE "TaskActivityType" AS ENUM ('CREATE', 'UPDATE_FIELD', 'COLUMN_CHANGE', 'DELETION', 'RESTORATION');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "function" "WorkspaceFunction" NOT NULL,
    "nextTaskNumber" INTEGER NOT NULL DEFAULT 1,
    "departmentId" UUID NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMembership" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "workspaceId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "milestoneId" UUID,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,

    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBoard" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "TaskBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskColumn" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "managementLocked" BOOLEAN NOT NULL DEFAULT false,
    "boardId" UUID NOT NULL,

    CONSTRAINT "TaskColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "dueDate" TIMESTAMPTZ(3) NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'OPEN',
    "isOvercapacity" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "number" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "estimatedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isManagementApproved" BOOLEAN NOT NULL DEFAULT false,
    "isEscalated" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ(3),
    "lastColumnId" UUID,
    "workspaceId" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "columnId" UUID NOT NULL,
    "milestoneId" UUID,
    "reporterId" UUID NOT NULL,
    "assigneeId" UUID,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefinitionOfDone" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item" TEXT NOT NULL,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "taskId" UUID NOT NULL,

    CONSTRAINT "DefinitionOfDone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskLink" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "TaskLinkType" NOT NULL,
    "sourceTaskId" UUID NOT NULL,
    "targetTaskId" UUID NOT NULL,

    CONSTRAINT "TaskLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskActivityLog" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actionType" "TaskActivityType" NOT NULL,
    "fieldChanged" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "taskId" UUID NOT NULL,
    "actorEmployeeId" UUID NOT NULL,

    CONSTRAINT "TaskActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "body" TEXT NOT NULL,
    "taskId" UUID NOT NULL,
    "authorId" UUID NOT NULL,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_code_key" ON "Workspace"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_departmentId_key" ON "Workspace"("departmentId");

-- CreateIndex
CREATE INDEX "WorkspaceMembership_workspaceId_employeeId_idx" ON "WorkspaceMembership"("workspaceId", "employeeId");

-- CreateIndex
CREATE INDEX "WorkspaceMembership_milestoneId_idx" ON "WorkspaceMembership"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskBoard_workspaceId_name_key" ON "TaskBoard"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TaskColumn_boardId_position_key" ON "TaskColumn"("boardId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TaskColumn_boardId_name_key" ON "TaskColumn"("boardId", "name");

-- CreateIndex
CREATE INDEX "Milestone_workspaceId_status_dueDate_idx" ON "Milestone"("workspaceId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Task_publicKey_key" ON "Task"("publicKey");

-- CreateIndex
CREATE INDEX "Task_assigneeId_isDeleted_idx" ON "Task"("assigneeId", "isDeleted");

-- CreateIndex
CREATE INDEX "Task_workspaceId_columnId_isDeleted_idx" ON "Task"("workspaceId", "columnId", "isDeleted");

-- CreateIndex
CREATE INDEX "Task_milestoneId_idx" ON "Task"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_workspaceId_number_key" ON "Task"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "TaskLink_targetTaskId_type_idx" ON "TaskLink"("targetTaskId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TaskLink_sourceTaskId_targetTaskId_type_key" ON "TaskLink"("sourceTaskId", "targetTaskId", "type");

-- CreateIndex
CREATE INDEX "TaskActivityLog_taskId_createdAt_idx" ON "TaskActivityLog"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBoard" ADD CONSTRAINT "TaskBoard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskColumn" ADD CONSTRAINT "TaskColumn_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "TaskBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "TaskBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "TaskColumn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefinitionOfDone" ADD CONSTRAINT "DefinitionOfDone_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLink" ADD CONSTRAINT "TaskLink_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLink" ADD CONSTRAINT "TaskLink_targetTaskId_fkey" FOREIGN KEY ("targetTaskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_actorEmployeeId_fkey" FOREIGN KEY ("actorEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reviewed task-engine invariants that Prisma cannot express.
ALTER TABLE "Workspace" ADD CONSTRAINT "workspace_task_number_positive" CHECK ("nextTaskNumber" > 0);
ALTER TABLE "Task" ADD CONSTRAINT "task_number_positive" CHECK ("number" > 0);
ALTER TABLE "Task" ADD CONSTRAINT "task_estimate_nonnegative" CHECK ("estimatedHours" >= 0);
ALTER TABLE "Task" ADD CONSTRAINT "task_delete_state_consistent" CHECK (
  ("isDeleted" = true AND "deletedAt" IS NOT NULL) OR
  ("isDeleted" = false AND "deletedAt" IS NULL)
);
ALTER TABLE "TaskLink" ADD CONSTRAINT "task_link_not_self" CHECK ("sourceTaskId" <> "targetTaskId");
CREATE UNIQUE INDEX "WorkspaceMembership_base_unique"
  ON "WorkspaceMembership" ("workspaceId", "employeeId") WHERE "milestoneId" IS NULL;
CREATE UNIQUE INDEX "WorkspaceMembership_milestone_unique"
  ON "WorkspaceMembership" ("workspaceId", "employeeId", "milestoneId") WHERE "milestoneId" IS NOT NULL;
CREATE UNIQUE INDEX "TaskColumn_one_initial_per_board"
  ON "TaskColumn" ("boardId") WHERE "isInitial" = true;

CREATE TRIGGER task_activity_append_only BEFORE UPDATE OR DELETE ON "TaskActivityLog"
  FOR EACH ROW EXECUTE FUNCTION protect_append_only();
