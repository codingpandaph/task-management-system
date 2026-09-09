CREATE TYPE "TaskManagementType" AS ENUM ('KANBAN', 'SCRUM', 'LIST');
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

ALTER TABLE "Department"
  ADD COLUMN "taskManagementTypes" "TaskManagementType"[] NOT NULL DEFAULT ARRAY['KANBAN']::"TaskManagementType"[],
  ADD COLUMN "kanbanWipLimit" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "Department"
  ADD CONSTRAINT "Department_kanbanWipLimit_check" CHECK ("kanbanWipLimit" BETWEEN 1 AND 50),
  ADD CONSTRAINT "Department_taskManagementTypes_check" CHECK (cardinality("taskManagementTypes") > 0);

UPDATE "Department" SET "taskManagementTypes" = ARRAY['LIST']::"TaskManagementType"[] WHERE "kind" = 'HR';
UPDATE "Department" SET "taskManagementTypes" = ARRAY['KANBAN', 'SCRUM']::"TaskManagementType"[]
WHERE "code" IN ('ACC', 'MKT');

ALTER TABLE "TaskBoard" ADD COLUMN "creatorId" UUID;
UPDATE "TaskBoard" board
SET "creatorId" = COALESCE(
  (SELECT employee.id FROM "Employee" employee
   JOIN "Workspace" workspace ON workspace."departmentId" = employee."departmentId"
   WHERE workspace.id = board."workspaceId" AND employee.position = 'ACCOUNT_DIRECTOR'
   ORDER BY employee."createdAt" LIMIT 1),
  (SELECT id FROM "Employee" WHERE position = 'SENIOR_DIRECTOR' ORDER BY "createdAt" LIMIT 1)
);

ALTER TABLE "TaskBoard"
  ALTER COLUMN "kind" TYPE "TaskManagementType" USING (UPPER("kind")::"TaskManagementType"),
  ALTER COLUMN "kind" SET DEFAULT 'KANBAN',
  ADD COLUMN "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  ALTER COLUMN "creatorId" SET NOT NULL,
  ADD CONSTRAINT "TaskBoard_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Employee"("id") ON DELETE RESTRICT;

CREATE TABLE "BoardCollaborator" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "boardId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  CONSTRAINT "BoardCollaborator_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BoardCollaborator_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "TaskBoard"("id") ON DELETE RESTRICT,
  CONSTRAINT "BoardCollaborator_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "BoardCollaborator_boardId_employeeId_key" ON "BoardCollaborator"("boardId", "employeeId");
CREATE INDEX "BoardCollaborator_employeeId_idx" ON "BoardCollaborator"("employeeId");

CREATE TABLE "Sprint" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "name" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
  "boardId" UUID NOT NULL,
  CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Sprint_dates_check" CHECK ("endDate" > "startDate"),
  CONSTRAINT "Sprint_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "TaskBoard"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "Sprint_boardId_name_key" ON "Sprint"("boardId", "name");
CREATE INDEX "Sprint_boardId_status_idx" ON "Sprint"("boardId", "status");
CREATE UNIQUE INDEX "Sprint_one_active_per_board" ON "Sprint"("boardId") WHERE "status" = 'ACTIVE';

ALTER TABLE "Task"
  ADD COLUMN "sprintId" UUID,
  ADD COLUMN "dueDate" DATE,
  ADD CONSTRAINT "Task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL;
CREATE INDEX "Task_sprintId_idx" ON "Task"("sprintId");
